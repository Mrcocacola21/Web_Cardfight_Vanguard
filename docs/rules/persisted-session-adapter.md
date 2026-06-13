# Persisted Session Adapter

## 1. Purpose

The persisted session adapter makes the authoritative `match-session` room truth durable. It bridges the runtime `SerializableMatchSessionDocument` to a storage boundary that can save, load, and restore current room state plus accepted history.

## 2. Why in-memory room truth was not enough

The local runtime can own a room while the process is alive, but realtime needs reconnect, recovery, and room reload after process loss. A participant projection can always be rebuilt from canonical truth, but only if that canonical room snapshot and accepted history survive outside the in-memory runtime.

## 3. Chosen persisted session model

The model remains `snapshot+event-history`:

- current canonical room/session snapshot;
- ordered accepted room history entries;
- room revision, lifecycle status, participants, metadata, clock state, pending requests, and engine state inside the canonical room document.

Player projections, UI event-log rows, client command failures, and derived views are not authoritative persisted truth.

## 4. Adapter responsibilities

`rules-core` stays storage-agnostic and only computes gameplay transitions.

`match-session` owns authoritative room orchestration, serialization, history recording, hidden-information projection, and timeout-aware clock state.

The persisted session adapter owns save/load/restore around canonical session truth. It validates documents, records accepted transitions, rejects stale writes, and calls a narrow storage port.

The storage layer owns actual persistence mechanics. Its accepted-transition method is the atomic unit that updates the current snapshot and appends accepted history together. The DB-backed implementation now lives behind the same port and calls gameplay RPCs instead of leaking SQL into `match-session`.

## 5. Snapshot + history strategy

One accepted transition produces one canonical next document. The snapshot is replaced with that next document, and any newly accepted history entries are appended in sequence. If an accepted transition emits no engine events, the snapshot still advances; history does not get filler rows.

Invalid and blocked commands are not stored as accepted room history.

## 6. Restore path

`loadRoomSession(roomId)` loads and validates the stored document. `restoreAuthoritativeRoom(roomId)` returns the canonical room and history from that validated document. Participant views are rebuilt afterward through the existing projection layer, so hidden information is not persisted as a player-specific authority.

## 7. Atomicity boundary

The adapter treats one accepted room transition as the consistency boundary:

- expected previous room revision;
- expected previous history length;
- next canonical snapshot;
- appended accepted history entries;
- persisted timestamp.

The storage port must commit those together or fail with a structured error. The included in-memory store enforces this boundary for tests and local use. The DB-backed storage implementation provides the same boundary through gameplay repository RPCs instead of chained best-effort writes.

## 8. Relationship to projection / timeout / pending requests

Pending requests and deadline-bearing clock state are part of the canonical room snapshot, so they restore with the room. Hidden-information projections remain downstream from restored truth. Timeout outcomes are treated like accepted runtime transitions when they produce accepted room results.

## 9. What is intentionally NOT implemented yet

This step does not implement websocket transport, distributed locks, matchmaking, presence, replay products, invalid-command audit storage, retention policy, or conflict resolution beyond stale revision/history checks.

## 10. Summary

The realtime foundation now has a load-bearing persisted session adapter and DB-backed storage path: canonical room truth can be created, updated after accepted transitions, loaded, and restored without moving storage concerns into `rules-core` or treating UI projections as authoritative state.
