# Common Format Hooks Foundation

## 1. Purpose

This step extracts the first reusable gameplay hooks from the format adapter
layer.

The goal is to reduce real duplication between Standard, V Premium, and
Premium without collapsing their distinct format semantics back into the core
reducer.

## 2. Why Common Hooks Are Needed

After three adapters, the repeated patterns were no longer hypothetical:

- repeated zone-kind guard logic
- repeated overlay-style transition preparation for format-owned
  ride-like/stride-like actions
- repeated adapter-side use of the same revision / player / piece / relocation
  plumbing

Leaving that duplication in place would make later mechanics growth drift into
copy-pasted adapter logic.

## 3. What Was Duplicated Before

The duplicated structure was mainly:

- reject actions that reference reserved or unsupported zone kinds
- reject destination zones for adapter-owned zones such as imaginary gift
- prepare a player-owned piece commit that overlays the current vanguard and
  relocates the displaced piece elsewhere before the new piece resolves

The important point is that the duplication was structural, while the policies
stayed format-specific.

## 4. Which Hooks Were Extracted

The shared adapter hook layer now includes:

- `rejectZoneKindReferences(...)`
- `rejectDestinationZoneKinds(...)`
- `prepareFormatOverlayCardAction(...)`
- `findZoneById(...)`

These are gameplay-domain hooks for adapter composition, not UI hooks.

## 5. Where the Hooks Live

The hooks live in:

- `packages/rules-core/src/formats/shared/hooks.ts`

They stay inside the format-extension layer instead of being promoted to the
root package surface.

## 6. How Adapters Now Compose Through Them

- Standard uses shared zone-kind guards for ride-deck access while delegating
  the ride mechanic itself to the core reducer.
- V Premium uses the same guard hooks for ride-deck rejection and imaginary
  gift destination rejection, while layering its gift continuation over the
  core ride transition.
- Premium uses the same guard hooks for ride-deck and reserved-zone rejection,
  plus the same overlay preparation for its stride-like `card.play` flow.

The adapters still own their own metadata, policy decisions, event shapes, and
post-transition state differences.

## 7. What Remains Format-Specific

Still format-owned:

- which zone kinds are reserved or rejected
- which action types are supported
- whether the format delegates to a core mechanic or owns a custom overlay
  transition
- whether the overlay source is ride deck, hand, or G zone
- whether the displaced piece goes to soul or heart
- whether a follow-up request is created, such as the V Premium gift request
- which terminal event is emitted (`card.rode` vs `card.played`)

## 8. What Is Intentionally NOT Generalized Yet

Not extracted yet:

- imaginary gift request generation
- event-array construction for every overlay transition
- full turn/phase gating policy
- format capability registry or plugin framework
- future effects/mechanics abstractions that are not duplicated yet

This keeps the shared layer grounded in proven repetition instead of
speculative architecture.

## 9. Summary

`rules-core` now has a small but real shared hook layer for format adapters.

The extracted hooks reduce duplication across all three adapters while keeping
format-specific behavior explicit and local to each adapter. This gives later
mechanics and effect work a cleaner extension base without turning the core
engine into a hidden format rules warehouse.
