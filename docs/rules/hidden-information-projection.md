# Hidden Information Projection

## 1. Purpose

Step 0.9 introduces a player-visible projection boundary. The engine/session can now distinguish canonical gameplay truth from what a specific player is allowed to see.

## 2. Why canonical state must be separated from player-visible state

`GameState` is server/engine truth. It contains full zone occupants, piece ids, card definition ids, deck order, pending request details, and card stats needed by rules. A realtime client must not receive that full state because private hands, deck order, and hidden request details would leak.

Projection is read-side only. Reducers, effects, validation, and legality still operate on canonical `GameState`.

## 3. Chosen projection model

The chosen model is a distinct `VisibleGameState` contract in `rules-core`, plus a `match-session` participant wrapper.

- `projectGameStateForPlayer(state, playerId)` returns a deterministic visible view or an explicit `unknown_viewer` failure.
- `projectGameStateForOmniscientViewer(state)` exists for local/dev inspection.
- `projectMatchRoomForParticipant(room, participantId)` resolves the participant binding and returns a room projection without exposing `engineState`.

Projected hidden cards use stable masked refs like `masked:<viewer>:<zone>:<position>`, not canonical `pieceId`.

## 4. Visibility rules for hand / deck / private zones

- Hand: owner sees card identities and piece ids; opponents see count and masked occupants only.
- Main deck: all players, including the owner, see count and masked occupants only. Deck top/order/card identities are hidden until revealed by gameplay.
- Ride deck / G deck: current bounded policy follows zone visibility. Owner-private contents are visible to the owner and masked to opponents.
- Public zones: contents remain visible to all players.
- Hidden zones: contents are masked to all player projections.
- Controller-private zones: visible only to the controlling player under the current bounded policy.

`VisibleGameState.cardStats` contains only stats for card definitions visible in the projection.

## 5. Opponent-private information handling

Opponent-private occupants do not expose canonical `pieceId`, `cardDefinitionId`, keywords, orientation, flags, or stat data. The projection preserves structural count, position, slot id where applicable, and a stable masked ref for UI diffing.

Responder-only requests are not sent as raw requests. They are projected into sanitized request data. For example, mulligan projection exposes eligible visible hand refs and deck count, not raw deck order.

## 6. Relationship to local prototype

The current local prototype can keep using canonical state as an explicit dev/omniscient view. A real player-visible path now also works for that same local room through `projectMatchRoomForParticipant`.

This keeps manual local play usable while preventing the prototype from being the only state-consumption model.

## 7. Relationship to future authoritative sync

The intended realtime shape is:

- server/session owns canonical `GameState`;
- each connected participant receives `ProjectedMatchRoomForParticipant`;
- reconnect rebuilds the projection from canonical state and participant binding;
- future spectator views can add a separate projection mode without changing reducer truth.

## 8. Event/log visibility policy

Raw engine events are not assumed safe for clients. The foundation adds visible event projection:

- shuffle events expose zone id and count, not ordered piece ids;
- draw/mulligan events expose counts to opponents and richer refs only to the owning player;
- reveal/check/trigger events expose revealed card facts because those are public aftermath;
- unsupported event details default to public metadata only until a more specific projection is added.

## 9. What is intentionally NOT implemented yet

This step does not implement network transport, final spectator mode, anti-cheat, persisted event history, full event redaction for every future event kind, UI mode switching, or production reconnect APIs.

## 10. Summary

Hidden information is now an explicit read boundary. Canonical state remains full engine truth, while player-visible projections mask hands, deck contents, private zones, sensitive requests, and hidden event payloads. Phase 20 realtime can build on this non-leaking state model.
