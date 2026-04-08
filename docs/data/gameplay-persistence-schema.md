# Gameplay Persistence Schema

## 1. Scope

This schema covers the first durable gameplay-runtime layer needed for:

- match rooms
- admitted room players and deck inputs
- runtime gameplay snapshots
- persisted gameplay events
- pending runtime choices

Included:

- `gameplay.match_rooms`
- `gameplay.room_players`
- `gameplay.room_snapshots`
- `gameplay.room_events`
- `gameplay.pending_choices`

Out of scope for this step:

- social match history as the primary source of runtime truth
- user-facing aggregate statistics
- tournament state
- importer or content truth
- legality-result persistence as gameplay truth
- spectator/chat/notification systems
- matchmaking
- full replay or analytics platforms beyond what event/snapshot persistence already enables

## 2. Core Tables

- `gameplay.match_rooms`
  - runtime/session container
- `gameplay.room_players`
  - participating runtime players and admitted deck input references
- `gameplay.room_snapshots`
  - persisted serializable `GameState` checkpoints
- `gameplay.room_events`
  - ordered runtime facts
- `gameplay.pending_choices`
  - unresolved gameplay decisions

## 3. Match Rooms

`gameplay.match_rooms` is the runtime container for an active or recoverable gameplay session.

It is intentionally not the same thing as `social.matches`:

- `social.matches`
  - user-facing recorded history
- `gameplay.match_rooms`
  - live or restorable runtime execution context

The schema keeps them separate, but allows an optional `social_match_id` link when a runtime room later materializes a user-facing match record.

`gameplay.room_players` sits directly under the room because runtime participants need their own identities:

- a room player is not just a profile reference
- it can link to a submitted `deck_version`
- it can persist an admitted `submitted_deck_snapshot`

That keeps gameplay execution tied to the admitted match input, not to a deck that may still change later in user storage.

## 4. Snapshots

`gameplay.room_snapshots` stores persisted runtime state checkpoints.

Design decisions:

- one room has many snapshots over time
- one room may have one current snapshot
- each snapshot records:
  - `snapshot_sequence`
  - `last_event_sequence`
  - optional turn and phase markers
  - serialized `game_state_payload`

This supports room restoration and runtime continuity without pretending that snapshots replace the event log completely.

`active_room_player_id` is constrained to the same room as the snapshot row, so snapshot metadata cannot accidentally point at a participant from a different runtime session.

## 5. Events

`gameplay.room_events` stores ordered runtime facts.

Each event has:

- room linkage
- strict per-room `event_sequence`
- `event_kind`
- `source_kind`
- optional actor linkage
- flexible `event_payload`

This is enough for continuity, inspection, and later replay-like capabilities without committing the system to a heavy event-sourcing doctrine.

`actor_room_player_id` is also constrained to the same room as the event row, which keeps runtime attribution room-local and consistent.

## 6. Pending Choices

`gameplay.pending_choices` stores unresolved runtime decisions.

Important decisions:

- pending choice is a gameplay/runtime concept, not a UI prompt
- owner may be a player or the system
- options and context are stored separately from final resolution
- resolved choices record the event-sequence point at which they were completed

This allows a room to be restored in "waiting for choice" state.

When a choice belongs to a player, the player reference is constrained to the same room as the choice row.

## 7. Key Relationships

- `match_room -> room_players`
  - one room has many runtime participants
- `match_room -> room_snapshots`
  - one room has many snapshots over time
- `match_room -> room_events`
  - one room has one ordered event stream
- `match_room -> pending_choices`
  - one room may have zero or more unresolved or historical choices

Runtime references and canonical identities are kept distinct:

- persistent room/player references use gameplay-owned IDs
- optional deck linkage points back to `user_data.deck_versions`
- admitted deck input can be persisted as `submitted_deck_snapshot`
- canonical card identity or runtime card-instance IDs belong inside snapshot/event/choice payloads as scalar references, not as copied catalog objects

This preserves the intended truth split:

- `catalog` owns canonical card truth
- `gameplay` owns runtime room state and runtime instance references
- `social` owns user-facing recorded match history

## 8. Payload Strategy

The schema uses a mixed strategy:

- relational columns for:
  - room identity
  - lifecycle
  - ordering
  - actor/owner linkage
  - currentness and sequence markers
- JSONB payloads for:
  - serialized game state
  - event details
  - pending-choice options/context/resolution
  - admitted deck snapshot payload per room player

This avoids two bad extremes:

- one opaque table-sized JSON blob
- premature full relational explosion of every runtime structure

## 9. Current State vs History

The persistence strategy is:

- current runtime truth is represented by:
  - room status
  - the current snapshot
  - the latest event sequence
  - active pending choices
- historical continuity is represented by:
  - ordered room events
  - older snapshots kept as checkpoints

This keeps recovery practical:

- restore latest current snapshot
- inspect or replay forward from known event position if needed
- resume unresolved pending choices explicitly

## 10. What Is Intentionally Out of Scope

This schema does not yet model:

- rules-engine internals
- effect-handler storage
- websocket/realtime orchestration
- spectator support
- analytics warehouse concerns
- full replay products
- runtime card-instance relational tables

Those should be added only when real gameplay implementation creates a clear need for them.
