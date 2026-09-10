-- Três consertos que saíram da mesma pergunta — "e os navios, é isso mesmo?"
--
-- 1. ESCONDER NÃO SEGURAVA. rotate_ship_calls publica, de hora em hora,
--    tudo que tem ETA a menos de 14 dias, e não distinguia "ainda não
--    publicado" de "escondido pela equipe": uma escala escondida à mão
--    voltava à loja na rodada seguinte, em até uma hora. `hidden_at` é a
--    marca — Esconder grava, Publicar limpa, a rotação respeita.
--
-- 2. O CRÉDITO DO DESVIO NASCIA EM DOIS LUGARES, E EM NENHUM DIREITO.
--    O cron creditava pedido em separação e na escada — mercadoria já
--    comprada, e o dinheiro voltando junto — e mudava o status sem gravar
--    de onde veio (previous_status e status_changed_at intocados), o que
--    deixava o painel sem saber o que tinha sido comprado. E o botão
--    "Creditar" do painel mudava o status e NÃO lançava crédito nenhum: a
--    tela dizia "viram crédito na conta do cliente" e o razão continuava
--    igual. Agora o lançamento é um GATILHO no próprio status: virou
--    'credited', nasce o crédito — pelo cron ou pela mão, uma vez só (a
--    idempotência vem do "não existe crédito de desvio para este pedido").
--    O cron credita SÓ depósito pago. Em separação e na escada ele apenas
--    aponta (devolve como 'sobras') e a equipe decide na tela de não
--    entregues: creditar, ou entregar na próxima escala do cliente.
--
-- 3. MERCADORIA COMPRADA PARA NAVIO QUE NÃO VEIO precisa de um lugar para
--    viver até ser entregue: leftover_note (o plano — para quem, onde,
--    quando) e leftover_resolved_at (entregue em outro pedido,
--    reaproveitada ou baixada). Duas colunas, nenhuma tabela nova.

-- ---------------------------------------------------------------- 1
alter table public.ships add column if not exists hidden_at timestamptz;
comment on column public.ships.hidden_at is
  'Escondida pela equipe. A rotação não republica enquanto estiver marcada; Publicar limpa.';

create or replace function public.rotate_ship_calls(p_secret text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_promovidas int;
  v_aposentadas int;
  v_ativas int;
  v_abertas int;
  v_proxima text;
begin
  if not exists (
    select 1 from public.app_secrets s
    where s.key = 'cron_secret' and s.value = p_secret and length(p_secret) >= 10
  ) then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  -- Entra: ainda não aconteceu, dentro do horizonte, e NINGUÉM a escondeu.
  with promove as (
    update public.ships
       set active = true
     where not active
       and hidden_at is null
       and eta > now()
       and eta < now() + interval '14 days'
    returning 1
  )
  select count(*)::int into v_promovidas from promove;

  with aposenta as (
    update public.ships
       set active = false
     where active
       and coalesce(ata, eta) < now() - interval '48 hours'
    returning 1
  )
  select count(*)::int into v_aposentadas from aposenta;

  select
    count(*) filter (where active),
    count(*) filter (
      where active
        and eta - make_interval(hours => coalesce(cutoff_hours, 24)) > now()
    )
    into v_ativas, v_abertas
  from public.ships;

  select to_char(min(s.eta) at time zone 'America/Sao_Paulo', 'DD Mon HH24:MI')
    into v_proxima
  from public.ships s
  where s.active
    and s.eta - make_interval(hours => coalesce(s.cutoff_hours, 24)) > now();

  return jsonb_build_object(
    'ok', true,
    'promovidas', v_promovidas,
    'aposentadas', v_aposentadas,
    'ativas', v_ativas,
    'janelas_abertas', v_abertas,
    'proxima_janela', v_proxima
  );
end;
$$;

-- ---------------------------------------------------------------- 2
-- O crédito nasce do status, não de quem mudou o status. Mesmo desenho
-- do gatilho de estoque: SECURITY DEFINER sem EXECUTE para ninguém — só
-- o gatilho o chama.
create or replace function public.order_credit_on_status_trg()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ship text;
begin
  if new.status = 'credited'
     and old.status is distinct from 'credited'
     and not exists (
       select 1 from public.credits c
       where c.order_id = new.id and c.kind = 'deviation'
     ) then
    select s.name into v_ship from public.ships s where s.id = new.ship_id;
    -- O DEPÓSITO INTEIRO, como sempre foi: se parte dele veio de crédito
    -- anterior, essa parte também era valor da pessoa.
    insert into public.credits (user_id, order_id, amount_usd, kind, note)
    values (
      new.user_id, new.id, new.deposit_usd, 'deviation',
      'Deposit held as credit — ' || coalesce(v_ship, new.vessel_name, 'your vessel') || ' skipped the call'
    );
  end if;
  return new;
end;
$$;
revoke execute on function public.order_credit_on_status_trg() from anon, authenticated, public;

drop trigger if exists order_credit_on_status on public.orders;
create trigger order_credit_on_status after update of status on public.orders
  for each row execute function public.order_credit_on_status_trg();

create or replace function public.credit_skipped_calls(p_secret text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_creditados jsonb;
  v_cancelados int;
  v_sobras jsonb;
begin
  if not exists (
    select 1 from public.app_secrets s
    where s.key = 'cron_secret' and s.value = p_secret and length(p_secret) >= 10
  ) then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  -- Só depósito pago: nada foi comprado, então não há o que decidir —
  -- é a promessa do checkout, cumprida à letra. A transição fica
  -- gravada como o painel grava (previous_status + status_changed_at);
  -- o crédito em si nasce do gatilho order_credit_on_status.
  -- Idempotente porque o filtro é o status: creditou, saiu do alvo.
  with alvo as (
    select o.id, o.code, o.status as de, o.deposit_usd, s.name as ship
    from public.orders o
    join public.ships s on s.id = o.ship_id
    where o.status = 'deposit_paid'
      and coalesce(s.ata, s.eta) < now() - interval '48 hours'
  ), marca as (
    update public.orders o
       set status = 'credited',
           previous_status = a.de,
           status_changed_at = now()
      from alvo a
     where o.id = a.id
    returning o.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'code', a.code, 'amount', a.deposit_usd, 'ship', a.ship
         )), '[]'::jsonb)
    into v_creditados
  from alvo a;

  -- Mercadoria comprada e navio que já foi: NÃO decide, aponta. A rota
  -- do cron transforma isto em notificação; a tela de não entregues é
  -- onde a equipe escolhe entre creditar e entregar na próxima escala.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id, 'code', o.code, 'status', o.status, 'ship', s.name
         ) order by o.created_at), '[]'::jsonb)
    into v_sobras
  from public.orders o
  join public.ships s on s.id = o.ship_id
  where o.status in ('preparing', 'at_gangway')
    and coalesce(s.ata, s.eta) < now() - interval '48 hours';

  -- Pedido que nunca chegou a ser pago não gera crédito: não houve
  -- dinheiro. Mas também não pode ficar de zumbi apontando para uma
  -- escala que já foi — vira cancelado. Ainda não manda e-mail.
  with mortos as (
    update public.orders o
       set status = 'cancelled',
           previous_status = 'awaiting_deposit',
           status_changed_at = now()
      from public.ships s
     where s.id = o.ship_id
       and o.status = 'awaiting_deposit'
       and coalesce(s.ata, s.eta) < now() - interval '48 hours'
    returning o.id
  )
  select count(*)::int into v_cancelados from mortos;

  return jsonb_build_object(
    'ok', true,
    'creditados', v_creditados,
    'sobras', v_sobras,
    'cancelados_sem_pagamento', v_cancelados
  );
end;
$$;

-- ---------------------------------------------------------------- 3
alter table public.orders
  add column if not exists leftover_note text,
  add column if not exists leftover_resolved_at timestamptz;
comment on column public.orders.leftover_note is
  'Mercadoria comprada para navio que não veio: o plano de entrega (para quem, onde, quando).';
comment on column public.orders.leftover_resolved_at is
  'A sobra foi resolvida (entregue em outro pedido, reaproveitada ou baixada).';

-- Os pedidos que o cron creditou ANTES deste conserto ficaram sem a
-- transição gravada. A regra é a da cadeia de estados: o cron nunca
-- escreveu previous_status, então o valor que está lá é o da ÚLTIMA
-- transição manual — de onde ela veio, não onde o pedido estava quando
-- foi creditado. Um passo à frente na cadeia recupera o estado real.
-- Só toca quem tem crédito de desvio e status_changed_at anterior a ele.
update public.orders o
   set status_changed_at = c.created_at,
       previous_status = case o.previous_status
                           when 'preparing'    then 'at_gangway'
                           when 'deposit_paid' then 'preparing'
                           else 'deposit_paid'
                         end
  from public.credits c
 where c.order_id = o.id
   and c.kind = 'deviation'
   and o.status = 'credited'
   and (o.status_changed_at is null or o.status_changed_at < c.created_at - interval '1 minute');
