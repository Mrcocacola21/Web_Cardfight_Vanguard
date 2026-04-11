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
  )
on conflict (id) do update
set
  display_name = excluded.display_name,
  category = excluded.category,
  description = excluded.description,
  sort_order = excluded.sort_order;

with wave_1_keyword_assignments as (
  select *
  from (
    values
      ('Apex Ruler, Bastion', 'twin-drive'),
      ('Apex Ruler, Bastion', 'persona-ride'),
      ('Fated One of Miracles, Rezael', 'twin-drive'),
      ('Fated One of Miracles, Rezael', 'persona-ride'),
      ('Fated One of Miracles, Rezael', 'divine-skill')
  ) as assignments(card_name, keyword_tag_id)
),
published_wave_1_entities as (
  select distinct
    entities.id,
    entities.name
  from catalog.card_entities as entities
  inner join catalog.card_printings as printings
    on printings.card_entity_id = entities.id
  where entities.name in (
    'Apex Ruler, Bastion',
    'Fated One of Miracles, Rezael'
  )
),
wave_1_entity_keyword_rows as (
  select
    entities.id as card_entity_id,
    assignments.keyword_tag_id
  from published_wave_1_entities as entities
  inner join wave_1_keyword_assignments as assignments
    on assignments.card_name = entities.name
)
insert into catalog.card_entity_keyword_tags (
  card_entity_id,
  keyword_tag_id
)
select
  card_entity_id,
  keyword_tag_id
from wave_1_entity_keyword_rows
on conflict (card_entity_id, keyword_tag_id) do nothing;

with published_wave_1_entities as (
  select distinct
    entities.id
  from catalog.card_entities as entities
  inner join catalog.card_printings as printings
    on printings.card_entity_id = entities.id
  where entities.name in (
    'Apex Ruler, Bastion',
    'Fated One of Miracles, Rezael'
  )
),
wave_1_keyword_projection as (
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
  inner join published_wave_1_entities as entities
    on entities.id = mapping.card_entity_id
  group by mapping.card_entity_id
)
update catalog.card_entities as entities
set keywords = projection.keyword_ids
from wave_1_keyword_projection as projection
where entities.id = projection.card_entity_id;
