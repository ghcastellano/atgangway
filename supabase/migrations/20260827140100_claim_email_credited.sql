-- claim_order_email admite o quarto tipo, e uma terceira porta.
--
-- O TIPO: 'credited' era o estado em que algo deu errado para o cliente
-- — o navio pulou a escala — e justamente o único sobre o qual ninguém
-- era avisado. Dos sete estados do pedido, três mandavam e-mail e
-- todos os três eram boas notícias. Sistema que fala nos bons momentos
-- e emudece nos ruins ensina a tripulação a não confiar nele.
--
-- A PORTA: eram duas, o admin logado e o segredo do webhook do Stripe.
-- Nenhuma serve aqui — quem descobre que uma escala foi embora é o cron
-- do line-up, de hora em hora, sem ninguém logado e sem passar pelo
-- Stripe. Entra a porta do cron_secret, com a mesma disciplina das
-- outras: conferido contra app_secrets, com piso de tamanho.
--
-- A idempotência continua sendo do livro-razão: order_emails tem chave
-- única em (order_id, kind), e o ON CONFLICT DO NOTHING faz o segundo
-- pedido de envio voltar como 'already_sent'. Por isso o cron pode
-- repetir sem duplicar e-mail.
create or replace function public.claim_order_email(p_order uuid, p_kind text, p_secret text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_claimed boolean;
  o record;
  v_items jsonb;
begin
  if p_kind not in ('deposit_paid', 'at_gangway', 'delivered', 'credited') then
    return jsonb_build_object('claimed', false, 'reason', 'bad_kind');
  end if;

  if not (
    public.is_admin()
    or exists (
      select 1 from public.app_secrets s
      where s.key = 'stripe_webhook_secret'
        and s.value = p_secret
        and length(p_secret) >= 10
    )
    or exists (
      select 1 from public.app_secrets s
      where s.key = 'cron_secret'
        and s.value = p_secret
        and length(p_secret) >= 10
    )
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
$function$;
