-- ============================================================
-- Vessel Supplier — schema inicial + RLS
-- ============================================================

-- ---------- perfis + staff ----------
create table public.admin_emails (
  email text primary key
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

-- Cria o profile automaticamente em cada signup (email ou Google).
-- Se o email estiver em admin_emails, já entra como admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    case
      when exists (select 1 from public.admin_emails a where lower(a.email) = lower(new.email))
        then 'admin'
      else 'customer'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper usado pelas policies (definer → sem recursão de RLS)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- ---------- domínio ----------
create table public.ships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  berth text,
  eta timestamptz not null,
  cutoff_hours integer not null default 26 check (cutoff_hours between 1 and 240),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  emoji text not null default '📦',
  category text not null default 'General',
  price_usd numeric(10,2) not null check (price_usd >= 0),
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  ship_id uuid not null references public.ships(id),
  status text not null default 'awaiting_deposit' check (status in (
    'awaiting_deposit', 'deposit_paid', 'preparing',
    'at_gangway', 'delivered', 'credited', 'cancelled'
  )),
  payment_method text check (payment_method in ('card', 'wallet', 'pix')),
  subtotal_usd numeric(10,2) not null check (subtotal_usd >= 0),
  deposit_usd numeric(10,2) not null check (deposit_usd >= 0),
  balance_usd numeric(10,2) not null check (balance_usd >= 0),
  contact_name text,
  contact_whatsapp text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  name text not null,
  emoji text,
  unit_price_usd numeric(10,2) not null check (unit_price_usd >= 0),
  qty integer not null check (qty > 0 and qty <= 99)
);

create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status);
create index order_items_order_idx on public.order_items (order_id);
create index ships_eta_idx on public.ships (eta);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orders_touch
  before update on public.orders
  for each row execute function public.touch_updated_at();

-- ---------- RLS ----------
alter table public.admin_emails enable row level security; -- sem policies = ninguém lê via API
alter table public.profiles     enable row level security;
alter table public.ships        enable row level security;
alter table public.products     enable row level security;
alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;

-- profiles: cada um lê o seu; admin lê todos; só full_name é editável
create policy "profiles: read own or admin"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.is_admin());

create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke update on public.profiles from authenticated, anon;
grant update (full_name) on public.profiles to authenticated;

-- ships: vitrine pública dos ativos; admin gerencia
create policy "ships: public read active"
  on public.ships for select
  using (active = true or public.is_admin());

create policy "ships: admin write"
  on public.ships for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- products: vitrine pública dos ativos; admin gerencia
create policy "products: public read active"
  on public.products for select
  using (active = true or public.is_admin());

create policy "products: admin write"
  on public.products for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- orders: cliente cria e lê os seus; admin lê e atualiza todos
create policy "orders: customer insert own"
  on public.orders for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "orders: read own or admin"
  on public.orders for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

create policy "orders: admin update"
  on public.orders for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- rollback do checkout: cliente pode apagar pedido próprio ainda sem depósito
create policy "orders: customer delete own pending"
  on public.orders for delete
  to authenticated
  using (auth.uid() = user_id and status = 'awaiting_deposit');

-- order_items: seguem o dono do pedido
create policy "order_items: customer insert own"
  on public.order_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );

create policy "order_items: read own or admin"
  on public.order_items for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );
