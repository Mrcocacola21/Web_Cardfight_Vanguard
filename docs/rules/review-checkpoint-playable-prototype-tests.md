# Review Checkpoint: Playable Prototype Tests

## 1. Scope of This Checkpoint

This checkpoint protects the Phase 19 playable prototype as one session surface,
not as isolated components.

Load-bearing scope:

- live match room/session bootstrap
- room lifecycle and submission boundary
- route and match screen integration
- zone projection and board rendering
- all currently supported main zone categories
- available-actions projection and submission
- pending request / choice interaction
- event log ordering and formatting
- representative local playable flow
- valid, invalid, blocked, pending, and closed states
- UI remaining thin over room and engine truth

## 2. Match Room Coverage

`packages/match-session/src/match-room.test.ts` covers:

- room creation and initialization
- explicit participant-to-engine-player bindings
- room lifecycle transitions from initialized to in-progress to completed
- immutable room advancement through accepted engine results
- stale revision rejection
- participant/player mismatch rejection
- live room shape staying distinct from historical match records

`packages/match-session/src/architecture-boundaries.test.ts` covers package
purity: the session package depends only on shared contracts and `rules-core`,
not UI, persistence, or match history modules.

## 3. Match UI Coverage

`basic-match-room-view.test.tsx` covers:

- screen mount from a local match room
- room id, room revision, engine revision, players, board, actions, pending
  request, last result, and event log visibility
- available action submission through `submitMatchRoomCommand`
- accepted result rendering
- structured invalid result rendering
- invalid recovery: the screen remains usable and can accept a later valid
  command
- pending, blocked, and choice-resolution surfaces
- completed-room no-action state
- guard checks that UI modules do not import reducer/transition internals

Route tests cover both `/matches/play/[roomId]` and `/matches/play/local`.

## 4. Zone Rendering Coverage

`zone-projection.test.ts` covers:

- current player and opponent orientation
- projection from engine-owned zones without mutating state
- all main zone roles: deck, hand, vanguard, rear-guard, ride deck, G deck,
  damage, soul, drop, bind
- battlefield, hand, library, resource, discard, and support grouping
- occupied, empty, slotted, and piece state data
- perspective flip for the second player

`match-board.test.tsx` covers rendered board readability:

- current/opponent side regions
- battlefield, support, and hand sections
- visible current-player contents
- opponent private contents rendered as hidden cards
- empty slot and empty zone states
- rest/locked piece markers

## 5. Available Actions Coverage

`available-actions.test.ts` covers:

- availability projection derived through room-boundary dry-runs
- projection does not mutate the room engine state
- setup actions available while premature start is unavailable
- turn-flow and board-development actions after match start
- pending request mode
- request-specific actions: keep hand and mulligan first hand card
- blocked normal actions while a request is pending
- closed-room no-action state after completion

The tests prove current UI availability consumes room/engine truth for the
bounded prototype. They do not claim complete legal-action enumeration.

## 6. Event Log Coverage

`event-log.test.ts` covers:

- honest empty log state
- accepted engine events appended in emitted order
- session metadata on entries: ordinal, transition, room revision, engine
  revision
- match and turn summaries
- card, piece, mulligan, choice, zone, draw, and effect event categories
- follow-up effect events staying visible as ordered engine facts
- no invented entries for commands that emitted no events

`event-log-panel.test.tsx` covers visible ordered timeline rendering and
structured details.

## 7. Pending Request Coverage

Pending request behavior is covered at multiple levels:

- room/action projection blocks normal actions while a mulligan request is
  pending
- match screen shows request type, eligible pieces, blocked actions, and
  request-specific actions
- local prototype can resolve the request through `choice_response`
- first-card mulligan return path produces move, shuffle, draw, and completed
  events through the room boundary
- after resolution, pending state disappears and the prototype continues

## 8. Local Playable Flow Coverage

`local-gameplay-prototype-flow.test.tsx` covers a real bounded UI/session flow:

1. render local room
2. ready both players
3. start match
4. begin mulligan
5. observe blocked normal actions
6. resolve request by returning the first hand card
7. observe draw and mulligan-completed events
8. advance phase
9. ride from ride deck
10. call from hand to rear-guard
11. observe board and log updates

`local-match-room.test.ts` covers the reusable local bootstrap and the
first-card mulligan choice helper at the room/session boundary.

## 9. Fixture Strategy

Fixtures are deliberately small and deterministic:

- `createLocalPrototypeMatchRoom()` creates the two-player room, participants,
  bindings, zones, pieces, and initial state.
- local command builders create representative setup, turn-flow, board, match,
  and choice-response submissions.
- tests use small helper functions such as `acceptCommand()` and
  `startLocalMatch()` to keep session-flow tests readable.

The fixtures are not full real decks and do not pretend to be production match
data.

## 10. What Is Still Not Covered

Intentionally not covered yet:

- realtime multiplayer and websocket behavior
- reconnect/recovery
- persisted room/event streams
- full browser E2E matrix
- final responsive/polished UX
- full legal-action enumeration for all mechanics
- complete battle/effect/card matrix through the UI
- full hidden-information security model

This is acceptable before Phase 20 because Phase 19 is a local proof of
playability, not the full production client.

## 11. Current Risks

Risk: available action candidates are still curated for the prototype.

Mitigation: every candidate is validated through the room/engine boundary, and
tests protect that. Future phases should introduce a stronger action
availability contract before expanding the action surface.

Risk: event log records are currently component-local.

Mitigation: event log tests protect ordering/rendering now. Future realtime or
reconnect work should move event history toward the room/session boundary.

Risk: web typecheck is blocked by unrelated collection inventory fixture type
drift.

Mitigation: focused Phase 19 tests and lint pass. The unrelated fixture debt
should be fixed separately so repo-wide typecheck can become a clean gate again.

## 12. Final Verdict

Verdict: GO WITH CONDITIONS.

The load-bearing seams for Phase 19 are now meaningfully protected. Tests cover
room/session flow, match UI integration, zone rendering, available actions,
pending choices, event log ordering, local playable flow, invalid recovery, and
the engine/UI boundary.

Phase 19 can be closed as the first proof of playability. The conditions before
larger growth are the same architectural ones identified in the review
checkpoint: formalize action availability, move event history closer to the
session boundary, and clear unrelated typecheck debt.
