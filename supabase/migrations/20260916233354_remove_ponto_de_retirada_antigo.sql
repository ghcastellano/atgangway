-- O ponto de retirada no balcão do bar parceiro deixou de existir: o bar
-- saiu da sociedade. Estava inativo, sem pedido e sem perfil apontando
-- para ele; as regras de entrega saem junto (on delete cascade).
delete from public.ports
 where slug = 'mariners-bar'
   and not exists (select 1 from public.orders o where o.port_id = ports.id)
   and not exists (select 1 from public.profiles p where p.port_id = ports.id);
