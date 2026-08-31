-- PASSO FINAL — irreversível. Só rode DEPOIS de:
--   1. ter rodado 01-schema.sql e 02-dados.sql no projeto novo;
--   2. ter apontado o app AHSD (projeto "ahsdtests" na Vercel) para o
--      banco novo — NEXT_PUBLIC_SUPABASE_URL e a chave anon;
--   3. ter aberto o painel do AHSD e visto os 3 resultados de lá.
--
-- Isto apaga dado de SAÚDE. Se o passo 2 não estiver feito, o app quebra
-- e o dado some junto.

drop function if exists public.ahsd_admin_listar_resultados(text);
drop table if exists public.ahsd_resultados;
drop table if exists public.ahsd_admin_config;
