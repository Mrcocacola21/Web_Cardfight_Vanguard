# Wave 1 Legalities And Restrictions

## 1. Purpose

Apply the first minimal legality/restriction data layer to published wave-1
content without hardcoding legality in UI or mixing legality truth with
gameplay validation logic.

## 2. Scope

Wave 1 covers only published Standard / D / DZ content.

Relevant formats for this step:

- `standard` as the primary wave scope
- `premium` and `v-premium` only where the existing legality profiles already
  define a meaningful outcome for the same published card entities

This step does not roll out full all-format legality content.

## 3. Relevant Formats For Wave 1

Wave-1 legality uses the already persisted legality schema:

- `legality.formats`
- `legality.rule_profiles`
- `legality.rule_profile_product_families`
- `legality.restriction_lists`
- `legality.card_restriction_rules`
- `legality.choice_restriction_rules`

For published wave-1 cards:

- `standard` is derived as allowed through `family-standard`
- `premium` is also derivable where the active Premium profile supports the
  same product families
- `v-premium` is derivable as disallowed because wave-1 published cards do not
  belong to `family-v`

## 4. Where Legality Facts Live

Legality facts live at the canonical `CardEntity` level.

Why:

- legality is gameplay-facing identity truth
- it should not be duplicated per printing when the fact applies to the card as
  a gameplay object
- printing-level publication remains separate from legality truth

Wave-1 legality is derived from persisted data:

- published `catalog.card_printings`
- published `catalog.products.family_id`
- active `legality.rule_profiles`
- active `legality.rule_profile_product_families`
- explicit `rule_profile_card_eligibility_overrides` when present

## 5. Where Restriction Facts Live

Restriction facts also live at the canonical `CardEntity` level.

They remain stored in:

- `legality.restriction_lists`
- `legality.card_restriction_rules`
- `legality.choice_restriction_rules`
- `legality.choice_restriction_rule_cards`

Wave 1 does not introduce printing-specific restrictions.

## 6. What Was Applied To The Published Wave

Applied for published wave-1 cards:

- catalog read logic now derives structured `allowed` / `disallowed`
  eligibility facts from persisted format/profile/product-family data
- those facts are available only for cards that actually have published
  printings

Wave-1 published cards therefore receive legality facts through data, not UI
constants.

Restrictions for wave 1:

- no new wave-1-specific restriction rows were added
- the restriction path remains active and queryable
- published wave-1 cards currently have no active restriction entries unless a
  real restriction row exists for them

## 7. What Was Intentionally NOT Applied

Not applied in this step:

- legality facts for unresolved / unpublished `Liael`
- printing-level legality duplication
- deck-level validation outcomes
- gameplay rules execution
- fake wave-1 restriction rows just to exercise the UI

## 8. Future Consumers Of This Data

This legality/restriction path is now usable by:

- catalog card detail display
- later catalog filtering by format / legality
- future deck validation modules that read legality truth as input data

The validation engine still remains a separate later phase.

## 9. Summary

Wave-1 legality/restriction support is now data-first:

- legality truth stays in legality + catalog persistence
- card-level legality is derived from published catalog presence plus active
  format profiles
- restriction truth remains structured and queryable
- unresolved/unpublished content does not receive catalog-facing legality facts
- no UI hardcoding is required to represent wave-1 legality
