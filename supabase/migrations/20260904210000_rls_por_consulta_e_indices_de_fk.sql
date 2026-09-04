-- Revisão geral do banco: o que o linter do Supabase apontou e é real.
--
-- Três famílias de problema, em ordem de quanto custam:
--
-- 1. RLS reavaliada POR LINHA. `auth.uid()` e `is_admin()` escritos
--    nus dentro de uma policy são reexecutados para cada linha
--    examinada. Envolvidos em `(select ...)`, o planner os promove a
--    InitPlan: uma vez por consulta. Com 6 pedidos isso não se mede;
--    com 60 mil linhas de order_items é a diferença entre a página do
--    cliente abrir e não abrir. Metade das policies já estava certa —
--    estas oito ficaram para trás.
--
-- 2. Chaves estrangeiras SEM índice. Catorze. O custo não aparece na
--    leitura do dia a dia, aparece no DELETE: apagar uma categoria faz
--    o Postgres varrer products inteira SEGURANDO LOCK para checar a
--    FK. Índice de FK é seguro de nascença — são tabelas pequenas e o
--    custo de escrita é desprezível perto de um lock em produção.
--
-- 3. Índice duplicado em ships: dois índices idênticos sobre imo,
--    mantidos e atualizados a cada escrita, servindo à mesma consulta.
--
-- E dois itens de segurança, ambos pequenos e ambos reais.
--
-- O QUE NÃO FOI FEITO, de propósito:
--
--   As policies "admin write" são FOR ALL, então também rodam no
--   SELECT ao lado da policy de leitura pública — o linter chama isso
--   de "multiple permissive policies". Separá-las em INSERT/UPDATE/
--   DELETE daria 33 policies novas para economizar UMA chamada de
--   função por consulta, que depois deste patch é InitPlan. Não paga.
--
--   `is_cron_secret` continua executável por anon, e é um oráculo:
--   dá para tentar adivinhar o segredo do cron uma chamada por vez.
--   Revogar quebraria todos os crons, porque eles rodam com a chave
--   ANÔNIMA e se autenticam justamente por essa função — não existe
--   service_role neste projeto, o que é uma boa propriedade e não vou
--   trocar por outra num patch de índice. A saída certa é o cron
--   validar o segredo no servidor Next, sem ida ao banco. Roadmap.

-- ============================================================
-- 1. RLS: uma avaliação por consulta, não por linha
-- ============================================================

drop policy if exists "credits: read own or admin" on public.credits;
create policy "credits: read own or admin" on public.credits
  for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists "credits: admin write" on public.credits;
create policy "credits: admin write" on public.credits
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "order_items: read own or admin" on public.order_items;
create policy "order_items: read own or admin" on public.order_items
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = (select auth.uid())
    )
  );

drop policy if exists "orders: read own or admin" on public.orders;
create policy "orders: read own or admin" on public.orders
  for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or (select public.is_admin()));

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "eta history: admin write" on public.ship_eta_history;
create policy "eta history: admin write" on public.ship_eta_history
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "ships: admin write" on public.ships;
create policy "ships: admin write" on public.ships
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ============================================================
-- 2. Índices de chave estrangeira
-- ============================================================

create index if not exists admin_notifications_order_idx on public.admin_notifications (order_id);
create index if not exists admin_notifications_ship_idx  on public.admin_notifications (ship_id);
create index if not exists call_reminders_ship_idx       on public.call_reminders (ship_id);
create index if not exists order_items_product_idx       on public.order_items (product_id);
create index if not exists order_items_variant_idx       on public.order_items (variant_id);
create index if not exists orders_ship_idx               on public.orders (ship_id);
create index if not exists products_default_variant_idx  on public.products (default_variant_id);
create index if not exists products_primary_cat_idx      on public.products (primary_category_id);
create index if not exists profiles_port_idx             on public.profiles (port_id);
create index if not exists profiles_rank_idx             on public.profiles (rank_slug);
-- Este não é só de FK: referral_order_count faz
-- `where p.referred_by = p_user`, e essa consulta roda toda vez que
-- alguém abre a página do Captain.
create index if not exists profiles_referred_by_idx      on public.profiles (referred_by);
create index if not exists profiles_ship_idx             on public.profiles (ship_id);
-- Usado pela própria policy de leitura de ships (`created_by = auth.uid()`).
create index if not exists ships_created_by_idx          on public.ships (created_by);
create index if not exists wishlists_product_idx         on public.wishlists (product_id);

-- ============================================================
-- 3. Índice duplicado
-- ============================================================

-- ships_imo_idx e ships_imo_unico são idênticos. Fica o UNIQUE, que
-- além de servir à busca garante a regra: um IMO, um casco.
drop index if exists public.ships_imo_idx;

-- ============================================================
-- 4. Segurança
-- ============================================================

-- Função sem search_path fixo pode ser sequestrada por quem controlar o
-- search_path da sessão. Esta é IMMUTABLE e só usa pg_catalog, então o
-- risco é baixo — mas ela valida DÍGITO VERIFICADOR DE IMO, que é o que
-- impede dois cascos diferentes de compartilharem identidade.
create or replace function public.imo_checksum_ok(p_imo text)
returns boolean language sql immutable
set search_path = ''
as $$
  select p_imo ~ '^\d{7}$'
     and (  substr(p_imo,1,1)::int * 7
          + substr(p_imo,2,1)::int * 6
          + substr(p_imo,3,1)::int * 5
          + substr(p_imo,4,1)::int * 4
          + substr(p_imo,5,1)::int * 3
          + substr(p_imo,6,1)::int * 2) % 10 = substr(p_imo,7,1)::int;
$$;

-- Função de GATILHO exposta como RPC em /rest/v1/rpc/. Ela devolve
-- `trigger`, então chamada de fora estoura — mas é SECURITY DEFINER e
-- mexe em estoque, e superfície que não serve a ninguém não deve
-- existir.
revoke execute on function public.order_stock_on_status_trg() from anon, authenticated, public;
