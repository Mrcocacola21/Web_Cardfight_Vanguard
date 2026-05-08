# Format Adapters Smoke Tests Checkpoint

## 1. Scope of This Checkpoint

This checkpoint verifies smoke-level adapter confidence only. It checks that each format adapter loads, composes with the shared adapter contract, survives representative execution paths, and preserves structured `accepted` / `invalid` / `blocked` results over the core transition foundation.

## 2. Adapters Covered

- `standard`
- `v-premium`
- `premium`

Each adapter is exercised through both generic engine delegation and one representative format-owned path.

## 3. Core Contracts Verified

- adapters dispatch through the shared `RulesFormatAdapter` contract
- generic reducer delegation still works
- structured engine dispatch results stay intact
- action / event / request integration remains coherent after adapter composition

## 4. Representative Scenarios

- Standard: `card.ride` from `ride_deck` to `vanguard_circle`
- V Premium: `card.ride` from `hand` plus gift follow-up request
- Premium: `card.play` from `g_zone` to `vanguard_circle`
- blocked path with pending request
- invalid paths for V Premium ride-deck usage and Premium occupied `heart`

## 5. Shared Hooks Verification

The checkpoint covers the shared hook layer in two ways:

- direct hook smoke coverage verifies that the same guard hook produces different outcomes under different format policies
- adapter smoke scenarios verify that shared overlay preparation still leads to distinct Standard, V Premium, and Premium behavior instead of flattening the adapters into one policy

## 6. What These Smoke Tests Prove

- all three adapters are real loadable layers, not dead exports
- adapter composition does not break the core engine contract
- representative format-owned transitions do not crash and return structured results
- common hooks are reusable without erasing format individuality

## 7. What Is Still Not Covered

- exhaustive legality matrices for any format
- full Standard / V Premium / Premium mechanics
- effect-system-driven continuation
- card-specific handlers and trigger logic
- multiplayer visibility / projection concerns

## 8. Current Risks

- adapter behavior is only smoke-verified, not rules-complete
- future mechanic growth can still regress format-specific legality if scenario coverage does not grow with it
- shared hooks are verified for current seams, but not yet for future effect-era extension points

## 9. Final Verdict

`GO WITH CONDITIONS`

Conditions:

- new format-owned mechanics should land with scenario-level adapter tests immediately
- future hook extraction should stay tied to real duplication, not speculative abstraction
- Phase 17 work should expand behavior coverage where new mechanics introduce non-trivial branching
