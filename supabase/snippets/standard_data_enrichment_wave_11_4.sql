begin;

insert into catalog.keyword_tags (
  id,
  display_name,
  category,
  description,
  sort_order
)
values
  (
    'twin-drive',
    'Twin Drive',
    'mechanic',
    'A drive mechanic that resolves two drive checks during battle.',
    10
  ),
  (
    'persona-ride',
    'Persona Ride',
    'mechanic',
    'A Standard-era ride mechanic enabled by the persona ride icon on grade 3 units.',
    20
  ),
  (
    'divine-skill',
    'Divine Skill',
    'mechanic',
    'A DZ-era Fated One gameplay mechanic.',
    30
  ),
  (
    'sentinel',
    'Sentinel',
    'keyword',
    'A defensive keyword that limits the hit count a guardian can allow through when its condition is met.',
    40
  ),
  (
    'over-trigger',
    'Over Trigger',
    'trigger',
    'A once-per-deck over trigger classification for trigger units with the over icon.',
    50
  )
on conflict (id) do update
set
  display_name = excluded.display_name,
  category = excluded.category,
  description = excluded.description,
  sort_order = excluded.sort_order;

with standard_keyword_assignments as (
  select *
  from (
    values
      ('card.apex-ruler-bastion', 'twin-drive'),
      ('card.apex-ruler-bastion', 'persona-ride'),
      ('card.fated-one-of-miracles-rezael', 'twin-drive'),
      ('card.fated-one-of-miracles-rezael', 'persona-ride'),
      ('card.fated-one-of-miracles-rezael', 'divine-skill'),
      ('card.lifesaving-angel-kurabiel', 'sentinel'),
      ('card.bringer-of-protection-cethlan', 'sentinel'),
      ('card.spiritual-king-of-determination-olbaria', 'over-trigger')
  ) as assignments(card_canonical_key, keyword_tag_id)
),
target_entities as (
  select
    entities.id,
    entities.canonical_key
  from catalog.card_entities as entities
  where entities.canonical_key in (
    'card.apex-ruler-bastion',
    'card.fated-one-of-miracles-rezael',
    'card.lifesaving-angel-kurabiel',
    'card.bringer-of-protection-cethlan',
    'card.spiritual-king-of-determination-olbaria'
  )
),
keyword_rows as (
  select
    entities.id as card_entity_id,
    assignments.keyword_tag_id
  from target_entities as entities
  inner join standard_keyword_assignments as assignments
    on assignments.card_canonical_key = entities.canonical_key
)
insert into catalog.card_entity_keyword_tags (
  card_entity_id,
  keyword_tag_id
)
select
  keyword_rows.card_entity_id,
  keyword_rows.keyword_tag_id
from keyword_rows
on conflict (card_entity_id, keyword_tag_id) do nothing;

with target_entities as (
  select
    entities.id,
    entities.canonical_key
  from catalog.card_entities as entities
  where entities.canonical_key in (
    'card.apex-ruler-bastion',
    'card.fated-one-of-miracles-rezael',
    'card.lifesaving-angel-kurabiel',
    'card.bringer-of-protection-cethlan',
    'card.spiritual-king-of-determination-olbaria'
  )
),
keyword_projection as (
  select
    mapping.card_entity_id,
    array_agg(
      mapping.keyword_tag_id
      order by
        tags.sort_order asc,
        tags.display_name asc,
        tags.id asc
    ) as keyword_ids
  from catalog.card_entity_keyword_tags as mapping
  inner join catalog.keyword_tags as tags
    on tags.id = mapping.keyword_tag_id
  inner join target_entities as entities
    on entities.id = mapping.card_entity_id
  group by mapping.card_entity_id
)
update catalog.card_entities as entities
set keywords = projection.keyword_ids
from keyword_projection as projection
where entities.id = projection.card_entity_id;

update legality.restriction_lists
set source_reference = 'https://en.cf-vanguard.com/howto/fighters_rules/deckrules/'
where rule_profile_id = 'standard-baseline-v1'
  and is_active = true;

with standard_active_list as (
  select id
  from legality.restriction_lists
  where rule_profile_id = 'standard-baseline-v1'
    and is_active = true
  order by effective_from desc, id asc
  limit 1
)
insert into legality.choice_restriction_rules (
  id,
  restriction_list_id,
  allowed_choices,
  note
)
select
  '62000000-0000-4000-8000-000000000001',
  standard_active_list.id,
  1,
  'Mirrors the current English Standard Deck Construction Rules as checked on 2026-04-17: Cerrgaon and Fated One of Miracles, Rezael cannot be used together beyond the allowed choice count.'
from standard_active_list
on conflict (id) do update
set
  restriction_list_id = excluded.restriction_list_id,
  allowed_choices = excluded.allowed_choices,
  note = excluded.note;

commit;
