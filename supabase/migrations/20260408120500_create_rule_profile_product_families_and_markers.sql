create table legality.rule_profile_product_families (
  rule_profile_id text not null
    references legality.rule_profiles (id)
    on delete cascade,
  product_family_id text not null
    references catalog.product_families (id)
    on delete restrict,
  primary key (rule_profile_id, product_family_id)
);

create table legality.rule_profile_gameplay_markers (
  rule_profile_id text not null
    references legality.rule_profiles (id)
    on delete cascade,
  marker text not null check (
    marker in (
      'ride-deck',
      'g-zone',
      'stride',
      'imaginary-gift',
      'overdress',
      'over-trigger'
    )
  ),
  primary key (rule_profile_id, marker)
);
