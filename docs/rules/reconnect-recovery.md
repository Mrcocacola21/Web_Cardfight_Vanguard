# Reconnect / Recovery

## 1. Purpose

Phase 20.3 makes the first realtime match-room loop recoverable in a bounded
form. A participant can reload the persisted room route, return after a dropped
connection, or resume the tab and converge back to the latest participant-safe
room state without trusting browser-owned gameplay state.

## 2. Chosen bounded reconnect/recovery model

The chosen baseline is snapshot-based recovery over the existing authenticated
room realtime route:

- `GET /api/matches/rooms/[roomId]/realtime` reloads the latest participant
  projection.
- The browser replaces local projected state with that authoritative snapshot.
- The existing polling loop continues after recovery and is re-triggered on
  `online`, window focus, and visible-tab resume.

This does not add websocket replay, offline command queues, or exactly-once
message delivery.

## 3. Recovery source of truth

Persisted authoritative match-session storage is the recovery source of truth.
The client never reconstructs canonical room state from UI memory or local
storage. The server route authenticates the user, resolves room membership,
loads the persisted session document, and projects it for the caller's
participant id.

## 4. Restored participant-facing state

Recovery restores the full projected room snapshot currently used by the
multiplayer client:

- room and engine revision
- projected visible game state and zones
- visible event/log context
- pending request surface
- available/blocked/unavailable action mode rebuilt from projection
- projected server clock, active request deadline, and active turn deadline
- completed or unavailable room state when persisted truth has advanced

## 5. Live sync re-attachment

After a recovery snapshot is applied, the same client remains in the live sync
loop. Polling keeps fetching viewer-specific snapshots, and browser resume or
network-online events explicitly request a fresh snapshot instead of leaving a
frozen board on screen.

## 6. Pending requests / deadlines / stale local state

Pending requests and deadlines are restored from the server projection, not from
stale local component state. If another participant advanced the room while this
client was disconnected, recovery discards the stale projected state and adopts
the latest room revision. If a timeout was already resolved and persisted while
the client was away, recovery shows the persisted post-timeout room snapshot.

In-flight commands are treated conservatively. If the POST fails before the
client receives an authoritative response, the command status is marked unknown,
the client does not blindly replay it, and the next recovery snapshot decides
what the room actually accepted.

## 7. Auth and hidden-information boundaries

Recovery uses the same authenticated route and participant projection as normal
sync. Non-participants cannot recover into the room, and the payload contains no
canonical `engineState` or opponent-private hidden data. The same canonical
revision may still produce different recovery payloads for different
participants.

## 8. What is intentionally NOT implemented yet

This step does not implement offline-first play, local canonical replay,
idempotent command replay, websocket replay windows, cross-device takeover,
spectator/replay mode, or recovery for the local prototype route. The local
`/matches/play/local` path remains a separate dev/prototype surface.

## 9. Summary

Realtime matches are no longer tied to one fragile browser connection. The
bounded recovery contract is simple: reload the participant-safe snapshot from
persisted authoritative truth, replace stale client state, and re-enter the live
sync loop.
