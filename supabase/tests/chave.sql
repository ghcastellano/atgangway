-- pgTAP: a chave de sincronização do line-up não duplica escala.
-- Roda com execute_sql (MCP) ou psql, sempre em transação que volta atrás.
-- Resultado esperado: 4 linhas "ok N - ...".
-- ============================================================
--  RODE O ARQUIVO INTEIRO. NUNCA statement por statement.
--
--  O `begin;` da primeira linha e o `rollback;` da última são o que
--  protege a produção: este teste CRIA ESCALAS pelo sync de verdade.
--  Sem o rollback, elas ficam. O segredo do cron é lido de app_secrets
--  DENTRO da transação e nunca sai no resultado.
-- ============================================================
begin;
select extensions.plan(4);
create temp table _tap (n int, r text);
create temp table _c as select (select value from app_secrets where key = 'cron_secret') as seg;
insert into _tap select 1, extensions.is(public.ship_key('NC BRISA (REB S/L)'), 'NC BRISA REB S L', 'ship_key não termina em espaço quando o nome termina em pontuação');
create temp table _r1 as select public.sync_ship_eta('ZZ TESTE (REB)', now() + interval '5 days', null, null, null, 'port_lineup', (select seg from _c)) as r;
create temp table _r2 as select public.sync_ship_eta('ZZ TESTE (REB)', now() + interval '5 days', null, null, null, 'port_lineup', (select seg from _c)) as r;
insert into _tap select 2, extensions.is((select count(*)::int from ships where name = 'ZZ TESTE (REB)'), 1, 'sincronizar duas vezes um nome terminado em ")" não duplica a escala');
insert into _tap select 3, extensions.is((select r ->> 'action' from _r2), 'unchanged', 'a segunda passada reconhece a escala que a primeira criou');
insert into _tap select 4, extensions.throws_ok($q$insert into ships (name, eta, sync_key) values ('ZZ OUTRA', now() + interval '5 days', 'ZZ TESTE REB')$q$, '23505', null, 'chave de sync repetida é recusada pelo índice único');
insert into _tap select 99, string_agg(f, E'\n') from extensions.finish() f;
select string_agg(r, E'\n' order by n) as tap from _tap;
rollback;
