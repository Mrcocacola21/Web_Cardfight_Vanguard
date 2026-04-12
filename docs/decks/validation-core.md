# Validation Core

## 1. Purpose

This document defines the initial deck validation core introduced for Phase 10.

The goal of this step is narrow:

- create a reusable validation foundation over current deck state;
- keep validation pure and domain-oriented;
- return structured results that future UI and rule phases can consume.

This step does not implement the full legality engine, full format coverage, or
final validation UX.

## 2. Why Validation Is a Separate Module

Validation now lives in [`packages/deck-validation`](/c:/codes/Web_VG/packages/deck-validation/README.md)
as its own package.

This keeps validation:

- outside UI components and route handlers;
- outside deck builder mutation flows;
- derived from the existing `Deck` aggregate instead of creating a second deck
  state;
- reusable by later server, builder, and legality-oriented orchestration.

The validation core consumes deck state. It does not own deck state.

## 3. Input Contract

The public input contract is:

```ts
interface DeckValidationInput {
  readonly deck: Deck
  readonly context?: DeckValidationContext
}
```

`deck` is the canonical input. That single aggregate already carries:

- deck metadata such as `formatId`;
- deck cards through `deck.currentVersion.cards`;
- current snapshot through `deck.currentVersion.snapshot`.

`DeckValidationContext` is intentionally small but growth-ready:

- `format?: { profile?: FormatProfile }`
- `cardFacts?: ReadonlyMap<CardId, DeckValidationCardFacts>`
- `restrictions?: { listId?: string; activeList?: RestrictionList }`

The core therefore reads one canonical deck object plus optional validation
context, without inventing a parallel mutable validation model.

`DeckValidationCardFacts` now carries the prepared card metadata and baseline
legality slices needed by format validators, such as `grade`, `cardType`,
`nation`, `clan`, per-format legality facts, and Premium G-deck qualification
facts.

## 4. Output Contract

The public result contract is:

```ts
interface DeckValidationResult {
  readonly isValid: boolean
  readonly formatId: FormatId | null
  readonly validatorGroups: readonly DeckValidationValidatorGroupId[]
  readonly evaluatedRules: readonly DeckValidationRuleId[]
  readonly issues: readonly DeckValidationIssue[]
  readonly summary: DeckValidationSummary
}
```

`summary` currently contains:

- `totalIssues`
- `errorCount`
- `warningCount`
- `infoCount`

`isValid` is derived from the issue set and is `true` only when no error issues
exist.

## 5. Issue Model

Each issue is structured:

```ts
interface DeckValidationIssue {
  readonly severity: 'error' | 'warning' | 'info'
  readonly category:
    | 'deck'
    | 'card'
    | 'section'
    | 'format'
    | 'restriction'
    | 'input'
  readonly code: string
  readonly message: string
  readonly target: DeckValidationTarget
}
```

The current target taxonomy supports:

- deck-level targets
- format-field targets
- section targets
- card targets
- restriction targets

This gives future UI and tests stable machine-facing hooks through `code` and
`target`, instead of relying on message strings alone.

## 6. Validation Pipeline Model

The package uses a simple sequential pipeline:

- each validator is a pure rule object with an `id` and `validate(input)` method;
- `createDeckValidationPipeline()` composes common and format-selected validator lists;
- `validateDeck()` runs the pipeline, accumulates issues, and produces the final
  result.

The default pipeline now runs `commonDeckValidators` first and then routes into
the matching format validator group when the deck format is supported.

This is intentionally small. Future phases can append:

- common validators
- Standard validators
- V Premium validators
- Premium validators
- restriction validators

without changing the result contract or introducing a second state model.

## 7. Minimal Rules Included Now

The core already performs meaningful baseline checks:

- deck must not be empty;
- deck format must be present;
- main deck must satisfy the common 50-card baseline;
- main-deck copy counts must stay within the common 4-copy baseline;
- deck entry section keys must be structurally valid;
- deck entries must reference non-empty canonical card entity ids;
- deck entry quantities must be positive integers;
- duplicate card rows in the same section are rejected;
- current version `deckId` must match aggregate `deckId`;
- current version `formatId` must match aggregate `formatId`;
- snapshot `deckId`, `formatId`, and `revision` must stay aligned;
- snapshot composition must match current version composition.

These are intentionally common baseline rules. Ride-deck, G-deck, and other
format-specific structure rules remain in separate format validator groups.

## 8. What Is Intentionally Not Implemented Yet

Not part of this step:

- validation UI rendering;
- builder warning surfaces;
- full Standard / V Premium / Premium rule families;
- full legality support states;
- restriction-list evaluation logic;
- catalog or database reads from validators;
- a large generic rule-engine framework.

## 9. How Later Phases Build On This Core

Later validation phases can extend this core by:

- passing richer `DeckValidationContext`;
- composing format-specific validator arrays on top of `commonDeckValidators`;
- adding deeper restriction-aware validators that consume prepared restriction data;
- mapping structured issues into one bounded UI feedback layer.

The key boundary stays the same: validation remains a pure derived layer over
the current deck draft or deck version.

## 10. Summary

The repository now has a dedicated validation core package with:

- a clear deck-first input contract;
- a structured result contract;
- explicit issue categories and targets;
- an extensible pipeline shell;
- minimal baseline rules;
- focused tests that protect contracts, deterministic output, and no-mutation
  behavior.

This is enough foundation to move into later validation phases without forcing
an architectural rewrite.
