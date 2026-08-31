-- ============================================================
-- Vessel Supplier — seed inicial (staff, line-up e catálogo)
-- ============================================================

-- Staff: emails aqui viram admin automaticamente no signup
insert into public.admin_emails (email) values
  ('ghcastellano@gmail.com'),
  ('anscastellano@gmail.com')
on conflict do nothing;

-- Se a conta já existir quando o seed rodar, promove também
update public.profiles p
set role = 'admin'
from public.admin_emails a
where lower(p.email) = lower(a.email);

-- Line-up de demonstração (ETAs relativas ao momento do seed)
insert into public.ships (name, berth, eta, cutoff_hours, active) values
  ('MSC LORENA',        '39', now() + interval '62 hours',  26, true),
  ('CMA CGM MELODY',    '33', now() + interval '110 hours', 26, true),
  ('MAERSK LOTA',       '37', now() + interval '150 hours', 26, true),
  ('NYK CONSTELLATION', '35', now() + interval '175 hours', 26, true);

-- Catálogo fase 0
insert into public.products (name, description, emoji, category, price_usd, sort_order) values
  ('eSIM Brasil 20 GB',    'Activates on docking · 30 days',        '📶', 'Connectivity', 18.00, 10),
  ('eSIM Brasil 50 GB',    'Heavy calls & streaming',               '🛰️', 'Connectivity', 32.00, 20),
  ('Snack kit grande',     'Chocolate, biscoitos, castanhas',       '🍫', 'Food',         25.00, 30),
  ('Brazilian coffee kit', '500g moído + filtros',                  '☕', 'Food',         18.00, 40),
  ('Drinks pack (no-alc)', '12 latas sortidas, geladas',            '🥤', 'Food',         16.00, 50),
  ('Hygiene kit',          'Shampoo, sabonete, pasta, barbear',     '🧴', 'Care',         22.00, 60),
  ('First-need pharmacy',  'Analgésico, band-aid, vitamina C',      '🩹', 'Care',         19.00, 70),
  ('Deck kit',             'Protetor solar FPS50 + boné',           '🧢', 'Care',         21.00, 80),
  ('JBL Go 4 speaker',     'Lacrada, NF incluída',                  '🎧', 'Tech',         45.00, 90),
  ('Powerbank 20.000 mAh', 'Carrega 4 celulares',                   '🔋', 'Tech',         29.00, 100),
  ('Cable & adapter kit',  'USB-C, Lightning, tomada BR',           '🔌', 'Tech',         15.00, 110),
  ('Poker set compacto',   'Para a próxima perna de viagem',        '🃏', 'Tech',         14.00, 120);
