create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'review_status') then
    create type review_status as enum ('pending', 'checked', 'excluded');
  end if;
  if not exists (select 1 from pg_type where typname = 'issue_severity') then
    create type issue_severity as enum ('warning', 'error');
  end if;
  if not exists (select 1 from pg_type where typname = 'quote_mode') then
    create type quote_mode as enum ('internal', 'client');
  end if;
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type job_status as enum ('queued', 'running', 'done', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'match_type') then
    create type match_type as enum ('auto', 'manual');
  end if;
end $$;

create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_role (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null
);

create table if not exists app_user_role (
  user_id uuid not null references app_user(id) on delete cascade,
  role_id uuid not null references app_role(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table if not exists supplier (
  id uuid primary key default gen_random_uuid(),
  external_code text,
  name text not null unique,
  contract_type text,
  vat_included boolean,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_account (
  id uuid primary key default gen_random_uuid(),
  external_code text,
  name text not null,
  inn text,
  city text,
  owner_user_id uuid references app_user(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_account_name_trgm on client_account using gin (name gin_trgm_ops);
create index if not exists idx_client_account_inn on client_account(inn);

create table if not exists import_batch (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references supplier(id) on delete restrict,
  owner_user_id uuid references app_user(id) on delete set null,
  created_by_user_id uuid references app_user(id) on delete set null,
  source text,
  status text not null default 'pending',
  document_type text,
  source_format text,
  currency text,
  period text,
  sheet_name text,
  import_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_import_batch_supplier_id on import_batch(supplier_id);
create index if not exists idx_import_batch_owner_user_id on import_batch(owner_user_id);
create index if not exists idx_import_batch_import_date on import_batch(import_date desc);

create table if not exists import_file (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references import_batch(id) on delete cascade,
  original_name text not null,
  storage_path text,
  mime_type text,
  source_checksum text,
  size_bytes bigint,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_import_file_import_batch_id on import_file(import_batch_id);

create table if not exists import_row (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references import_batch(id) on delete cascade,
  row_index integer not null,
  external_product_id text,
  temp_product_id text,
  raw_name text not null,
  normalized_name text,
  manual_normalized_name text,
  normalization_note text,
  category text,
  country text,
  volume_l numeric(12,3),
  purchase_price numeric(14,2),
  rrc_min numeric(14,2),
  promo boolean not null default false,
  review_status review_status not null default 'pending',
  excluded boolean not null default false,
  selected_match_id uuid,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_batch_id, row_index)
);

create index if not exists idx_import_row_batch_row on import_row(import_batch_id, row_index);
create index if not exists idx_import_row_review_status on import_row(review_status);
create index if not exists idx_import_row_name_trgm on import_row using gin (raw_name gin_trgm_ops);
create index if not exists idx_import_row_normalized_name_trgm on import_row using gin (coalesce(normalized_name, '') gin_trgm_ops);

create table if not exists import_row_issue (
  id uuid primary key default gen_random_uuid(),
  import_row_id uuid not null references import_row(id) on delete cascade,
  severity issue_severity not null,
  field_name text,
  message text not null,
  raw_value text,
  created_at timestamptz not null default now()
);

create index if not exists idx_import_row_issue_row on import_row_issue(import_row_id);
create index if not exists idx_import_row_issue_severity on import_row_issue(severity);

create table if not exists catalog_product (
  id uuid primary key default gen_random_uuid(),
  external_code text,
  title text not null,
  normalized_title text,
  brand text,
  category text,
  country text,
  volume_l numeric(12,3),
  attributes jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_catalog_product_title_trgm on catalog_product using gin (title gin_trgm_ops);
create index if not exists idx_catalog_product_normalized_title_trgm on catalog_product using gin (coalesce(normalized_title, '') gin_trgm_ops);

create table if not exists row_product_match (
  id uuid primary key default gen_random_uuid(),
  import_row_id uuid not null references import_row(id) on delete cascade,
  catalog_product_id uuid not null references catalog_product(id) on delete cascade,
  match_type match_type not null,
  score numeric(8,4),
  is_selected boolean not null default false,
  created_by_user_id uuid references app_user(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_row_id, catalog_product_id, match_type)
);

create index if not exists idx_row_product_match_row on row_product_match(import_row_id, is_selected);
create index if not exists idx_row_product_match_catalog on row_product_match(catalog_product_id);

create table if not exists quote_document (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references client_account(id) on delete set null,
  source_import_batch_id uuid references import_batch(id) on delete set null,
  owner_user_id uuid references app_user(id) on delete set null,
  quote_number text not null,
  quote_date date,
  mode quote_mode not null default 'internal',
  status text not null default 'draft',
  note text,
  total_purchase numeric(14,2),
  total_sale numeric(14,2),
  total_margin numeric(14,2),
  export_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_number)
);

create index if not exists idx_quote_document_client_id on quote_document(client_id);
create index if not exists idx_quote_document_owner_user_id on quote_document(owner_user_id);

create table if not exists quote_item (
  id uuid primary key default gen_random_uuid(),
  quote_document_id uuid not null references quote_document(id) on delete cascade,
  source_import_row_id uuid references import_row(id) on delete set null,
  catalog_product_id uuid references catalog_product(id) on delete set null,
  line_no integer not null,
  name_snapshot text not null,
  category_snapshot text,
  country_snapshot text,
  volume_l numeric(12,3),
  qty numeric(12,3) not null default 1,
  purchase_price numeric(14,2),
  sale_price numeric(14,2),
  rrc_min numeric(14,2),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_document_id, line_no)
);

create index if not exists idx_quote_item_quote_document_id on quote_item(quote_document_id, line_no);
create index if not exists idx_quote_item_source_import_row_id on quote_item(source_import_row_id);

create table if not exists quote_item_alternative (
  id uuid primary key default gen_random_uuid(),
  quote_item_id uuid not null references quote_item(id) on delete cascade,
  import_row_id uuid references import_row(id) on delete set null,
  catalog_product_id uuid references catalog_product(id) on delete set null,
  rank_no integer not null default 1,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_quote_item_alternative_item on quote_item_alternative(quote_item_id, rank_no);

create table if not exists job_run (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  target_type text not null,
  target_id uuid,
  status job_status not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references app_user(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_job_run_target on job_run(target_type, target_id);
create index if not exists idx_job_run_status on job_run(status, created_at desc);
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
do $$
begin
  if not exists (select 1 from pg_type where typname = 'import_file_kind') then
    create type import_file_kind as enum ('price', 'attachment', 'request');
  end if;
end $$;

alter table import_batch
  add column if not exists request_ref text,
  add column if not exists request_title text,
  add column if not exists manager_note text;

alter table import_file
  add column if not exists file_kind import_file_kind not null default 'price',
  add column if not exists linked_quote_document_id uuid references quote_document(id) on delete set null,
  add column if not exists note text;

create index if not exists idx_import_file_kind on import_file(file_kind);
create index if not exists idx_import_file_linked_quote on import_file(linked_quote_document_id);

create table if not exists catalog_supplier_offer (
  id uuid primary key default gen_random_uuid(),
  catalog_product_id uuid not null references catalog_product(id) on delete cascade,
  supplier_id uuid not null references supplier(id) on delete cascade,
  import_batch_id uuid references import_batch(id) on delete set null,
  import_row_id uuid references import_row(id) on delete set null,
  purchase_price numeric(14,2),
  rrc_min numeric(14,2),
  promo boolean not null default false,
  offer_date date,
  is_current boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_catalog_supplier_offer_product on catalog_supplier_offer(catalog_product_id, supplier_id);
create index if not exists idx_catalog_supplier_offer_current on catalog_supplier_offer(is_current, offer_date desc);
create index if not exists idx_catalog_supplier_offer_import_row on catalog_supplier_offer(import_row_id);

alter table quote_document
  add column if not exists request_title text,
  add column if not exists manager_name text,
  add column if not exists export_status text not null default 'draft';

alter table quote_item
  add column if not exists selected_alternative_id uuid references quote_item_alternative(id) on delete set null,
  add column if not exists line_snapshot_payload jsonb not null default '{}'::jsonb;

create table if not exists quote_export (
  id uuid primary key default gen_random_uuid(),
  quote_document_id uuid not null references quote_document(id) on delete cascade,
  format text not null,
  status text not null default 'queued',
  storage_path text,
  payload jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references app_user(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quote_export_quote_document on quote_export(quote_document_id, created_at desc);
create index if not exists idx_quote_export_status on quote_export(status, created_at desc);
alter table import_batch
  add column if not exists processing_status text not null default 'uploaded',
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_finished_at timestamptz,
  add column if not exists last_webhook_at timestamptz;

alter table import_file
  add column if not exists processing_status text not null default 'uploaded',
  add column if not exists processing_pipeline text,
  add column if not exists dispatch_payload jsonb not null default '{}'::jsonb,
  add column if not exists parse_result jsonb not null default '{}'::jsonb,
  add column if not exists last_error text;

create index if not exists idx_import_batch_processing_status on import_batch(processing_status, created_at desc);
create index if not exists idx_import_file_processing_status on import_file(processing_status, uploaded_at desc);

create index if not exists idx_job_run_type_target on job_run(type, target_type, created_at desc);
