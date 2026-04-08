create table legality.card_restriction_rules (
  id uuid primary key default gen_random_uuid(),
  restriction_list_id uuid not null
    references legality.restriction_lists (id)
    on delete cascade,
  card_entity_id uuid not null
    references catalog.card_entities (id)
    on delete restrict,
  restriction_type text not null check (
    restriction_type in (
      'unrestricted',
      'banned',
      'limited',
      'semi-limited',
      'maximum-copies'
    )
  ),
  max_copies smallint null check (max_copies is null or max_copies >= 0),
  note text null,
  unique (restriction_list_id, card_entity_id),
  check (
    (restriction_type = 'unrestricted' and max_copies is null)
    or (restriction_type = 'banned' and max_copies = 0)
    or (restriction_type = 'limited' and max_copies = 1)
    or (restriction_type = 'semi-limited' and max_copies = 2)
    or (restriction_type = 'maximum-copies' and max_copies is not null)
  )
);

create index card_restriction_rules_card_idx
  on legality.card_restriction_rules (card_entity_id);
