# Premium Format Adapter Foundation

## 1. Purpose

This step introduces the Premium format adapter on top of
`@web-vg/rules-core`.

The goal is to prove that even the most demanding format in the current
roadmap can still live as an adapter layer instead of forcing Premium-first
branching into the core state, reducer, or engine/UI boundary.

## 2. Why Premium Is the Hardest Adapter

Premium carries the broadest structural surface of the three formats:

- mixed-era card pool expectations
- G zone and stride-era runtime structure
- imaginary gift compatibility
- more Premium-only structural assumptions than Standard or V Premium

That makes it the right stress test for the adapter architecture.

## 3. Relationship to Standard and V Premium Adapters

Premium uses the same adapter family pattern as the first two formats:

- `formatId`
- `constructionBasis`
- `gameplayMarkers`
- `supportedActionTypes`
- `dispatch(currentState, command)`

What changes is not the extension model, but the format-owned behavior layered
through it.

## 4. Adapter Contract Reused / Extended

No new adapter architecture was introduced for Premium.

The existing shared contract was sufficient:

- pre-dispatch command evaluation for format gates
- format-owned transition handling for a bounded action subset
- delegation back to the generic engine boundary for unchanged behavior

This keeps all three adapters as siblings over one rules extension model.

## 5. Which Premium-Specific Semantics Are Implemented Now

This foundation step implements a small but meaningful Premium subset:

- `PREMIUM_FORMAT_ID`
- `constructionBasis: 'clan-based'`
- `gameplayMarkers` with `g-zone`, `stride`, `imaginary-gift`,
  `over-trigger`
- rejection of ride deck references as a baseline runtime surface
- rejection of generic movement into Premium-reserved structural zones such as
  `g_zone` and `heart`
- Premium-owned `card.play` interpretation as a stride-like G-zone play
  foundation
  - current vanguard moves into `heart`
  - G unit moves from `g_zone` to `vanguard_circle`
  - `piece.moved` and `card.played` facts are emitted

This is intentionally not a full stride implementation. It is a Premium-only
transition slice that proves the adapter can own more demanding structure than
the first two formats.

## 6. How It Composes With `rules-core`

The adapter lives in `packages/rules-core/src/formats/premium`.

It composes with the core through:

- the shared `EngineCommand` / `EngineDispatchResult` boundary
- the shared format adapter contract
- common format helpers for revision checks, action preparation, event ids,
  and owned-zone lookup
- the generic zone relocation primitive for invariant-safe movement

Unchanged commands still delegate to the common engine boundary. Only
Premium-owned branches stay inside the adapter.

## 7. What Is Intentionally NOT Implemented Yet

Still out of scope:

- full Premium legality
- full stride sequence and turn legality
- G guard
- face-up / face-down G zone state semantics
- Premium ride flow and gift mechanics as a complete subsystem
- card-specific effect handling
- full mixed-era mechanic resolution

## 8. How This Prepares Common Hooks and Later Mechanics

After three adapters, commonality is now visible instead of hypothetical:

- shared revision / action preparation helpers are already real
- Standard and V Premium both show ride-related format ownership
- Premium shows G-zone / reserved-structure ownership

That makes the next common-hooks step natural: extract only the duplication
that is now proven across real adapters, without collapsing format boundaries
back into the core.

## 9. Summary

`rules-core` now supports Standard, V Premium, and Premium through the same
adapter architecture.

Premium does not replace the core engine and does not special-case the reducer.
Its heavier format semantics remain in a dedicated adapter layer, which keeps
the base rules foundation clean while proving the pattern can absorb the most
complex format in the current scope.
