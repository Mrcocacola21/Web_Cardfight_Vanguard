alter table importer.raw_product_records
  add constraint raw_product_records_id_import_job_unique
  unique (id, import_job_id);

create table importer.raw_card_printing_records (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null
    references importer.import_jobs (id)
    on delete restrict,
  source_printing_id text not null,
  source_product_id text null,
  source_product_code text null,
  raw_product_record_id uuid null,
  payload_fingerprint text not null,
  raw_card_name text not null,
  raw_printing_code text null,
  raw_rarity text null,
  raw_locale_code text null,
  raw_region_code text null,
  raw_card_type text null,
  raw_nation text null,
  raw_clan text null,
  raw_trigger_type text null,
  raw_grade_text text null,
  raw_power_text text null,
  raw_critical_text text null,
  raw_shield_text text null,
  raw_rules_text text null,
  source_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (import_job_id, source_printing_id),
  foreign key (raw_product_record_id, import_job_id)
    references importer.raw_product_records (id, import_job_id)
    on delete restrict,
  check (btrim(source_printing_id) <> ''),
  check (source_product_id is null or btrim(source_product_id) <> ''),
  check (source_product_code is null or btrim(source_product_code) <> ''),
  check (btrim(payload_fingerprint) <> ''),
  check (btrim(raw_card_name) <> ''),
  check (raw_printing_code is null or btrim(raw_printing_code) <> ''),
  check (raw_rarity is null or btrim(raw_rarity) <> ''),
  check (raw_locale_code is null or btrim(raw_locale_code) <> ''),
  check (raw_region_code is null or btrim(raw_region_code) <> ''),
  check (raw_card_type is null or btrim(raw_card_type) <> ''),
  check (raw_nation is null or btrim(raw_nation) <> ''),
  check (raw_clan is null or btrim(raw_clan) <> ''),
  check (raw_trigger_type is null or btrim(raw_trigger_type) <> ''),
  check (raw_grade_text is null or btrim(raw_grade_text) <> ''),
  check (raw_power_text is null or btrim(raw_power_text) <> ''),
  check (raw_critical_text is null or btrim(raw_critical_text) <> ''),
  check (raw_shield_text is null or btrim(raw_shield_text) <> ''),
  check (raw_rules_text is null or btrim(raw_rules_text) <> ''),
  check (jsonb_typeof(source_payload) = 'object')
);

create index raw_card_printing_records_job_created_at_idx
  on importer.raw_card_printing_records (import_job_id, created_at desc);

create index raw_card_printing_records_source_printing_idx
  on importer.raw_card_printing_records (source_printing_id);

create index raw_card_printing_records_product_link_idx
  on importer.raw_card_printing_records (raw_product_record_id)
  where raw_product_record_id is not null;

create index raw_card_printing_records_source_product_id_idx
  on importer.raw_card_printing_records (source_product_id)
  where source_product_id is not null;

create index raw_card_printing_records_source_product_code_idx
  on importer.raw_card_printing_records (source_product_code)
  where source_product_code is not null;
