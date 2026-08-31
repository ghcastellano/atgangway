-- ============================================================
-- Hardening pós-advisor:
-- 1. search_path fixo na função de trigger
-- 2. handle_new_user não pode ser chamada via RPC pela API —
--    só o trigger de auth (supabase_auth_admin) executa
-- 3. is_admin fica executável apenas pelos papéis da API
--    (as policies a chamam no contexto do usuário; para anon
--    ela apenas retorna false)
-- ============================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
