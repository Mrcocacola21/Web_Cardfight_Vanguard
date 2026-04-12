# Standard Validation Rules

## 1. Purpose

This document defines the first real format-specific validation layer for
`standard` decks.

Its scope is intentionally narrow:

- run on top of the existing validation core and common validators;
- enforce baseline Standard ride-deck rules;
- enforce baseline Standard nation consistency;
- keep one stable issue/result shape.

## 2. Why Standard Rules Are Separate

Standard deck construction is not the same as V Premium or Premium.

These rules therefore live in the Standard validator group, not in:

- common validators;
- builder mutation logic;
- UI conditionals;
- route-level helpers.

The pipeline still runs common validation first. Standard rules then run only
for `deck.formatId === 'standard'`.

## 3. Ride Deck Rules

The Standard layer now validates these ride-deck invariants:

- `standard-ride-deck-missing`
  when the ride section is absent;
- `standard-ride-deck-size-invalid`
  when the ride section does not contain exactly 4 cards;
- `standard-ride-deck-grade-sequence-invalid`
  when the ride deck is not one card each for grades `0 / 1 / 2 / 3`;
- `standard-ride-deck-card-type-invalid`
  when a ride-deck card is not a unit card;
- `standard-ride-deck-card-metadata-missing`
  when catalog facts needed for ride-deck checks are missing for a card.

Ride-deck validation uses prepared `cardFacts` from the validation context.
Today it consumes `grade` and `cardType`. It does not query the catalog or DB
directly.

## 4. Nation Constraints

The Standard layer now treats nation consistency as a Standard-only rule.

It validates that:

- cards in the Standard construction sections resolve to one nation baseline;
- conflicting nations produce `standard-nation-mismatch`;
- missing nation facts produce `standard-card-nation-missing`.

The validator works on canonical `CardEntity` ids and reads `nation` from
prepared catalog facts in `context.cardFacts`.

## 5. Issue Model (Codes)

Current Standard-specific codes:

- `standard-card-facts-missing`
- `standard-ride-deck-missing`
- `standard-ride-deck-size-invalid`
- `standard-ride-deck-grade-sequence-invalid`
- `standard-ride-deck-card-type-invalid`
- `standard-ride-deck-card-metadata-missing`
- `standard-card-nation-missing`
- `standard-nation-mismatch`

Targets stay within the shared validation issue model:

- deck target for missing Standard card-facts context;
- section target for ride-deck requirement and size/grade issues;
- card target for invalid ride-deck cards and nation mismatches;
- input category for missing prepared catalog facts.

## 6. Integration With Validation Pipeline

The Standard validator group now runs in this order:

1. `validate-standard-sections`
2. `validate-standard-card-facts`
3. `validate-standard-ride-deck`
4. `validate-standard-nation-constraints`

This group is selected only by the format-aware pipeline for `standard` decks.
The result contract remains the same unified `DeckValidationResult`.

## 7. What Is Intentionally NOT Implemented Yet

Still out of scope for this step:

- full Standard legality coverage;
- trigger-count rules and other deeper Standard construction rules;
- special exception handling for ride-deck eligibility;
- restriction-list exceptions;
- UI rendering of validation issues;
- DB-backed or catalog-backed reads from validators;
- deeper V Premium and Premium rule families.

## 8. Summary

The validation package now has a real Standard-specific layer with:

- explicit pipeline integration;
- baseline ride-deck validation;
- nation-consistency validation;
- stable issue codes;
- pure input-driven use of prepared catalog facts.

This is the first true format-specific validation foundation without turning the
core into a generic rules engine.
