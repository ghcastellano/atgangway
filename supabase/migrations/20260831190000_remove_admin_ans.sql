-- Revoga o acesso de staff de anscastellano@gmail.com.
-- (aplicada via MCP em 31/08/2026 como `remove_admin_ans`, a pedido do
--  dono da conta)
--
-- A concessão vinha de duas fontes, as duas removidas do repositório:
-- o seed inicial (20260822000002) e a migração dedicada
-- 20260829000000_admin_mariana.sql, que foi apagada — ela existia só
-- para conceder. Sem isso, um banco novo nasceria concedendo de novo.
--
-- Não havia usuário nem perfil com esse e-mail (a conta nunca chegou a
-- ser criada), então o delete resolve. O update fica junto por
-- segurança: se a conta existisse, perderia o papel de admin também.
delete from public.admin_emails where lower(email) = lower('anscastellano@gmail.com');

update public.profiles p
   set role = 'customer'
  from auth.users u
 where u.id = p.id
   and lower(u.email) = lower('anscastellano@gmail.com')
   and p.role = 'admin';
