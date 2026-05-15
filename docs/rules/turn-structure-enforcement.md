# Turn Structure Enforcement

## 1. Purpose

This step makes the Vanguard turn lifecycle engine-owned. The reducer now
controls phase order, turn switching, phase legality, and the bounded automatic
consequences that happen when a turn starts or advances.

## 2. Why match flow needed engine-owned turn discipline

Before this step, several phase actions existed as contracts, but the playable
flow still relied on callers sending actions in the intended order. That is not
safe for authoritative play, replay, or future realtime sessions. The engine
must reject actions that are out of phase and must be the source of truth for
which player is taking the current turn.

## 3. Turn lifecycle

The current bounded lifecycle is:

`stand -> draw -> ride -> main -> battle -> end`

`pregame` remains a setup phase that can advance into `stand`. Later format
adapters may refine details inside a phase, but this lifecycle is the current
core baseline.

## 4. Phase progression rules

Phase progression is linear and testable:

`pregame -> stand -> draw -> ride -> main -> battle -> end`

`system.advance_phase` and `turn.end_phase` may only advance to the exact next
phase. Skipping phases or advancing past `end` is rejected. `end` transitions to
the next player through turn switch semantics instead of another phase advance.

## 5. Turn switch semantics

`turn.end_turn` is valid only for the current turn player and only from the
`end` phase. The same turn switch can also be driven by
`system.resolve_mandatory_flow` with `scope: "turn"` from the `end` phase.

On turn switch, the engine:

- emits `turn.ended`;
- selects the next non-defeated player by seat order;
- increments the turn number;
- sets the next active player and priority player;
- starts the next turn in `stand`;
- emits `turn.started`.

## 6. Automatic turn-start / turn-end consequences

Entering `stand` automatically stands the active player's main-circle units
that are rested and not locked.

Entering `draw` automatically draws one card from the active player's deck to
hand when those zones exist and the deck is not empty.

Ending a turn clears turn-scoped piece modifiers currently represented by
`powerModifier` and `criticalModifier`. Locked state is preserved because it is
not a generic turn-scoped modifier under the current foundation.

## 7. Phase-based action legality

The reducer now enforces the core phase gates:

- `card.ride` requires `ride`;
- `card.call` and `card.play` require `main`;
- attack, boost, guard, drive check, combat resolution, and damage check require
  `battle`;
- battle mandatory flow requires `battle`;
- turn mandatory flow requires `end`.

Turn-owned player actions require the actor to be the current turn player.
Guard is intentionally not current-turn-player gated because it belongs to the
defending player during battle.

## 8. Relationship to requests and terminal state

Existing pending-request blocking remains authoritative: phase progression and
turn switch do not proceed while a request is unresolved.

Terminal game states reject further lifecycle progression. A completed match
cannot advance phases or switch turns.

## 9. What is intentionally NOT implemented yet

This step does not implement a full future timing scheduler, priority system
rewrite, format-specific turn variations, deck-out loss during draw, or every
phase-specific Vanguard edge case. It also does not move phase policy into the
UI or session layer.

## 10. Summary

The match now has a reducer-owned turn discipline. Phase order, current turn
player, automatic stand/draw consequences, turn-end cleanup, and wrong-phase
rejection are part of engine truth and can be consumed by the room and UI layers
instead of being invented there.
