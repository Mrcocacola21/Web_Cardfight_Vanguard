# Review Checkpoint: Playable Prototype

## 1. Executive Summary

Verdict: GO WITH CONDITIONS.

Phase 19 now has a real bounded playable local match loop. It is not a full Cardfight!! Vanguard client, but it is more than isolated engine widgets: a deterministic local room can be opened, rendered, advanced through setup and mulligan choice resolution, updated through board actions, and explained through the event log.

The core architecture still holds. `rules-core` remains the gameplay source of truth, `@web-vg/match-session` is the session boundary, and React renders projections plus submits commands. The main conditions before richer prototype or realtime work are to move from prototype candidate actions toward a stronger engine/room availability surface, make room event history recoverable outside component-local state, and reduce local-only bootstrap assumptions.

## 2. Scope Reviewed

Reviewed Phase 19 layers:

- 19.1 match room model in `@web-vg/match-session`
- 19.2 live match screen
- 19.3 zone rendering foundation
- 19.4 all main zone rendering
- 19.5 available actions layer
- 19.6 event log
- 19.7 local gameplay prototype

Reviewed supporting posture:

- room and UI integration tests
- zone projection tests
- available action tests
- event log tests
- local prototype flow tests
- Phase 19 documentation

## 3. Playable Loop Review

The current loop is real, bounded, and manually playable:

1. Create/open a local room.
2. Render session, players, zones, pending state, actions, and log.
3. Ready both players.
4. Start the match.
5. Begin mulligan.
6. Resolve the pending request by keeping hand or returning the first hand card and drawing a replacement.
7. Advance phase.
8. Ride from ride deck.
9. Call from hand to rear-guard.
10. Concede to complete the room.

This loop exercises room lifecycle, participant-bound player actions, system actions, choice response flow, zone movement, event emission, board rerender, blocked actions, invalid/unavailable action previews, and closed-room no-action behavior.

It is still a prototype loop. It does not yet cover full turn structure, all battle flows, full effect UX, complete action selection, or real deck/game completion.

## 4. Match Room Review

The match room is load-bearing rather than decorative.

Strengths:

- Room identity, format, adapter identity, lifecycle, participants, revisions, and metadata are explicit.
- `GameState` remains hosted engine truth instead of being dissolved into room metadata.
- Participant ids, optional user ids, and engine player ids are distinct.
- Commands validate participant-to-player binding before dispatch.
- Accepted engine results return a new room; invalid/blocked results preserve current room state.
- Match history semantics are kept out of the live room shape.

Limitations:

- No persistence/recovery repository exists yet.
- Event history is not room-owned yet.
- Local prototype uses deterministic in-memory room creation only.

## 5. Match UI Review

The match UI is usable as a prototype session surface. It shows room status, revisions, active player, player summaries, board, pending request, last result, event log, and available actions.

Valid, invalid, blocked, pending, and closed states are visible. The UI submits via `submitMatchRoomCommand` and updates from accepted returned room state.

The screen still has prototype roughness: it is dense, labels are developer-oriented in places, and it is behind the protected app shell. That is acceptable for Phase 19, but product usability will need later refinement.

## 6. Zone Rendering Review

Zone rendering supports play understanding at the current scope.

Strengths:

- Current player and opponent sides are visually separated.
- Major engine-backed zones are represented: hand, vanguard, rear-guard, deck, ride deck, G deck, damage, soul, drop, bind, plus generic other zones.
- Battlefield, hand, library, resource, and discard zones use different visual treatments.
- Slotted rear-guard zones show occupied and empty slots.
- Piece identity is visibility-aware.
- Rest/stand and flags are projected from engine piece state.

Limitations:

- Hidden-information policy is still a prototype presentation policy, not a full security model.
- Card labels are ids, not player-facing card names/art.
- Layout is good enough for manual play but not final board UX.

## 7. Available Actions Review

The available-actions layer is the main bridge from engine to usability and is working for the bounded loop.

Strengths:

- Candidate commands are dry-run through `submitMatchRoomCommand`; React does not independently decide legality.
- Accepted probes become available actions, blocked probes become blocked actions, invalid probes become unavailable actions.
- Pending mulligan requests become first-class decision actions.
- Submitted actions reuse the same room boundary as probes.

Limitations:

- The candidate list is still prototype-authored. It is not a complete engine-owned enumeration of every legal action.
- Some action construction uses deterministic local fixture assumptions, such as first ride-deck card or first hand card.
- Future richer UX will need target/context selection instead of only fixed representative commands.

## 8. Event Log Review

The event log is part of playability, not just decoration.

Strengths:

- It appends only accepted engine-emitted events.
- Ordering preserves accepted command order and per-transition event sequence.
- Entries include readable summaries plus event ids, transition ids, room revision, engine revision, category, source, and details.
- It makes mulligan, draw, ride, call, phase, match start, and match end consequences understandable.

Limitations:

- Event records are component-local in the current local prototype.
- There is no persisted or room-owned event stream for reload/reconnect/replay yet.
- Formatting is intentionally representative, not final prose for every future event.

## 9. Local Prototype Review

The local prototype is reproducible and useful as a developer harness.

Strengths:

- `/matches/play/local` provides a stable single-session entrypoint.
- Bootstrap creates deterministic participants, player bindings, zones, pieces, and initial state.
- The flow can progress through setup, request, board action, log, and completion.
- Pending requests can be resolved from UI.
- Board/actions/log update coherently from accepted room results.

Awkward points:

- The route is inside the protected app shell, so unauthenticated HTTP access redirects to `/login`.
- The fixture is intentionally tiny and does not represent complete real decks.
- Some commands are local prototype conveniences over engine primitives, not final game UX.

## 10. Engine/UI Boundary Review

The boundary still holds under real play pressure.

Positive signals:

- UI/projection code does not call reducer internals directly.
- State mutation happens through returned room values from `submitMatchRoomCommand`.
- Zones are deterministic projections of `GameState`.
- Available actions rely on room/engine probe results.
- Event log derives from accepted engine events.

Main risk:

- Prototype candidate action construction can become shadow orchestration if it grows without a more formal room/engine action availability contract.

## 11. Test Coverage Review

Test posture is strong for a Phase 19 prototype.

Covered:

- match room creation, initialization, lifecycle, participant/player binding, command routing, historical-model separation
- route entrypoints
- match screen rendering and result states
- zone projection and board rendering
- available action projection, blocked/unavailable states, pending request actions
- event log formatting and ordering
- local gameplay flow across setup, request resolution, board actions, and log updates
- guard tests that prevent UI/prototype layers from importing reducer internals

Verification status during checkpoint:

- Focused match UI/prototype tests pass.
- Route tests pass.
- Web lint passes.
- Web typecheck still fails in unrelated collection inventory test fixtures that predate Phase 19.

Remaining gap:

- No browser E2E suite yet for the full local flow.
- No persistence/recovery/reload event-log tests because those capabilities are intentionally deferred.

## 12. Documentation Review

Documentation posture is good and honest.

Docs reviewed:

- match room model foundation
- basic match UI foundation
- match zone rendering foundation
- all main zones rendering foundation
- available actions UI foundation
- match event log foundation
- local gameplay prototype

The docs clearly separate room, engine, UI, log, zone projection, and match history concerns. They also state current limits rather than claiming full game completion.

One small documentation issue was fixed in this checkpoint: the local gameplay prototype heading now uses ASCII quotes around `"playable"`.

## 13. Top Findings

### Finding 1

Severity: Medium

Issue: Available actions are still based on a curated prototype candidate list, then validated by the room/engine.

Why it matters: This avoids UI-side legality, but it is not yet a complete source of all legal actions. As mechanics expand, missing candidates could make legal gameplay invisible.

Recommendation: Introduce a formal engine/room availability contract or action-intent provider before expanding beyond representative local commands.

### Finding 2

Severity: Medium

Issue: Event log records are component-local in the local prototype.

Why it matters: Current play is coherent, but reload, reconnect, replay, and authoritative multiplayer need room/session-level event history or an append-only event stream.

Recommendation: Move event accumulation closer to the room/session application boundary before realtime or recovery work.

### Finding 3

Severity: Medium

Issue: The local route is protected and redirects unauthenticated requests to `/login`.

Why it matters: This is consistent with the app shell, but it adds friction for a developer trying to launch the proof quickly.

Recommendation: Decide whether local prototype should remain protected or gain an explicit dev-only unprotected harness route.

### Finding 4

Severity: Low

Issue: Board and event labels expose fixture ids rather than polished card/player-facing labels.

Why it matters: It is acceptable for a developer prototype, but player comprehension will suffer as the loop becomes richer.

Recommendation: Add card catalog/name projection when moving from proof-of-playability to product-facing prototype.

### Finding 5

Severity: Low

Issue: Full web typecheck is blocked by unrelated collection inventory test fixtures.

Why it matters: It does not invalidate Phase 19 behavior, but it reduces confidence in repo-wide validation.

Recommendation: Fix the collection fixture type drift separately so future gameplay changes can rely on clean typecheck.

## 14. Fixes Applied

- Fixed the `docs/rules/local-gameplay-prototype.md` heading to use ASCII quotes around `"playable"`.
- Added this checkpoint document.

No runtime redesign or new gameplay feature was introduced during the checkpoint.

## 15. Final Verdict

Verdict: GO WITH CONDITIONS.

The first playable loop exists. It is bounded and local, but it is real: room, engine, UI, zones, actions, pending requests, event log, and local bootstrap operate as one session surface.

The prototype can safely move beyond Phase 19 foundation work, provided the next growth steps treat the current loop as a proof to harden, not as final production architecture. The highest-priority conditions are a stronger action availability contract, room/session-level event history for future sync/recovery, and cleanup of unrelated typecheck failures.
