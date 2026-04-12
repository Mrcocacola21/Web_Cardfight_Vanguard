# Restriction List Validation

## 1. Purpose

This document defines the first restriction-list validation layer added on top
of the existing deck-validation pipeline.

Its scope is intentionally narrow:

- consume prepared restriction-list data through validation context;
- validate banned cards;
- validate stricter copy limits;
- validate baseline choice restrictions;
- keep one shared issue and result model.

## 2. Why Restriction Rules Are Separate From Structural Rules

Restriction rules are not the same as structural deck rules.

Structural validation answers questions such as:

- is the deck shape valid for the format;
- is a card in the correct section;
- does the deck satisfy baseline size rules.

Restriction validation answers a different question:

- does the active restriction list impose additional card-level admissibility
  limits on this otherwise structurally valid deck.

That is why the restriction layer now runs after the format-specific structural
validators instead of being embedded into common, Standard, V Premium, or
Premium validators.

## 3. Restriction Data Input/Context

Restriction validation consumes prepared data through
`DeckValidationContext.restrictions`.

Current input shape:

- `listId`
- `activeList`

`activeList` is the prepared `RestrictionList` coming from the existing legality
data foundation. Validators do not fetch it themselves.

Restrictions still operate on canonical `CardEntity` ids only. Printing-level
identity is never used in restriction validation.

## 4. Banned Rules

The restriction layer now validates card rules whose effective limit is zero.

It reports:

- `card-banned-in-format`
  when a canonical card appears in the deck while the active restriction list
  bans it for the deck format.

This is a hard error.

## 5. Limited Rules

The restriction layer now validates stricter copy limits from the active list.

It reports:

- `card-exceeds-restricted-copies`
  when deck quantity exceeds the effective restriction-list copy limit.

This runs on top of existing common quantity and copy-cap validation. It does
not replace those structural checks; it narrows them with formal restriction
data.

## 6. Choice Rules

The restriction layer now validates one baseline choice-restriction model:

- a group of mutually restricted canonical cards;
- a declared `allowedChoices` count;
- violation when the deck contains more distinct present choices than allowed.

It reports:

- `choice-restriction-violated`
  when the active restriction list's choice group is exceeded.

This is intentionally a practical baseline, not a full generic solver.

## 7. Issue Model

Current restriction-layer codes:

- `restriction-list-missing`
- `restriction-list-format-mismatch`
- `card-banned-in-format`
- `card-exceeds-restricted-copies`
- `choice-restriction-violated`

Targets stay within the shared issue model:

- restriction target for list-level context problems and choice-group failures;
- card target for banned and copy-limit violations.

Missing active list is currently a warning when restriction context is declared
but the active list is absent. Mismatched list format is an error.

## 8. Format Applicability

Restriction validation applies only when the active restriction list matches the
deck format.

Current behavior:

- Standard decks consume Standard restriction lists;
- V Premium decks consume V Premium restriction lists;
- Premium decks consume Premium restriction lists;
- mismatched lists produce `restriction-list-format-mismatch` and do not apply
  card or choice rules.

This prevents restrictions from bleeding across format branches accidentally.

## 9. What Is Intentionally NOT Implemented Yet

Still out of scope for this step:

- a full legality engine rewrite;
- UI validation panels;
- DB-backed restriction lookups inside validators;
- a generic restriction DSL;
- every corner case of official restriction semantics;
- advanced cross-rule interaction resolution.

## 10. Summary

The validation core now supports a real restriction layer with:

- prepared restriction-list input;
- banned-card validation;
- stricter copy-limit validation;
- baseline choice-restriction validation;
- clean aggregation into the existing validation result.

This moves deck validation beyond structure-only checks while preserving the
existing format-aware architecture and canonical-card identity model.
