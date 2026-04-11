create table importer.raw_product_records (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null
    references importer.import_jobs (id)
    on delete restrict,
  source_product_id text not null,
  payload_fingerprint text not null,
  raw_name text not null,
  raw_code text null,
  raw_product_category text null,
  raw_product_kind text null,
  raw_family_name text null,
  raw_release_date_text text null,
  raw_region_code text null,
  source_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_job_id, source_product_id),
  check (btrim(source_product_id) <> ''),
  check (btrim(payload_fingerprint) <> ''),
  check (btrim(raw_name) <> ''),
  check (raw_code is null or btrim(raw_code) <> ''),
  check (
    raw_product_category is null
    or btrim(raw_product_category) <> ''
  ),
  check (raw_product_kind is null or btrim(raw_product_kind) <> ''),
  check (raw_family_name is null or btrim(raw_family_name) <> ''),
  check (
    raw_release_date_text is null
    or btrim(raw_release_date_text) <> ''
  ),
  check (raw_region_code is null or btrim(raw_region_code) <> ''),
  check (jsonb_typeof(source_payload) = 'object')
);

create index raw_product_records_job_created_at_idx
  on importer.raw_product_records (import_job_id, created_at desc);

create index raw_product_records_source_product_idx
  on importer.raw_product_records (source_product_id);

create index raw_product_records_fingerprint_idx
  on importer.raw_product_records (payload_fingerprint);
