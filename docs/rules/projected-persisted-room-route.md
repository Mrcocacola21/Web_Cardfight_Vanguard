# Projected Persisted Room Route

## 1. Purpose

`/matches/play/[roomId]` now represents the multiplayer room entry surface. It
loads persisted authoritative match session truth on the server, resolves the
authenticated participant, derives a participant-safe projection, and renders the
projection-driven match UI.

## 2. Why `/matches/play/[roomId]` could not stay on local in-memory room semantics

The previous route passed `roomId` into the local prototype view. That view
created an in-memory room in the browser session, so the route was not tied to a
persisted multiplayer room and could not survive refresh/reconnect honestly.
Using that path for multiplayer would also blur canonical runtime truth with a
developer-only local fixture.

## 3. Chosen persisted room load model

The page calls a server read model that creates the DB-backed
`PersistedMatchSessionStorage`, wraps it with `createPersistedMatchSessionAdapter`,
and loads the session by `roomId`. Missing rooms use the route not-found
boundary. Storage and restore failures render explicit error states.

## 4. Authenticated participant resolution

The protected layout still handles signed-out redirects. The page read model
loads the current Supabase user, resolves the current profile, and matches that
profile id against the persisted room participants. Non-participants are denied.
No client-provided participant id is trusted.

## 5. Projection-driven render model

Canonical room/session truth stays server-side. The read model projects the room
with `projectMatchRoomForParticipant`, feeds accepted-only history engine events
through the same projection boundary, builds `ProjectedMatchRoomClientState`,
and renders `ProjectedMatchRoomView`.

## 6. Separation from local prototype path

`/matches/play/local` remains the explicit local prototype route and still uses
`BasicMatchRoomView`. `/matches/play/[roomId]` no longer imports or creates the
local in-memory prototype room.

## 7. Relationship to transport/reconnect/persisted session

The page now starts from the same persisted session truth used by the
authenticated realtime route. Refresh and later reconnect can reload the same
room document and rebuild participant-safe state, including pending requests,
availability mode, and clock/deadline projection.

Phase 20.1 adds a bounded browser sync loop on top of this route: the persisted
page renders a projected sync client that polls the authenticated realtime route
for participant snapshots and submits projection-safe participant commands with
`expectedRoomRevision`.

## 8. What is intentionally NOT implemented yet

This step does not implement WebSocket fanout, replay windows, the full gameplay
action catalog, optimistic client state, matchmaking, or room discovery.
Available actions are rendered from the current safe projection contract; the
first command submission wiring is intentionally bounded to projection-safe
participant commands.

## 9. Summary

The multiplayer play route is no longer a disguised local prototype. It is now a
server-loaded, persisted, participant-projected route that keeps canonical
`engineState` out of the client render boundary.
