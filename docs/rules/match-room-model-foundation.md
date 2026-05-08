# Match Room Model Foundation

## 1. Purpose

Match room is the live gameplay session entity. It gives a real match an identity, participants, lifecycle, format binding, and current engine state.

The model lives outside `@web-vg/rules-core` in `@web-vg/match-session`. It wraps a rules engine session; it does not replace the engine state or become UI state.

## 2. Why match room is separate from `GameState`

`GameState` remains the gameplay truth inside `rules-core`: players, zones, pieces, turn state, battle state, requests, events, and revision.

Match room owns session-level concerns around that state:

- room id
- room lifecycle
- room participants and seats
- format and engine adapter identity
- current hosted `GameState`
- room-level timestamps and revision

Keeping those apart prevents UI, persistence, reconnect, or product session concerns from leaking into the pure rules model.

## 3. Room-level data vs engine-level data

Room-level data:

- `roomId`
- `formatId`
- `engineAdapterId`
- `status`
- room `revision`
- `participants`
- optional `hostParticipantId`
- room metadata timestamps
- hosted `engineState` after initialization

Engine-level data stays in `GameState`:

- gameplay player state
- turn/phase/step
- zones, pieces, and runtime piece state
- battle state
- pending choices
- gameplay events and engine revision

## 4. Participant identity vs gameplay player identity

Room participants are session members. They may have a `userId`, client session id, display name, deck reference, and seat.

Gameplay player ids are rules-engine ids inside `GameState`.

Initialization requires explicit bindings:

- `participantId -> playerId`

The room validates that every participant and every engine player is bound once, and that room seats match engine player seats. A `userId` is never treated as a `PlayerId`.

## 5. Room lifecycle

Baseline statuses:

- `created`: room shell exists, no engine state is attached yet
- `initialized`: room hosts an initial setup/ready `GameState`
- `in_progress`: engine state has moved into active gameplay or pending choice flow
- `completed`: hosted engine state completed the match
- `aborted`: room stopped without a completed engine match

Room lifecycle is not turn lifecycle. Engine phases, steps, battle status, and pending choices remain inside `GameState`.

## 6. Initialization model

The baseline path is explicit:

1. `createMatchRoom(...)`
2. `initializeMatchRoom(room, { initialState, playerBindings })`
3. `submitMatchRoomCommand(...)`

Initialization accepts only setup/ready engine states. Recovery from persisted snapshots is intentionally left for a later step.

## 7. Action submission boundary

Commands enter the room through `submitMatchRoomCommand`.

The room checks:

- the room is initialized or in progress
- participant-submitted player actions match the participant's bound engine player id
- choice responses come from the bound participant for the responder player
- system actions come through a room system source
- the configured engine adapter matches the room format

The room then dispatches through the rules engine adapter and returns a new room on accepted results. Invalid or blocked engine results keep the room unchanged. Direct uncontrolled `GameState` mutation is not part of the room contract.

## 8. Relationship to match history

Match room is live runtime state.

Match history records are user-facing historical summaries in the matches domain. They can later be produced from gameplay rooms, but they are not the same entity.

The room model does not contain match-history fields such as owner profile, played-at record timestamp, visibility, participant result, or manual notes.

## 9. What is intentionally NOT implemented yet

- websocket or realtime protocol
- lobby or matchmaking
- tournament room ownership
- persistence repository for rooms
- reconnect/recovery flow
- full action availability projection
- playable UI
- conversion from completed room to match-history record

## 10. Summary

`@web-vg/match-session` introduces the first live match aggregate. It keeps `rules-core` pure, hosts a coherent current `GameState`, separates participants from gameplay player ids, defines session lifecycle, and establishes the command boundary needed for the Phase 19 playable prototype.
