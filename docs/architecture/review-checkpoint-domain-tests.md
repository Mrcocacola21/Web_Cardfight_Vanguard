# Domain Tests Checkpoint

Status: Domain tests checkpoint  
Last updated: 2026-04-07

## 1. Scope of This Checkpoint

This checkpoint does not aim to provide broad test coverage for the whole platform.

Its purpose is narrower:

- protect core domain invariants that already exist in code;
- validate a small set of domain-oriented helper behavior;
- reduce the risk of silent drift in format interpretation, card identity handling, deck snapshot counting, legality restriction interpretation, and gameplay projection usage.

This checkpoint deliberately focuses on:

- mapping and identity assumptions;
- format-profile interpretation helpers;
- deck and legality invariant helpers;
- gameplay-facing projection helpers.

It does not attempt to test:

- a legality engine that does not yet exist;
- gameplay runtime resolution that is not yet implemented;
- importer workflow behavior beyond current package scaffolding;
- UI or end-to-end product flows.

## 2. What Was Tested

### Shared

Tested:

- format-profile interpretation helpers;
- section presence by format;
- required section derivation;
- duplicate-counting scope derivation;
- trigger-limit lookup;
- gameplay marker access.

### Catalog

Tested:

- grouping of multiple printings under one canonical card identity;
- separation of printing identity from canonical card identity;
- printing-to-card relationship checks that do not depend on product or printing artifacts.

### Decks

Tested:

- deck snapshot section lookup;
- per-section card counting;
- canonical-card copy counting across selected deck sections.

### Legality

Tested:

- distinction between card restrictions and choice restrictions;
- mapping of banned, limited, semi-limited, and maximum-copies restrictions to explicit copy ceilings;
- malformed maximum-copies restriction detection.

### Rules / Gameplay

Tested:

- gameplay-facing format projection helpers;
- section availability by format projection;
- runtime zone enablement by format projection;
- marker-based format distinction between Standard, V Premium, and Premium.

## 3. What Invariants Are Now Protected

The following invariants now have executable protection:

- Standard, V Premium, and Premium do not collapse into one generic format behavior.
- Ride deck and G deck remain format-dependent concepts.
- Duplicate counting is canonical-card-based, not printing-based.
- Multiple printings of one card preserve one canonical card identity.
- Deck snapshot sections remain explicit and distinct instead of being flattened.
- Choice restrictions remain a distinct legality rule family, not a disguised card copy limit.
- Maximum-copies restrictions require an explicit limit.
- Gameplay-facing format input remains projection-based and format-distinct.

## 4. What Is Still Intentionally Untested

The following areas are still intentionally not covered by this checkpoint:

- concrete official format-profile instances as published runtime data;
- importer normalization workflow and ambiguity-resolution behavior;
- legality engine behavior across full deck validation scenarios;
- gameplay action validation, event resolution, timing windows, replacement effects, and priority behavior;
- projection mappers from canonical catalog or canonical format profile into gameplay-ready runtime input;
- web-layer composition, React integration, and end-to-end product flows.

These remain out of scope because the relevant runtime implementation layers do not exist yet or are not mature enough to test meaningfully.

## 5. Risks Still Not Covered

Remaining uncovered risks:

- importer mistakes around errata or ambiguous canonical-card grouping still depend on future normalization implementation and review discipline;
- Premium-specific legality and gameplay edge cases still need real implementation tests once concrete profile instances and G-deck qualification logic are wired;
- gameplay abstraction is now modeled clearly, but its deeper runtime semantics are still not exercised by executable engine tests because no engine exists yet.

## 6. Verdict

Verdict:

- GO

Reason:

- The current checkpoint scope is successful.
- The domain foundation now has a real executable guardrail layer around the most important current invariants.
- The remaining untested areas are real, but they belong to later implementation phases rather than to the current domain-foundation checkpoint.
