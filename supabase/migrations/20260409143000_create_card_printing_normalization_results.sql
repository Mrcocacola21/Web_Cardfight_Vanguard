alter table importer.raw_card_printing_records
  add constraint raw_card_printing_records_id_import_job_unique
  unique (id, import_job_id);

create type importer.card_printing_normalization_status as enum (
  'auto_resolved',
  'unresolved',
  'ambiguous',
  'blocked_for_review',
  'superseded'
);

create table importer.card_printing_normalization_results (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null
    references importer.import_jobs (id)
    on delete restrict,
  raw_card_printing_record_id uuid not null,
  raw_product_record_id uuid null,
  normalization_version text not null,
  normalization_status importer.card_printing_normalization_status not null,
  resolution_basis text not null,
  proposed_card_entity_id uuid null
    references catalog.card_entities (id)
    on delete restrict,
  candidate_card_entity_ids uuid[] not null default '{}',
  candidate_count integer not null default 0,
  normalized_name text not null,
  normalized_grade integer null,
  normalized_card_type text null,
  normalized_nation text null,
  normalized_clan text null,
  normalized_trigger_type text null,
  raw_payload_fingerprint text not null,
  needs_manual_review boolean not null default false,
  status_reason text not null,
  conflict_summary text null,
  resolution_evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (raw_card_printing_record_id, normalization_version),
  foreign key (raw_card_printing_record_id, import_job_id)
    references importer.raw_card_printing_records (id, import_job_id)
    on delete restrict,
  foreign key (raw_product_record_id, import_job_id)
    references importer.raw_product_records (id, import_job_id)
    on delete restrict,
  check (btrim(normalization_version) <> ''),
  check (btrim(resolution_basis) <> ''),
  check (btrim(normalized_name) <> ''),
  check (btrim(raw_payload_fingerprint) <> ''),
  check (btrim(status_reason) <> ''),
  check (normalized_card_type is null or btrim(normalized_card_type) <> ''),
  check (normalized_nation is null or btrim(normalized_nation) <> ''),
  check (normalized_clan is null or btrim(normalized_clan) <> ''),
  check (
    normalized_trigger_type is null or btrim(normalized_trigger_type) <> ''
  ),
  check (conflict_summary is null or btrim(conflict_summary) <> ''),
  check (candidate_count >= 0),
  check (candidate_count = cardinality(candidate_card_entity_ids)),
  check (jsonb_typeof(resolution_evidence) = 'object')
);

create index card_printing_normalization_results_job_status_idx
  on importer.card_printing_normalization_results (
    import_job_id,
    normalization_status,
    created_at desc
  );

create index card_printing_normalization_results_raw_printing_idx
  on importer.card_printing_normalization_results (
    raw_card_printing_record_id,
    normalization_version
  );

create index card_printing_normalization_results_entity_idx
  on importer.card_printing_normalization_results (proposed_card_entity_id)
  where proposed_card_entity_id is not null;

create index card_printing_normalization_results_review_idx
  on importer.card_printing_normalization_results (
    import_job_id,
    needs_manual_review
  )
  where needs_manual_review = true;
