-- Escuta do AIS ao redor de Santos, a cada 2 horas, pela Edge Function
-- ais-santos (supabase/functions/ais-santos). O mesmo padrão dos crons
-- do line-up: pg_cron → pg_net → portador do segredo do cron.
--
-- Custo: zero. A função roda no plano Free (500 mil invocações/mês,
-- 150 s por execução; ela ouve 100 s) e nada passa pelo GitHub Actions
-- nem pela Vercel. A cada 2 h porque a fila de navios muda nesse ritmo
-- e a mensagem estática do AIS sai a cada 6 min — 100 s de escuta pega
-- todo casco no alcance.
select cron.unschedule(jobid) from cron.job where jobname = 'ais-santos';

select cron.schedule(
  'ais-santos',
  '20 */2 * * *',
  $$
  select net.http_post(
    url := 'https://cuaocjxofaizefzcxlyc.supabase.co/functions/v1/ais-santos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select value from public.app_secrets where key = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);
