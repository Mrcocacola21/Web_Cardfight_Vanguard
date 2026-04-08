begin;

insert into catalog.product_families (
  id,
  display_name,
  lineage,
  parent_family_id,
  description,
  sort_order
)
values
  (
    'family-standard',
    'Standard Lineage',
    'standard-lineage',
    null,
    'Synthetic dev seed family for Standard-era content.',
    10
  ),
  (
    'family-v',
    'V Lineage',
    'v-lineage',
    null,
    'Synthetic dev seed family for V-era content.',
    20
  ),
  (
    'family-premium',
    'Premium Lineage',
    'premium-lineage',
    null,
    'Synthetic dev seed family for Premium-era content.',
    30
  )
on conflict (id) do update
set
  display_name = excluded.display_name,
  lineage = excluded.lineage,
  parent_family_id = excluded.parent_family_id,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into legality.formats (
  id,
  display_name,
  description
)
values
  (
    'standard',
    'Standard',
    'Synthetic development format identity for Standard profile testing.'
  ),
  (
    'v-premium',
    'V Premium',
    'Synthetic development format identity for V Premium profile testing.'
  ),
  (
    'premium',
    'Premium',
    'Synthetic development format identity for Premium profile testing.'
  )
on conflict (id) do update
set
  display_name = excluded.display_name,
  description = excluded.description;

update legality.rule_profiles
set is_active = false
where format_id in ('standard', 'v-premium', 'premium')
  and id not in (
    'standard-baseline-v1',
    'v-premium-baseline-v1',
    'premium-baseline-v1'
  );

insert into legality.rule_profiles (
  id,
  format_id,
  version_label,
  display_name,
  construction_basis,
  product_eligibility_basis,
  restriction_compatibility,
  default_max_copies_per_card,
  supports_ride_deck,
  supports_g_deck,
  supports_stride,
  supports_imaginary_gift,
  supports_overdress,
  is_active,
  published_at
)
values
  (
    'standard-baseline-v1',
    'standard',
    'baseline-v1',
    'Standard Baseline v1',
    'nation-based',
    'explicit-family-membership',
    'official-list',
    4,
    true,
    false,
    false,
    false,
    true,
    true,
    now()
  ),
  (
    'v-premium-baseline-v1',
    'v-premium',
    'baseline-v1',
    'V Premium Baseline v1',
    'clan-based',
    'family-membership-with-overrides',
    'official-list',
    4,
    false,
    false,
    false,
    true,
    false,
    true,
    now()
  ),
  (
    'premium-baseline-v1',
    'premium',
    'baseline-v1',
    'Premium Baseline v1',
    'clan-based',
    'broad-english-pool',
    'official-list-with-overrides',
    4,
    false,
    true,
    true,
    true,
    false,
    true,
    now()
  )
on conflict (id) do update
set
  format_id = excluded.format_id,
  version_label = excluded.version_label,
  display_name = excluded.display_name,
  construction_basis = excluded.construction_basis,
  product_eligibility_basis = excluded.product_eligibility_basis,
  restriction_compatibility = excluded.restriction_compatibility,
  default_max_copies_per_card = excluded.default_max_copies_per_card,
  supports_ride_deck = excluded.supports_ride_deck,
  supports_g_deck = excluded.supports_g_deck,
  supports_stride = excluded.supports_stride,
  supports_imaginary_gift = excluded.supports_imaginary_gift,
  supports_overdress = excluded.supports_overdress,
  is_active = excluded.is_active,
  published_at = excluded.published_at;

insert into legality.rule_profile_sections (
  rule_profile_id,
  section_key,
  min_cards,
  max_cards,
  required,
  allowed_grades,
  allowed_card_types
)
values
  (
    'standard-baseline-v1',
    'main',
    50,
    50,
    true,
    null,
    array[
      'normal-unit',
      'trigger-unit',
      'normal-order',
      'blitz-order',
      'set-order'
    ]::text[]
  ),
  (
    'standard-baseline-v1',
    'ride',
    4,
    4,
    true,
    array[0, 1, 2, 3]::smallint[],
    array['normal-unit']::text[]
  ),
  (
    'v-premium-baseline-v1',
    'main',
    50,
    50,
    true,
    null,
    array[
      'normal-unit',
      'trigger-unit',
      'normal-order',
      'blitz-order',
      'set-order'
    ]::text[]
  ),
  (
    'premium-baseline-v1',
    'main',
    50,
    50,
    true,
    null,
    array[
      'normal-unit',
      'trigger-unit',
      'normal-order',
      'blitz-order',
      'set-order'
    ]::text[]
  ),
  (
    'premium-baseline-v1',
    'g',
    0,
    16,
    false,
    array[4]::smallint[],
    array['normal-unit']::text[]
  )
on conflict (rule_profile_id, section_key) do update
set
  min_cards = excluded.min_cards,
  max_cards = excluded.max_cards,
  required = excluded.required,
  allowed_grades = excluded.allowed_grades,
  allowed_card_types = excluded.allowed_card_types;

insert into legality.rule_profile_duplicate_scope_sections (
  rule_profile_id,
  section_key
)
values
  ('standard-baseline-v1', 'main'),
  ('standard-baseline-v1', 'ride'),
  ('v-premium-baseline-v1', 'main'),
  ('premium-baseline-v1', 'main')
on conflict (rule_profile_id, section_key) do nothing;

insert into legality.rule_profile_trigger_rules (
  rule_profile_id,
  applies_to_section,
  max_total_triggers
)
values
  ('standard-baseline-v1', 'main', 16),
  ('v-premium-baseline-v1', 'main', 16),
  ('premium-baseline-v1', 'main', 16)
on conflict (rule_profile_id) do update
set
  applies_to_section = excluded.applies_to_section,
  max_total_triggers = excluded.max_total_triggers;

insert into legality.rule_profile_trigger_type_limits (
  rule_profile_id,
  trigger_type,
  max_copies
)
values
  ('standard-baseline-v1', 'heal', 4),
  ('standard-baseline-v1', 'over', 1),
  ('v-premium-baseline-v1', 'heal', 4),
  ('premium-baseline-v1', 'heal', 4),
  ('premium-baseline-v1', 'over', 1)
on conflict (rule_profile_id, trigger_type) do update
set
  max_copies = excluded.max_copies;

insert into legality.rule_profile_product_families (
  rule_profile_id,
  product_family_id
)
values
  ('standard-baseline-v1', 'family-standard'),
  ('v-premium-baseline-v1', 'family-v'),
  ('premium-baseline-v1', 'family-standard'),
  ('premium-baseline-v1', 'family-v'),
  ('premium-baseline-v1', 'family-premium')
on conflict (rule_profile_id, product_family_id) do nothing;

insert into legality.rule_profile_gameplay_markers (
  rule_profile_id,
  marker
)
values
  ('standard-baseline-v1', 'ride-deck'),
  ('standard-baseline-v1', 'overdress'),
  ('standard-baseline-v1', 'over-trigger'),
  ('v-premium-baseline-v1', 'imaginary-gift'),
  ('premium-baseline-v1', 'g-zone'),
  ('premium-baseline-v1', 'stride'),
  ('premium-baseline-v1', 'imaginary-gift'),
  ('premium-baseline-v1', 'over-trigger')
on conflict (rule_profile_id, marker) do nothing;

insert into catalog.products (
  id,
  canonical_key,
  family_id,
  official_code,
  name,
  product_category,
  product_kind,
  release_date,
  region_code,
  cycle_key
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'product.d-bt01.genesis-of-azure',
    'family-standard',
    'D-BT01',
    'Genesis of Azure',
    'booster',
    'main',
    date '2021-05-14',
    'en',
    'dev-standard-wave-1'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'product.d-sd01.azure-vanguard-start-deck',
    'family-standard',
    'D-SD01',
    'Azure Vanguard Start Deck',
    'deck',
    'start',
    date '2021-05-28',
    'en',
    'dev-standard-wave-1'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'product.v-bt01.crimson-vanguard',
    'family-v',
    'V-BT01',
    'Crimson Vanguard',
    'booster',
    'main',
    date '2018-05-11',
    'en',
    'dev-v-wave-1'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'product.pr-g01.premium-anniversary-pack',
    'family-premium',
    'PR-G01',
    'Premium Anniversary Promo Pack',
    'promo',
    'standalone',
    date '2019-08-09',
    'en',
    'dev-premium-wave-1'
  )
on conflict (id) do update
set
  canonical_key = excluded.canonical_key,
  family_id = excluded.family_id,
  official_code = excluded.official_code,
  name = excluded.name,
  product_category = excluded.product_category,
  product_kind = excluded.product_kind,
  release_date = excluded.release_date,
  region_code = excluded.region_code,
  cycle_key = excluded.cycle_key;

insert into catalog.card_entities (
  id,
  canonical_key,
  name,
  normalized_name,
  grade,
  card_type,
  nation,
  clan,
  race,
  trigger_type,
  base_power,
  base_critical,
  base_shield,
  keywords,
  effect_refs
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    'card.azure-vanguard-cadet',
    'Azure Vanguard Cadet',
    'azure vanguard cadet',
    0,
    'normal-unit',
    'Dragon Empire',
    null,
    'Human',
    null,
    5000,
    1,
    5000,
    '{}'::text[],
    array['effect.ref.dev.cadet']::text[]
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'card.azure-vanguard-scout',
    'Azure Vanguard Scout',
    'azure vanguard scout',
    1,
    'normal-unit',
    'Dragon Empire',
    null,
    'Human',
    null,
    8000,
    1,
    5000,
    '{}'::text[],
    array['effect.ref.dev.scout']::text[]
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'card.azure-vanguard-lancer',
    'Azure Vanguard Lancer',
    'azure vanguard lancer',
    2,
    'normal-unit',
    'Dragon Empire',
    null,
    'Cosmo Dragon',
    null,
    10000,
    1,
    5000,
    '{}'::text[],
    array['effect.ref.dev.lancer']::text[]
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    'card.azure-vanguard-dragon',
    'Azure Vanguard Dragon',
    'azure vanguard dragon',
    3,
    'normal-unit',
    'Dragon Empire',
    null,
    'Cosmo Dragon',
    null,
    13000,
    1,
    0,
    array['twin-drive']::text[],
    array['effect.ref.dev.dragon']::text[]
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    'card.azure-critical-pulse',
    'Azure Critical Pulse',
    'azure critical pulse',
    0,
    'trigger-unit',
    'Dragon Empire',
    null,
    'Element',
    'critical',
    5000,
    1,
    15000,
    '{}'::text[],
    '{}'::text[]
  ),
  (
    '20000000-0000-4000-8000-000000000006',
    'card.azure-healing-pulse',
    'Azure Healing Pulse',
    'azure healing pulse',
    0,
    'trigger-unit',
    'Dragon Empire',
    null,
    'Element',
    'heal',
    5000,
    1,
    15000,
    '{}'::text[],
    '{}'::text[]
  ),
  (
    '20000000-0000-4000-8000-000000000007',
    'card.azure-over-pulse',
    'Azure Over Pulse',
    'azure over pulse',
    0,
    'trigger-unit',
    'Dragon Empire',
    null,
    'Element',
    'over',
    5000,
    1,
    50000,
    '{}'::text[],
    '{}'::text[]
  ),
  (
    '20000000-0000-4000-8000-000000000008',
    'card.crimson-v-blaster',
    'Crimson V Blaster',
    'crimson v blaster',
    3,
    'normal-unit',
    'United Sanctuary',
    'Royal Paladin',
    'Human',
    null,
    12000,
    1,
    0,
    array['imaginary-gift']::text[],
    array['effect.ref.dev.v-blaster']::text[]
  ),
  (
    '20000000-0000-4000-8000-000000000009',
    'card.crimson-v-draw-pulse',
    'Crimson V Draw Pulse',
    'crimson v draw pulse',
    0,
    'trigger-unit',
    'United Sanctuary',
    'Royal Paladin',
    'Element',
    'draw',
    5000,
    1,
    15000,
    '{}'::text[],
    '{}'::text[]
  ),
  (
    '20000000-0000-4000-8000-000000000010',
    'card.chrono-gate-strider',
    'Chrono Gate Strider',
    'chrono gate strider',
    4,
    'normal-unit',
    'Dark Zone',
    'Gear Chronicle',
    'Gear Dragon',
    null,
    15000,
    1,
    0,
    array['stride']::text[],
    array['effect.ref.dev.strider']::text[]
  )
on conflict (id) do update
set
  canonical_key = excluded.canonical_key,
  name = excluded.name,
  normalized_name = excluded.normalized_name,
  grade = excluded.grade,
  card_type = excluded.card_type,
  nation = excluded.nation,
  clan = excluded.clan,
  race = excluded.race,
  trigger_type = excluded.trigger_type,
  base_power = excluded.base_power,
  base_critical = excluded.base_critical,
  base_shield = excluded.base_shield,
  keywords = excluded.keywords,
  effect_refs = excluded.effect_refs;

insert into catalog.card_printings (
  id,
  printing_key,
  card_entity_id,
  product_id,
  collector_number,
  rarity,
  locale_code,
  region_code,
  printed_name,
  art_variant,
  is_alternate_art,
  is_promo_variant
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    'printing.azure-vanguard-cadet.d-sd01.001.en',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '001',
    'C',
    'en',
    'en',
    'Azure Vanguard Cadet',
    null,
    false,
    false
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'printing.azure-vanguard-scout.d-sd01.002.en',
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '002',
    'C',
    'en',
    'en',
    'Azure Vanguard Scout',
    null,
    false,
    false
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    'printing.azure-vanguard-lancer.d-sd01.003.en',
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    '003',
    'R',
    'en',
    'en',
    'Azure Vanguard Lancer',
    null,
    false,
    false
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    'printing.azure-vanguard-dragon.d-sd01.004.en',
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000002',
    '004',
    'RRR',
    'en',
    'en',
    'Azure Vanguard Dragon',
    'starter-art',
    false,
    false
  ),
  (
    '30000000-0000-4000-8000-000000000005',
    'printing.azure-critical-pulse.d-bt01.050.en',
    '20000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000001',
    '050',
    'C',
    'en',
    'en',
    'Azure Critical Pulse',
    null,
    false,
    false
  ),
  (
    '30000000-0000-4000-8000-000000000006',
    'printing.azure-critical-pulse.d-sd01.010.en',
    '20000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000002',
    '010',
    'C',
    'en',
    'en',
    'Azure Critical Pulse',
    'starter-reprint',
    false,
    false
  ),
  (
    '30000000-0000-4000-8000-000000000007',
    'printing.azure-healing-pulse.d-bt01.051.en',
    '20000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000001',
    '051',
    'C',
    'en',
    'en',
    'Azure Healing Pulse',
    null,
    false,
    false
  ),
  (
    '30000000-0000-4000-8000-000000000008',
    'printing.azure-over-pulse.d-bt01.052.en',
    '20000000-0000-4000-8000-000000000007',
    '10000000-0000-4000-8000-000000000001',
    '052',
    'RRR',
    'en',
    'en',
    'Azure Over Pulse',
    null,
    false,
    false
  ),
  (
    '30000000-0000-4000-8000-000000000009',
    'printing.azure-vanguard-dragon.pr-g01.001.en',
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000004',
    '001',
    'PR',
    'en',
    'en',
    'Azure Vanguard Dragon',
    'anniversary-promo',
    true,
    true
  ),
  (
    '30000000-0000-4000-8000-000000000010',
    'printing.crimson-v-blaster.v-bt01.005.en',
    '20000000-0000-4000-8000-000000000008',
    '10000000-0000-4000-8000-000000000003',
    '005',
    'VR',
    'en',
    'en',
    'Crimson V Blaster',
    null,
    false,
    false
  ),
  (
    '30000000-0000-4000-8000-000000000011',
    'printing.crimson-v-draw-pulse.v-bt01.048.en',
    '20000000-0000-4000-8000-000000000009',
    '10000000-0000-4000-8000-000000000003',
    '048',
    'C',
    'en',
    'en',
    'Crimson V Draw Pulse',
    null,
    false,
    false
  ),
  (
    '30000000-0000-4000-8000-000000000012',
    'printing.chrono-gate-strider.pr-g01.002.en',
    '20000000-0000-4000-8000-000000000010',
    '10000000-0000-4000-8000-000000000004',
    '002',
    'PR',
    'en',
    'en',
    'Chrono Gate Strider',
    null,
    false,
    true
  )
on conflict (id) do update
set
  printing_key = excluded.printing_key,
  card_entity_id = excluded.card_entity_id,
  product_id = excluded.product_id,
  collector_number = excluded.collector_number,
  rarity = excluded.rarity,
  locale_code = excluded.locale_code,
  region_code = excluded.region_code,
  printed_name = excluded.printed_name,
  art_variant = excluded.art_variant,
  is_alternate_art = excluded.is_alternate_art,
  is_promo_variant = excluded.is_promo_variant;

update legality.restriction_lists
set is_active = false
where rule_profile_id in (
  'standard-baseline-v1',
  'v-premium-baseline-v1',
  'premium-baseline-v1'
)
  and id not in (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000003'
  );

insert into legality.restriction_lists (
  id,
  rule_profile_id,
  version_label,
  effective_from,
  effective_to,
  source_reference,
  is_active
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    'standard-baseline-v1',
    'dev-2026-04',
    date '2026-04-08',
    null,
    'dev-seed',
    true
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    'v-premium-baseline-v1',
    'dev-2026-04',
    date '2026-04-08',
    null,
    'dev-seed',
    true
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    'premium-baseline-v1',
    'dev-2026-04',
    date '2026-04-08',
    null,
    'dev-seed',
    true
  )
on conflict (id) do update
set
  rule_profile_id = excluded.rule_profile_id,
  version_label = excluded.version_label,
  effective_from = excluded.effective_from,
  effective_to = excluded.effective_to,
  source_reference = excluded.source_reference,
  is_active = excluded.is_active;

insert into legality.card_restriction_rules (
  id,
  restriction_list_id,
  card_entity_id,
  restriction_type,
  max_copies,
  note
)
values
  (
    '50000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004',
    'limited',
    1,
    'Synthetic dev restriction for Standard legality testing.'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000008',
    'banned',
    0,
    'Synthetic dev restriction for V Premium legality testing.'
  )
on conflict (id) do update
set
  restriction_list_id = excluded.restriction_list_id,
  card_entity_id = excluded.card_entity_id,
  restriction_type = excluded.restriction_type,
  max_copies = excluded.max_copies,
  note = excluded.note;

insert into legality.choice_restriction_rules (
  id,
  restriction_list_id,
  allowed_choices,
  note
)
values
  (
    '60000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    1,
    'Synthetic dev choice restriction for Premium legality testing.'
  )
on conflict (id) do update
set
  restriction_list_id = excluded.restriction_list_id,
  allowed_choices = excluded.allowed_choices,
  note = excluded.note;

insert into legality.choice_restriction_rule_cards (
  choice_restriction_rule_id,
  card_entity_id
)
values
  (
    '60000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004'
  ),
  (
    '60000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000008'
  )
on conflict (choice_restriction_rule_id, card_entity_id) do nothing;

commit;
