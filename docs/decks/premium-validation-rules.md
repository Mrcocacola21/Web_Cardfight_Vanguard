# Premium Validation Rules

## 1. Purpose

This document defines the first dedicated Premium validation layer in the
deck-validation package.

Its scope is intentionally narrow:

- run only for `premium` decks;
- validate main-deck and G-deck separation;
- validate baseline G-deck structure;
- validate baseline Premium legality for canonical cards;
- keep one shared validation result and issue model.

## 2. Why Premium Is Structurally Different

Premium is the first supported format that uses two explicit deck sections in
its baseline structure:

- `main`
- `g`

That means Premium validation must check more than broad format legality. It
must also validate whether a canonical card is admissible in the section where
the deck places it.

## 3. Main Deck Rules

The Premium layer now treats main-deck qualification separately from G-deck
qualification.

It reports:

- `premium-card-section-qualification-missing`
  when a card lacks prepared G-deck qualification facts;
- `premium-main-deck-contains-g-deck-card`
  when a card marked as G-deck-qualified is placed in the main deck.

This keeps Premium from collapsing into one undifferentiated card pool.

## 4. G Deck Rules

The Premium layer now validates the G deck as its own section.

It reports:

- `premium-g-deck-missing`
  when the supplied Premium profile requires a G deck and the deck has none;
- `premium-g-deck-size-invalid`
  when the G deck falls outside the profile bounds;
- `premium-g-deck-invalid-card`
  when a card in section `g` is not qualified for G-deck occupancy.

The current baseline uses prepared `premiumGDeckEligible` facts. It does not
attempt to derive G-deck meaning from UI state, era guessing, or DB access.

## 5. Issue Model

Current Premium-specific codes:

- `premium-card-facts-missing`
- `premium-card-section-qualification-missing`
- `premium-g-deck-missing`
- `premium-g-deck-size-invalid`
- `premium-g-deck-invalid-card`
- `premium-main-deck-contains-g-deck-card`
- `premium-card-legality-missing`
- `premium-card-legality-invalid`

Targets remain inside the shared issue model:

- deck target for missing Premium card-facts context;
- section target for G-deck structure issues;
- card target for section-qualification and legality failures;
- `input` category for missing prepared facts;
- `format` category for explicit baseline illegality.

## 6. Integration With Pipeline

The Premium validator group now runs in this order:

1. `validate-premium-sections`
2. `validate-premium-card-facts`
3. `validate-premium-g-deck-structure`
4. `validate-premium-section-qualification`
5. `validate-premium-card-legality`

The existing format-aware pipeline selects this group only when
`deck.formatId === 'premium'`.

## 7. Differences From Standard And V Premium

The three supported format branches now validate different structural concerns:

- Standard validates ride-deck structure and nation consistency;
- V Premium validates clan consistency and baseline format legality;
- Premium validates main/G deck separation, G-deck structure, and baseline
  format legality.

All three still reuse the same common validator layer and result shape.

## 8. What Is NOT Implemented Yet

Still out of scope for this step:

- full Premium gameplay or stride rules;
- advanced G-deck exception handling;
- restriction-list validation;
- UI rendering of validation issues;
- DB or catalog reads inside validators;
- a general-purpose rules engine framework.

## 9. Summary

The validation core now has a real Premium-specific layer with:

- clean pipeline routing;
- explicit main-deck versus G-deck validation;
- baseline G-deck structure checks;
- baseline Premium legality validation;
- stable issue codes over canonical card identity.

This confirms that the validation architecture can scale to a structurally
richer format without rewriting the core pipeline.
