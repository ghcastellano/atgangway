-- ============================================================
-- Pagamento Stripe + abatimento de crédito Captain no checkout
-- (aplicada no projeto em 23/08/2026 via Management API)
-- ============================================================

alter table public.orders
  add column if not exists credit_applied_usd numeric(10,2) not null default 0;

create table if not exists public.app_secrets (
  key text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;

insert into public.app_secrets (key, value)
values ('stripe_webhook_secret', gen_random_uuid()::text)
on conflict (key) do nothing;

create or replace function public.my_credit_balance()
returns numeric
language sql stable security definer set search_path = public
as $$
  select coalesce(sum(amount_usd), 0)
  from public.credits
  where user_id = auth.uid();
$$;
revoke execute on function public.my_credit_balance() from public;
grant execute on function public.my_credit_balance() to authenticated;

create or replace function public.apply_order_credit(p_order uuid)
returns numeric
language plpgsql security definer set search_path = public
as $$
declare
  o record;
  balance numeric;
  applied numeric;
begin
  select * into o from public.orders
  where id = p_order and user_id = auth.uid()
  for update;

  if o is null or o.status <> 'awaiting_deposit' or o.credit_applied_usd > 0 then
    return 0;
  end if;

  select coalesce(sum(amount_usd), 0) into balance
  from public.credits where user_id = auth.uid();

  applied := round(least(balance, o.deposit_usd), 2);
  if applied <= 0 then
    return 0;
  end if;

  insert into public.credits (user_id, order_id, amount_usd, kind, note)
  values (auth.uid(), p_order, -applied, 'redeem', 'Applied to order ' || o.code);

  update public.orders
  set credit_applied_usd = applied,
      status = case when deposit_usd - applied <= 0.009 then 'deposit_paid' else status end
  where id = p_order;

  return applied;
end;
$$;
revoke execute on function public.apply_order_credit(uuid) from public;
grant execute on function public.apply_order_credit(uuid) to authenticated;

create or replace function public.confirm_stripe_deposit(p_order uuid, p_secret text)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if p_secret is null or length(p_secret) < 10 then
    return false;
  end if;
  if not exists (
    select 1 from public.app_secrets s
    where s.key = 'stripe_webhook_secret' and s.value = p_secret
  ) then
    return false;
  end if;

  update public.orders
  set status = 'deposit_paid'
  where id = p_order and status = 'awaiting_deposit';

  return found;
end;
$$;
revoke execute on function public.confirm_stripe_deposit(uuid, text) from public;
grant execute on function public.confirm_stripe_deposit(uuid, text) to anon, authenticated;
