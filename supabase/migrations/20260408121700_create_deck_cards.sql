create table user_data.deck_cards (
  id uuid primary key default gen_random_uuid(),
  deck_version_id uuid not null
    references user_data.deck_versions (id)
    on delete cascade,
  section_key text not null check (
    section_key in ('main', 'ride', 'g')
  ),
  card_entity_id uuid not null
    references catalog.card_entities (id)
    on delete restrict,
  quantity smallint not null check (quantity > 0),
  unique (deck_version_id, section_key, card_entity_id)
);

create index deck_cards_card_entity_idx
  on user_data.deck_cards (card_entity_id);
