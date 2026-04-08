create table legality.rule_profile_sections (
  rule_profile_id text not null
    references legality.rule_profiles (id)
    on delete cascade,
  section_key text not null check (section_key in ('main', 'ride', 'g')),
  min_cards smallint not null check (min_cards >= 0),
  max_cards smallint not null check (max_cards >= min_cards),
  required boolean not null,
  allowed_grades smallint[] null check (
    allowed_grades is null
    or allowed_grades <@ array[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]::smallint[]
  ),
  allowed_card_types text[] null check (
    allowed_card_types is null
    or allowed_card_types <@ array[
      'normal-unit',
      'trigger-unit',
      'normal-order',
      'blitz-order',
      'set-order',
      'token'
    ]::text[]
  ),
  primary key (rule_profile_id, section_key)
);

create table legality.rule_profile_duplicate_scope_sections (
  rule_profile_id text not null,
  section_key text not null check (section_key in ('main', 'ride', 'g')),
  primary key (rule_profile_id, section_key),
  foreign key (rule_profile_id, section_key)
    references legality.rule_profile_sections (rule_profile_id, section_key)
    on delete cascade
);

create table legality.rule_profile_trigger_rules (
  rule_profile_id text primary key,
  applies_to_section text not null default 'main' check (applies_to_section = 'main'),
  max_total_triggers smallint not null check (max_total_triggers >= 0),
  foreign key (rule_profile_id, applies_to_section)
    references legality.rule_profile_sections (rule_profile_id, section_key)
    on delete cascade
);

create table legality.rule_profile_trigger_type_limits (
  rule_profile_id text not null
    references legality.rule_profile_trigger_rules (rule_profile_id)
    on delete cascade,
  trigger_type text not null check (
    trigger_type in ('critical', 'draw', 'front', 'heal', 'stand', 'over')
  ),
  max_copies smallint not null check (max_copies >= 0),
  primary key (rule_profile_id, trigger_type)
);
