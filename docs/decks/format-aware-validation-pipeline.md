# Format-Aware Validation Pipeline

## 1. Purpose

This document defines the Phase 10.2 validation change that makes the deck
validation core format-aware.

The goal of this step is to route one stable validation result shape through:

- common validators that always run;
- format-specific validators selected by deck format;
- honest handling for missing or unsupported formats.

## 2. Why Validation Must Be Format-Aware

Standard, V Premium, and Premium do not share the same deck structure or rule
surface.

That means validation cannot remain one undifferentiated validator list. The
pipeline must know which format is being validated and which validator group is
allowed to run.

Format awareness belongs in validation orchestration, not in scattered UI
conditionals or route-level helper checks.

## 3. Input/Context Model

The canonical input stays:

```ts
interface DeckValidationInput {
  readonly deck: Deck
  readonly context?: DeckValidationContext
}
```

Format is now treated explicitly through two layers:

- `deck.formatId` is the canonical attached format id;
- `context.format?.profile` is the optional resolved format profile for deeper
  format-aware validators.

The pipeline routes by `deck.formatId`. Format-specific validators may also use
the supplied profile when available.

## 4. Common vs Format-Specific Validators

The package now separates validator groups explicitly:

- `commonValidators`
- `standardValidators`
- `vPremiumValidators`
- `premiumValidators`
- `restrictionValidators`

Those groups are registered in one validator registry. That registry is the
single place where the pipeline learns which validators belong to which format.

The common validator group now covers baseline deck invariants such as:

- non-empty deck checks;
- main-deck size checks;
- main-deck copy-limit checks;
- structural entry consistency checks.

## 5. Pipeline Orchestration Model

The pipeline now works in this order:

1. run common validators;
2. evaluate format routing through `select-format-validator-group`;
3. if the format is supported and coherent, select the matching format group;
4. run the selected format validators;
5. run the restriction validator layer;
6. aggregate everything into the same `DeckValidationResult` shape.

The result shape stays unified across all formats. Format-aware routing changes
which rules run, not how the result is represented.

## 6. Unsupported/Missing Format Handling

The pipeline handles format failures explicitly:

- missing format:
  common validators report `missing-format`, and no format group is selected;
- unsupported format:
  routing reports `unsupported-format`, and no format group is selected;
- mismatched format profile:
  routing reports `format-profile-mismatch`, and no format group is selected.

This prevents silent rule skipping and avoids pretending the deck was fully
validated for a format branch that never actually ran.

## 7. How Later Phases Build On This

Later phases can extend this structure without rewriting the core:

- add more common validators;
- add deeper Standard validators;
- add deeper V Premium validators;
- add richer Premium validators;
- add deeper restriction validators beside or after the format branch;
- pass deeper prepared context into format-specific rules.

The routing model stays the same: common first, then format-specific selection,
then unified aggregation.

## 8. What Is Intentionally NOT Implemented Yet

Still out of scope for this step:

- full Standard rule coverage;
- full V Premium rule coverage;
- full Premium rule coverage;
- restriction list validation logic;
- UI rendering of validation;
- database-backed validation reads;
- a generic plugin or rules-engine framework.

## 9. Summary

The validation core now has a real format-aware orchestration layer:

- format is explicit in the validation flow;
- common and format-specific validators are separated cleanly;
- Standard, V Premium, and Premium route through distinct validator groups;
- unsupported and missing formats fail honestly;
- result shape and issue model remain unified.

This is the foundation needed for later rule phases without forcing a rewrite of
the validation core.
