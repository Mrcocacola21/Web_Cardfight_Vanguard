# Realtime Sync for Match Rooms

## 1. Purpose

Phase 20.1 adds the first working live sync loop for persisted match rooms. The
goal is bounded multiplayer synchronization, not the final realtime platform:
participants can open the same persisted room, submit participant commands
through the server route, and observe participant-safe projected updates without
manual page reloads.

## 2. Chosen first realtime sync baseline

The chosen baseline is authenticated short-interval polling against:

- `GET /api/matches/rooms/[roomId]/realtime` for participant snapshots
- `POST /api/matches/rooms/[roomId]/realtime` for participant commands

Client updates use full projected room snapshot replacement. Deltas can be added
later after the live room loop is stable.

## 3. Why this baseline fits current Phase 20 foundation

The current branch already has DB-backed persisted session storage, participant
projection, accepted-only history, the server-route realtime transport, and the
persisted `/matches/play/[roomId]` route. Polling uses those boundaries directly
instead of adding websocket or Supabase fanout infrastructure before the command
authority path is proven.

## 4. Participant command flow

The browser derives a small command catalog from the current participant
projection. It sends `commandId`, `expectedRoomRevision`, and a player-originated
engine command envelope to the authenticated route. The route resolves the
trusted participant from the current user and persisted room membership, then
delegates to `createServerRouteRealtimeTransport`.

## 5. Projected room update flow

Accepted commands are processed by the authoritative session/runtime path,
persisted as accepted transitions, and returned as `RealtimeProjectedStatePush`
for the submitting participant. Polling clients call the same route with `GET`
and replace local client state with the latest projected snapshot when the
revision advances.

## 6. Per-participant projection under sync

Polling is viewer-specific. Each request authenticates the caller and resolves
that caller's participant id before projection. Two participants can observe the
same canonical room revision while receiving different `visibleState` payloads;
private hands, hidden requests, and redacted event fields remain protected.

## 7. Relationship to pending requests / deadlines / availability

Pending requests and clock/deadline state come from canonical room truth and are
carried through the projected snapshot. The client action mode is rebuilt from
the current projected room state after every accepted POST or polled GET. The
first browser command catalog supports only simple projection-safe commands and
leaves richer choice/action submission for later phases.

## 8. Relationship to persisted session storage

The sync loop does not read canonical room state from the browser. Both `GET`
and `POST` load persisted authoritative session documents on the server through
the persisted session adapter. Accepted transitions update the stored snapshot
and accepted history before clients see the new projected revision.

## 9. What is intentionally NOT implemented yet

This step does not implement websocket fanout, Supabase Realtime subscriptions,
presence, reconnect replay windows, optimistic reconciliation, duplicate command
idempotency, distributed room locks, social realtime, or the final complete
gameplay action catalog.

## 10. Summary

Phase 20 is now doing bounded match-room synchronization. The first live loop is
server-owned, persisted, participant-projected, and browser-visible: open room,
poll projected snapshots, submit a participant command, persist the accepted
transition, and converge both participants to the latest safe projection.
