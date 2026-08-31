-- Um passo atrás no board.
-- (aplicada via MCP em 31/08/2026 como `desfazer_status_do_pedido`)
--
-- O board só andava para frente: `credited`, `cancelled` e `delivered`
-- não tinham transição de saída, então um clique errado era definitivo
-- — e "↺ Credit (diverted)" fica ao lado da ação principal, com um
-- ícone que parece justamente um desfazer. Aconteceu com dois pedidos
-- reais (AG-1201 e AG-1202), e a única saída foi SQL na mão.
--
-- Guardar o estado anterior resolve sem inventar máquina de estados
-- nova: desfazer é restaurar o que está escrito aqui, e a coluna zera
-- depois — um passo, não uma pilha.
alter table public.orders add column if not exists previous_status text;
alter table public.orders add column if not exists status_changed_at timestamptz;

comment on column public.orders.previous_status is
  'Estado imediatamente anterior, gravado a cada mudança pelo board. NULL = nada a desfazer (ou o desfazer já foi usado).';
