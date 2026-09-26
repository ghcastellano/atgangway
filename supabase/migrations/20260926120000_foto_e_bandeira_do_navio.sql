-- Foto e bandeira no seletor de navio.
--
-- Dos 556 navios do banco, nenhum tinha bandeira, IMO ou foto. A bandeira
-- a CODESP publica (como gentílico: "LIBERIANA") e o cron lia — mas não
-- gravava: sync_ship_eta não tinha o parâmetro. A foto vem de fora
-- (Wikimedia Commons, licença livre, via scripts/fotos-navios.mjs), e
-- licença livre exige crédito: daí as duas colunas de atribuição.
--
-- photo_checked_at existe para o enriquecimento não bater no Commons
-- toda semana pelos mesmos navios que não têm foto lá.

alter table public.ships
  add column if not exists image_credit text,
  add column if not exists image_source text,
  add column if not exists photo_checked_at timestamptz;

-- ---------------------------------------------------------------------
-- sync_ship_eta ganha p_flag. Só preenche quando está vazio: a bandeira
-- que a tripulação ou o staff corrigiu vale mais que a do line-up.
-- Trocar a assinatura exige derrubar a antiga — senão vira sobrecarga.
-- ---------------------------------------------------------------------
drop function if exists public.sync_ship_eta(text, timestamptz, text, text, text, text, text);

create function public.sync_ship_eta(
  p_name text, p_eta timestamptz, p_berth text default null, p_imo text default null,
  p_voyage text default null, p_source text default 'port_lineup', p_secret text default null,
  p_flag text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_key text;
  v_ship record;
  v_delta numeric;
  v_baseline timestamptz;
  v_flag text := nullif(upper(trim(coalesce(p_flag, ''))), '');
  new_voyage boolean := false;
begin
  if not exists (
    select 1 from public.app_secrets s
    where s.key = 'cron_secret' and s.value = p_secret and length(p_secret) >= 10
  ) then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  if p_name is null or p_eta is null then
    return jsonb_build_object('ok', false, 'reason', 'bad_input');
  end if;

  v_key := trim(public.ship_key(p_name));

  select * into v_ship from public.ships
  where (p_imo is not null and imo = p_imo) or sync_key = v_key
  order by (imo is not null and imo = p_imo) desc
  limit 1;

  if v_ship is null then
    insert into public.ships (name, berth, eta, imo, voyage, sync_key,
                              eta_source, last_synced_at, active, flag)
    values (upper(trim(p_name)), p_berth, p_eta, p_imo, p_voyage, v_key,
            p_source, now(), false, v_flag)
    returning * into v_ship;

    insert into public.ship_eta_history (ship_id, eta, source, delta_hours)
    values (v_ship.id, p_eta, p_source, 0);

    return jsonb_build_object('ok', true, 'action', 'created',
                              'ship', v_ship.name, 'needs_review', true);
  end if;

  if abs(extract(epoch from (p_eta - v_ship.eta))) < 1800 then
    update public.ships
    set last_synced_at = now(),
        berth = coalesce(p_berth, berth),
        imo = coalesce(p_imo, imo),
        voyage = coalesce(p_voyage, voyage),
        flag = coalesce(flag, v_flag)
    where id = v_ship.id;
    return jsonb_build_object('ok', true, 'action', 'unchanged', 'ship', v_ship.name);
  end if;

  select eta into v_baseline from public.ship_eta_history
  where ship_id = v_ship.id order by recorded_at asc limit 1;
  v_baseline := coalesce(v_baseline, v_ship.eta);

  v_delta := round(extract(epoch from (p_eta - v_baseline)) / 3600.0, 1);

  -- salto > 14 dias (em qualquer direção) = nova escala, não atraso
  if abs(v_delta) > 336 then
    new_voyage := true;
    v_delta := 0;
    delete from public.ship_eta_history where ship_id = v_ship.id;
    insert into public.ship_eta_history (ship_id, eta, source, delta_hours)
    values (v_ship.id, p_eta, p_source, 0);
  else
    insert into public.ship_eta_history (ship_id, eta, source, delta_hours)
    values (v_ship.id, p_eta, p_source, v_delta);
  end if;

  update public.ships
  set previous_eta = case when new_voyage then null else v_ship.eta end,
      eta = p_eta,
      berth = coalesce(p_berth, berth),
      imo = coalesce(p_imo, imo),
      voyage = coalesce(p_voyage, voyage),
      flag = coalesce(flag, v_flag),
      delay_hours = v_delta,
      eta_source = p_source,
      last_synced_at = now()
  where id = v_ship.id;

  return jsonb_build_object('ok', true,
    'action', case when new_voyage then 'new_voyage' else 'eta_changed' end,
    'ship', v_ship.name, 'delay_hours', v_delta);
end;
$$;

revoke all on function public.sync_ship_eta(text, timestamptz, text, text, text, text, text, text) from public;
grant execute on function public.sync_ship_eta(text, timestamptz, text, text, text, text, text, text) to anon, authenticated;

-- O lote repassa a bandeira.
create or replace function public.sync_ship_etas(p_rows jsonb, p_secret text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r jsonb;
  res jsonb;
  out jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from public.app_secrets s where s.key = 'cron_secret' and s.value = p_secret and length(p_secret) >= 10) then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return jsonb_build_object('ok', false, 'reason', 'bad_input');
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      res := public.sync_ship_eta(
        p_name   := r->>'name',
        p_eta    := (r->>'eta')::timestamptz,
        p_berth  := r->>'berth',
        p_imo    := r->>'imo',
        p_voyage := r->>'voyage',
        p_source := coalesce(r->>'source', 'port_lineup'),
        p_secret := p_secret,
        p_flag   := r->>'flag'
      );
    exception when others then
      -- uma linha torta não derruba as outras 164
      res := jsonb_build_object('ok', false, 'ship', r->>'name', 'reason', sqlerrm);
    end;
    out := out || jsonb_build_array(res);
  end loop;
  return jsonb_build_object('ok', true, 'results', out);
end $$;

revoke all on function public.sync_ship_etas(jsonb, text) from public;
grant execute on function public.sync_ship_etas(jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- A busca devolve o crédito da foto junto com o caminho: quem mostra a
-- foto mostra o crédito, e a tela não deveria precisar de outra ida ao
-- banco para isso. Mesma régua de janela aberta de antes.
-- ---------------------------------------------------------------------
drop function if exists public.search_vessels(text);

create function public.search_vessels(p_query text)
returns table (
  id uuid, name text, imo text, flag text, image_path text, image_credit text,
  verified boolean, eta timestamptz, ata timestamptz, cutoff_hours int
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.id, s.name, s.imo, s.flag, s.image_path, s.image_credit,
         s.verified, s.eta, s.ata, s.cutoff_hours
  from public.ships s
  where length(coalesce(p_query, '')) >= 3
    and s.eta - make_interval(hours => coalesce(s.cutoff_hours, 24)) > now()
    and (
      s.imo = regexp_replace(p_query, '\D', '', 'g')
      or s.search_name like public.ship_key(p_query) || '%'
      or s.search_name % public.ship_key(p_query)
    )
  order by
    (s.imo = regexp_replace(p_query, '\D', '', 'g')) desc,
    s.verified desc,
    similarity(s.search_name, public.ship_key(p_query)) desc,
    s.eta asc,
    s.name asc
  limit 10;
$$;

grant execute on function public.search_vessels(text) to anon, authenticated;
