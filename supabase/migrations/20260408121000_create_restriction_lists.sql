create table legality.restriction_lists (
  id uuid primary key default gen_random_uuid(),
  rule_profile_id text not null
    references legality.rule_profiles (id)
    on delete restrict,
  version_label text not null,
  effective_from date not null,
  effective_to date null,
  source_reference text null,
  is_active boolean not null default false,
  check (effective_to is null or effective_to >= effective_from),
  unique (rule_profile_id, version_label)
);

create unique index restriction_lists_one_active_per_profile_idx
  on legality.restriction_lists (rule_profile_id)
  where is_active;

create index restriction_lists_effective_from_idx
  on legality.restriction_lists (rule_profile_id, effective_from desc);
