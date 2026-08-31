-- Pedido atômico e idempotente — FASE A, só aditiva.
-- (aplicada no projeto via MCP em 31/08/2026, em duas migrações:
--  `pedido_atomico_e_idempotente` e `place_order_retorna_vessel`;
--  este arquivo é a documentação consolidada do estado final)
--
-- O placeOrder do app fazia quatro escritas soltas: insert do pedido,
-- insert dos itens, delete compensatório se os itens falhassem (com o
-- resultado ignorado) e o crédito por RPC (com o erro ignorado — crédito
-- que falhava virava depósito CHEIO cobrado em silêncio). Nada impedia
-- um reenvio de criar o pedido duas vezes: a proteção era o disabled do
-- botão. E a RLS de orders deixa qualquer logado inserir linha com
-- valores arbitrários via PostgREST — a validação toda morava em TS.
--
-- Esta fase cria o caminho novo SEM tirar o velho: o app já deployado
-- continua inserindo direto e chamando confirm_stripe_deposit(2 args).
-- A FASE B (migração separada, depois do E2E) derruba as policies de
-- escrita direta, a confirm antiga e o braço legado dos segredos.

-- ── Idempotência e amarração com o Stripe ─────────────────────────────
-- A chave nasce no navegador, uma por TENTATIVA de compra: reenviar a
-- mesma tentativa (retry de rede, clique duplo) devolve o MESMO pedido;
-- carrinho editado gera chave nova e pedido novo.
alter table public.orders add column if not exists idempotency_key uuid;
alter table public.orders add column if not exists stripe_session_id text;

create unique index if not exists orders_idem_uidx
  on public.orders (user_id, idempotency_key) where idempotency_key is not null;
create unique index if not exists orders_stripe_session_uidx
  on public.orders (stripe_session_id) where stripe_session_id is not null;

-- Código sequencial: MS-1000..9999 aleatório eram 9000 valores com 5
-- tentativas — colisão vira falha de compra com volume. Sequência
-- remove a falha em vez de raréa-la. (0 pedidos em produção hoje.)
create sequence if not exists public.order_code_seq start 1201;

-- Livro de eventos do Stripe: reivindicação insert-first, a mesma
-- disciplina de order_emails. RLS ligada e SEM policies: só as
-- functions (definer) tocam — padrão admin_emails.
create table if not exists public.stripe_events (
  id          text primary key,
  type        text not null,
  order_id    uuid,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

-- Segredo PRÓPRIO do caminho webhook→banco. Antes o signing secret do
-- Stripe estava gravado em app_secrets e autorizava confirm_stripe_deposit
-- para anon via PostgREST: quem tivesse a string marcava pedido como pago,
-- e rotacionar o secret no Stripe quebrava a confirmação em silêncio.
insert into public.app_secrets (key, value)
values ('stripe_confirm_secret', gen_random_uuid()::text)
on conflict (key) do nothing;

-- ── place_order: o pedido inteiro numa transação ──────────────────────
-- SECURITY DEFINER no padrão da casa (apply_order_credit, confirm_*):
-- auth.uid() é a identidade, e a function revalida TUDO que guarda
-- dinheiro — preço do banco, catálogo vivo, mínimo do porto, janela da
-- escala, E.164 — porque com grant a authenticated ela é API pública de
-- quem está logado, não um detalhe interno do app.
create or replace function public.place_order(
  p_key       uuid,
  p_ship      uuid default null,
  p_apply_credit boolean default false,
  p_contact_name text default null,
  p_contact_whatsapp text default null,
  p_note      text default null,
  p_items     jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  prof   public.profiles%rowtype;
  s      public.ships%rowtype;
  v_port record;
  v_dup  record;
  v_chk  record;
  v_order public.orders%rowtype;
  v_ship uuid;
  v_vessel text;
  v_wa   text;
  v_subtotal int;
  v_deposit  int;
  v_balance  int;
  v_applied  numeric := 0;
  v_status   text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'auth');
  end if;
  if p_key is null then
    return jsonb_build_object('ok', false, 'error', 'bad_key');
  end if;

  -- REENVIO da mesma tentativa: devolve o pedido que já existe, sem
  -- tocar em nada. É o contrato da idempotência.
  select id, code, status, deposit_usd, balance_usd, credit_applied_usd, vessel_name
    into v_dup
    from public.orders
   where user_id = v_user and idempotency_key = p_key;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true,
      'id', v_dup.id, 'code', v_dup.code, 'status', v_dup.status,
      'deposit_usd', v_dup.deposit_usd, 'balance_usd', v_dup.balance_usd,
      'credit_applied_usd', v_dup.credit_applied_usd, 'vessel_name', v_dup.vessel_name);
  end if;

  -- Mesma régua E.164 do app; o WhatsApp é o único canal que alcança
  -- quem já embarcou.
  v_wa := regexp_replace(coalesce(p_contact_whatsapp, ''), '[^0-9+]', '', 'g');
  if v_wa !~ '^\+[0-9]{8,15}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_whatsapp');
  end if;

  -- Forma dos itens antes de qualquer conta.
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty_kit');
  end if;
  if jsonb_array_length(p_items) > 60
     or exists (
       select 1 from jsonb_to_recordset(p_items) as x(id uuid, qty int)
       where x.id is null or x.qty is null or x.qty < 1 or x.qty > 99
     ) then
    return jsonb_build_object('ok', false, 'error', 'bad_items');
  end if;

  select * into prof from public.profiles where id = v_user;

  -- Navio do PERFIL, com o do parâmetro de retaguarda — igual ao app.
  v_ship := coalesce(prof.ship_id, p_ship);
  if v_ship is not null then
    select * into s from public.ships where id = v_ship;
    if s.id is null or s.eta is null then
      -- Falha FECHADO: sem prova de janela aberta não há pedido.
      return jsonb_build_object('ok', false, 'error', 'no_window');
    end if;
    -- A régua de uma linha — a MESMA conta de lib/callstate.ts,
    -- rotate_ship_calls e credit_skipped_calls. Não reimplementa a
    -- máquina de estados; só o invariante que guarda dinheiro.
    if coalesce(s.ata, s.eta) + interval '48 hours' <= now() then
      return jsonb_build_object('ok', false, 'error', 'sailed', 'ship', s.name);
    end if;
    if s.eta - make_interval(hours => coalesce(s.cutoff_hours, 24)) <= now() then
      return jsonb_build_object('ok', false, 'error', 'window_closed', 'ship', s.name,
        'closed_at', s.eta - make_interval(hours => coalesce(s.cutoff_hours, 24)));
    end if;
  end if;
  v_vessel := coalesce(prof.vessel_name, s.name);

  -- Uma passada pelo catálogo: variante viva, estoque anunciado e o
  -- subtotal — PREÇO SEMPRE DO BANCO, nunca do cliente.
  select
    count(*) filter (where v.id is null or v.active is not true or p2.active is not true) as mortos,
    min(p2.name) filter (where v.id is not null and (v.active is not true or p2.active is not true)) as nome_morto,
    count(*) filter (where v.track_stock and v.stock_qty < k.qty) as sem_estoque,
    min(p2.name) filter (where v.track_stock and v.stock_qty < k.qty) as nome_sem_estoque,
    min(v.stock_qty) filter (where v.track_stock and v.stock_qty < k.qty) as restante,
    coalesce(sum(v.price_cents * k.qty) filter (where v.id is not null), 0)::int as subtotal
    into v_chk
    from (select x.id, sum(x.qty)::int as qty
            from jsonb_to_recordset(p_items) as x(id uuid, qty int)
           group by x.id) k
    left join public.product_variants v on v.id = k.id
    left join public.products p2 on p2.id = v.product_id;

  if v_chk.mortos > 0 then
    return jsonb_build_object('ok', false, 'error', 'unavailable', 'name', v_chk.nome_morto);
  end if;
  if v_chk.sem_estoque > 0 then
    return jsonb_build_object('ok', false, 'error', 'out_of_stock',
      'name', v_chk.nome_sem_estoque, 'left', v_chk.restante);
  end if;
  v_subtotal := v_chk.subtotal;
  if v_subtotal <= 0 then
    return jsonb_build_object('ok', false, 'error', 'empty_kit');
  end if;

  -- Porto do perfil, Santos de retaguarda; o mínimo é conferido AQUI.
  if prof.port_id is not null then
    select id, name, min_order_cents into v_port from public.ports where id = prof.port_id;
  end if;
  if v_port.id is null then
    select id, name, min_order_cents into v_port from public.ports where slug = 'santos';
  end if;
  if coalesce(v_port.min_order_cents, 0) > 0 and v_subtotal < v_port.min_order_cents then
    return jsonb_build_object('ok', false, 'error', 'min_order',
      'port', v_port.name, 'minimum_cents', v_port.min_order_cents,
      'missing_cents', v_port.min_order_cents - v_subtotal);
  end if;

  -- Mesma conta de lib/money.ts (depositCents): 30% arredondado ao
  -- centavo. Divergir um centavo aqui quebraria a paridade com a UI.
  v_deposit := round(v_subtotal * 30 / 100.0)::int;
  v_balance := v_subtotal - v_deposit;

  -- O pedido. on conflict cobre a corrida de duas chamadas simultâneas
  -- com a MESMA chave: quem perder busca o pedido do vencedor.
  insert into public.orders (
    code, user_id, ship_id, port_id, status, idempotency_key,
    subtotal_usd, deposit_usd, balance_usd,
    subtotal_cents, deposit_cents, balance_cents,
    vessel_name, vessel_imo, vessel_flag, contact_rank,
    contact_name, contact_whatsapp, note
  ) values (
    'MS-' || nextval('public.order_code_seq'),
    v_user, v_ship, v_port.id, 'awaiting_deposit', p_key,
    round(v_subtotal / 100.0, 2), round(v_deposit / 100.0, 2), round(v_balance / 100.0, 2),
    v_subtotal, v_deposit, v_balance,
    v_vessel, prof.vessel_imo, prof.vessel_flag, prof.rank_slug,
    left(coalesce(nullif(trim(p_contact_name), ''), prof.full_name), 120),
    v_wa,
    left(nullif(trim(p_note), ''), 500)
  )
  on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing
  returning * into v_order;

  if v_order.id is null then
    select id, code, status, deposit_usd, balance_usd, credit_applied_usd, vessel_name
      into v_dup
      from public.orders
     where user_id = v_user and idempotency_key = p_key;
    return jsonb_build_object('ok', true, 'duplicate', true,
      'id', v_dup.id, 'code', v_dup.code, 'status', v_dup.status,
      'deposit_usd', v_dup.deposit_usd, 'balance_usd', v_dup.balance_usd,
      'credit_applied_usd', v_dup.credit_applied_usd, 'vessel_name', v_dup.vessel_name);
  end if;

  -- Itens na MESMA transação: falhou aqui, o pedido não nasce pela
  -- metade — some junto o delete compensatório com resultado ignorado.
  insert into public.order_items (
    order_id, product_id, variant_id, sku, name, emoji,
    image_path, unit_price_usd, unit_price_cents, qty
  )
  select v_order.id, p2.id, v.id, v.sku,
         p2.name || case when nullif(v.option_label, '') is not null
                         then ' — ' || v.option_label else '' end,
         p2.emoji,
         coalesce(v.image_path, p2.primary_image_path),
         round(v.price_cents / 100.0, 2), v.price_cents, k.qty
    from (select x.id, sum(x.qty)::int as qty
            from jsonb_to_recordset(p_items) as x(id uuid, qty int)
           group by x.id) k
    join public.product_variants v on v.id = k.id
    join public.products p2 on p2.id = v.product_id;

  -- Crédito Captain DENTRO da transação: se a RPC falhar, tudo desfaz —
  -- nunca mais depósito cheio cobrado em silêncio. (Ela guarda
  -- user_id = auth.uid() e é idempotente por dentro.)
  if p_apply_credit then
    v_applied := public.apply_order_credit(v_order.id);
  end if;

  select status into v_status from public.orders where id = v_order.id;

  return jsonb_build_object('ok', true, 'duplicate', false,
    'id', v_order.id, 'code', v_order.code, 'status', v_status,
    'deposit_usd', v_order.deposit_usd, 'balance_usd', v_order.balance_usd,
    'credit_applied_usd', v_applied, 'vessel_name', v_vessel);
end;
$$;

revoke all on function public.place_order(uuid, uuid, boolean, text, text, text, jsonb) from public, anon;
grant execute on function public.place_order(uuid, uuid, boolean, text, text, text, jsonb) to authenticated;

-- ── Amarrar a session do Stripe ao pedido ─────────────────────────────
-- Cliente não tem policy de UPDATE em orders (e não deve ter): a
-- gravação do id da session passa por aqui, presa ao dono e ao status.
create or replace function public.set_order_stripe_session(p_order uuid, p_session text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or nullif(trim(p_session), '') is null then
    return false;
  end if;
  update public.orders
     set stripe_session_id = p_session
   where id = p_order and user_id = auth.uid() and status = 'awaiting_deposit';
  return found;
end;
$$;
revoke all on function public.set_order_stripe_session(uuid, text) from public, anon;
grant execute on function public.set_order_stripe_session(uuid, text) to authenticated;

-- ── confirm_stripe_deposit v2: evento reivindicado + OUTCOME ──────────
-- Overload de 4 argumentos: a de 2 continua existindo para o app já
-- deployado, e cai na FASE B. O retorno vira um outcome porque o
-- webhook precisa distinguir o no-op legítimo (já pago/creditado) da
-- falha real — com boolean, "não gravou um depósito pago" respondia
-- 200 e o Stripe nunca reentregava.
--
-- Durante a transição aceita o segredo novo E o signing secret antigo:
-- o deploy do app não pode depender de env nova já existir na Vercel.
create or replace function public.confirm_stripe_deposit(
  p_order uuid, p_secret text, p_event text, p_session text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is null or length(p_secret) < 10 or not exists (
    select 1 from public.app_secrets s
     where s.key in ('stripe_confirm_secret', 'stripe_webhook_secret')
       and s.value = p_secret
  ) then
    return 'unauthorized';
  end if;
  if nullif(trim(p_event), '') is null then
    return 'unauthorized';
  end if;

  -- Reivindica o EVENTO primeiro (padrão claim_order_email). Claim e
  -- update moram na mesma transação: falha depois do claim desfaz o
  -- claim junto, e a reentrega do Stripe recomeça do zero.
  insert into public.stripe_events (id, type, order_id)
  values (p_event, 'checkout.session', p_order)
  on conflict (id) do nothing;
  if not found then
    return 'duplicate_event';
  end if;

  update public.orders
     set status = 'deposit_paid',
         stripe_session_id = coalesce(p_session, stripe_session_id)
   where id = p_order and status = 'awaiting_deposit';
  if found then
    return 'confirmed';
  end if;

  return case when exists (select 1 from public.orders where id = p_order)
              then 'already_paid'
              else 'no_order' end;
end;
$$;
revoke all on function public.confirm_stripe_deposit(uuid, text, text, text) from public;
grant execute on function public.confirm_stripe_deposit(uuid, text, text, text) to anon, authenticated;

-- ── E-mails: o segredo novo entra como porta aceita ───────────────────
-- (o braço 'stripe_webhook_secret' sai na FASE B; o do cron fica.
--  Corpos completos idênticos aos aplicados — só a verificação de
--  segredo mudou para aceitar as chaves em conjunto.)
create or replace function public.claim_order_email(p_order uuid, p_kind text, p_secret text default null::text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed boolean;
  o record;
  v_items jsonb;
begin
  if p_kind not in ('deposit_paid', 'at_gangway', 'delivered', 'credited') then
    return jsonb_build_object('claimed', false, 'reason', 'bad_kind');
  end if;

  -- As portas: admin logado (painel), o segredo do caminho Stripe→banco
  -- (novo: stripe_confirm_secret; o signing secret segue aceito só até
  -- a fase B), e o segredo do cron. Segredo conferido contra
  -- app_secrets, com piso de tamanho.
  if not (
    public.is_admin()
    or (length(coalesce(p_secret, '')) >= 10 and exists (
      select 1 from public.app_secrets s
       where s.key in ('stripe_confirm_secret', 'stripe_webhook_secret', 'cron_secret')
         and s.value = p_secret
    ))
  ) then
    return jsonb_build_object('claimed', false, 'reason', 'unauthorized');
  end if;

  select o2.*,
         s.name as ship_name, s.berth as ship_berth, s.eta as ship_eta,
         coalesce(nullif(p.email, ''), u.email) as to_email,
         coalesce(nullif(o2.contact_name, ''), nullif(p.full_name, ''), 'sailor') as to_name
    into o
  from public.orders o2
  left join public.ships s     on s.id = o2.ship_id
  left join public.profiles p  on p.id = o2.user_id
  left join auth.users u       on u.id = o2.user_id
  where o2.id = p_order;

  if o is null then
    return jsonb_build_object('claimed', false, 'reason', 'no_order');
  end if;
  if o.to_email is null then
    return jsonb_build_object('claimed', false, 'reason', 'no_recipient');
  end if;

  insert into public.order_emails (order_id, kind, recipient)
  values (p_order, p_kind, o.to_email)
  on conflict (order_id, kind) do nothing
  returning true into v_claimed;

  if not coalesce(v_claimed, false) then
    return jsonb_build_object('claimed', false, 'reason', 'already_sent');
  end if;

  select coalesce(
           jsonb_agg(jsonb_build_object(
             'name', i.name, 'emoji', i.emoji,
             'qty', i.qty, 'unit_usd', i.unit_price_usd
           ) order by i.name),
           '[]'::jsonb)
    into v_items
  from public.order_items i
  where i.order_id = p_order;

  return jsonb_build_object(
    'claimed', true,
    'kind', p_kind,
    'to_email', o.to_email,
    'to_name', o.to_name,
    'code', o.code,
    'status', o.status,
    'subtotal_usd', o.subtotal_usd,
    'deposit_usd', o.deposit_usd,
    'balance_usd', o.balance_usd,
    'credit_applied_usd', o.credit_applied_usd,
    'ship_name', o.ship_name,
    'ship_berth', o.ship_berth,
    'ship_eta', o.ship_eta,
    'has_photo', (o.delivery_photo_path is not null),
    'items', v_items
  );
end;
$$;

create or replace function public.release_order_email(p_order uuid, p_kind text, p_secret text default null::text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.is_admin()
    or (length(coalesce(p_secret, '')) >= 10 and exists (
      select 1 from public.app_secrets s
       where s.key in ('stripe_confirm_secret', 'stripe_webhook_secret')
         and s.value = p_secret
    ))
  ) then
    return false;
  end if;

  delete from public.order_emails
  where order_id = p_order and kind = p_kind;
  return found;
end;
$$;
