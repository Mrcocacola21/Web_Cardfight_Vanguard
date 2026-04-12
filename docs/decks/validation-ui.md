# Validation UI

## 1. Purpose

This document defines the first UI layer for deck validation in the deck
builder.

The goal of this step is to:

- render the existing validation result in one bounded feedback surface;
- keep validation derived from the current draft state;
- make errors and warnings readable without creating a second deck state model.

## 2. Why validation is read-only in UI

Validation still lives in the domain validation package.

The builder UI:

- prepares validation input from the current draft plus prepared card facts;
- calls the validation core as derived data;
- renders the returned result.

The UI does not:

- own a separate mutable validation deck;
- write validation state back into the draft;
- reimplement rule logic in React components.

## 3. Validation panel structure

The builder now renders one dedicated `DeckValidationPanel` above the catalog
and current-deck columns.

The panel:

- receives one structured validation result;
- shows summary status and counts;
- groups issues into deck-level and card-level feedback;
- keeps long card-issue lists bounded with a simple expand control.

## 4. Severity handling

The UI keeps the shared severity model:

- `error` uses destructive styling and marks the draft invalid;
- `warning` uses softer warning styling;
- `info` stays neutral.

Severity styling is applied both in the panel and on affected deck rows.

## 5. Deck-level vs card-level issues

Deck-level issues stay in the summary surface and cover targets such as:

- deck;
- format;
- section;
- restriction groups.

Card-level issues stay in the same panel but also link back to the matching deck
row when the current draft contains that card.

Current deck rows now expose:

- severity-based highlighting;
- issue-count badges for the affected card row.

## 6. UX decisions

Validation appears as one bounded feedback block instead of scattered inline
warnings across the whole page.

This keeps the builder usable because:

- the main editing workflow remains visible;
- actionable card problems can still jump to the affected row;
- long issue lists do not immediately become a wall of repeated messages.

## 7. What is intentionally NOT implemented yet

This step does not add:

- new validation rules;
- auto-fix actions;
- per-field inline warning systems across the whole builder;
- validation-owned mutable UI state;
- deep animation or full visual polish.

It also does not solve missing Premium-only qualification facts beyond the
current prepared validation data surface.

## 8. Summary

The deck builder now has a real validation UI surface that:

- reads the existing validation result as derived data;
- keeps one stable feedback area;
- distinguishes severity clearly;
- links card-level issues back to existing deck rows;
- stays aligned with the single draft source of truth.
