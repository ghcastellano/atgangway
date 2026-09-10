-- pgTAP: o desvio de navio — quem é creditado sozinho, quem vira sobra,
-- e Esconder que segura na rotação. Roda com execute_sql (MCP) ou psql,
-- sempre em transação que volta atrás.
-- Resultado esperado: 9 linhas "ok N - ...".
-- ============================================================
--  RODE O ARQUIVO INTEIRO. NUNCA statement por statement.
--
--  O `begin;` da primeira linha e o `rollback;` da última são o que
--  protege a produção: este teste CRIA ESCALAS E PEDIDOS, roda o cron
--  de crédito e a ROTAÇÃO DE ESCALAS de verdade (que publica e aposenta
--  escalas reais dentro da transação). Sem o rollback, tudo isso fica.
--  Já aconteceu de eu recopiar os statements do meio sem as duas pontas
--  — o MCP executou, nada desfez, e sobrou lixo em produção.
--  Conferido: com as duas pontas, o rollback funciona pelo MCP.
--
--  O segredo do cron é lido de app_secrets DENTRO da transação e nunca
--  sai no resultado: só a tabela _tap é selecionada no fim.
-- ============================================================
begin;
select extensions.plan(9);
create temp table _tap (n int, r text);
create temp table _d as
  select gen_random_uuid() as foi, gen_random_uuid() as esc, gen_random_uuid() as livre,
         (select id from profiles limit 1) as uid,
         (select value from app_secrets where key = 'cron_secret') as seg;
insert into ships (id, name, eta, cutoff_hours, active, hidden_at)
  select foi, 'ZZ TESTE FOI', now() - interval '3 days', 24, true, null from _d;
insert into ships (id, name, eta, cutoff_hours, active, hidden_at)
  select esc, 'ZZ TESTE ESCONDIDA', now() + interval '5 days', 24, false, now() from _d;
insert into ships (id, name, eta, cutoff_hours, active, hidden_at)
  select livre, 'ZZ TESTE LIVRE', now() + interval '5 days', 24, false, null from _d;
insert into orders (code, user_id, ship_id, status, subtotal_usd, deposit_usd, balance_usd)
  select 'ZZ-DEP', uid, foi, 'deposit_paid', 100, 30, 70 from _d;
insert into orders (code, user_id, ship_id, status, subtotal_usd, deposit_usd, balance_usd)
  select 'ZZ-SEP', uid, foi, 'preparing', 100, 30, 70 from _d;
insert into orders (code, user_id, ship_id, status, subtotal_usd, deposit_usd, balance_usd)
  select 'ZZ-ESC', uid, foi, 'at_gangway', 100, 30, 70 from _d;
create temp table _r as select public.credit_skipped_calls((select seg from _d)) as r;
insert into _tap select 1, extensions.is((select status from orders where code = 'ZZ-DEP'), 'credited', 'depósito pago + navio que foi -> creditado sozinho');
insert into _tap select 2, extensions.is((select previous_status from orders where code = 'ZZ-DEP'), 'deposit_paid', 'e o cron grava de onde veio');
insert into _tap select 3, extensions.is((select sum(amount_usd) from credits where kind = 'deviation' and order_id = (select id from orders where code = 'ZZ-DEP')), 30::numeric, 'o crédito nasce do gatilho, uma vez, no valor do depósito');
insert into _tap select 4, extensions.is((select status from orders where code = 'ZZ-SEP'), 'preparing', 'em separação NÃO é creditado sozinho (mercadoria comprada)');
insert into _tap select 5, extensions.is((select status from orders where code = 'ZZ-ESC'), 'at_gangway', 'na escada NÃO é creditado sozinho');
insert into _tap select 6, extensions.is((select jsonb_array_length((select r from _r) -> 'sobras')), 2, 'os dois voltam como sobras para a equipe decidir');
update orders set status = 'credited', previous_status = 'preparing', status_changed_at = now() where code = 'ZZ-SEP';
insert into _tap select 7, extensions.is((select count(*)::int from credits where kind = 'deviation' and order_id = (select id from orders where code = 'ZZ-SEP')), 1, 'creditar à mão (botão do painel) também lança o crédito');
create temp table _r2 as select public.rotate_ship_calls((select seg from _d)) as r;
insert into _tap select 8, extensions.is((select active from ships where id = (select esc from _d)), false, 'escondida pela equipe continua escondida depois da rotação');
insert into _tap select 9, extensions.is((select active from ships where id = (select livre from _d)), true, 'a que só esperava é publicada pela rotação');
insert into _tap select 99, string_agg(f, E'\n') from extensions.finish() f;
select string_agg(r, E'\n' order by n) as tap from _tap;
rollback;
