# V Premium Validation Rules

## 1. Purpose

This document defines the first dedicated V Premium validation layer in the
deck-validation package.

Its scope is intentionally narrow:

- run only for `v-premium` decks;
- validate clan-based deck construction;
- validate baseline format legality for canonical cards;
- keep one shared validation result and issue model.

## 2. Why V Premium Rules Differ

V Premium does not share Standard's nation-based construction model.

The format branch therefore validates different invariants:

- one clan baseline instead of one nation baseline;
- no ride-deck structure checks;
- baseline card legality for the declared V Premium format.

These rules belong in the V Premium validator group, not in common validators,
UI code, or deck-builder mutation flows.

## 3. Clan Building Rules

The V Premium layer now validates clan consistency across main-deck cards.

It reports:

- `v-premium-card-clan-missing`
  when a card lacks prepared clan facts;
- `v-premium-clan-mismatch`
  when a card belongs to a different clan than the deck's resolved clan
  baseline.

The validator works on canonical `CardEntity` ids and reads `clan` through
prepared `context.cardFacts`.

## 4. Legality Rules

The V Premium layer also performs a minimal baseline legality check.

It reports:

- `v-premium-card-legality-missing`
  when a card lacks prepared format-legality facts;
- `v-premium-card-legality-invalid`
  when the provided legality facts do not allow the card in `v-premium`.

This is intentionally only a baseline format-eligibility check. It does not
implement restriction-list logic or deeper exception handling.

## 5. Issue Model

Current V Premium-specific codes:

- `v-premium-card-facts-missing`
- `v-premium-card-clan-missing`
- `v-premium-clan-mismatch`
- `v-premium-card-legality-missing`
- `v-premium-card-legality-invalid`

Targets remain inside the shared issue model:

- deck target for missing V Premium card-facts context;
- card target for clan and legality failures;
- `input` category for missing prepared facts;
- `format` category for explicit baseline illegality.

## 6. Integration With Pipeline

The V Premium validator group now runs in this order:

1. `validate-v-premium-sections`
2. `validate-v-premium-card-facts`
3. `validate-v-premium-clan-constraints`
4. `validate-v-premium-card-legality`

The existing format-aware pipeline selects this group only when
`deck.formatId === 'v-premium'`.

## 7. Differences From Standard

The Standard branch and V Premium branch now prove the pipeline supports
multiple formats without branching in UI code.

Current difference in validation focus:

- Standard validates ride-deck structure and nation consistency;
- V Premium validates clan consistency and baseline format legality;
- both branches still reuse the same common validator layer and result shape.

## 8. What Is NOT Implemented Yet

Still out of scope for this step:

- deeper Premium rules and G-deck validation;
- full restriction-list handling;
- advanced V Premium exception logic;
- UI rendering of validation issues;
- DB or catalog reads inside validators;
- a general-purpose rules engine framework.

## 9. Summary

The validation core now has a real V Premium-specific layer with:

- clean pipeline routing;
- clan-based construction validation;
- baseline format-legality validation;
- stable issue codes;
- prepared-input use of catalog and legality facts.

This confirms that the validation architecture can grow format by format
without rewriting the core pipeline.
