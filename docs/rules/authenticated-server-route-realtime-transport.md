# Authenticated Server Route Realtime Transport

## 1. Purpose

Phase 20 starts the app-level server-owned realtime path for multiplayer match
rooms. Participant commands now have a concrete HTTP route entrypoint:

`POST /api/matches/rooms/[roomId]/realtime`

Participant reconnect/projected snapshot loads use:

`GET /api/matches/rooms/[roomId]/realtime`

Both routes authenticate the caller, resolve the caller's room participant from
authoritative persisted room membership, and delegate gameplay handling to
`createServerRouteRealtimeTransport`.

## 2. Why local/in-memory prototype path was not enough

The local match page can still be useful for development, but it is not a
multiplayer authority boundary. It can construct local room truth and run local
commands in process. A real multiplayer path needs server authentication,
persisted authoritative session loading, accepted transition persistence, and
participant-safe projection before anything reaches the browser.

## 3. Chosen authenticated route model

The client sends only a command envelope: `commandId`,
`expectedRoomRevision`, and `payload`. The client-supplied participant identity
is ignored. The route resolves the current Supabase user, loads the user's
profile, loads the authoritative room through DB-backed persisted session
storage, and finds the participant whose `userId` matches that profile id.

Non-authenticated callers receive `auth_required`. Authenticated callers who are
not room participants receive `room_access_denied`.

## 4. Participant command flow

1. Client posts a participant-facing command envelope.
2. Route authenticates with the Supabase cookie-backed server client.
3. Route creates a server-only DB client from `SUPABASE_SERVICE_ROLE_KEY`.
4. Route loads the persisted authoritative match session.
5. Route resolves `participantId` from persisted room membership.
6. Route calls `createServerRouteRealtimeTransport({ sessions })`.
7. Transport loads the session again for runtime processing, validates revision
   and legality, persists accepted transitions, and returns projected output.

## 5. Projected response/update model

The route returns the transport response directly: `accepted`, `invalid`,
`blocked`, or snapshot `ok`. The response contains `projectedUpdate`, revision
data, pending/deadline surfaces, available actions, and projected log ids when
the runtime provides them. It does not return canonical `engineState` or raw
session snapshots.

## 6. Relationship to persisted session storage

The route constructs `createDbPersistedMatchSessionStorage` behind
`createPersistedMatchSessionAdapter`. The route does not write gameplay tables
itself. Accepted transition atomicity and accepted-only history persistence stay
inside the persisted session adapter and storage port.

## 7. Authorization and membership model

Authentication is based on the current Supabase user. Membership is based on the
persisted canonical room document's participant bindings. The trusted
participant id is the stored room participant id bound to the authenticated
profile. A body-level `participantId` is not trusted.

## 8. Relationship to hidden-information boundary

The route loads canonical truth only on the server. The browser receives only
participant projection emitted by `match-session` realtime transport. Local
prototype views remain separate and must not be used as the multiplayer
authoritative path.

## 9. What is intentionally NOT implemented yet

This step does not implement WebSocket fanout, reconnect replay windows,
matchmaking, lobby discovery, invite flows, client optimistic state as truth, or
full production scaling. It also does not rewrite the local prototype match page.

## 10. Summary

The project now has a real authenticated server route for multiplayer match
interaction. Commands flow through persisted authoritative session storage and
`createServerRouteRealtimeTransport`; clients receive projected participant-safe
updates instead of canonical room state.
