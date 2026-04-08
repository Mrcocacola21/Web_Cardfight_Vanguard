create table legality.rule_profile_card_eligibility_overrides (
  id uuid primary key default gen_random_uuid(),
  rule_profile_id text not null
    references legality.rule_profiles (id)
    on delete cascade,
  card_entity_id uuid not null
    references catalog.card_entities (id)
    on delete restrict,
  eligibility_state text not null check (
    eligibility_state in ('allowed', 'disallowed')
  ),
  rationale text null,
  unique (rule_profile_id, card_entity_id)
);

create index rule_profile_card_eligibility_overrides_card_idx
  on legality.rule_profile_card_eligibility_overrides (card_entity_id);
