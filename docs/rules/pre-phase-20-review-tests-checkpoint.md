# Pre-Phase 20 Review and Tests Checkpoint

Step 0.12 - Pre-Phase 20 review + tests checkpoint

Current status note: this document remains a historical pre-Phase-20
checkpoint. Later Phase 20 entry work has closed several conditions named here:
DB-backed persisted session storage, authenticated server-route transport,
persisted projected `/matches/play/[roomId]`, and a live `test:db` checkpoint
now exist. The remaining Phase 20 work is realtime fanout,
reconnect/recovery, optimistic reconciliation, production multiplayer UX, and
broader scaling hardening.

Checkpoint question:

> Before realtime, does a match already behave like a real game, or is it still only a state machine demo?

## 1. Executive Summary

Verdict: **GO WITH CONDITIONS**.

The current match foundation is now a real local gameplay loop over engine and session truth. It is no longer only a UI-driven state machine demo:

- gameplay starts from validated deck snapshots and gameplay card definitions;
- `rules-core` owns combat, battle sequencing, triggers, turn flow, damage defeat, requests, and state transitions;
- `match-session` owns room lifecycle, participant-to-player identity binding, command source validation, projection, and serialization;
- player-visible projection masks private zones and hidden request/event payloads;
- action availability in the local UI is a dry-run projection through the room boundary, not a duplicate legality engine;
- focused tests pass for rules, session, and local gameplay UI surfaces.

The conditions before realtime are about transport and authority, not basic game semantics. Phase 20 should not send canonical `GameState` to clients, should not let clients submit system actions directly, and should treat the current local action palette as a prototype command builder rather than the final realtime action contract.

## 2. Scope Reviewed

Reviewed gameplay fidelity:

- combat math, boost, guard, intercept, drive check, damage check, battle completion, and damage defeat;
- trigger reveal/resolution for critical, draw, front, heal, stand, and over trigger foundations;
- turn phase order, automatic stand/draw consequences, phase legality, and turn switch cleanup;
- real deck-to-match bootstrap from deck snapshots and gameplay card stats.

Reviewed session truth:

- match room lifecycle and engine-state ownership;
- participant identity binding to engine players;
- room command source validation;
- engine adapter boundary;
- room status derivation from engine state.

Reviewed hidden-info posture:

- rules-core player projection;
- match-session participant projection;
- masked hands/decks/private zones;
- responder-only request redaction;
- event redaction for shuffle, draw, mulligan, and revealed check facts.

Reviewed serialization readiness:

- versioned snapshot-plus-history document;
- plain JSON roundtrip;
- restore validation;
- active pending request restore;
- completed-room restore;
- invalid/blocked command attempts excluded from durable history.

Reviewed action availability contract:

- local available-actions projection;
- dry-run legality through `submitMatchRoomCommand`;
- accepted/blocked/invalid availability states;
- pending-request mode;
- closed-room no-action state.

## 3. Gameplay Fidelity Review

Status: **real bounded game loop**.

The engine now has enough Vanguard semantics to count as gameplay:

- attack declaration creates battle state and rests the attacker;
- boost is column-aware and rests the booster;
- guard opens a defender-owned request and resolves through choice response;
- intercept is represented as a guard source and contributes shield;
- combat math compares attacker/base/boost power against defender/shield power;
- vanguard attacks require drive check before combat comparison;
- hit damage moves cards into damage and evaluates the 6-damage defeat threshold;
- missed attacks complete without damage check;
- battle aftermath clears battle state and moves guardians to drop;
- triggers are resolved as event-triggered effects and update runtime modifiers or draw/heal/stand consequences;
- turn flow enforces phase order and wrong-phase rejection.

This is still bounded. It does not yet model every Vanguard rule, every card-specific effect, full priority windows, complete target-selection UX, deck-out loss, or all format-specific battle exceptions. That is acceptable before realtime as long as Phase 20 treats the server/session as authoritative over the implemented subset.

## 4. Session Truth Review

Status: **session truth is correctly separated from UI and match history**.

`MatchRoom` is the live aggregate. It owns lifecycle status, participants, engine adapter id, room revision, metadata, and canonical `engineState` after initialization. The UI does not own gameplay truth; it submits commands through `submitMatchRoomCommand`.

Positive signals:

- rooms cannot accept gameplay commands before initialization;
- closed rooms reject further commands;
- participant commands must come from the participant bound to the engine player;
- system actions must come from a system source;
- accepted engine results are the only path that advances room state;
- room status follows engine completion instead of recalculating win conditions in session code.

Realtime condition: Phase 20 must preserve this boundary. Client sockets should identify participants and submit player commands or choice responses. Server runtime should be the only source allowed to submit system actions such as start, phase advance, checks, combat resolution, and mandatory flow.

## 5. Hidden-Info Posture Review

Status: **safe foundation with one Phase 20 policy condition**.

The player projection does not expose canonical `engineState`. Hidden occupants use masked references, and visible card stats are filtered to visible card definitions. Own deck contents are masked even to the owner. Opponent hand contents and responder-only requests are redacted.

Event projection redacts known hidden payloads:

- shuffle exposes count, not deck order;
- draw and mulligan expose private piece refs only to the owning player;
- revealed checks and trigger reveals are public aftermath facts.

Condition: event projection must stay fail-closed as new event types are added. The current default exposes only public metadata and no raw event payload, which is acceptable now, but Phase 20 should require every new event carrying piece ids, ordered lists, request data, or private selections to add explicit projection tests.

## 6. Serialization Readiness Review

Status: **ready as reconnect foundation, not full event sourcing**.

The persistence foundation stores canonical room snapshot plus ordered history. It restores active rooms with pending requests, completed rooms with terminal engine state, and rejects unsupported versions or out-of-order history.

This is enough for Phase 20 reconnect-style inspection and server-side recovery from a latest snapshot. It is not yet a full replay engine:

- history records accepted engine events, but restore uses latest snapshot as truth;
- invalid and blocked attempts are intentionally not durable audit records;
- lifecycle history is available but not automatically synthesized for every status transition;
- migrations are version-gated but only version 1 exists.

Condition: realtime persistence should persist authoritative snapshots and accepted events together. Do not persist player projections as truth.

## 7. Action Availability Contract Review

Status: **good local contract; not yet final realtime protocol**.

The available-actions panel is correctly thin over engine truth. It forms representative commands, dry-runs them through `submitMatchRoomCommand`, and classifies the result:

- accepted -> available;
- blocked -> blocked with request ids;
- invalid -> unavailable with structured code/message.

This prevents the UI from becoming a second rules engine. It also proves the match is usable as a command-driven game loop.

Condition: the current implementation is intentionally local/prototype-scoped. Phase 20 should move from hardcoded local command builders to a server-issued action/request contract or server-validated command construction. In particular, the realtime client should not infer authority from the local `available-actions` candidate list.

## 8. Tests Checkpoint

Focused commands run:

```text
corepack pnpm --filter @web-vg/rules-core run test
corepack pnpm --filter @web-vg/match-session run test
corepack pnpm --filter @web-vg/web exec vitest run --config vitest.config.mjs src/features/matches/play src/components/matches/basic-match-room-view.test.tsx src/components/matches/local-gameplay-prototype-flow.test.tsx src/components/matches/match-board.test.tsx src/components/matches/event-log-panel.test.tsx
corepack pnpm --filter @web-vg/rules-core run typecheck
corepack pnpm --filter @web-vg/match-session run typecheck
```

Observed result:

- `@web-vg/rules-core`: 35 test files, 210 tests passed.
- `@web-vg/match-session`: 5 test files, 24 tests passed.
- focused web gameplay tests: 8 test files, 28 tests passed.
- `rules-core` typecheck passed.
- `match-session` typecheck passed.

Coverage confirmed for:

- combat: attack, boost, guard, intercept, combat comparison, battle aftermath;
- triggers: trigger reveal/resolution, runtime modifiers, draw/heal/stand/over behavior;
- turn flow: phase order, automatic stand/draw, wrong-phase rejection, turn switch cleanup;
- bootstrap: validated deck snapshot to deterministic engine state;
- projection: hidden state masking, request/event redaction, participant projection;
- persistence foundation: snapshot/history creation, JSON roundtrip, restore, completed state, invalid history rejection.

## 9. Remaining Risks Before Phase 20

Risk 1: realtime command authority.

Phase 20 must prevent clients from submitting system commands directly. The current local session uses system commands for developer playability; realtime needs server-side automation and participant-scoped player commands.

Risk 2: final action availability protocol.

Local action availability proves the contract shape but not the final protocol. Realtime needs stable command ids, server validation, and request-specific response schemas.

Risk 3: event projection for future event types.

Known sensitive event types are projected safely. Future events with hidden payloads need explicit redaction tests before client delivery.

Risk 4: persistence is snapshot-plus-history, not replay truth.

This is an intentional baseline. If Phase 20 needs full deterministic replay from event history, that is a separate implementation step.

Risk 5: bounded rules coverage.

The current game loop is real, but it is not a full Vanguard simulator. Missing rules should be exposed as unsupported action/effect scope, not silently handled by UI assumptions.

## 10. Final Verdict

Verdict: **GO WITH CONDITIONS**.

The match now clears the pre-realtime bar for a real bounded game: deck-backed bootstrap, engine-owned gameplay, room-owned session truth, hidden-info projection, serialization foundation, and availability derived from command results.

Phase 20 can start if it preserves the current truth boundaries:

1. server/session owns canonical room and engine state;
2. clients receive only participant projections;
3. participant identity gates player commands and choice responses;
4. system commands stay server/runtime-owned;
5. persistence stores canonical snapshots plus accepted history;
6. new event/request/action surfaces get projection and availability tests before client exposure.
