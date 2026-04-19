# Validation Tests Checkpoint

## 1. Scope

This checkpoint locks Phase 10 validation behavior with scenario-level deck tests.
The goal is not to add new validation features, but to protect the existing rule-based pipeline, restriction layer, profile-driven baselines, and runtime wiring from regression as card content grows.

## 2. Test Deck Strategy

Scenario fixtures now live as a first-class layer under `packages/deck-validation/src/fixtures/decks/`.
Each fixture is a readable TypeScript scenario with:

- a realistic deck shape
- a prepared validation context
- explicit expected issues
- format-isolation expectations

The suite avoids giant JSON dumps and keeps each deck focused on one deck-building outcome.

## 3. Standard Scenarios

Standard fixture coverage includes:

- a valid nation-consistent main plus ride deck
- an undersized main deck
- an invalid ride deck
- a mixed-nation deck
- a deck that combines a banned card with another baseline failure

These scenarios lock Standard-specific issue codes and confirm that V Premium and Premium validators do not leak into the Standard path.

## 4. V Premium Scenarios

V Premium fixture coverage includes:

- a valid single-clan deck
- a mixed-clan deck
- a legality failure
- a limited-card restriction failure

The suite also includes a custom-profile scenario that proves validation uses `context.format.profile` for deck size and copy-limit baselines instead of silently falling back to hidden defaults.

## 5. Premium Scenarios

Premium fixture coverage includes:

- a valid main plus G deck
- a G-deck-qualified card placed in the main deck
- an invalid G deck size
- a choice restriction violation

This complements the existing runtime integration hardening tests in `apps/web/src/features/decks/deck-builder-validation.test.ts`, which already verify that Premium qualification facts are hydrated on the real web/server path.

## 6. Restriction Coverage

Restriction behavior is now locked inside real deck flows instead of isolated rule assertions only:

- `banned` is covered in a Standard deck fixture
- `limited` is covered in a V Premium deck fixture
- `choice` is covered in a Premium deck fixture

One Standard scenario intentionally combines a restriction failure with a baseline deck-size failure so aggregation is protected too.

## 7. Issue Model Coverage

The scenario suite asserts the stable validation contract for each fixture:

- `issue.code`
- `issue.severity`
- `issue.category`
- `issue.target`

It also checks summary counts, validator groups, and format-specific rule execution boundaries.

## 8. Format Isolation

Every scenario carries required and forbidden rule expectations.
This locks the format-aware pipeline contract:

- Standard validators run only for Standard decks
- V Premium validators run only for V Premium decks
- Premium validators run only for Premium decks

The suite also rejects foreign issue-code prefixes for each format.

## 9. What Is Not Covered

This checkpoint does not attempt:

- exhaustive card-by-card legality matrices
- UI rendering as the source of truth
- a new validation framework or rewrite
- browser e2e as the main validation contract

Lower-level structural rule tests remain in the existing validation core unit/pipeline suite.

## 10. Risks

The main remaining risk is content breadth, not architecture shape.
New cards, sets, and future formats will still need additional fixtures, but the suite now has a clean place to add them without turning tests into inline deck noise.

## 11. Verdict

`GO`

Phase 10 validation is now protected by readable deck scenarios across Standard, V Premium, and Premium, with restriction coverage, issue-model assertions, format isolation, and profile-driven baseline coverage in place.
