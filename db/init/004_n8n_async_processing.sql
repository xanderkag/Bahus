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
