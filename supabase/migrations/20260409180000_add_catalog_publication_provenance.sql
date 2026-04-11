alter table catalog.products
  add column source_import_job_id uuid null,
  add column source_raw_product_record_id uuid null;

create index products_source_import_job_idx
  on catalog.products (source_import_job_id);

create unique index products_source_raw_product_record_uidx
  on catalog.products (source_raw_product_record_id)
  where source_raw_product_record_id is not null;

alter table catalog.card_printings
  add column source_import_job_id uuid null,
  add column source_normalization_result_id uuid null,
  add column source_raw_card_printing_record_id uuid null,
  add column source_raw_product_record_id uuid null;

create index card_printings_source_import_job_idx
  on catalog.card_printings (source_import_job_id);

create unique index card_printings_source_normalization_result_uidx
  on catalog.card_printings (source_normalization_result_id)
  where source_normalization_result_id is not null;

create unique index card_printings_source_raw_card_printing_uidx
  on catalog.card_printings (source_raw_card_printing_record_id)
  where source_raw_card_printing_record_id is not null;
