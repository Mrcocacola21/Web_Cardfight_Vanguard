alter table importer.card_printing_normalization_results
  add constraint card_printing_normalization_results_id_import_job_unique
  unique (id, import_job_id);

create type importer.manual_review_reason as enum (
  'ambiguous_mapping',
  'unresolved_mapping',
  'conflicting_facts',
  'exceptional_card'
);

create type importer.manual_review_status as enum (
  'open',
  'in_review',
  'resolved',
  'rejected',
  'superseded',
  'cancelled'
);

create type importer.manual_review_resolution_kind as enum (
  'accept_proposed_match',
  'select_candidate_match',
  'keep_unresolved',
  'mark_exceptional',
  'reject_imported_record'
);

create table importer.manual_review_items (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null
    references importer.import_jobs (id)
    on delete restrict,
  normalization_result_id uuid not null,
  raw_card_printing_record_id uuid not null,
  raw_product_record_id uuid null,
  review_reason importer.manual_review_reason not null,
  review_status importer.manual_review_status not null default 'open',
  summary text not null,
  context_payload jsonb not null default '{}'::jsonb,
  candidate_card_entity_ids uuid[] not null default '{}',
  proposed_card_entity_id uuid null
    references catalog.card_entities (id)
    on delete restrict,
  resolution_kind importer.manual_review_resolution_kind null,
  resolved_card_entity_id uuid null
    references catalog.card_entities (id)
    on delete restrict,
  decision_notes text null,
  opened_at timestamptz not null default now(),
  started_review_at timestamptz null,
  resolved_at timestamptz null,
  closed_at timestamptz null,
  updated_at timestamptz not null default now(),
  unique (normalization_result_id),
  foreign key (normalization_result_id, import_job_id)
    references importer.card_printing_normalization_results (id, import_job_id)
    on delete restrict,
  foreign key (raw_card_printing_record_id, import_job_id)
    references importer.raw_card_printing_records (id, import_job_id)
    on delete restrict,
  foreign key (raw_product_record_id, import_job_id)
    references importer.raw_product_records (id, import_job_id)
    on delete restrict,
  check (btrim(summary) <> ''),
  check (decision_notes is null or btrim(decision_notes) <> ''),
  check (cardinality(candidate_card_entity_ids) >= 0),
  check (jsonb_typeof(context_payload) = 'object')
);

create index manual_review_items_job_status_idx
  on importer.manual_review_items (import_job_id, review_status, opened_at desc);

create index manual_review_items_reason_idx
  on importer.manual_review_items (review_reason, review_status, opened_at desc);

create index manual_review_items_raw_printing_idx
  on importer.manual_review_items (raw_card_printing_record_id, import_job_id);

create index manual_review_items_active_idx
  on importer.manual_review_items (import_job_id, updated_at desc)
  where review_status in ('open', 'in_review');
