-- Marcações alimentares no produto: halal, vegetariano, vegano, sem
-- glúten, sem lactose, contém nozes.
--
-- Boa parte das tripulações que passam por Santos é filipina, indiana e
-- ucraniana; "posso comer isso?" é a segunda pergunta depois do preço,
-- e o catálogo não respondia. A lista é fechada (check) para o card
-- desenhar selos de um vocabulário só, sem texto livre. Começa vazia:
-- quem sabe o que cada item é, é quem compra no mercado.
alter table public.products
  add column if not exists dietary text[] not null default '{}';

alter table public.products
  drop constraint if exists products_dietary_conhecidas;
alter table public.products
  add constraint products_dietary_conhecidas
  check (dietary <@ array['halal','vegetarian','vegan','gluten_free','lactose_free','contains_nuts']::text[]);

-- A busca do catálogo devolve o card inteiro por esta RPC; o selo vem
-- junto, sem segunda ida ao banco.
comment on column public.products.dietary is
  'Selos: halal, vegetarian, vegan, gluten_free, lactose_free, contains_nuts. Vazio = não informado.';

-- list_products passa a devolver dietary (o tipo de retorno muda, então
-- a função é recriada; corpo igual ao anterior + a coluna).
drop function if exists public.list_products(text, uuid, text, text, text, text, integer);

create function public.list_products(p_category text default null, p_brand uuid default null, p_query text default null, p_badge text default null, p_sort text default 'featured', p_cursor text default null, p_limit integer default 24)
returns table(id uuid, slug text, name text, short_description text, brand_name text, price_cents integer, compare_at_cents integer, max_price_cents integer, stock_qty integer, tracks_stock boolean, variant_count smallint, primary_image_path text, badge text, sku text, sort_order integer, default_variant_id uuid, dietary text[], cursor text)
language sql stable
set search_path to 'public', 'pg_temp'
as $function$
  with params as (
    select least(greatest(coalesce(p_limit, 24), 1), 60) as lim,
           nullif(btrim(coalesce(p_query, '')), '') as q,
           split_part(coalesce(p_cursor, ''), '|', 1) as c1,
           split_part(coalesce(p_cursor, ''), '|', 2) as c2,
           split_part(coalesce(p_cursor, ''), '|', 3) as c3
  ),
  filtered as (
    select p.*, b.name as brand_name,
           case when (select q from params) is null then 0
                else ts_rank(p.search_tsv, websearch_to_tsquery('simple', (select q from params)))
           end as rank
    from public.products p
    left join public.brands b on b.id = p.brand_id
    where p.active
      and (p_category is null or exists (
            select 1 from public.product_categories pc
            join public.categories c on c.id = pc.category_id
            where pc.product_id = p.id and c.path like p_category || '%'))
      and (p_brand is null or p.brand_id = p_brand)
      and (p_badge is null or p.badge = p_badge)
      and ((select q from params) is null
        or p.search_tsv @@ websearch_to_tsquery('simple', (select q from params))
        or p.name % (select q from params)
        or p.sku ilike (select q from params) || '%')
  )
  select f.id, f.slug, f.name, f.short_description, f.brand_name,
         f.price_cents, f.compare_at_cents, f.max_price_cents,
         f.stock_qty, f.tracks_stock, f.variant_count, f.primary_image_path,
         f.badge, f.sku, f.sort_order, f.default_variant_id, f.dietary,
         case p_sort
           when 'price_asc'  then f.price_cents::text || '|' || f.id::text || '|'
           when 'price_desc' then f.price_cents::text || '|' || f.id::text || '|'
           when 'newest'     then extract(epoch from f.created_at)::bigint::text || '|' || f.id::text || '|'
           else f.sort_order::text || '|' || f.name || '|' || f.id::text
         end as cursor
  from filtered f, params
  where case
      when p_cursor is null or p_cursor = '' then true
      when p_sort = 'price_asc'  then (f.price_cents, f.id) > (params.c1::int, params.c2::uuid)
      when p_sort = 'price_desc' then (f.price_cents, f.id) < (params.c1::int, params.c2::uuid)
      when p_sort = 'newest'     then (extract(epoch from f.created_at)::bigint, f.id) < (params.c1::bigint, params.c2::uuid)
      else (f.sort_order, f.name, f.id) > (params.c1::int, params.c2, params.c3::uuid)
    end
  order by
    case when params.q is not null then -f.rank else 0 end,
    case when p_sort = 'price_asc'  then f.price_cents end asc,
    case when p_sort = 'price_desc' then f.price_cents end desc,
    case when p_sort = 'newest'     then f.created_at end desc,
    case when p_sort not in ('price_asc','price_desc','newest') then f.sort_order end asc,
    f.name asc, f.id asc
  limit (select lim from params);
$function$;

grant execute on function public.list_products(text, uuid, text, text, text, text, integer) to anon, authenticated;
