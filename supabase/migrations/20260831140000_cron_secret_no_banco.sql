-- O segredo do cron tem UMA casa: app_secrets.cron_secret.
-- (aplicada no projeto via MCP em 31/08/2026 como `cron_secret_no_banco`;
--  este arquivo é documentação)
--
-- As rotas de cron validavam o Bearer contra uma CÓPIA do segredo em
-- env da Vercel (CRON_SECRET) — e a cópia é exatamente o que faltou no
-- painel: o pg_cron mandava o valor certo e levava 401/503 do lado do
-- app. Esta function deixa a rota perguntar ao banco "este portador
-- sabe o segredo?", que é a mesma pergunta que as RPCs de trabalho
-- (sync_ship_eta, ops_daily, upsert_fx_rate…) já fazem por dentro.
-- Uma fonte de verdade, zero coordenação de painel.
--
-- Superfície: um oráculo booleano de igualdade exata, o mesmo que
-- qualquer RPC com p_secret já oferece via PostgREST — nada novo.
create or replace function public.is_cron_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_secrets s
     where s.key = 'cron_secret'
       and s.value = p_secret
       and length(coalesce(p_secret, '')) >= 10
  );
$$;
revoke all on function public.is_cron_secret(text) from public;
grant execute on function public.is_cron_secret(text) to anon, authenticated;
