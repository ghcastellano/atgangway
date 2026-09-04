-- Avisos da operação para o painel: atraso de navio, escala que sumiu,
-- cron que falhou. Quem escreve é o cron (via RPC guardada pelo segredo)
-- ou o próprio banco; quem lê e marca como lido é admin (RLS).
create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                       -- 'ship_delay' | 'ship_gone' | 'cron_failed' | ...
  severity text not null default 'info' check (severity in ('info','warn','danger')),
  title text not null,
  body text,
  ship_id uuid references public.ships(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  -- chave de deduplicação: o mesmo fato (navio X, ETA Y) não vira dois avisos
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists admin_notifications_unread_idx on public.admin_notifications (created_at desc) where read_at is null;

alter table public.admin_notifications enable row level security;
drop policy if exists "admin_notifications: admin read" on public.admin_notifications;
create policy "admin_notifications: admin read" on public.admin_notifications
  for select using (public.is_admin());
drop policy if exists "admin_notifications: admin mark read" on public.admin_notifications;
create policy "admin_notifications: admin mark read" on public.admin_notifications
  for update using (public.is_admin()) with check (public.is_admin());
grant select, update (read_at) on public.admin_notifications to authenticated;

-- O cron avisa por aqui: guardado pelo mesmo segredo das outras RPCs de
-- trabalho. Devolve true quando criou (false = já existia: dedupe).
create or replace function public.notify_admin(
  p_kind text, p_severity text, p_title text, p_body text,
  p_ship uuid default null, p_order uuid default null, p_dedupe text default null,
  p_secret text default null
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.app_secrets s where s.key = 'cron_secret' and s.value = p_secret and length(p_secret) >= 10)
     and not public.is_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  insert into public.admin_notifications (kind, severity, title, body, ship_id, order_id, dedupe_key)
  values (p_kind, coalesce(p_severity, 'info'), p_title, p_body, p_ship, p_order, p_dedupe)
  on conflict (dedupe_key) do nothing;
  return found;
end $$;
revoke all on function public.notify_admin(text, text, text, text, uuid, uuid, text, text) from public;
grant execute on function public.notify_admin(text, text, text, text, uuid, uuid, text, text) to anon, authenticated;
