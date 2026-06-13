# Match UI Projection-Driven Client Path

## 1. Purpose

The multiplayer match UI renders participant-safe projected room state. It is a
thin client of server/session projection, availability, pending request, event,
clock, and metadata surfaces.

## 2. Why canonical `engineState` could not remain the multiplayer UI input

Canonical `engineState` contains hidden zones, full piece identities, raw
pending requests, and authoritative runtime internals. Passing it to a
multiplayer client makes accidental hidden-information leaks likely, especially
when board helpers, logs, or action affordances inspect raw zones and pieces.

The multiplayer render path now accepts `ProjectedMatchRoomClientState`, built
from `ProjectedMatchRoomForParticipant` / `RealtimeProjectedStatePush`. It
rejects non-player projections and viewer mismatches instead of falling back to
canonical state.

## 3. Chosen client-facing projected room shape

`ProjectedMatchRoomClientState` is the canonical web client read model for this
step. It contains:

- room/session metadata: room id, status, room revision, engine revision,
  format, participant/viewer binding;
- `VisibleGameState` derived surfaces: turn, player summaries, visible pending
  requests, masked/visible zone and piece data;
- board projection built from `VisibleGameState`;
- projected event log entries built from `VisibleGameEvent`;
- projected clock/deadline state;
- accepted history ids when supplied by realtime transport.

It intentionally does not contain `engineState`.

## 4. Board/zone rendering from projection

`MatchBoard` no longer accepts `GameState`. It renders a `MatchBoardProjection`
that is built from `VisibleGameState`. Masked pieces stay masked; public or
viewer-visible pieces carry identity. Deck and hidden zones render counts and
masked cards without requiring raw piece ids.

The previous local helper remains only as a dev adapter: it first creates a
player projection, then builds the board projection from that visible state.

## 5. Event log / pending requests / availability from projection

The multiplayer-safe event log consumes projected `VisibleGameEvent` entries.
Redacted fields stay redacted in the displayed details.

Pending request UI consumes `VisibleGameChoiceRequest`; full request details are
shown only when the projection exposes them to the viewer. Action UI consumes a
client action projection. The default projected action surface does not infer
legality locally; future server-route/realtime responses can supply accepted
availability entries.

## 6. Local/dev mode vs multiplayer-safe mode

`BasicMatchRoomView` remains the local prototype controller. It still owns an
in-memory canonical room so local buttons can submit through the room boundary.
Before rendering, it projects the room for the local participant and passes only
the projected client state into `ProjectedMatchRoomView`.

The local prototype keeps its detailed raw event log as an explicit dev override.
That override is not part of the multiplayer client read model.

## 7. Relationship to transport and persisted session

The selected UI shape matches the server-route realtime baseline: clients can
hydrate from `RealtimeProjectedStatePush` and render without canonical session
truth. Persisted session restore remains server/session authority work; after
restore, the server projects room truth for the participant and sends the same
client shape.

## 8. What is intentionally NOT implemented yet

- WebSocket or Supabase Realtime delivery.
- Production server-route wiring into Next.js pages.
- Full server-owned action availability generation for every game action.
- Spectator mode.
- Redesign of the visual match UX.

## 9. Summary

The multiplayer match UI path is now projection-driven. Board, pending request,
event log, and action surfaces render from participant-safe read models, while
local/dev canonical state is isolated in the local controller instead of being a
shared UI input.
