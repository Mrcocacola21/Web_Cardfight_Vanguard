# Available Actions UI Foundation

## 1. Purpose

Phase 19.5 adds an available-actions surface to the live match screen. The
prototype now shows what can be submitted right now, what is blocked by pending
engine state, and what is currently unavailable.

## 2. Why available actions must come from engine truth

React components do not decide legality. The UI renders a projection derived
from the live match room and the rules engine transition result. This keeps
gameplay state and legality inside `rules-core` and the match room boundary.

## 3. Source of truth for action availability

The current baseline uses a local prototype availability projection. It builds a
small set of representative command intents, then dry-runs each intent through
`submitMatchRoomCommand` without mutating the room. The probe result is the
source of truth:

- accepted probe -> available action
- blocked probe -> blocked action
- invalid probe -> unavailable action

## 4. UI interaction pattern used now

The match screen has an `Available Actions` panel. Available actions are grouped
as setup, turn flow, board, decision, and match actions. Selecting one creates a
fresh command id and submits through the existing room/action boundary.

## 5. How pending requests are shown

Pending engine requests switch the panel into pending-request mode. The current
mulligan request exposes a `Keep current hand` response. Normal actions that the
engine blocks behind the request are shown in the blocked section with the
blocking request id.

## 6. How invalid / blocked states are surfaced

Blocked probe results are rendered as blocked actions with their engine code and
blocking request ids. Invalid probe results are rendered as unavailable actions
with the engine code and message. If a submitted command returns invalid, the
existing `Last Result` panel still shows the structured invalid result.

## 7. What is intentionally NOT implemented yet

Deferred:

- full action availability for every mechanic
- target selection overlays
- contextual per-card command menus
- drag and drop command construction
- client-side legality rules
- rich action explanations or tutorial UX
- authoritative realtime action protocol

## 8. Summary

The match UI now tells the player what can be done without becoming a second
rules engine. Availability is a thin, testable projection over room/engine
truth, and action submission still flows through the match room boundary.
