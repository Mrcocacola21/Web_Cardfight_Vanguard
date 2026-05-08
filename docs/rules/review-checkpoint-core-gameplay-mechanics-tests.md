# Review Checkpoint: Core Gameplay Mechanics Tests

Phase 17 - Core Gameplay Mechanics  
Step 17.8 - Tests checkpoint

## 1. Scope of This Checkpoint

This checkpoint protects the Phase 17 gameplay foundation at subsystem level,
not as isolated helper units.

The covered load-bearing scope is:

- gameplay state coherence through `GameState` invariants;
- reducer determinism for representative mechanics;
- structured `applied` / `invalid` / `blocked` results;
- card instance identity across movement-heavy transitions;
- request-aware flows for mulligan, guard, and adapter continuations;
- battle state integrity across attack, boost, guard, drive, and damage;
- state flag semantics for stand/rest/locked;
- format adapter compatibility for currently implemented Standard, V Premium,
  and Premium mechanics.

## 2. Draw / Shuffle / Mulligan Coverage

Covered:

- deterministic `zone.shuffle` from explicit ordered piece ids;
- draw top-deck consumption from deck to hand;
- no duplication/loss after draw and mulligan resolution;
- engine-owned `mulligan.select_cards` request creation;
- pending-request blocking while mulligan is unresolved;
- return-to-deck, deterministic reshuffle, redraw, request clearing, and
  mulligan completion flag;
- structural rejection of mismatched mulligan responses.

## 3. Ride / Call Coverage

Covered:

- valid ride into `vanguard_circle`;
- previous vanguard displacement to soul;
- valid call into a legal rear-guard slot;
- occupied/invalid placement rejection with unchanged state;
- hand and board occupancy updates;
- pending-request blocking;
- active-battle sequencing rejection for ride/call attempts.

## 4. Attack / Boost / Guard Coverage

Covered:

- deterministic attack declaration and battle-state creation;
- attacker rest integration through piece-state flags;
- boost commitment and duplicate boost rejection;
- already-rested booster rejection with no battle corruption;
- guard request creation by the defending player;
- guard commit response moving guardians to guardian circle;
- guard pass response clearing the request without moving guardians;
- mismatched guard responses rejected structurally;
- blocked battle actions behind pending requests.

## 5. Drive / Damage Check Coverage

Covered:

- drive check from attacking deck to hand;
- damage check from defending deck to damage;
- top-deck consumption and post-check movement;
- revealed card integrity with runtime `pieceId` and `cardDefinitionId`;
- single-location identity preservation for revealed cards;
- invalid missing/wrong battle context;
- invalid repeated or wrongly sequenced damage checks;
- blocked check actions behind pending requests.

## 6. Zone Transfer Coverage

Covered:

- representative valid transfers touching soul, drop, bind, damage, ride deck,
  and G deck;
- wrong-source rejection;
- invalid occupied destination rejection;
- blocked transfer path;
- `piece.moved` event shape and transfer reason;
- source/destination coherence and instance identity preservation.

These tests show the transfer layer is a real primitive used by mechanics, not a
decorative enum or parallel helper.

## 7. State Flags Coverage

Covered:

- sparse default state: missing piece state means standing/unflagged;
- `piece.rest` / `piece.stand`;
- `piece.lock` / `piece.unlock`;
- mutually exclusive orientation plus composable `locked` flag;
- invalid duplicate state/flag invariants;
- invalid incompatible flag transitions;
- pending-request blocking;
- attack/boost consuming standing state and resting units;
- current baseline preservation of piece-state entries across transfers.

## 8. Reducer Determinism Coverage

Covered:

- same state plus same action gives the same structured result for lifecycle,
  shuffle, zone movement, and attack scenarios;
- valid transitions produce predictable revisions, events, requests, and state;
- invalid transitions keep current state and emit no events;
- blocked transitions keep current state and expose blocking requests;
- no tested mechanic relies on hidden time, randomness, browser state, or
  mutable external state.

## 9. Request-Aware Flow Coverage

Covered:

- mulligan request creation and response continuation;
- guard request creation, guard commit response, guard pass response, and
  mismatched response rejection;
- V Premium gift continuation through shared choice-response handling;
- head-of-queue pending request behavior;
- pending requests blocking incompatible actions.

## 10. Fixture Strategy

The checkpoint uses focused scenario fixtures already colocated with their
transition tests:

- opening deck/hand fixture for draw, shuffle, mulligan;
- board-development fixture for ride/call;
- battle-ready two-player fixture for attack/boost/guard;
- check-ready battle fixture for drive/damage;
- transfer-heavy fixture covering soul/drop/bind/damage/ride deck/G deck;
- flag-sensitive board fixture for stand/rest/locked behavior;
- adapter-specific Standard, V Premium, Premium fixtures and smoke fixtures.

No giant global harness was added. The fixture shape stays close to the tested
mechanic so failures remain readable.

## 11. What Is Still Not Covered

Intentionally not covered yet:

- full effect resolution;
- full trigger resolution;
- full battle completion/hit/no-hit lifecycle;
- exhaustive per-format combat legality matrix;
- multiplayer hidden-information projections;
- full turn automation and phase policy;
- property/fuzz testing for every transfer permutation.

These are acceptable gaps before Phase 18 because the current checkpoint is
about protecting the implemented foundation, not simulating all future Vanguard
rules.

## 12. Current Risks

Remaining risks:

- state flag lifecycle across zone movement is tested as current baseline
  preservation, but the final policy still needs explicit design before effects
  depend on it;
- guard pass currently resolves without a domain event; tests document that
  behavior, but event policy should be revisited before replay/effect hooks;
- drive/damage checks still use `pending_future_engine` for trigger resolution;
- battle completion/cleanup is not implemented yet and remains a Phase 18+
  dependency.

## 13. Final Verdict

Verdict: **GO WITH CONDITIONS**.

The Phase 17 gameplay mechanics are now protected well enough to close the
phase and move toward the effect-system foundation. The conditions are to keep
the remaining semantic risks explicit in Phase 18: flag lifecycle, battle
completion, trigger/effect timing, and event policy for important choice
responses.
