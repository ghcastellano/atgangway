-- Estoque: o único bug de dinheiro que sobrou. Aplicada via MCP em 2026-09-02.
--
-- place_order CONFERIA stock_qty mas nunca baixava, e a conferência era
-- sem lock: duas transações liam "1" e as duas vendiam. Três peças, na
-- mesma transação do pedido:
--   1. lock das variantes (select ... for update, ordenado por id) ANTES de conferir;
--   2. baixa após gravar os itens, só para quem track_stock;
--   3. CHECK stock_qty >= 0 como última linha de defesa.
-- E a volta (gatilho order_stock_on_status): cancelado devolve;
-- descancelado (Undo do admin) baixa de novo, e falha alto se não houver.
--
-- O que NÃO muda: track_stock continua false nas 131 variantes. Ligar é
-- decisão de quem tem o estoque na mão — 119 estão com stock_qty = 0, e
-- ligar em massa esvaziaria a loja num clique. A chave é por produto.
--
-- Provado com pgTAP (supabase/tests/dinheiro.sql): 11/11, em transação
-- com rollback contra o banco de produção.
--
-- O corpo completo do place_order novo está no histórico de migrações
-- do projeto (estoque_baixa_no_pedido); aqui ficam as partes que mudam.

alter table public.product_variants
  add constraint product_variants_stock_nao_negativo check (stock_qty >= 0);

-- Dentro de place_order, antes da conferência de v_chk:
--   perform 1 from public.product_variants v
--    where v.id in (select x.id from jsonb_to_recordset(p_items) as x(id uuid, qty int))
--    order by v.id for update;
-- Depois do insert em order_items:
--   update public.product_variants v set stock_qty = v.stock_qty - k.qty
--     from (select x.id, sum(x.qty)::int as qty from jsonb_to_recordset(p_items) as x(id uuid, qty int) group by x.id) k
--    where v.id = k.id and v.track_stock;

create or replace function public.order_stock_on_status_trg()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.product_variants v set stock_qty = v.stock_qty + i.qty
      from public.order_items i where i.order_id = new.id and i.variant_id = v.id and v.track_stock;
  elsif old.status = 'cancelled' and new.status <> 'cancelled' then
    update public.product_variants v set stock_qty = v.stock_qty - i.qty
      from public.order_items i where i.order_id = new.id and i.variant_id = v.id and v.track_stock;
  end if;
  return new;
end; $$;
drop trigger if exists order_stock_on_status on public.orders;
create trigger order_stock_on_status after update of status on public.orders
  for each row execute function public.order_stock_on_status_trg();
