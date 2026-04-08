create table catalog.product_families (
  id text primary key,
  display_name text not null,
  lineage text not null check (
    lineage in (
      'standard-lineage',
      'v-lineage',
      'premium-lineage',
      'cross-lineage'
    )
  ),
  parent_family_id text null
    references catalog.product_families (id)
    on delete restrict,
  description text null,
  sort_order integer not null default 0
);
