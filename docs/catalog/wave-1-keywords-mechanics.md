# Wave 1 Keywords / Mechanics

## 1. Purpose

Apply a minimal, persisted keyword/mechanics layer to the published wave-1
catalog content so later filters, card detail pages, and gameplay-oriented
modules can consume structured data instead of UI constants.

## 2. Scope of Keywords / Mechanics for Wave 1

Wave 1 only covers the published `Standard / D / DZ` entities that crossed the
publication boundary:

- `Apex Ruler, Bastion`
- `Fated One of Miracles, Rezael`

Applied mechanics:

- `twin-drive`
- `persona-ride`
- `divine-skill` (`Rezael` only)

This is intentionally not a full Vanguard keyword rollout.

## 3. Domain Level Decision (Entity vs Printing)

Gameplay-facing mechanics live on `CardEntity`.

Rationale:

- `Twin Drive`, `Persona Ride`, and `Divine Skill` describe canonical gameplay
  identity.
- `Rezael` has two published printings, but both still point to the same
  canonical entity.
- no wave-1 mechanic in this step is printing-specific.

## 4. Data Model (High-Level)

Structured keyword data now lives in `catalog`:

- `catalog.keyword_tags`
  - registry of supported keyword/mechanic tags
- `catalog.card_entity_keyword_tags`
  - explicit mapping from canonical `CardEntity` to keyword/mechanic tags

The existing `catalog.card_entities.keywords` array is kept as a flattened
projection for current catalog reads, but the normalized tables are now the
durable keyword source of truth.

## 5. Applied Keywords (`Bastion` / `Rezael`)

`Apex Ruler, Bastion`

- `twin-drive`
- `persona-ride`

`Fated One of Miracles, Rezael`

- `twin-drive`
- `persona-ride`
- `divine-skill`

Because the tags live on `CardEntity`, both published `Rezael` printings share
the same mechanics through the same canonical entity.

## 6. Excluded Records (`Liael`)

`Fated One of Time, Liael=Amorta` remains excluded.

Reason:

- it never crossed publication
- it remains review-owned
- keyword/mechanics data is not used as a side channel for unpublished content

## 7. How This Will Be Used Later

This data foundation is intended for:

- catalog filters by keyword/mechanic
- card detail presentation backed by catalog truth
- future rules / validation modules that need canonical gameplay markers

This step does not interpret effects or execute rules.

## 8. What Is Intentionally NOT Implemented

- gameplay engine behavior
- automatic rules text parsing
- full keyword coverage for all Vanguard eras
- printing-specific keyword logic
- UI-only keyword badges as the source of truth

## 9. Summary

Wave 1 now has a minimal but correct keyword/mechanics data layer:

- persisted
- structured
- attached at the canonical `CardEntity` level
- excluded from unpublished review-stage content
- usable later by filters, detail views, and gameplay-oriented systems
