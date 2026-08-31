-- Escala não é catálogo: ela nasce, abre, fecha e morre em dias.
--
-- Até aqui o campo `active` era um interruptor manual no admin, então a
-- lista só sabia envelhecer. O resultado apareceu em produção: os quatro
-- navios ativos estavam TODOS vencidos — dois já tinham partido e dois
-- tinham a janela fechada. Zero escalas compráveis, e nada no sistema
-- dizendo isso. Um cliente que entrasse na loja naquele momento não
-- conseguiria fechar pedido nenhum, e a operação não teria como saber.
--
-- O raspador do line-up já traz as escalas de hora em hora. O que
-- faltava era alguém decidir quais delas estão em cena. Esta função é
-- essa decisão, e ela é sobre TEMPO, não sobre gosto:
--
--   entra  — escala que ainda não aconteceu e está dentro do horizonte
--   sai    — escala cujo navio já esteve e foi embora
--
-- Horizonte de 14 dias porque line-up mais longo que isso é chute: a
-- CODESP republica e as datas andam. Folga de 48 h depois da ETA porque
-- navio fica atracado — sumir com a escala no minuto da ETA apagaria da
-- tela justamente o navio que está no berço agora. Não existe coluna de
-- partida (atd) no line-up, então `coalesce(ata, eta)` é o melhor sinal
-- disponível: se atracou de fato, conta da atracação; senão, da prevista.
--
-- Desativar é SEGURO para quem está a bordo: a policy de leitura de
-- ships devolve a escala mesmo inativa para quem a tem no perfil e para
-- quem a criou. Ninguém perde o próprio navio de vista.
--
-- Mesmo modelo de segurança de sync_ship_eta e ops_daily: SECURITY
-- DEFINER gated pelo cron_secret de app_secrets. Nenhuma chave
-- service_role dentro do app.
create or replace function public.rotate_ship_calls(p_secret text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_promovidas int;
  v_aposentadas int;
  v_ativas int;
  v_abertas int;
  v_proxima text;
begin
  if not exists (
    select 1 from public.app_secrets s
    where s.key = 'cron_secret' and s.value = p_secret and length(p_secret) >= 10
  ) then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  -- 1. entra em cena o que ainda vai acontecer
  with promove as (
    update public.ships
       set active = true
     where not active
       and eta > now()
       and eta < now() + interval '14 days'
    returning 1
  )
  select count(*)::int into v_promovidas from promove;

  -- 2. sai de cena o que já esteve e foi
  with aposenta as (
    update public.ships
       set active = false
     where active
       and coalesce(ata, eta) < now() - interval '48 hours'
    returning 1
  )
  select count(*)::int into v_aposentadas from aposenta;

  -- 3. o retrato depois da rotação, que é o que a operação precisa ver
  select
    count(*) filter (where active),
    count(*) filter (
      where active
        and eta - make_interval(hours => coalesce(cutoff_hours, 24)) > now()
    )
    into v_ativas, v_abertas
  from public.ships;

  select to_char(min(s.eta) at time zone 'America/Sao_Paulo', 'DD Mon HH24:MI')
    into v_proxima
  from public.ships s
  where s.active
    and s.eta - make_interval(hours => coalesce(s.cutoff_hours, 24)) > now();

  return jsonb_build_object(
    'ok', true,
    'promovidas', v_promovidas,
    'aposentadas', v_aposentadas,
    'ativas', v_ativas,
    'janelas_abertas', v_abertas,
    'proxima_janela', v_proxima
  );
end;
$$;

revoke all on function public.rotate_ship_calls(text) from public, anon, authenticated;


-- E o resumo diário passa a contar as janelas ABERTAS, não só as escalas
-- das próximas 48 h.
--
-- A diferença importa. A lista de 48 h dizia "NYK CONSTELLATION, janela
-- fechada" e "MAERSK LOTA, janela fechada" — cada linha certa, e o
-- conjunto mudo sobre o fato que interessa: naquele dia a loja não
-- vendia para ninguém. Número que só aparece somando linhas na cabeça é
-- número que ninguém soma às seis da manhã.
--
-- Agora sai um contador único. Zero nele é o alarme que faltava.
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
  v_abertas int;
  v_proxima text;
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

  -- 5. o número que faltava: quantas escalas ACEITAM pedido agora.
  --    Zero aqui significa loja parada, e é a primeira coisa que o
  --    e-mail das 6h precisa dizer.
  select count(*)::int into v_abertas
  from public.ships s
  where s.active
    and s.eta - make_interval(hours => coalesce(s.cutoff_hours, 24)) > now();

  select to_char(min(s.eta) at time zone 'America/Sao_Paulo', 'DD Mon HH24:MI')
    into v_proxima
  from public.ships s
  where s.active
    and s.eta - make_interval(hours => coalesce(s.cutoff_hours, 24)) > now();

  return jsonb_build_object('ok', true,
    'totais', v_totais, 'pedidos', v_pedidos, 'itens', v_itens,
    'escalas', v_escalas, 'novidades_expiradas', v_expirados,
    'janelas_abertas', v_abertas, 'proxima_janela', v_proxima);
end;
$$;

revoke all on function public.ops_daily(text) from public, anon, authenticated;
