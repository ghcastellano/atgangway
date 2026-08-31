-- O corte deixa de chegar em silêncio: a última chamada.
--
-- A janela fechava sem aviso nenhum — quem estava montando a caixa
-- descobria no empurrão do checkout. Nas 12 horas antes do corte está o
-- pedido de maior margem da semana: é quando se compra o que FALTOU,
-- não o que se planejou.
--
-- O plano original era "e-mail para quem tem carrinho com itens", e ele
-- é impossível de verdade: o carrinho vive no localStorage do navegador,
-- o servidor não sabe quem tem o quê. O desenho honesto é melhor:
-- lembrar TODA a tripulação cujo navio fecha em 12h — o público do
-- pedido é quem embarca, não só quem já abriu carrinho — e usar a lista
-- de desejos, que É server-side, como o toque pessoal do texto.
--
-- Livro-razão próprio, como o de order_emails: reivindicar ANTES de
-- mandar é o que garante um e-mail por pessoa por escala, mesmo com o
-- cron repetindo de hora em hora. A chave leva a DATA da escala: se o
-- mesmo casco voltar no mês seguinte, é outra escala e outro lembrete.
create table if not exists public.call_reminders (
  user_id   uuid not null references auth.users(id) on delete cascade,
  ship_id   uuid not null references public.ships(id) on delete cascade,
  call_date date not null,
  recipient text,
  sent_at   timestamptz not null default now(),
  primary key (user_id, ship_id, call_date)
);

-- Ninguém lê nem escreve por fora: só as funções SECURITY DEFINER.
alter table public.call_reminders enable row level security;

create or replace function public.claim_call_reminders(p_secret text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_out jsonb;
begin
  if not exists (
    select 1 from public.app_secrets s
    where s.key = 'cron_secret' and s.value = p_secret and length(p_secret) >= 10
  ) then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  with alvo as (
    select
      p.id as user_id,
      s.id as ship_id,
      (s.eta at time zone 'America/Sao_Paulo')::date as call_date,
      coalesce(nullif(p.email, ''), u.email) as to_email,
      coalesce(nullif(p.full_name, ''), 'sailor') as to_name,
      s.name as ship,
      s.berth,
      s.eta,
      s.eta - make_interval(hours => coalesce(s.cutoff_hours, 24)) as closes_at,
      (select count(*)::int from public.wishlists w where w.user_id = p.id) as wish_count
    from public.profiles p
    join public.ships s on s.id = p.ship_id
    left join auth.users u on u.id = p.id
    where s.active
      -- a janela AINDA está aberta e fecha nas próximas 12 horas:
      and s.eta - make_interval(hours => coalesce(s.cutoff_hours, 24)) > now()
      and s.eta - make_interval(hours => coalesce(s.cutoff_hours, 24)) <= now() + interval '12 hours'
  ), reivindica as (
    insert into public.call_reminders (user_id, ship_id, call_date, recipient)
    select a.user_id, a.ship_id, a.call_date, a.to_email
    from alvo a
    where a.to_email is not null
    on conflict (user_id, ship_id, call_date) do nothing
    returning user_id, ship_id, call_date
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', a.user_id, 'ship_id', a.ship_id, 'call_date', a.call_date,
           'to_email', a.to_email, 'to_name', a.to_name,
           'ship', a.ship, 'berth', a.berth,
           'eta', a.eta, 'closes_at', a.closes_at,
           'wish_count', a.wish_count
         )), '[]'::jsonb)
    into v_out
  from alvo a
  join reivindica r
    on r.user_id = a.user_id and r.ship_id = a.ship_id and r.call_date = a.call_date;

  return jsonb_build_object('ok', true, 'reminders', v_out);
end;
$$;

-- Se o SMTP falhar, o cron devolve a reivindicação para a próxima
-- passada tentar de novo — mesma disciplina do claim de order_emails.
create or replace function public.release_call_reminder(
  p_user uuid, p_ship uuid, p_call_date date, p_secret text default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (
    select 1 from public.app_secrets s
    where s.key = 'cron_secret' and s.value = p_secret and length(p_secret) >= 10
  ) then
    return false;
  end if;
  delete from public.call_reminders
   where user_id = p_user and ship_id = p_ship and call_date = p_call_date;
  return found;
end;
$$;

revoke all on function public.claim_call_reminders(text) from public, anon, authenticated;
revoke all on function public.release_call_reminder(uuid, uuid, date, text) from public, anon, authenticated;
