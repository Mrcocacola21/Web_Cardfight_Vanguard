create table legality.rule_profiles (
  id text primary key,
  format_id text not null
    references legality.formats (id)
    on delete restrict,
  version_label text not null,
  display_name text not null,
  construction_basis text not null check (
    construction_basis in ('nation-based', 'clan-based', 'open')
  ),
  product_eligibility_basis text not null check (
    product_eligibility_basis in (
      'explicit-family-membership',
      'family-membership-with-overrides',
      'broad-english-pool'
    )
  ),
  restriction_compatibility text not null check (
    restriction_compatibility in (
      'official-list',
      'official-list-with-overrides'
    )
  ),
  default_max_copies_per_card smallint not null check (
    default_max_copies_per_card > 0
  ),
  supports_ride_deck boolean not null default false,
  supports_g_deck boolean not null default false,
  supports_stride boolean not null default false,
  supports_imaginary_gift boolean not null default false,
  supports_overdress boolean not null default false,
  is_active boolean not null default false,
  published_at timestamptz not null default now(),
  unique (format_id, version_label)
);

create unique index rule_profiles_one_active_per_format_idx
  on legality.rule_profiles (format_id)
  where is_active;
