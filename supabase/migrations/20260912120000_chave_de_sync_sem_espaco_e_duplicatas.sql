-- Onze navios em dobro no line-up, e quatro com o nome cortado.
--
-- A DUPLICATA. ship_key() troca cada trecho não alfanumérico por um
-- espaço — e um nome que termina em ")" ou "." ganhava um espaço no
-- fim: 'NC BRISA (REB S/L)' → 'NC BRISA REB S L '. Foi assim que as
-- escalas de agosto foram gravadas. Depois, sync_ship_eta passou a
-- procurar por trim(ship_key(nome)) — sem o espaço — e nunca mais achou
-- essas linhas: em 31/08 22:00 nasceu uma segunda escala para cada
-- navio com parêntese no nome (NC BRISA, NC BRAVO, LOG-IN ENDURANCE,
-- FLUMAR MACEIO…). A antiga ficou congelada, a nova é a que o sync
-- atualiza. Nenhuma das 22 linhas tem pedido nem cliente no perfil.
--
-- O CORTE. A CODESP limita o nome a 25 caracteres na própria página:
-- 'MERCOSUL FORTALEZA (CNC L', 'CMA CGM VERACRUZ (REB S/L'. Parêntese
-- aberto e nunca fechado não é nome, é corte — o parser passa a tirar o
-- fragmento (lib/lineup.ts), e aqui os quatro já gravados são
-- corrigidos, senão a próxima passada criaria uma escala nova para cada
-- um com a chave "limpa".
--
-- Quatro passos, nesta ordem: a função deixa de produzir espaço no fim;
-- as duplicatas são fundidas (fica a linha viva, a que o sync atualiza;
-- histórico e avisos apontam para ela); os nomes cortados são
-- corrigidos; as chaves são recalculadas para todos e um índice ÚNICO
-- garante que isto não volta — se voltar, o sync falha alto em vez de
-- duplicar em silêncio.

-- ---------------------------------------------------------------- 1
create or replace function public.ship_key(p_name text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select nullif(trim(
    regexp_replace(
      translate(upper(coalesce(p_name, '')),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÑÇ', 'AAAAAEEEEIIIIOOOOOUUUUNC'),
      '[^A-Z0-9]+', ' ', 'g')
  ), '')
$$;

-- ---------------------------------------------------------------- 2
-- Fica a linha cuja chave já não tem espaço (é a que o sync encontra e
-- atualiza); em empate, a sincronizada por último. Tudo que apontava
-- para a linha congelada passa a apontar para a viva — o histórico de
-- ETA junta as duas trilhas, nada se perde.
create temp table _dup on commit drop as
  select s.id as stale, k.keeper
  from public.ships s
  join (
    select trim(sync_key) as key,
           (array_agg(id order by (sync_key = trim(sync_key)) desc, last_synced_at desc nulls last, created_at desc))[1] as keeper
    from public.ships
    where sync_key is not null
    group by trim(sync_key)
    having count(*) > 1
  ) k on trim(s.sync_key) = k.key and s.id <> k.keeper;

update public.ship_eta_history h set ship_id = d.keeper from _dup d where h.ship_id = d.stale;
update public.admin_notifications a set ship_id = d.keeper from _dup d where a.ship_id = d.stale;
update public.profiles p set ship_id = d.keeper from _dup d where p.ship_id = d.stale;
update public.orders o set ship_id = d.keeper from _dup d where o.ship_id = d.stale;
delete from public.call_reminders c using _dup d where c.ship_id = d.stale;
delete from public.ships s using _dup d where s.id = d.stale;

-- ---------------------------------------------------------------- 3
update public.ships
   set name = regexp_replace(name, '\s*\([^)]*$', '')
 where name ~ '\(' and name !~ '\)';

-- ---------------------------------------------------------------- 4
-- Escala sincronizada sempre teve sync_key = ship_key(nome); recalcular
-- com a função nova é só tirar o espaço — e alinhar os quatro renomeados.
update public.ships
   set sync_key = public.ship_key(name)
 where sync_key is not null;
update public.ships
   set search_name = public.ship_key(name);

drop index if exists public.ships_sync_key_idx;
create unique index ships_sync_key_uniq on public.ships (sync_key) where sync_key is not null;
