-- ============================================================
-- Cadastro por e-mail: o trigger copia o formulário inteiro
--
-- Com a confirmação de e-mail ligada, o signUp não devolve sessão. O
-- formulário de cadastro (app/signup) então manda navio, IMO, porto,
-- telefone, rank e nacionalidade no raw_user_meta_data — mas o
-- handle_new_user só copiava full_name para public.profiles. Resultado:
-- a pessoa confirmava o e-mail, caía na loja, montava o carrinho e no
-- /checkout era mandada para /account redigitar tudo o que já tinha
-- preenchido.
--
-- Aqui o trigger passa a copiar cada campo que veio. port_id e rank_slug
-- têm FK: um valor inválido no metadata abortaria o insert em auth.users
-- e derrubaria o cadastro inteiro, então só entram quando existem na
-- tabela referenciada. O resto do trigger (email, role por admin_emails,
-- on conflict) fica igual. Grants da migração de hardening seguem
-- valendo — create or replace preserva o owner e as permissões.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  md jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_port_id uuid;
  v_rank_slug text;
begin
  -- Só vira uuid se tiver cara de uuid; e só entra se o porto existir.
  if (md ->> 'port_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select p.id into v_port_id
    from public.ports p
    where p.id = (md ->> 'port_id')::uuid;
  end if;

  select r.slug into v_rank_slug
  from public.crew_ranks r
  where r.slug = nullif(trim(md ->> 'rank_slug'), '');

  insert into public.profiles (
    id, email, full_name, role,
    whatsapp, vessel_name, vessel_imo, vessel_flag, port_id, rank_slug, nationality
  )
  values (
    new.id,
    new.email,
    coalesce(md ->> 'full_name', md ->> 'name'),
    case
      when exists (select 1 from public.admin_emails a where lower(a.email) = lower(new.email))
        then 'admin'
      else 'customer'
    end,
    nullif(trim(md ->> 'whatsapp'), ''),
    nullif(trim(md ->> 'vessel_name'), ''),
    nullif(trim(md ->> 'vessel_imo'), ''),
    nullif(upper(trim(md ->> 'vessel_flag')), ''),
    v_port_id,
    v_rank_slug,
    nullif(trim(md ->> 'nationality'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
