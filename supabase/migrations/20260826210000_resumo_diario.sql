-- O resumo diário da operação, e a manutenção que anda junto com ele.
--
-- É a segunda metade da resposta a "como vamos acompanhar tudo o que
-- está acontecendo?". A primeira foi o aviso por pedido (o e-mail que
-- sai quando um depósito é pago); esta é a batida de caixa: uma função
-- que o cron chama de manhã e devolve o dia anterior inteiro — pedidos,
-- valores, itens mais pedidos e as escalas das próximas 48 horas com o
-- estado da janela de cada uma.
--
-- A manutenção do New Arrivals mora AQUI de propósito, e não num cron
-- separado: "novo" só significa alguma coisa se expirar, e a expiração
-- é um fato do dia tanto quanto os pedidos. Produto com selo há mais de
-- 30 dias perde o selo e sai da coleção — a regra que estava escrita no
-- plano e não existia em lugar nenhum executável.
--
-- Mesmo modelo de segurança de sync_ship_eta: SECURITY DEFINER gated
-- pelo cron_secret de app_secrets. Nenhuma chave service_role no app.
create or replace function public.ops_daily(p_secret text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_pedidos jsonb;
  v_totais jsonb;
  v_itens jsonb;
  v_escalas jsonb;
  v_expirados jsonb;
begin
  if not exists (
    select 1 from public.app_secrets s
    where s.key = 'cron_secret' and s.value = p_secret and length(p_secret) >= 10
  ) then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  -- 1. manutenção: o selo "new" expira em 30 dias, e a filiação à
  --    coleção expira junto — senão New Arrivals vira o corredor onde
  --    as coisas ficam velhas com etiqueta de novas.
  with velhos as (
    select id, name from public.products
    where badge = 'new' and published_at < now() - interval '30 days'
  ), tira_selo as (
    update public.products set badge = null
    where id in (select id from velhos) returning id
  ), tira_colecao as (
    delete from public.product_categories pc
    using public.categories c
    where c.slug = 'new-arrivals' and pc.category_id = c.id
      and pc.product_id in (select id from velhos)
    returning pc.product_id
  )
  select coalesce(jsonb_agg(v.name), '[]'::jsonb) into v_expirados from velhos v;

  -- 2. os pedidos das últimas 24h, mais novos primeiro
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', o.code, 'status', o.status,
           'vessel', o.vessel_name, 'berth', o.vessel_berth,
           'subtotal', o.subtotal_usd, 'deposit', o.deposit_usd,
           'at', to_char(o.created_at at time zone 'America/Sao_Paulo', 'DD Mon HH24:MI')
         ) order by o.created_at desc), '[]'::jsonb)
    into v_pedidos
  from public.orders o
  where o.created_at >= now() - interval '24 hours'
    and o.status <> 'cancelled';

  select jsonb_build_object(
           'pedidos', count(*),
           'subtotal', coalesce(sum(o.subtotal_usd), 0),
           'depositos', coalesce(sum(o.deposit_usd), 0))
    into v_totais
  from public.orders o
  where o.created_at >= now() - interval '24 hours'
    and o.status <> 'cancelled';

  -- 3. o que mais saiu (para a lista de compra do dia)
  select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'qty', t.qty)
                            order by t.qty desc), '[]'::jsonb)
    into v_itens
  from (
    select oi.name, sum(oi.qty)::int as qty
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.created_at >= now() - interval '24 hours'
      and o.status <> 'cancelled'
    group by oi.name
    order by sum(oi.qty) desc
    limit 8
  ) t;

  -- 4. escalas das próximas 48h, com o estado da janela de cada uma
  select coalesce(jsonb_agg(jsonb_build_object(
           'ship', s.name, 'berth', s.berth,
           'eta', to_char(s.eta at time zone 'America/Sao_Paulo', 'DD Mon HH24:MI'),
           'window', case
             when s.eta - make_interval(hours => coalesce(s.cutoff_hours, 24)) > now()
             then 'open' else 'closed' end
         ) order by s.eta), '[]'::jsonb)
    into v_escalas
  from public.ships s
  where s.active and s.eta between now() and now() + interval '48 hours';

  return jsonb_build_object('ok', true,
    'totais', v_totais, 'pedidos', v_pedidos, 'itens', v_itens,
    'escalas', v_escalas, 'novidades_expiradas', v_expirados);
end;
$$;

revoke all on function public.ops_daily(text) from public, anon, authenticated;
