create schema if not exists importer;

create type importer.import_job_status as enum (
  'pending',
  'running',
  'blocked_for_review',
  'completed',
  'partially_completed',
  'failed',
  'cancelled'
);

create type importer.import_job_stage as enum (
  'source',
  'raw_import',
  'normalization',
  'publication'
);

create table importer.import_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  source_type text not null,
  display_name text not null,
  provider_name text null,
  origin_uri text null,
  configuration jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_key),
  check (btrim(source_key) <> ''),
  check (btrim(source_type) <> ''),
  check (btrim(display_name) <> ''),
  check (provider_name is null or btrim(provider_name) <> ''),
  check (origin_uri is null or btrim(origin_uri) <> ''),
  check (jsonb_typeof(configuration) = 'object')
);

create index import_sources_active_type_idx
  on importer.import_sources (is_active, source_type);

create table importer.import_jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null
    references importer.import_sources (id)
    on delete restrict,
  retry_of_job_id uuid null
    references importer.import_jobs (id)
    on delete restrict,
  job_status importer.import_job_status not null default 'pending',
  current_stage importer.import_job_stage not null default 'source',
  pipeline_version text not null default 'v1',
  upstream_snapshot_key text null,
  input_fingerprint text null,
  scope_metadata jsonb not null default '{}'::jsonb,
  status_reason text null,
  error_code text null,
  raw_record_count integer not null default 0,
  normalized_candidate_count integer not null default 0,
  conflict_count integer not null default 0,
  published_record_count integer not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  finished_at timestamptz null,
  updated_at timestamptz not null default now(),
  check (btrim(pipeline_version) <> ''),
  check (upstream_snapshot_key is null or btrim(upstream_snapshot_key) <> ''),
  check (input_fingerprint is null or btrim(input_fingerprint) <> ''),
  check (status_reason is null or btrim(status_reason) <> ''),
  check (error_code is null or btrim(error_code) <> ''),
  check (jsonb_typeof(scope_metadata) = 'object'),
  check (raw_record_count >= 0),
  check (normalized_candidate_count >= 0),
  check (conflict_count >= 0),
  check (published_record_count >= 0),
  check (started_at is null or started_at >= created_at),
  check (finished_at is null or finished_at >= created_at),
  check (
    started_at is null
    or finished_at is null
    or finished_at >= started_at
  ),
  check (
    (job_status = 'pending' and started_at is null and finished_at is null)
    or (job_status = 'running' and started_at is not null and finished_at is null)
    or (
      job_status in (
        'completed',
        'partially_completed',
        'failed',
        'blocked_for_review'
      )
      and started_at is not null
      and finished_at is not null
    )
    or (job_status = 'cancelled' and finished_at is not null)
  ),
  check ((job_status = 'failed' and error_code is not null) or job_status <> 'failed')
);

create index import_jobs_source_created_at_idx
  on importer.import_jobs (source_id, created_at desc);

create index import_jobs_status_created_at_idx
  on importer.import_jobs (job_status, created_at desc);

create index import_jobs_created_at_idx
  on importer.import_jobs (created_at desc);

create index import_jobs_retry_idx
  on importer.import_jobs (retry_of_job_id)
  where retry_of_job_id is not null;

create index import_jobs_snapshot_idx
  on importer.import_jobs (source_id, upstream_snapshot_key)
  where upstream_snapshot_key is not null;

create index import_jobs_fingerprint_idx
  on importer.import_jobs (source_id, input_fingerprint)
  where input_fingerprint is not null;
