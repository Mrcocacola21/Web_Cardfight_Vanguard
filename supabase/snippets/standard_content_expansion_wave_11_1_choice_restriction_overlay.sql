begin;

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
  'Mirrors the official Standard deck rules choice restriction as of 2026-04-17: Cerrgaon & Fated One of Miracles, Rezael.'
from standard_active_list
on conflict (id) do update
set
  restriction_list_id = excluded.restriction_list_id,
  allowed_choices = excluded.allowed_choices,
  note = excluded.note;

insert into legality.choice_restriction_rule_cards (
  choice_restriction_rule_id,
  card_entity_id
)
select
  '62000000-0000-4000-8000-000000000001',
  entity.id
from catalog.card_entities as entity
where entity.canonical_key in (
  'card.cerrgaon',
  'card.fated-one-of-miracles-rezael'
)
on conflict (choice_restriction_rule_id, card_entity_id) do nothing;

commit;
