-- A busca de navio devolvia TODA escala com aquele nome — inclusive a
-- que já fechou a janela de pedidos e a que já partiu. Quem escolhia
-- uma delas no cadastro ou na conta ficava preso a uma escala morta e
-- só descobria no checkout ("fase 1" barra o pedido, mas o picker
-- continuava oferecendo o beco).
--
-- Régua única, a mesma do banco em rotate_ship_calls e place_order:
--   janela aberta  =  eta - cutoff_hours > now()
-- Não filtra por `active`: navio cadastrado pela tripulação nasce
-- inativo (até o staff conciliar) e precisa continuar aparecendo para
-- quem o criou; escala antiga inativa já cai pela régua da janela.
--
-- Devolve também ata e cutoff_hours para a tela poder aplicar a MESMA
-- máquina de estados de lib/callstate (open/closing) no rótulo.

drop function if exists public.search_vessels(text);

create function public.search_vessels(p_query text)
returns table (
  id uuid, name text, imo text, flag text, image_path text, verified boolean,
  eta timestamptz, ata timestamptz, cutoff_hours int
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.id, s.name, s.imo, s.flag, s.image_path, s.verified, s.eta, s.ata, s.cutoff_hours
  from public.ships s
  where length(coalesce(p_query, '')) >= 3
    -- só escala que ainda aceita pedido
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

-- create_vessel deduplicava contra QUALQUER escala com o mesmo nome ou
-- IMO — e devolvia a fechada. Com a busca escondendo escala fechada, a
-- pessoa clicava em "Create a new Vessel" e recebia de volta exatamente
-- a escala morta que a busca acabou de esconder. Agora só desduplica
-- contra escala com janela aberta; se a única igual já fechou, nasce
-- uma escala nova (é o modelo: o navio é permanente, a escala não).
--
-- IMO: o índice único é por casco, e a escala fechada segura o número.
-- A escala nova nasce SEM o IMO (o perfil guarda a cópia em vessel_imo);
-- claim_vessel_imo continua respondendo imo_taken, como já fazia.

create or replace function public.create_vessel(p_name text, p_imo text default null, p_flag text default null)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_name text := upper(trim(coalesce(p_name, '')));
  v_imo  text := nullif(regexp_replace(coalesce(p_imo, ''), '\D', '', 'g'), '');
begin
  if auth.uid() is null then
    raise exception 'precisa estar autenticado';
  end if;
  if length(v_name) < 3 or length(v_name) > 60 then
    raise exception 'nome de navio inválido';
  end if;
  if v_imo is not null and not public.imo_checksum_ok(v_imo) then
    raise exception 'IMO % fails its check digit — copy the 7 digits from the hull or leave it blank', v_imo;
  end if;

  -- Não duplica escala ABERTA: se já existe por IMO ou nome e ainda
  -- aceita pedido, devolve a que existe.
  select s.id into v_id from public.ships s
  where ((v_imo is not null and s.imo = v_imo)
     or s.search_name = public.ship_key(v_name))
    and s.eta - make_interval(hours => coalesce(s.cutoff_hours, 24)) > now()
  order by s.verified desc, s.eta asc
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  -- O IMO já pertence a uma escala (fechada): a nova nasce sem ele.
  if v_imo is not null and exists (select 1 from public.ships s where s.imo = v_imo) then
    v_imo := null;
  end if;

  insert into public.ships (name, imo, flag, eta, cutoff_hours, active, verified, created_by)
  values (v_name, v_imo, nullif(upper(trim(coalesce(p_flag, ''))), ''),
          now() + interval '7 days', 72, false, false, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;
