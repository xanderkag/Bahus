-- 002_n8n_async.sql
-- SQL для dispatch/callback контура через n8n.

-- import_dispatch:select_files
select
  ib.id as import_batch_id,
  ib.processing_status as import_processing_status,
  ifl.id as import_file_id,
  ifl.file_kind,
  ifl.original_name,
  ifl.storage_path,
  ifl.mime_type,
  ifl.processing_status,
  ifl.size_bytes
from import_batch ib
join import_file ifl on ifl.import_batch_id = ib.id
where ib.id = $1
order by ifl.uploaded_at asc;

-- import_dispatch:update_batch
update import_batch
set
  status = 'queued',
  processing_status = 'queued',
  processing_started_at = now(),
  updated_at = now()
where id = $1
returning id, processing_status;

-- import_dispatch:update_files
update import_file
set
  processing_status = 'queued'
where import_batch_id = $1
returning id, processing_status;

-- import_dispatch:create_job
insert into job_run (
  type,
  target_type,
  target_id,
  status,
  payload,
  created_by_user_id
)
values (
  'import_parse',
  'import_batch',
  $1,
  'queued',
  $2::jsonb,
  $3
)
returning id;

-- import_callback:mark_job_running
update job_run
set
  status = 'running',
  started_at = coalesce(started_at, now()),
  updated_at = now()
where id = $1
returning id;

-- import_callback:mark_success
update job_run
set
  status = 'done',
  finished_at = now(),
  result = $2::jsonb,
  updated_at = now()
where id = $1;

-- import_callback:mark_failed
update job_run
set
  status = 'failed',
  finished_at = now(),
  result = $2::jsonb,
  updated_at = now()
where id = $1;

-- import_callback:update_batch_success
update import_batch
set
  status = $2,
  processing_status = $2,
  processing_finished_at = now(),
  last_webhook_at = now(),
  currency = coalesce($3, currency),
  sheet_name = coalesce($4, sheet_name),
  updated_at = now()
where id = $1;

-- import_callback:update_batch_failed
update import_batch
set
  status = 'failed',
  processing_status = 'failed',
  processing_finished_at = now(),
  last_webhook_at = now(),
  updated_at = now()
where id = $1;

-- import_callback:update_file_success
update import_file
set
  processing_status = $2,
  processing_pipeline = $3,
  parse_result = $4::jsonb,
  last_error = null
where id = $1;

-- import_callback:update_file_failed
update import_file
set
  processing_status = 'failed',
  processing_pipeline = $2,
  last_error = $3
where id = $1;

-- import_callback:delete_existing_rows
delete from import_row
where import_batch_id = $1;

-- import_callback:insert_row
insert into import_row (
  import_batch_id,
  row_index,
  external_product_id,
  temp_product_id,
  raw_name,
  normalized_name,
  category,
  country,
  volume_l,
  purchase_price,
  rrc_min,
  promo,
  raw_payload
)
values (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, coalesce($12, false), $13::jsonb
)
returning id;

-- import_callback:insert_issue
insert into import_row_issue (
  import_row_id,
  severity,
  field_name,
  message,
  raw_value
)
values (
  $1, $2, $3, $4, $5
);

-- import_status:get
select
  ib.id,
  ib.status,
  ib.processing_status,
  ib.processing_started_at,
  ib.processing_finished_at,
  ib.last_webhook_at,
  jsonb_agg(
    jsonb_build_object(
      'id', ifl.id,
      'file_kind', ifl.file_kind,
      'original_name', ifl.original_name,
      'processing_status', ifl.processing_status,
      'processing_pipeline', ifl.processing_pipeline,
      'last_error', ifl.last_error
    )
    order by ifl.uploaded_at asc
  ) as files
from import_batch ib
left join import_file ifl on ifl.import_batch_id = ib.id
where ib.id = $1
group by ib.id;
