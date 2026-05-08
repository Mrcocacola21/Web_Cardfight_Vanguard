# Local Gameplay Prototype

## 1. Purpose

The local gameplay prototype is the first single-session proof that the match room, rules engine, match UI, zone rendering, available actions, pending requests, and event log can operate together as one playable flow.

It is intentionally local. It does not introduce realtime transport, matchmaking, persistence, reconnect, or a second demo rules engine.

## 2. What "playable" Means at This Stage

Playable currently means a developer or user can open one local match room, see the board/session state, submit real room commands, resolve at least one engine request, observe board changes, and follow the resulting engine event log.

It does not mean the entire Cardfight!! Vanguard ruleset can be completed end to end yet. The prototype proves the architecture can sustain a bounded match loop through the real room and engine contracts.

## 3. Local Prototype Entrypoint

The stable local entrypoint is:

`/matches/play/local`

It renders the existing match screen with the deterministic local room id `local-prototype`. The generic live-room route `/matches/play/[roomId]` remains available for room-id based sessions.

## 4. Session Bootstrap Model

The prototype bootstrap lives in the match play application layer, not in `rules-core`.

`createLocalPrototypeMatchRoom()` creates an initialized match room with:

- Standard format identity.
- Two local participants, Aichi Sendou and Toshiki Kai.
- Stable participant-to-engine-player bindings.
- Deterministic local deck, hand, ride deck, G deck, field, damage, soul, drop, and bind zones.
- Initial public piece states used by the board renderer.

The bootstrapped `GameState` remains engine-owned gameplay truth once commands begin flowing.

## 5. Supported Playable Loop

The current bounded loop supports:

- Ready both participants.
- Start the match.
- Begin the active player mulligan request.
- Resolve the request by keeping the hand or returning the first hand card and drawing one replacement.
- Advance the turn phase to draw.
- Ride the first ride-deck card.
- Call the first available hand card to an empty rear-guard slot.
- Concede to complete the room.

This loop is representative, not exhaustive. It proves setup, pending choice resolution, zone movement, board development, event logging, and closed-room no-action behavior.

## 6. How Actions / Requests / Log / Board Work Together

The screen renders available actions from the room/engine-driven availability projection. Clicking an action submits a command through `submitMatchRoomCommand`.

Accepted commands replace the current room with the returned room, append emitted engine events to the local event timeline, and rerender the board from the new `GameState`.

Pending requests are first-class action contexts. The mulligan request is displayed in the request panel, normal actions are blocked by the room boundary, and request responses are submitted as choice responses through the same room boundary.

Invalid and blocked results are shown as structured feedback. The UI does not patch zones, requests, events, or room lifecycle directly.

## 7. What Is Intentionally NOT Implemented Yet

- Realtime multiplayer or websocket synchronization.
- Backend room persistence.
- Reconnect/recovery flow.
- Full match completion across all Vanguard mechanics.
- Final production board UX, drag-and-drop, animation, or full responsive polish.
- Complete action affordances for every future mechanic/effect.
- A separate demo reducer or UI-owned gameplay state.

## 8. Summary

The local gameplay prototype is a deterministic single-session route over the real match room model and `rules-core` engine. It is sufficient to manually exercise a meaningful gameplay sequence and to verify that board rendering, available actions, pending requests, invalid/blocked feedback, and event logging are integrated around one room-owned session state.
