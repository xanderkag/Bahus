-- 001_first_slice.sql
-- Базовые SQL-запросы для первой backend-итерации.

-- imports:list
select
  ib.id,
  ib.supplier_id,
  s.name as supplier_name,
  ib.document_type,
  ib.source_format,
  ib.status,
  ib.currency,
  ib.period,
  ib.import_date,
  coalesce(price_file.original_name, first_file.original_name) as source_file,
  count(distinct ir.id) as rows_total,
  count(distinct iri.id) as issues_total,
  count(distinct case when ifl.file_kind = 'attachment' then ifl.id end) as attachments_total
from import_batch ib
join supplier s on s.id = ib.supplier_id
left join lateral (
  select f.original_name
  from import_file f
  where f.import_batch_id = ib.id and f.file_kind = 'price'
  order by f.uploaded_at asc
  limit 1
) price_file on true
left join lateral (
  select f.original_name
  from import_file f
  where f.import_batch_id = ib.id
  order by f.uploaded_at asc
  limit 1
) first_file on true
left join import_row ir on ir.import_batch_id = ib.id
left join import_row_issue iri on iri.import_row_id = ir.id
left join import_file ifl on ifl.import_batch_id = ib.id
where
  ($1::text is null or ib.owner_user_id = $1::uuid)
group by
  ib.id, ib.supplier_id, s.name, price_file.original_name, first_file.original_name
order by ib.import_date desc nulls last, ib.created_at desc;

-- imports:create
insert into import_batch (
  supplier_id,
  owner_user_id,
  created_by_user_id,
  source,
  status,
  document_type,
  source_format,
  currency,
  period,
  import_date,
  request_ref,
  request_title,
  manager_note
)
values (
  $1, $2, $3, $4,
  'uploaded',
  $5, $6, $7, $8, $9,
  $10, $11, $12
)
returning id;

-- import_files:create
insert into import_file (
  import_batch_id,
  original_name,
  storage_path,
  mime_type,
  size_bytes,
  file_kind,
  note
)
values
  ($1, $2, $3, $4, $5, $6, $7);

-- import_rows:list
select
  ir.id,
  ir.import_batch_id,
  ir.row_index,
  ir.external_product_id,
  ir.temp_product_id,
  ir.raw_name,
  coalesce(ir.manual_normalized_name, ir.normalized_name) as normalized_name,
  ir.category,
  ir.country,
  ir.volume_l,
  ir.purchase_price,
  ir.rrc_min,
  ir.promo,
  ir.review_status,
  ir.excluded,
  count(iri.id) as issues_total
from import_row ir
left join import_row_issue iri on iri.import_row_id = ir.id
where ir.import_batch_id = $1
group by ir.id
order by ir.row_index asc;

-- import_issues:list
select
  iri.id,
  iri.import_row_id,
  iri.severity,
  iri.field_name,
  iri.message,
  iri.raw_value,
  ir.row_index
from import_row_issue iri
join import_row ir on ir.id = iri.import_row_id
where ir.import_batch_id = $1
order by ir.row_index asc, iri.created_at asc;

-- quotes:list
select
  qd.id,
  qd.quote_number,
  qd.quote_date,
  qd.mode,
  qd.status,
  qd.request_title,
  qd.manager_name,
  ca.id as client_id,
  ca.name as client_name,
  count(qi.id) as positions_total,
  coalesce(sum(qi.sale_price * qi.qty), 0) as total_sale,
  case
    when coalesce(sum(qi.purchase_price * qi.qty), 0) > 0 then
      ((coalesce(sum(qi.sale_price * qi.qty), 0) - coalesce(sum(qi.purchase_price * qi.qty), 0))
      / sum(qi.purchase_price * qi.qty)) * 100
    else null
  end as margin_pct
from quote_document qd
left join client_account ca on ca.id = qd.client_id
left join quote_item qi on qi.quote_document_id = qd.id
group by qd.id, ca.id
order by qd.quote_date desc nulls last, qd.created_at desc;

-- quotes:create
insert into quote_document (
  client_id,
  source_import_batch_id,
  owner_user_id,
  quote_number,
  quote_date,
  mode,
  status,
  note,
  request_title,
  manager_name
)
values (
  $1, $2, $3, $4, $5,
  $6,
  'draft',
  $7, $8, $9
)
returning id;

-- quote:get
select
  qd.*,
  ca.name as client_name
from quote_document qd
left join client_account ca on ca.id = qd.client_id
where qd.id = $1;

-- quote_items:list
select
  qi.id,
  qi.quote_document_id,
  qi.source_import_row_id,
  qi.catalog_product_id,
  qi.line_no,
  qi.name_snapshot,
  qi.category_snapshot,
  qi.country_snapshot,
  qi.volume_l,
  qi.qty,
  qi.purchase_price,
  qi.sale_price,
  qi.rrc_min,
  qi.comment
from quote_item qi
where qi.quote_document_id = $1
order by qi.line_no asc;

-- quote_items:add_from_import_row
with next_line as (
  select coalesce(max(line_no), 0) + 1 as line_no
  from quote_item
  where quote_document_id = $1
)
insert into quote_item (
  quote_document_id,
  source_import_row_id,
  catalog_product_id,
  line_no,
  name_snapshot,
  category_snapshot,
  country_snapshot,
  volume_l,
  qty,
  purchase_price,
  sale_price,
  rrc_min,
  line_snapshot_payload
)
select
  $1,
  ir.id,
  rpm.catalog_product_id,
  nl.line_no,
  ir.raw_name,
  ir.category,
  ir.country,
  ir.volume_l,
  1,
  ir.purchase_price,
  coalesce(ir.rrc_min, ir.purchase_price),
  ir.rrc_min,
  jsonb_build_object(
    'import_batch_id', ir.import_batch_id,
    'row_index', ir.row_index,
    'raw_name', ir.raw_name,
    'normalized_name', ir.normalized_name,
    'purchase_price', ir.purchase_price,
    'rrc_min', ir.rrc_min,
    'promo', ir.promo
  )
from import_row ir
cross join next_line nl
left join lateral (
  select catalog_product_id
  from row_product_match
  where import_row_id = ir.id and is_selected = true
  order by updated_at desc nulls last
  limit 1
) rpm on true
where ir.id = $2
returning id;

-- quote_item:update
update quote_item
set
  qty = coalesce($2, qty),
  sale_price = coalesce($3, sale_price),
  comment = coalesce($4, comment),
  updated_at = now()
where id = $1
returning *;

-- quote_item:delete
delete from quote_item
where id = $1;
