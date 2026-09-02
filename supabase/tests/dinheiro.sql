-- pgTAP: as invariantes de DINHEIRO, provadas no banco, em transação
-- que sempre volta atrás. Roda com execute_sql (MCP) ou psql:
--   psql "$DATABASE_URL" -f supabase/tests/dinheiro.sql
-- Resultado esperado: 11 linhas "ok N - ...". Qualquer "not ok" é regressão.
--
-- Por que no banco e não no app: RLS, lock e CHECK vivem no Postgres.
-- Um mock no Node prova que o Node chama a RPC; só isto prova que a RPC
-- e as políticas fazem o que dizem.
begin;
select extensions.plan(11);
create temp table _t as
  select (select id from profiles limit 1) as uid,
         (select v.id from product_variants v join products p on p.id=v.product_id where v.active and p.active order by v.price_cents limit 1) as vid,
         (select id from ships where active and eta - make_interval(hours=>cutoff_hours) > now() + interval '6 hours' order by eta limit 1) as sid;
create temp table _tap (n int, r text);
grant insert on _tap to anon;
grant select on _t to anon;
update product_variants set track_stock = true, stock_qty = 2 where id = (select vid from _t);
update profiles set ship_id = (select sid from _t), port_id = coalesce(port_id, (select id from ports where slug='santos')) where id = (select uid from _t);
update ports set min_order_cents = 0 where slug = 'santos';
select set_config('request.jwt.claims', json_build_object('sub', (select uid from _t), 'role', 'authenticated')::text, true);
insert into _tap select 1, extensions.is((public.place_order(gen_random_uuid(), null, false, 'Teste', '+5511970561448', null, jsonb_build_array(jsonb_build_object('id', (select vid from _t), 'qty', 3))))->>'error', 'out_of_stock', 'pedir 3 com 2 em estoque -> out_of_stock');
insert into _tap select 2, extensions.is((public.place_order('11111111-1111-1111-1111-111111111111', null, false, 'Teste', '+5511970561448', null, jsonb_build_array(jsonb_build_object('id', (select vid from _t), 'qty', 2))))->>'ok', 'true', 'pedir 2 com 2 em estoque -> ok');
insert into _tap select 3, extensions.is((select stock_qty from product_variants where id = (select vid from _t)), 0, 'estoque baixou para 0 na mesma transação');
insert into _tap select 4, extensions.is((public.place_order(gen_random_uuid(), null, false, 'Teste', '+5511970561448', null, jsonb_build_array(jsonb_build_object('id', (select vid from _t), 'qty', 1))))->>'error', 'out_of_stock', 'terceiro comprador com estoque 0 -> out_of_stock');
insert into _tap select 5, extensions.is((public.place_order('11111111-1111-1111-1111-111111111111', null, false, 'Teste', '+5511970561448', null, jsonb_build_array(jsonb_build_object('id', (select vid from _t), 'qty', 2))))->>'duplicate', 'true', 'mesma chave de idempotência -> duplicate');
insert into _tap select 6, extensions.is((select stock_qty from product_variants where id = (select vid from _t)), 0, 'duplicata não baixa de novo');
update orders set status = 'cancelled' where idempotency_key = '11111111-1111-1111-1111-111111111111';
insert into _tap select 7, extensions.is((select stock_qty from product_variants where id = (select vid from _t)), 2, 'cancelar devolve as 2 unidades');
update orders set status = 'awaiting_deposit' where idempotency_key = '11111111-1111-1111-1111-111111111111';
insert into _tap select 8, extensions.is((select stock_qty from product_variants where id = (select vid from _t)), 0, 'descancelar (Undo) baixa de novo');
insert into _tap select 9, extensions.throws_ok('update product_variants set stock_qty = -1 where id = (select vid from _t)', '23514', null, 'CHECK impede estoque negativo');
insert into _tap select 10, extensions.is((select stock_qty from products where id = (select product_id from product_variants where id = (select vid from _t))), 0, 'products.stock_qty acompanha a variante (rollup)');
set local role anon;
insert into _tap select 11, extensions.throws_ok($q$insert into public.orders (code, user_id, subtotal_usd, deposit_usd, balance_usd) values ('X', gen_random_uuid(), 1, 1, 0)$q$, '42501', null, 'anon não insere em orders (RLS)');
reset role;
insert into _tap select 99, string_agg(f, E'\n') from extensions.finish() f;
select string_agg(r, E'\n' order by n) as tap from _tap;
rollback;
