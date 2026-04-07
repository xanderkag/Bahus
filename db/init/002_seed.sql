insert into app_role (code, title)
values
  ('admin', 'Administrator'),
  ('manager', 'Manager')
on conflict (code) do nothing;

insert into app_user (email, display_name)
values
  ('admin@bakhus', 'Администратор Bakhus'),
  ('manager@bakhus', 'Александр')
on conflict (email) do nothing;

insert into app_user_role (user_id, role_id)
select u.id, r.id
from app_user u
join app_role r on
  (u.email = 'admin@bakhus' and r.code = 'admin')
  or (u.email = 'manager@bakhus' and r.code = 'manager')
on conflict do nothing;

insert into supplier (external_code, name, contract_type, vat_included)
values
  ('sup_nr', 'НР', 'net_price', true),
  ('sup_a', 'Supplier A', 'promo', true),
  ('sup_b', 'Supplier B', 'price_list', false)
on conflict (name) do nothing;

insert into client_account (external_code, name, inn, city, owner_user_id)
select
  seed.external_code,
  seed.name,
  seed.inn,
  seed.city,
  u.id
from (
  values
    ('cl_001', 'ООО "Гастроном на Петровке"', '7704123456', 'Москва'),
    ('cl_002', 'Ресторанный холдинг "Северный Берег"', '7812456789', 'Санкт-Петербург'),
    ('cl_003', 'HoReCa Group "Винная Карта"', '5403987654', 'Новосибирск'),
    ('cl_004', 'Бутик-бар "Malt & Oak Craft House"', '6678123490', 'Екатеринбург'),
    ('cl_005', 'ООО "Торговый дом Демо клиент с очень длинным названием для проверки селектора"', '7722334455', 'Москва')
) as seed(external_code, name, inn, city)
join app_user u on u.email = 'manager@bakhus'
where not exists (
  select 1
  from client_account c
  where c.external_code = seed.external_code
);

insert into catalog_product (external_code, title, normalized_title, brand, category, country, volume_l)
values
  ('cat_001', 'Vodka Premium 0.5', 'vodka premium 0.5', 'Demo Spirits', 'Водка', 'Россия', 0.5),
  ('cat_002', 'Vodka Premium 0.7', 'vodka premium 0.7', 'Demo Spirits', 'Водка', 'Россия', 0.7),
  ('cat_003', 'Cognac VS 0.5', 'cognac vs 0.5', 'Maison Demo', 'Коньяк', 'Франция', 0.5),
  ('cat_004', 'Prosecco DOC Extra Dry 0.75', 'prosecco doc extra dry 0.75', 'Veneto Demo', 'Игристое', 'Италия', 0.75)
on conflict do nothing;
