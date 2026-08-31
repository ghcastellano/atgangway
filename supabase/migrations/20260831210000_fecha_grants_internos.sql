-- Function interna não é API.
-- (aplicada via MCP em 31/08/2026 em duas partes: `fecha_grants_internos`
--  e `fecha_grants_internos_public`)
--
-- O analisador do Supabase apontou 23 funções SECURITY DEFINER com
-- EXECUTE para `anon`. A maioria é proposital — as guardadas por
-- segredo (cron, Stripe) e por auth.uid(). Estas não eram:
--
--   * sete funções de GATILHO: rodam por evento de tabela, ninguém
--     deveria poder chamá-las pelo PostgREST;
--   * products_rollup, que ESCREVE em products (preço, estoque,
--     contagem de variantes) — a auxiliar dos gatilhos, aberta para a
--     internet inteira.
--
-- Detalhe que custou uma rodada: revogar de `anon`/`authenticated` não
-- surtiu efeito. O acesso vinha de PUBLIC — o Postgres concede EXECUTE
-- a PUBLIC por padrão ao criar função, e os dois papéis herdavam daí.
--
-- Testado antes de aplicar, numa transação desfeita: com o grant
-- revogado, um UPDATE em ships pelo papel `authenticated` (o admin
-- editando no painel) dispara o gatilho normalmente — gatilho não
-- checa EXECUTE no disparo, e as funções são definer, então seguem
-- chamando products_rollup como donas.
revoke execute on function public.award_referral_credit()        from public, anon, authenticated;
revoke execute on function public.categories_cascade_path()      from public, anon, authenticated;
revoke execute on function public.categories_rebuild_path()      from public, anon, authenticated;
revoke execute on function public.product_images_primary_trg()   from public, anon, authenticated;
revoke execute on function public.product_variants_rollup_trg()  from public, anon, authenticated;
revoke execute on function public.products_search_trg()          from public, anon, authenticated;
revoke execute on function public.ships_search_name_trg()        from public, anon, authenticated;
revoke execute on function public.products_rollup(uuid)          from public, anon, authenticated;

-- touch_updated_at fica: não é definer e só carimba updated_at, então
-- chamá-la direto não faz nada — revogar mexeria no caminho de escrita
-- de pedidos sem ganho nenhum.

-- As duas do programa de indicação recebiam um id de usuário QUALQUER
-- por parâmetro, sem guarda, furando a RLS por serem definer: com o
-- UUID de outra pessoa dava para ler quantas indicações ela tem.
--
-- A guarda mora na contagem, e a faixa (referral_rate) herda dela: quem
-- não é o dono nem admin recebe zero indicações e, por consequência, a
-- faixa base — informação pública do programa. Assinatura intacta, o
-- app continua chamando igual.
create or replace function public.referral_order_count(p_user uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when p_user = auth.uid() or public.is_admin() then (
      select count(*)::int
      from public.orders o
      join public.profiles p on p.id = o.user_id
      where p.referred_by = p_user
        and o.status not in ('cancelled', 'awaiting_deposit')
    )
    else 0
  end;
$$;
