# Validation Hardening Before Tests Checkpoint

## 1. Purpose

This note captures the targeted hardening pass completed before the `10.10`
validation tests checkpoint.

The goal of this step is narrow:

- remove pseudo-common baseline assumptions from validation;
- wire published `format.profile` data through the runtime validation path;
- provide the Premium section-qualification fact needed by the current
  validation layer;
- add focused integration coverage for those seams.

This is not a rewrite of validation architecture.

## 2. What Extensibility Seams Existed Before

Before this pass, the main seams were:

- main-deck size and copy-limit checks lived in the shared `common` layer even
  though they were really format/profile-sensitive baselines;
- the web runtime path did not consistently hydrate `context.format.profile`
  even though the validation core contract already supported it;
- Premium runtime validation still received `premiumGDeckEligible` as a
  placeholder `null` in the builder validation data path.

That meant the architecture looked more extensible than the runtime wiring
actually was.

## 3. How Baseline Constraints Are Now Profile-Driven / Format-Aware

Main-deck size and main-deck copy-limit checks now run as format-aware baseline
validators, not as fake-common rules.

Current behavior:

- `common` keeps only true shared invariants such as missing format, invalid
  rows, duplicate rows, empty deck, and deck/snapshot consistency;
- main-deck size resolves from `context.format.profile.deckStructure` when a
  matching profile is supplied;
- copy-limit resolves from
  `context.format.profile.constructionRules.duplicateConstraint` when a matching
  profile is supplied;
- supported-format fallbacks remain in place for `standard`, `v-premium`, and
  `premium` so current behavior stays stable if runtime profile hydration is
  temporarily unavailable.

This keeps the current supported formats stable without pretending the shared
layer owns universal deck-construction truth.

## 4. How `format.profile` Is Wired Through Runtime

The builder validation runtime now loads active published format profiles from
the legality tables and carries them through the builder validation data path.

Runtime flow now looks like this:

1. server validation-data preparation loads active rule profiles plus their
   published section, duplicate-scope, trigger, gameplay-marker, and product
   family data;
2. that data is mapped into `FormatProfile` objects;
3. builder validation data now carries those profiles;
4. `validateDeckBuilderDraft` selects the profile matching the current draft
   format and passes it into `context.format.profile`;
5. validation core uses that profile for format-aware baseline behavior and
   other profile-aware rules.

This makes the runtime path match the core contract instead of leaving richer
context only at package-test level.

## 5. How Premium Qualification Facts Are Now Provided

The builder validation server path now computes the current
`premiumGDeckEligible` fact from the published Premium `g`-section contract plus
current canonical card metadata.

Current baseline derivation:

- resolve the active Premium profile;
- read the Premium `g` section constraints;
- treat a card as `premiumGDeckEligible` when its grade and card type satisfy
  the published Premium `g`-section baseline.

This is intentionally limited to the current validation scope. It is enough to
make Premium section validation honest without introducing DB reads inside the
validation core or inventing a larger gameplay taxonomy in this step.

## 6. The 2 Integration Tests Added

Two focused integration tests now protect the hardening seams:

1. Premium runtime wiring:
   `apps/web/src/features/decks/deck-builder-validation.test.ts`
   proves that `getDeckBuilderValidationData -> validateDeckBuilderDraft`
   hydrates Premium profile data and Premium qualification facts, and that the
   runtime validation result surfaces Premium section placement honestly.
2. Profile-aware baseline behavior:
   `apps/web/src/features/decks/deck-builder-validation.test.ts`
   proves that runtime validation uses `context.format.profile` for main-deck
   size and copy-limit behavior rather than hidden shared constants.

## 7. What This Step Intentionally Does NOT Do

This hardening pass does not:

- rewrite validation architecture;
- introduce a generic constraints DSL;
- move DB access into validation core;
- add new validation feature phases;
- redesign validation UI;
- claim to solve full Premium gameplay semantics or full card-taxonomy support.

## 8. Summary

Validation remains the same overall system: a pure rule pipeline with format
groups, restriction support, and a UI consumer.

What changed here is that the last misleading seams were closed:

- common rules are more honest about what is actually common;
- runtime now provides real format profile context;
- Premium runtime validation receives the qualification fact it needs;
- integration coverage now defends those exact seams before `10.10`.
