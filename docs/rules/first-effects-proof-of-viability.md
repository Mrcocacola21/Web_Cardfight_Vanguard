# First Effects Proof of Viability

## 1. Purpose

Phase 18.4 turns the effect architecture from definitions into bounded runtime behavior. The goal is not a complete effect engine yet; it is to prove that registered effects can be found through engine-owned semantics, resolve through current timing/event seams, and produce observable state or event consequences.

## 2. Why These Effects Were Chosen First

The first working effects are intentionally small and representative:

- `Twin Drive` changes the number of drive checks before the existing drive-check transition draws cards.
- `Persona Ride` reacts after a ride event, validates a richer domain condition, then draws a card and marks affected units with a power flag.

Together they exercise keyword-to-effect lookup, registry lookup, event/timing matching, declarative operations, a hybrid typed condition, zone movement, generated events, and runtime piece flags without requiring a full stack or priority system.

## 3. Which Effects Are Implemented

- `effect:keyword:twin-drive.check-count`
  - Keyword-scoped continuous effect.
  - Applies before `battle.drive_check`.
  - Adds one drive check for the source attacking unit.

- `effect:keyword:persona-ride.on-ride`
  - Standard-scoped triggered effect.
  - Applies after `card.rode`.
  - Requires the new vanguard to ride over a unit with the same card definition.
  - Draws one card for the source controller and marks that controller's current vanguard/rear-guards with a persona ride power flag.

## 4. How They Are Registered

Both effects are normal `EffectDefinition` entries in the core effect registry. They keep stable effect identity, timing metadata, applicability metadata, and hybrid/declarative resolution metadata.

Cards do not trigger these effects by bespoke card branches. A piece carries stable keyword references, the keyword mechanics layer maps those references to effect ids, and the effect registry returns the effect definitions used by the transition integration seam.

## 5. How They Are Triggered

The current baseline has two explicit engine integration points:

- Drive check transition:
  - Reads the attacker piece keywords.
  - Resolves matching keyword mechanics through the registry.
  - Applies `adjust_check_count` operations before moving cards from deck to hand.
  - Emits `effect.resolved` before the check events.

- Ride transition:
  - Emits the normal `card.rode` event.
  - The event-triggered resolver finds post-ride keyword effects for the rode piece.
  - Matches the registered effect against `card.rode` and the `card.ride` after window.
  - Schedules the effect through the formal resolution queue.
  - Applies the bounded Persona Ride behavior and emits `effect.resolved`.

## 6. Which Parts Are Typed vs Declarative

`Twin Drive` is declarative: its behavior is a regular `adjust_check_count` operation with no bespoke branching beyond timing and keyword applicability.

`Persona Ride` is hybrid: the condition "rode over a card with the same definition in Standard" is typed domain logic, while the consequences are declarative operations (`draw_cards` and `apply_power_modifier`).

## 7. Observable Engine Consequences

The implemented effects are observable through normal engine output:

- Twin Drive changes a `system.drive_check` action with `count: 1` into two moved cards and two revealed check cards.
- Persona Ride moves one card from deck to hand using effect-driven draw movement.
- Persona Ride emits a `cards.drawn` event for the source controller.
- Persona Ride adds a runtime flag representing `+10000 until end of turn` to the controller's current vanguard/rear-guards.
- The emitted `cards.drawn` event now schedules the core draw finalizer through the queue model.
- Both effects emit `effect.resolved` events with the resolved effect id and operation kinds.

## 8. What Is Intentionally NOT Implemented Yet

- No full priority/stack model.
- No unbounded recursive trigger discovery.
- No simultaneous effect ordering policy.
- No full power calculator; Persona Ride power is represented as a runtime flag.
- No complete keyword encyclopedia.
- No card-text parser.
- No UI, DB, importer, or browser dependency in the effect path.
- No general-purpose interpreter for every future declarative operation.

The front-row target is currently represented by the existing board zone model as the controller-owned vanguard and rear-guard circles. More precise board-position semantics can be layered later without changing the effect identity or registry contract.

## 9. Summary

The first effects prove that the Phase 18 architecture is executable: content-facing keywords can route to registered effects, effects can match timing/events, and bounded resolution can change state and emit events. Later Phase 18 steps route Persona Ride through event-triggered resolution and the formal queue model without redesigning the registry, keyword layer, or hybrid contract.
