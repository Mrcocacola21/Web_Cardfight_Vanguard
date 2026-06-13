# DB-backed Persisted Match Session Storage

## 1. Purpose

This step adds a durable implementation of `PersistedMatchSessionStorage` behind the existing `match-session` port. The authoritative room/session document can now be created, advanced after accepted transitions, loaded, and restored from `gameplay` tables instead of living only in process memory.

## 2. Why in-memory storage was not enough

The in-memory adapter proved the serialization and accepted-history contract, but it cannot survive process restart, reconnect, or server handoff. Phase 20 realtime needs canonical room truth outside the runtime process so projections and timeout handling can be rebuilt from persisted authority.

## 3. Chosen table mapping

`gameplay.match_rooms` stores the room container: UUID room id, format id, mapped lifecycle status, host profile when available, latest accepted event sequence, latest snapshot sequence, and lifecycle timestamps.

`gameplay.room_players` stores DB participant bindings for FK integrity: one row per room participant, deterministic room-player UUID, seat order, optional profile id, and active/joined status. The full participant truth remains in the canonical snapshot.

`gameplay.room_snapshots` stores the current canonical `SerializableMatchSessionDocument` in `game_state_payload`. It records snapshot sequence, last accepted event sequence, turn/phase markers, active room player FK, and `is_current`.

`gameplay.room_events` stores accepted `MatchRoomHistoryEntry` rows only. `event_sequence` mirrors history sequence, `event_kind` mirrors lifecycle or engine event type, `source_kind` classifies setup/system/player/effect/trigger origin, and `event_payload` keeps the canonical history entry.

`gameplay.pending_choices` stores the current pending FIFO mirror. Each row contains request id and queue index in `context_payload`, the raw canonical request in `options_payload`, owner room player when resolvable, and deadline metadata when present.

## 4. Save/load/restore model

Create and accepted-transition writes go through DB-side RPCs:

- `gameplay.create_persisted_match_session(jsonb)`
- `gameplay.persist_accepted_match_session_transition(jsonb)`

The repository builds one payload from the validated session document and calls the RPC. Load reads `match_rooms`, the current snapshot, accepted event rows, and pending choices; the current snapshot remains canonical and the other rows are validated against it. Restore is still the existing `match-session` restore path over the loaded document.

## 5. Accepted-only history semantics

Only `persistAcceptedRoomTransition` appends `room_events`. Invalid and blocked command results return `persisted: false` before DB storage is called. Load validates that event row count/order matches snapshot history, so restore does not invent or accept extra history.

## 6. Pending choice persistence

Pending choices are replaced on each accepted transition: consumed/stale pending rows are deleted and the current canonical FIFO queue is inserted. FIFO truth is the snapshot `engineState.pendingRequests`; table rows mirror `requestId`, `queueIndex`, owner, request payload, and active deadline metadata for reconnect/inspection.

## 7. Atomicity boundary

One accepted transition persists atomically inside Postgres:

- lock and validate current room revision/history boundary;
- append accepted event rows;
- replace pending pending-choice rows;
- mark old snapshot non-current and insert the new current snapshot;
- update `match_rooms` status, latest event sequence, latest snapshot sequence, and timestamps.

If any part fails, the RPC fails and Postgres rolls back the whole transition.

## 8. Relationship to projection/timeout/runtime

Storage persists canonical server-owned truth only. Participant projections are not stored as authority and remain derived after load. Clock and timeout state live inside the canonical room snapshot; timeout aftermath is persisted through the same accepted-transition path when it changes room truth.

## 9. What is intentionally NOT implemented yet

This does not implement websocket transport, matchmaking, distributed locks, replay from events, invalid-command audit logs, projection storage, spectator support, retention policy, or non-UUID room id mapping. The DB-backed adapter expects durable room ids to be UUID-compatible with `gameplay.match_rooms.id`.

## 10. Summary

Realtime no longer depends only on in-memory room storage. The authoritative session document, accepted history, lifecycle metadata, and pending request mirror now have a real DB-backed storage path with explicit atomic transition persistence.
