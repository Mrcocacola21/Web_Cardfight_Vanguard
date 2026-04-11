# Content Wave 1 Seed

## Purpose

Prepare one small but realistic Standard-focused D/DZ seed wave for the dev JSON
import path.

This wave is intentionally chosen to validate:

- one clean normal import path
- one multi-printing path
- one review-queue path

It is not a publication step.

## Scope

This wave is deliberately small:

- 3 products
- 4 printing records
- Keter Sanctuary only
- Standard / D/DZ only

The goal is readability and pipeline validation, not content volume.

## Selected Product(s)

- `D-BT01 Genesis of the Five Greats`
  - clean D-era control product
- `DZ-BT01 Fated Clash`
  - early DZ booster with known parallel printing variants
- `DZ-BT02 Illusionless Strife`
  - follow-up DZ booster used for the intentional review/unresolved case

Fixture:

- `packages/importer/fixtures/dev-json/content-wave-1-standard-ddz-minimal.json`

## Normal Case

Card:

- `Apex Ruler, Bastion`

Why it is here:

- one straightforward Standard-grade grade 3 unit
- one printing only in this seed wave
- useful as the control case for raw import -> normalization -> no-review flow

Expected intent:

- clean raw import
- clean normalization to one canonical card entity
- no manual review item

## Multiple Printings Case

Card:

- `Fated One of Miracles, Rezael`

Printings included:

- `DZ-BT01/010EN`
- `DZ-BT01/DSR01EN`

Why it is here:

- same canonical Standard card
- two realistic printing-level variants in the same DZ booster
- validates that printings remain distinct while normalization can still attach
  both to one canonical entity

Expected intent:

- two raw printing rows
- both normalize toward the same canonical card entity
- no accidental duplication of `CardEntity`

## Ambiguity / Review Case

Card:

- `Fated One of Time, Liael=Amorta`

Printing included:

- `DZ-BT02/010EN`

Why it is here:

- real Standard / DZ card
- used as the intentional review-queue case for this minimal wave
- the wave assumes the accompanying minimal canonical bootstrap will include
  Bastion and Rezael, but will intentionally omit Liael=Amorta

Expected intent:

- raw import succeeds normally
- normalization should remain unresolved under the intended minimal canonical
  bootstrap
- a manual review item should be created instead of silently inventing catalog
  truth

## Expected Pipeline Outcomes

Under the intended wave-1 baseline:

- `Apex Ruler, Bastion`
  - raw import succeeds
  - normalization should auto-resolve
  - no review item
- `Fated One of Miracles, Rezael`
  - both printings import separately
  - both should normalize to the same canonical entity
  - no review item
- `Fated One of Time, Liael=Amorta`
  - raw import succeeds
  - normalization should remain unresolved
  - manual review queue item should be created

## What This Step Explicitly Does NOT Do

- publish anything into final catalog truth
- load a large Standard dataset
- cover V/Premium eras
- provide full mechanical, legality, or collector coverage
- replace a later real content wave

## Summary

This seed is a minimal but realistic Standard D/DZ content slice. It is small
enough to inspect manually, realistic enough to exercise importer semantics, and
intentional about the three pipeline cases that matter right now:

- normal
- multiple printings
- unresolved/review
