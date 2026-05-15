# Core Vanguard Resources And Defense

## 1. Purpose

This step makes Counter Blast, Counter Charge, Soul Blast, Soul Charge, and
Intercept part of engine-owned gameplay truth. These mechanics now operate on
canonical match state and can be used by effect execution instead of being
approximated outside the reducer/effect model.

## 2. Why damage and soul must become real resources

Damage and soul are not only display zones. Damage cards are also the Counter
Blast/Counter Charge surface, and soul cards are consumed or gained by many
card effects. Without resource semantics, future costed effects cannot be
validated or resolved honestly.

## 3. Face-up / face-down damage semantics

Damage count remains derived from the damage zone occupants.

Counter resource state is represented on runtime piece state:

- a damage card without `damage.face_down` is face-up;
- a damage card with `damage.face_down` is face-down.

Damage checks put cards into damage face-up by default. Moving a damage card out
of the damage zone clears runtime state through the existing transfer lifecycle.
Turn cleanup preserves `damage.face_down`; it is not a turn-scoped modifier.

## 4. Counter Blast / Counter Charge

Counter Blast N selects the first N face-up cards in the player's damage zone
under the current deterministic baseline and marks them face-down.

Counter Charge N selects the first N face-down cards in the player's damage zone
and marks them face-up.

If the required number of cards is not available, effect resolution fails with a
structured invalid result. No partial payment is applied.

## 5. Soul Blast / Soul Charge

Soul Blast N selects the first N cards in the player's soul and moves them to
drop.

Soul Charge N moves the top N cards of the player's deck into soul.

Both operations emit normal `piece.moved` facts plus resource summary events. If
the source zone cannot provide N cards, the operation fails predictably.

## 6. Intercept semantics

Intercept is integrated into the guard flow. A defending rear-guard is eligible
to intercept when it is:

- controlled by the defending player;
- on a rear-guard circle treated as front row by the current bounded board
  model;
- not locked;
- a grade 2 unit, or explicitly carries the `intercept` keyword.

When selected in a guard response, the interceptor moves from rear-guard to the
guardian circle with transfer reason `intercept`. Its shield is included by the
existing combat shield calculation through `battle.guardPieceIds`.

## 7. Relationship to effect system

CB/CC/SB/SC are declarative effect operations:

- `counter_blast`
- `counter_charge`
- `soul_blast`
- `soul_charge`

The operation role distinguishes costs (`counter_blast`, `soul_blast`) from
resource-gain effects (`counter_charge`, `soul_charge`). Event-triggered
resolution can execute these operations from effect definitions, so future
costed effects can build on the same path instead of mutating zones directly.

## 8. What is intentionally NOT implemented yet

This step does not implement a full cost solver, manual resource selection
requests, every format-specific intercept exception, complete board row
semantics, or a UI overhaul for choosing costs. Selection is deterministic-first
for now so the engine path is stable and testable.

## 9. Summary

Damage now has face-up/face-down resource state, soul is spendable and
chargeable, and Intercept is a real guard source. The foundation is bounded, but
it is integrated with effect execution and battle resolution, which makes future
costed effects and stronger defense mechanics realistic.
