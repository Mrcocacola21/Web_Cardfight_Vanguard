create table catalog.card_entities (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  name text not null,
  normalized_name text not null,
  grade smallint not null check (grade between 0 and 10),
  card_type text not null check (
    card_type in (
      'normal-unit',
      'trigger-unit',
      'normal-order',
      'blitz-order',
      'set-order',
      'token'
    )
  ),
  nation text not null,
  clan text null,
  race text null,
  trigger_type text null check (
    trigger_type is null
    or trigger_type in ('critical', 'draw', 'front', 'heal', 'stand', 'over')
  ),
  base_power integer null check (base_power is null or base_power >= 0),
  base_critical integer null check (base_critical is null or base_critical >= 0),
  base_shield integer null check (base_shield is null or base_shield >= 0),
  keywords text[] not null default '{}',
  effect_refs text[] not null default '{}',
  check (
    (card_type = 'trigger-unit' and trigger_type is not null)
    or (card_type <> 'trigger-unit' and trigger_type is null)
  )
);

create index card_entities_normalized_name_idx
  on catalog.card_entities (normalized_name);

create index card_entities_card_type_grade_idx
  on catalog.card_entities (card_type, grade);
