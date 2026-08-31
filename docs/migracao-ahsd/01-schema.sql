-- AHSD — esquema para o projeto Supabase NOVO.
-- Rode isto no SQL Editor do projeto novo, antes de 02-dados.sql.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.ahsd_resultados (
  id uuid primary key default gen_random_uuid(),
  client_id text unique,
  created_at timestamptz not null default now(),
  instrument_id text not null,
  acronym text not null,
  instrument_name text not null,
  respondent text,
  total_score numeric not null,
  max_score numeric not null,
  band_label text not null,
  severity text not null,
  positive boolean,
  metric_is_mean boolean not null default false,
  subscales jsonb,
  constraint ahsd_acronym_len check (char_length(acronym) <= 30),
  constraint ahsd_band_len check (char_length(band_label) <= 120),
  constraint ahsd_client_len check (char_length(client_id) <= 64),
  constraint ahsd_instr_id_len check (char_length(instrument_id) <= 60),
  constraint ahsd_instr_nome_len check (char_length(instrument_name) <= 160),
  constraint ahsd_resp_len check (char_length(respondent) <= 80),
  constraint ahsd_sev_len check (char_length(severity) <= 20),
  constraint ahsd_max_faixa check (max_score >= 0 and max_score <= 1000),
  constraint ahsd_total_faixa check (total_score >= -1000 and total_score <= 1000),
  constraint ahsd_subescalas_tam check (pg_column_size(subscales) <= 16384)
);

create table if not exists public.ahsd_admin_config (
  id integer primary key,
  senha_hash text
);

alter table public.ahsd_resultados enable row level security;
alter table public.ahsd_admin_config enable row level security;

-- Mesma política do banco antigo: o formulário grava, ninguém lê pelo
-- REST. A leitura do painel passa só pela função abaixo, com senha.
drop policy if exists ahsd_insercao_anonima on public.ahsd_resultados;
create policy ahsd_insercao_anonima on public.ahsd_resultados
  for insert to anon, authenticated with check (true);

-- ahsd_admin_config fica sem policy de propósito: RLS ligada e nenhuma
-- policy = ninguém alcança pelo REST, só a função SECURITY DEFINER.

create or replace function public.ahsd_admin_listar_resultados(p_senha text)
returns setof public.ahsd_resultados
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  if not exists (
    select 1 from ahsd_admin_config
    where senha_hash = crypt(p_senha, senha_hash)
  ) then
    raise exception 'senha incorreta';
  end if;
  return query
    select * from ahsd_resultados order by created_at desc limit 2000;
end;
$function$;
