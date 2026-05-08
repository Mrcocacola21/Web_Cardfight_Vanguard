# Match Event Log Foundation

## 1. Purpose

Phase 19.6 adds the first match timeline to the playable prototype. The log
helps players understand what happened and gives developers a readable view of
engine consequences while manually exercising the match screen.

## 2. Why the event log is derived from engine events

The log is not gameplay truth. `GameState` and the match room remain the source
for current state, while `rules-core` emitted events are the source for history.
The UI does not invent gameplay events or infer consequences from board diffs.

## 3. Source of truth for log entries

The current local prototype appends only events from accepted
`submitMatchRoomCommand` results. Each appended record stores the engine event
plus session metadata: ordinal, transition id, room revision, and engine
revision. Availability dry-runs do not append to the log.

## 4. Entry model and formatting strategy

Each rendered entry contains:

- stable event record id
- chronological ordinal
- engine event id and sequence
- event type and category
- source/origin label
- readable summary
- compact structured details

Formatting is a deterministic projection from `GameEvent` types. Unknown future
event detail can still render by type/id without becoming raw JSON.

## 5. Ordering policy

Events are appended in the order accepted commands return them. Within a command,
the engine event array and event sequence are preserved. The UI renders oldest
to newest so causality is readable.

## 6. How the log fits into the match screen

The event log is a visible panel in the match screen below the board/request
feedback area. It updates naturally after accepted available-action submissions
and resets with the local room.

## 7. Empty/early-match handling

Before any accepted command emits events, the panel shows an honest empty state:
`No engine events yet.` Setup actions that emit no events do not create fake log
entries.

## 8. What is intentionally NOT implemented yet

Deferred:

- full replay controls
- persistent room event streams
- realtime event sync
- spectator log UX
- raw audit/debug console
- perfect prose for every future event type
- log-driven state reconstruction

## 9. Summary

The match screen now has a real event timeline derived from engine facts. It is
readable enough for players, structured enough for debugging, and deliberately
downstream from the room/engine boundary.
