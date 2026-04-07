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
