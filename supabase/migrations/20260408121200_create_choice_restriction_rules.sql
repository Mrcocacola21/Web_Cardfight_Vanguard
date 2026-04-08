create table legality.choice_restriction_rules (
  id uuid primary key default gen_random_uuid(),
  restriction_list_id uuid not null
    references legality.restriction_lists (id)
    on delete cascade,
  allowed_choices smallint not null check (allowed_choices > 0),
  note text null
);

create table legality.choice_restriction_rule_cards (
  choice_restriction_rule_id uuid not null
    references legality.choice_restriction_rules (id)
    on delete cascade,
  card_entity_id uuid not null
    references catalog.card_entities (id)
    on delete restrict,
  primary key (choice_restriction_rule_id, card_entity_id)
);

create index choice_restriction_rule_cards_card_idx
  on legality.choice_restriction_rule_cards (card_entity_id);
