-- A página /credits precisa listar TODAS as fotos de navio que a busca
-- mostra — e search_vessels (security definer) mostra também os navios
-- do line-up ainda não revisados (active = false), que a RLS esconde do
-- anon. Uma RPC estreita, só com as colunas de atribuição, resolve sem
-- abrir a tabela.
create or replace function public.vessel_photo_credits()
returns table (name text, imo text, flag text, image_path text, image_credit text, image_source text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.name, s.imo, s.flag, s.image_path, s.image_credit, s.image_source
  from public.ships s
  where s.image_credit is not null and s.image_path is not null
  order by s.name;
$$;

grant execute on function public.vessel_photo_credits() to anon, authenticated;
