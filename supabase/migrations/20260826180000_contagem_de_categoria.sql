-- A home dizia "Food & Drinks · 86 items" e a listagem entregava 60.
--
-- A causa é um clássico de LEFT JOIN com condição na cláusula ON: a
-- linha do produto inativo NÃO some, ela só volta com p.* nulo. E a
-- contagem era sobre `pc.product_id`, que continua preenchido — então
-- todo produto desativado seguia contando.
--
-- Contar `p.id` corrige porque NULL não entra em count(distinct). E
-- `sub.active` entrou junto: subcategoria desativada também não deve
-- somar para o pai, senão o número volta a discordar do que a pessoa
-- encontra quando clica.
--
-- Número de categoria que não bate com a listagem é pior do que não ter
-- número: quem viu 86 e achou 60 passa a duvidar do resto da loja.
create or replace function public.category_counts()
returns table(category_id uuid, product_count bigint)
language sql stable
set search_path to 'public', 'pg_temp'
as $function$
  select c.id, count(distinct p.id)
  from public.categories c
  left join public.categories sub on sub.path like c.path || '%' and sub.active
  left join public.product_categories pc on pc.category_id = sub.id
  left join public.products p on p.id = pc.product_id and p.active
  where c.active
  group by c.id;
$function$;
