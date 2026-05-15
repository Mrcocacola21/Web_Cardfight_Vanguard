# Match State Serialization and Session Event History

## 1. Purpose

Step 0.10 makes a live match room serializable and restorable. The session layer now has a durable truth document that can carry canonical room state plus ordered room history.

## 2. Why live room state needed a durable truth model

In-memory room state is enough for a local prototype, but realtime needs recovery after reconnect, server restart, and client resync. That requires a stable canonical snapshot and ordered history that are independent from UI state and local closures.

## 3. Chosen persistence baseline

The chosen baseline is a bounded hybrid:

- latest canonical room snapshot;
- append-only room-level event history.

Snapshot-only would restore quickly but lose ordered causality. Event-log-only would be heavier than the current engine needs and would require replay guarantees not yet implemented. The hybrid gives fast reconnect now and a clear replay/audit seam later.

## 4. Serializable session shape

The persisted document is versioned:

- `version`;
- `persistenceModel: "snapshot+event-history"`;
- `room`, containing lifecycle status, participant bindings, metadata, and canonical `GameState` when initialized;
- `history`, containing ordered session history entries.

The persisted canonical state includes pending requests, battle/turn/effect-visible state already carried by `GameState`, card stats, zones, pieces, and room lifecycle data. Player-visible projections are not persisted as authoritative state.

## 5. Room-level event history model

Room history entries wrap durable facts:

- `room_lifecycle` events for room created/initialized/started/completed/aborted milestones;
- `engine_event` entries wrapping rules-core domain events with transition metadata.

Invalid and blocked command attempts are not persisted in the bounded baseline. They remain ephemeral command results unless a future audit layer explicitly records them.

## 6. Ordering and identity policy

History is append-only and sequence-based:

- `sequence` is monotonic and starts at 1;
- `entryId` is derived as `<roomId>:history:<sequence>`;
- each entry stores `roomRevision`;
- entries from engine results also store `engineRevision` and `transitionId`;
- timestamps are metadata only, not the ordering authority.

Restoration rejects out-of-order, duplicate, malformed, or wrong-room history.

## 7. Reconnection-safe session assumptions

A reconnect can load the serialized document, restore the latest canonical room snapshot, inspect pending requests, and rebuild per-player projections from the restored truth. The document does not depend on in-memory adapters, dispatch closures, React state, or UI event-log formatting.

## 8. Relationship to hidden-information projection

Serialization stores canonical truth. Hidden-information projection remains downstream:

- `restoreMatchSessionDocument` returns canonical room + history;
- `projectMatchRoomForParticipant` can then rebuild a player-visible view;
- persisted state never stores a partial player projection as authoritative truth.

## 9. What is intentionally NOT implemented yet

This step does not implement websocket transport, DB tables, distributed transactions, full event-sourced replay, persisted invalid-command audit, retention policies, migrations beyond version 1, or production reconnect protocol.

## 10. Summary

Match sessions now have a restoration-safe foundation: a versioned snapshot-plus-history document, deterministic history ordering, explicit restore validation, and compatibility with player-visible projections. Realtime can build on this instead of ephemeral local runtime state.
