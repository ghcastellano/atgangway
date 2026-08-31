-- Cadastro de produto estava quebrado em produção.
--
-- `products.price_usd` é da primeira versão da loja, quando o preço era
-- numérico em dólar. O catálogo novo guarda o preço em `price_cents`, na
-- variante, e nenhum caminho de escrita preenche mais a coluna antiga —
-- que continuou `not null` sem default. Resultado: qualquer INSERT em
-- products falhava com 23502, tanto no formulário de novo produto quanto
-- na importação de planilha. O erro morria no `if (error) return`, então
-- a tela só não fazia nada.
--
-- A coluna não pode ser derrubada: a tela antiga (/admin/products) ainda
-- lê e escreve nela. Então ganha default, e passa a ser mantida em dia
-- pelo mesmo gatilho que consolida o preço das variantes.

alter table public.products alter column price_usd set default 0;

update public.products set price_usd = price_cents / 100.0
where price_usd is distinct from price_cents / 100.0;

create or replace function public.products_rollup(p_product uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_min integer; v_max integer; v_cmp integer;
  v_stock integer; v_count smallint; v_default uuid;
begin
  select min(v.price_cents), max(v.price_cents),
         coalesce(sum(v.stock_qty), 0), count(*)::smallint
    into v_min, v_max, v_stock, v_count
  from public.product_variants v
  where v.product_id = p_product and v.active;

  select v.id, v.compare_at_cents into v_default, v_cmp
  from public.product_variants v
  where v.product_id = p_product and v.active
  order by v.price_cents asc, v.sort_order asc limit 1;

  update public.products p
  set price_cents        = coalesce(v_min, 0),
      max_price_cents    = v_max,
      compare_at_cents   = case when v_cmp is not null and v_cmp > coalesce(v_min, 0)
                                then v_cmp else null end,
      stock_qty          = coalesce(v_stock, 0),
      variant_count      = coalesce(v_count, 0),
      default_variant_id = v_default,
      -- Coluna de legado: a tela antiga do admin ainda a mostra, então
      -- ela tem de contar a mesma verdade que price_cents.
      price_usd          = coalesce(v_min, 0) / 100.0,
      updated_at         = now()
  where p.id = p_product;
end;
$function$;

-- Segundo motivo de a importação nunca ter gravado: os índices únicos de
-- `sku` e `slug` eram PARCIAIS (`where ... is not null`). ON CONFLICT só
-- casa com índice parcial se a instrução repetir o mesmo predicado, e o
-- PostgREST — que é quem o admin usa, via `upsert({ onConflict: "sku" })`
-- — não tem como repetir. O erro era 42P10, engolido pelo `if (error)`.
--
-- Índice cheio resolve sem afrouxar nada: em Postgres NULL não conflita
-- com NULL, então continuam podendo existir vários produtos sem sku.
drop index if exists public.products_sku_key;
create unique index products_sku_key on public.products (sku);

drop index if exists public.products_slug_key;
create unique index products_slug_key on public.products (slug);
