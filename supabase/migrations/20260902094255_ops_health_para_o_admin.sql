-- Frescor e saúde da operação para o painel, sem service_role no app.
-- SECURITY DEFINER que recusa quem não é admin ANTES de ler qualquer
-- coisa; devolve line-up, PTAX, crons (cron.job_run_details não é
-- exposto pelo PostgREST) e pedidos. Aplicada via MCP em 2026-09-02.
-- Corpo completo: ver histórico de migrações no projeto (ops_health_para_o_admin).
create or replace function public.ops_health() returns jsonb
language plpgsql security definer set search_path to 'public', 'cron', 'pg_temp' as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  select jsonb_build_object(
    'agora', now(),
    'lineup', jsonb_build_object(
      'ultimo_sync', (select max(last_synced_at) from public.ships),
      'escalas_futuras', (select count(*) from public.ships where eta > now()),
      'janelas_abertas', (select count(*) from public.ships s where s.active and s.eta - make_interval(hours => coalesce(s.cutoff_hours, 24)) > now())),
    'ptax', jsonb_build_object(
      'data_cotacao', (select max(quote_date) from public.fx_rates),
      'buscada_em', (select max(fetched_at) from public.fx_rates),
      'venda', (select usd_brl_sell from public.fx_rates order by quote_date desc limit 1)),
    'crons', (select coalesce(jsonb_agg(jsonb_build_object('job', j.jobname, 'agenda', j.schedule, 'ativo', j.active,
        'ultima', u.start_time, 'status', u.status,
        'falhas_24h', (select count(*) from cron.job_run_details d where d.jobid = j.jobid and d.status <> 'succeeded' and d.start_time > now() - interval '24 hours')) order by j.jobname), '[]'::jsonb)
      from cron.job j left join lateral (select d.start_time, d.status from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1) u on true),
    'pedidos', jsonb_build_object(
      'abertos', (select count(*) from public.orders where status in ('awaiting_deposit','deposit_paid','preparing','at_gangway')),
      'aguardando_deposito_24h', (select count(*) from public.orders where status = 'awaiting_deposit' and created_at < now() - interval '24 hours')),
    'emails', jsonb_build_object('ultimo_enviado', (select max(sent_at) from public.order_emails))
  ) into r;
  return r;
end; $$;
revoke execute on function public.ops_health() from public, anon;
grant execute on function public.ops_health() to authenticated;
