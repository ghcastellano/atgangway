-- O sync do line-up chamava sync_ship_eta UMA vez por navio: ~165
-- chamadas HTTP por hora, 18.050 no relatório — cada uma com a
-- sobrecarga do PostgREST (set_config, JWT, JSON) e uma ida e volta
-- Vercel → Supabase. Agora o cron manda a lista inteira numa chamada e
-- o banco itera por dentro, com a MESMA função de sempre por linha.
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
        p_secret := p_secret
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
