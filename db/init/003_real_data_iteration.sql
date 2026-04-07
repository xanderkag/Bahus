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
