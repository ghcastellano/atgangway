-- pgTAP: o picker de navio só oferece escala com janela aberta.
-- Roda com execute_sql (MCP) ou psql, sempre em transação que volta atrás.
-- Resultado esperado: 5 linhas "ok N - ...".
-- ============================================================
--  RODE O ARQUIVO INTEIRO. NUNCA statement por statement.
--
--  O `begin;` da primeira linha e o `rollback;` da última são o que
--  protege a produção: este teste CRIA PEDIDO, mexe em estoque e zera
--  o mínimo do porto. Já aconteceu de eu recopiar os statements do
--  meio sem as duas pontas — o MCP executou, nada desfez, e sobrou em
--  produção um pedido de teste, um produto marcado como esgotado e o
--  pedido mínimo de Santos em zero. Conferido: com as duas pontas, o
--  rollback funciona pelo MCP.
-- ============================================================
begin;
select extensions.plan(5);
create temp table _tap (n int, r text);
create temp table _s as
  select gen_random_uuid() as fechada, gen_random_uuid() as aberta, gen_random_uuid() as partida,
         (select id from profiles limit 1) as uid;
insert into ships (id, name, eta, cutoff_hours, active, verified)
  select fechada, 'ZZ TESTE ESCALA', now() + interval '10 hours', 24, true, true from _s;
insert into ships (id, name, eta, cutoff_hours, active, verified)
  select aberta, 'ZZ TESTE ESCALA', now() + interval '5 days', 24, true, true from _s;
insert into ships (id, name, eta, ata, cutoff_hours, active, verified)
  select partida, 'ZZ TESTE PARTIDA', now() - interval '3 days', now() - interval '3 days', 24, false, true from _s;
insert into _tap select 1, extensions.is((select count(*)::int from search_vessels('ZZ TESTE ESCALA')), 1, 'com duas escalas do mesmo nome, a busca devolve só a aberta');
insert into _tap select 2, extensions.is((select id from search_vessels('ZZ TESTE ESCALA') limit 1), (select aberta from _s), 'e é a de janela aberta');
-- por id, não por contagem: a busca é por trigrama e 'ZZ TESTE ESCALA' (aberta) também casa.
insert into _tap select 3, extensions.ok(not exists (select 1 from search_vessels('ZZ TESTE PARTIDA') where id = (select partida from _s)), 'navio que já partiu não aparece');
select set_config('request.jwt.claims', json_build_object('sub', (select uid from _s), 'role', 'authenticated')::text, true);
insert into _tap select 4, extensions.is(public.create_vessel('ZZ TESTE ESCALA'), (select aberta from _s), 'create_vessel devolve a escala aberta existente');
insert into _tap select 5, extensions.isnt(public.create_vessel('ZZ TESTE PARTIDA'), (select partida from _s), 'create_vessel NÃO devolve a escala que já partiu — nasce outra');
insert into _tap select 99, string_agg(f, E'\n') from extensions.finish() f;
select string_agg(r, E'\n' order by n) as tap from _tap;
rollback;
