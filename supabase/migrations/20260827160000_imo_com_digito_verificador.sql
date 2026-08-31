-- O IMO ganha as três coisas que faltavam: conferência, unicidade e um
-- caminho para entrar nos navios que o line-up trouxe sem ele.
--
-- Contexto: nenhuma das duas fontes do line-up publica o número (a
-- CODESP não tem a coluna — a única ocorrência de "IMO" na página
-- inteira é o meio do nome ZIM BALT-IMO-RE; a vports idem). Então o
-- número só pode vir de quem embarca — e aí ele precisa ser conferível,
-- único e possível de acrescentar depois.

-- 1. A soma de conferência da OMI: seis primeiros dígitos × 7..2, o
--    último algarismo da soma é o sétimo dígito. Mesma regra existe em
--    TypeScript (lib/imo.ts) para o erro aparecer com o campo na tela;
--    esta aqui é a que vale, porque cliente nenhum é confiável.
create or replace function public.imo_checksum_ok(p_imo text)
returns boolean
language sql immutable
as $$
  select p_imo ~ '^\d{7}$'
     and (  substr(p_imo,1,1)::int * 7
          + substr(p_imo,2,1)::int * 6
          + substr(p_imo,3,1)::int * 5
          + substr(p_imo,4,1)::int * 4
          + substr(p_imo,5,1)::int * 3
          + substr(p_imo,6,1)::int * 2) % 10 = substr(p_imo,7,1)::int;
$$;

-- 2. Dois cascos não dividem um número: o IMO nunca é reutilizado, nem
--    depois do desmanche. Parcial porque os 209 do line-up estão nulos
--    e nulo não conflita com nulo.
create unique index if not exists ships_imo_unico
  on public.ships (imo) where imo is not null;

-- 3. create_vessel deixa de aceitar lixo: antes, qualquer sequência de
--    dígitos entrava como IMO. Número de conferência quebrada é RECUSADO
--    com mensagem, não silenciosamente descartado — quem digitou errado
--    precisa saber que errou, senão confia num cadastro furado.
create or replace function public.create_vessel(p_name text, p_imo text default null::text, p_flag text default null::text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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

  -- Não duplica: se já existe por IMO ou nome, devolve o que existe.
  select s.id into v_id from public.ships s
  where (v_imo is not null and s.imo = v_imo)
     or s.search_name = public.ship_key(v_name)
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.ships (name, imo, flag, eta, cutoff_hours, active, verified, created_by)
  values (v_name, v_imo, nullif(upper(trim(coalesce(p_flag, ''))), ''),
          now() + interval '7 days', 72, false, false, auth.uid())
  returning id into v_id;

  return v_id;
end;
$function$;

-- 4. O caminho que não existia: acrescentar o IMO a um navio que o
--    line-up trouxe sem ele. Quem sabe o número é quem está a bordo —
--    está pintado no casco e nos certificados.
--
--    Regras de escrita deliberadamente estreitas:
--      - só PREENCHE nulo, nunca sobrescreve: corrigir IMO errado é
--        ação de admin, não de tripulante — senão vandalismo troca o
--        número certo por um errado;
--      - conferência obrigatória;
--      - se outro casco já tem o número, recusa com o nome dele, que é
--        o jeito de a pessoa perceber que escolheu o navio errado na
--        lista (o cenário que o IMO existe para evitar);
--      - verified continua false: dado de tripulante é útil na hora e
--        confirmado pelo escritório depois.
create or replace function public.claim_vessel_imo(p_ship uuid, p_imo text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_imo text := nullif(regexp_replace(coalesce(p_imo, ''), '\D', '', 'g'), '');
  v_dono text;
  v_atual text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;
  if v_imo is null or not public.imo_checksum_ok(v_imo) then
    return jsonb_build_object('ok', false, 'reason', 'bad_checksum');
  end if;

  select s.name into v_dono from public.ships s where s.imo = v_imo and s.id <> p_ship;
  if v_dono is not null then
    return jsonb_build_object('ok', false, 'reason', 'imo_taken', 'ship', v_dono);
  end if;

  update public.ships
     set imo = v_imo
   where id = p_ship and imo is null
  returning imo into v_atual;

  if v_atual is null then
    -- ou o navio não existe, ou já tem IMO — nos dois casos, não mexeu
    select s.imo into v_atual from public.ships s where s.id = p_ship;
    if v_atual is null then
      return jsonb_build_object('ok', false, 'reason', 'no_ship');
    end if;
    return jsonb_build_object('ok', v_atual = v_imo, 'reason', 'already_set', 'imo', v_atual);
  end if;

  return jsonb_build_object('ok', true, 'imo', v_atual);
end;
$function$;

revoke all on function public.claim_vessel_imo(uuid, text) from public, anon;
grant execute on function public.claim_vessel_imo(uuid, text) to authenticated;
