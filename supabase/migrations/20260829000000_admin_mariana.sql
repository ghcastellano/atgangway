-- Mariana Castellano (anscastellano@gmail.com) entra como staff.
--
-- admin_emails e a lista-fonte: o gatilho handle_new_user le ela no
-- signup e ja cria o perfil com role='admin'. Como ela ainda nao tinha
-- conta quando isto rodou, bastou entrar na lista — ao criar o login
-- (por e-mail ou Google) ela vira admin sozinha. O UPDATE cobre o caso
-- de a conta ja existir; e no-op caso contrario. Mesmo padrao do seed,
-- idempotente.
insert into public.admin_emails (email) values
  ('anscastellano@gmail.com')
on conflict do nothing;

update public.profiles p
set role = 'admin'
where lower(p.email) = lower('anscastellano@gmail.com')
  and p.role <> 'admin';
