# Content Layer Schema

## 1. Scope

This schema covers the initial content layer needed for:

- canonical catalog content
- format and rule-profile persistence
- legality-relevant content facts

Included:

- `catalog.product_families`
- `catalog.products`
- `catalog.card_entities`
- `catalog.card_printings`
- `legality.formats`
- `legality.rule_profiles`
- rule-profile structure and eligibility tables
- restriction-list content tables

Out of scope for this step:

- deck storage
- user/profile/social storage
- gameplay runtime state
- match state
- importer raw workflow tables
- legality results for arbitrary deck validations
- UI-facing projection tables

## 2. Core Tables

### Catalog truth

- `catalog.product_families`
  - normalized release lineage
- `catalog.products`
  - release containers for printings
- `catalog.card_entities`
  - canonical gameplay identity
- `catalog.card_printings`
  - printing-level identity

### Legality-owned content facts

- `legality.formats`
  - top-level format identity
- `legality.rule_profiles`
  - versioned format rule profiles
- `legality.rule_profile_sections`
  - section-level deck structure facts
- `legality.rule_profile_duplicate_scope_sections`
  - duplicate-counting scope
- `legality.rule_profile_trigger_rules`
  - trigger baseline per profile
- `legality.rule_profile_trigger_type_limits`
  - per-trigger-type limits
- `legality.rule_profile_product_families`
  - baseline eligible product families
- `legality.rule_profile_gameplay_markers`
  - format-facing runtime markers
- `legality.rule_profile_card_eligibility_overrides`
  - explicit card-level eligibility exceptions
- `legality.restriction_lists`
  - versioned legality list baselines
- `legality.card_restriction_rules`
  - banned / limited / semi-limited / maximum-copies rules
- `legality.choice_restriction_rules`
  - choice-group rules
- `legality.choice_restriction_rule_cards`
  - membership of each choice group

## 3. Key Relationships

- `legality.formats -> legality.rule_profiles`
  - one format has many profile versions
- `catalog.product_families -> catalog.products`
  - one product family has many products
- `catalog.card_entities -> catalog.card_printings`
  - one canonical card has many printings
- `catalog.products -> catalog.card_printings`
  - one product contains many printings
- `legality.rule_profiles -> catalog.product_families`
  - profile-level baseline eligibility references catalog lineage
- `legality.rule_profiles -> catalog.card_entities`
  - explicit eligibility overrides target canonical cards
- `legality.restriction_lists -> catalog.card_entities`
  - restrictions attach to canonical cards, not printings

## 4. CardEntity vs CardPrinting

The schema keeps gameplay identity and printing identity separate by construction:

- `catalog.card_entities` stores gameplay-stable fields only
  - name, type, grade, nation/clan, stats, keywords, effect refs
- `catalog.card_printings` stores release and presentation fields only
  - product link, collector number, rarity, locale, art variant

This prevents set, rarity, and promo metadata from polluting canonical card identity, while still preserving reprints, promos, and alternate arts.

## 5. Formats and RuleProfiles

Formats and profiles are not flattened into strings on card or deck rows.

- `legality.formats`
  - stable format identity such as `standard`, `v-premium`, `premium`
- `legality.rule_profiles`
  - versioned rule facts for each format

Profile structure is split into focused child tables so the schema can express:

- deck sections
- duplicate-count scope
- trigger limits
- eligible product families
- gameplay-facing markers

That keeps `format` and `profile` as first-class persisted objects rather than magic labels.

## 6. Legality Content Facts

The legality part of the content layer stores legality inputs and baselines, not deck-validation outcomes.

Stored here:

- baseline eligible product families
- explicit card eligibility overrides
- restriction lists
- card restriction rules
- choice restriction groups

Not stored here:

- `LegalityResult`
- deck-specific validation history
- ad hoc cached legality outcomes for arbitrary snapshots

This preserves the boundary between legality truth and legality processing.

## 7. Constraints and Indexing Rationale

Important constraints:

- unique canonical keys for products, card entities, and printings
- one active rule profile per format
- one active restriction list per rule profile
- unique printing identity within `product + collector_number + locale`
- check constraints for:
  - product taxonomy category/kind combinations
  - card vocabulary
  - trigger typing
  - restriction-type semantics

Important indexes:

- product family/code/region lookup
- release-date lookup
- normalized card-name lookup
- card-printing lookups by card and by product
- restriction lookups by card
- choice-restriction membership lookup by card

## 8. What Is Intentionally Out of Scope

This schema does not yet attempt to model:

- importer raw ingestion state
- deck versions or snapshots
- user-owned content
- social features
- gameplay runtime state
- materialized gameplay projections
- repository abstractions

Those belong to later layers and should not be collapsed into the content schema prematurely.
