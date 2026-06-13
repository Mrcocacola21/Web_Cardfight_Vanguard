# Realtime Transport Shape

## 1. Purpose

This step chooses the first concrete Phase 20 transport baseline and implements a bounded command/update path that respects authoritative session truth, projection, persistence, and timeout state.

## 2. Evaluated options

- WebSocket: best fit for a later low-latency bidirectional room server, but this repo does not yet have a session server, socket lifecycle, or presence layer.
- Supabase Realtime: useful later for persisted change fanout, but unsafe as the first gameplay command channel because canonical session commands still need server-owned orchestration and projection filtering.
- Server route orchestration: fits the current Next/server-route posture and can call `match-session` directly while returning only participant projections.
- Hybrid: routes plus subscriptions may be useful later, but doing both now would add fanout infrastructure before the command authority path is proven.

## 3. Chosen transport baseline

The chosen baseline is `server_route_commands_with_projected_snapshots`.

Client commands enter through server route orchestration. The route loads persisted authoritative session truth, submits a participant command through `match-session`, persists accepted transitions, and returns a projected participant update. Reconnect/polling loads a projected participant snapshot from the same persisted truth.

## 4. Why this option fits current repo best

The repo already has:

- `rules-core` as pure gameplay logic;
- `match-session` as authoritative room/session runtime;
- `SerializableMatchSessionDocument` and accepted history;
- persisted session adapter boundaries;
- Next/server-side application patterns;
- no production WebSocket server or Supabase Realtime gameplay channel yet.

Server route orchestration is therefore the smallest honest baseline: it creates a real command/update path without pretending the final multiplayer backend exists.

## 5. Command contract

Client to server uses a participant command envelope:

- `commandId`
- `roomId` from the route
- participant identity resolved by the authenticated server route
- optional `expectedRoomRevision`
- participant-facing engine command payload

The route rejects client-submitted system actions. System actions remain
session/runtime-owned.

## 6. Projected update contract

Server to client returns `ServerRouteRealtimeCommandResponse`:

- `accepted`, `invalid`, or `blocked`
- room and participant ids
- room/engine revisions when accepted
- accepted history entry ids when accepted
- one `RealtimeProjectedStatePush` for the requesting participant

The response does not expose `SerializableMatchSessionDocument`, canonical `engineState`, other participants' projected payloads, or raw blocking request internals.

## 7. Authority model

`rules-core` owns gameplay transition rules and stays storage/transport-free.

`match-session` owns authoritative room orchestration, command validation, clocks, timeouts, serialization, accepted history, and hidden-information projection.

The server route transport is a thin bridge: it moves commands upward and projected updates downward. It does not implement gameplay rules.

The storage layer remains behind the persisted session adapter.

## 8. Relationship to persistence, projection, timeout, pending requests

The route transport loads canonical session truth through the persisted adapter. Accepted commands are persisted as snapshot plus accepted history before the route returns an accepted response.

Participant updates are rebuilt through projection. Pending requests and clock deadlines come from canonical room state and appear only through projected fields. Timeout outcomes use the same session/runtime accepted-transition model; production scheduling is a later concern.

## 9. What is intentionally NOT implemented yet

This step does not implement a WebSocket server, Supabase Realtime fanout,
presence, matchmaking, duplicate command idempotency, optimistic
reconciliation, distributed locks, reconnect replay windows, or production
room-server scaling. The DB-backed storage and authenticated route-handler
baseline now exist as Phase 20 entry work.

## 10. Summary

Phase 20 now has a concrete transport baseline: server routes submit participant commands to authoritative `match-session`, accepted state is persisted, and clients receive only projected snapshots. WebSocket or Supabase fanout can be added later behind the same command/projection contract.
