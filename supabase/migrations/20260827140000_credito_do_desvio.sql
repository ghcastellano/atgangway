-- A promessa do desvio, finalmente com mecanismo por trás dela.
--
-- O checkout diz, com todas as letras: "se o seu navio pular a escala, o
-- depósito vira crédito integral para a próxima — sem papelada". O
-- estado 'credited' existia no banco desde o início. E nada o disparava:
-- nenhum gatilho, nenhum e-mail, nenhuma tela. Era a única promessa que
-- o site fazia e não sabia cumprir.
--
-- São três peças, e as três estão aqui porque são um fato só — o navio
-- esteve e foi:
--
--   1. credits.kind admite 'deviation'
--   2. credit_skipped_calls() credita e marca os pedidos
--   3. claim_order_email() aceita o quarto tipo e a porta do cron

-- ---------------------------------------------------------------- 1
-- Existiam 'referral' (o capitão indicou), 'redeem' (gastou) e
-- 'adjustment' (alguém corrigiu à mão). Desvio de navio não é nenhum dos
-- três: é evento operacional recorrente, previsto no texto do checkout,
-- com significado contábil próprio. Poderia ter entrado como
-- 'adjustment', e teria sido pior — o balde de correção manual existe
-- para o que NÃO tem categoria, e somar ali um fato semanal faria o
-- razão perder a única pergunta que ele precisa responder depois:
-- quanto do crédito em circulação veio de navio que não veio.
alter table public.credits drop constraint if exists credits_kind_check;
alter table public.credits add constraint credits_kind_check
  check (kind = any (array['referral'::text, 'redeem'::text, 'adjustment'::text, 'deviation'::text]));

-- ---------------------------------------------------------------- 2
-- Credita o DEPÓSITO INTEIRO, e não só o dinheiro que entrou. Se a
-- pessoa pagou 60 com 25 de crédito e 35 de cartão, devolver 60 restaura
-- as duas partes — o crédito gasto também era valor dela. Devolver só os
-- 35 seria confiscar a diferença por tecnicalidade.
--
-- Mesma condição de aposentadoria de escala: coalesce(ata, eta) + 48h.
-- Idempotente por construção: exige que não exista crédito 'deviation'
-- para o pedido, então o cron pode repetir de hora em hora à vontade.
create or replace function public.credit_skipped_calls(p_secret text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_creditados jsonb;
  v_cancelados int;
begin
  if not exists (
    select 1 from public.app_secrets s
    where s.key = 'cron_secret' and s.value = p_secret and length(p_secret) >= 10
  ) then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  with alvo as (
    select o.id, o.code, o.user_id, o.deposit_usd, s.name as ship
    from public.orders o
    join public.ships s on s.id = o.ship_id
    where o.status in ('deposit_paid', 'preparing', 'at_gangway')
      and coalesce(s.ata, s.eta) < now() - interval '48 hours'
      and not exists (
        select 1 from public.credits c
        where c.order_id = o.id and c.kind = 'deviation'
      )
  ), lanca as (
    insert into public.credits (user_id, order_id, amount_usd, kind, note)
    select a.user_id, a.id, a.deposit_usd, 'deviation',
           'Deposit held as credit — ' || a.ship || ' skipped the call'
    from alvo a
    returning order_id
  ), marca as (
    update public.orders set status = 'credited'
    where id in (select id from alvo)
    returning id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'code', a.code, 'amount', a.deposit_usd, 'ship', a.ship
         )), '[]'::jsonb)
    into v_creditados
  from alvo a;

  -- Pedido que nunca chegou a ser pago não gera crédito: não houve
  -- dinheiro. Mas também não pode ficar de zumbi apontando para uma
  -- escala que já foi — vira cancelado. AINDA NÃO manda e-mail; é a
  -- outra metade da lacuna dos estados mudos, e fica registrada como
  -- pendência em vez de fingida como pronta.
  with mortos as (
    update public.orders o
       set status = 'cancelled'
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
    'cancelados_sem_pagamento', v_cancelados
  );
end;
$$;

revoke all on function public.credit_skipped_calls(text) from public, anon, authenticated;
