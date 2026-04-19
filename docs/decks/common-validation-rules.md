# Common Validation Rules

## 1. Purpose

This document defines the first real common validation layer that runs before
any format-specific validators.

Its scope is narrow:

- enforce deck invariants that are shared across the currently supported
  official formats;
- keep those checks in pure domain validation;
- return issues through the same stable validation result contract.

## 2. Why These Rules Are Format-Neutral

These rules are treated as common because they do not depend on:

- published format-profile baselines for section size and duplicate limits;
- Standard ride-deck semantics;
- V Premium clan logic;
- Premium G-deck logic;
- restriction-list exceptions.

They validate baseline deck integrity first. Format-specific validators then add
extra rules on top. Format-aware baseline size and copy-limit checks now run
inside the selected format validator group so those limits can follow published
profile data honestly.

## 3. Deck Presence Rule

The common layer now checks:

- `empty-deck`
  when the deck has no positive-quantity cards at all.

## 4. Structural Consistency Rules

The common layer now enforces these structural invariants:

- format id must be present;
- deck entries must use supported section keys;
- deck entries must use positive integer quantities;
- deck entries must reference a non-empty canonical card entity id;
- duplicate rows for the same canonical card in the same section are rejected;
- deck version and published snapshot must stay internally aligned.

## 5. Issue Model / Issue Codes

Common-rule issues use the shared validation issue model and stable codes.

Current common-rule codes:

- `empty-deck`
- `missing-format`
- `missing-card-entity-id`
- `invalid-card-quantity`
- `invalid-card-section`
- `duplicate-card-entry`
- internal consistency codes such as `snapshot-card-mismatch`

Targets are chosen by issue type:

- deck-level target for `empty-deck`
- card target for broken-entry issues
- format target for format attachment mismatches

## 6. What Is Intentionally NOT Implemented Yet

Still out of scope for this step:

- deeper V Premium-specific construction rules;
- deeper Premium G-deck qualification rules;
- restriction-list exceptions;
- trigger-specific legality;
- database or catalog reads from validators;
- validation UI.

## 7. How Later Phases Extend This

Later phases should build on top of this common layer by adding:

- richer common legality rules that are still format-neutral;
- deeper Standard-specific validators;
- deeper V Premium-specific validators;
- deeper Premium-specific validators;
- restriction-aware validators.

The orchestration stays the same: common validation first, format branches
second.

## 8. Summary

The validation core now has a real common-rules layer with:

- non-empty deck checks;
- stronger broken-entry validation;
- integration ahead of format-specific validators.

This gives the project a solid validation foundation before deeper
format-specific legality work begins.
