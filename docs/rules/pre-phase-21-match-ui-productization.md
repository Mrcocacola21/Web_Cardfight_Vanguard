# Pre-Phase 21 Match UI Productization

## 1. Purpose

Step 21.0.4 turns the projected match UI from a technically functional state
viewer into a playable game surface. The goal is not final visual polish. The
goal is that a player can understand the table, the current choice, battle
context, and server feedback without reading engine internals.

## 2. Why the old UI felt like a dashboard

The previous screen was organized around room and reducer facts: revisions,
request payloads, raw event details, and generic board sections. That proved the
projection path worked, but it forced players to infer gameplay intent from
state-machine output. Choice requests, legal targets, battle state, and
recovery feedback were present but scattered.

## 3. Board readability improvements

`MatchBoard` now presents a game table with player-facing field language,
distinct side/zone structure, empty and occupied slots, hand/damage/drop/bind
counts, and visible card state. Cards expose stand/rest state, power and
critical modifiers, selected and targetable states, and battle roles where the
projection exposes enough data.

## 4. Target/request/choice UX improvements

Pending requests now render as prompts such as mulligan, target, option, zone,
guard, or confirm choices. Legal projected targets are highlighted on the board,
selected targets are clearly marked, and unavailable candidates in the relevant
request scope are visually de-emphasized. The confirm/pass/clear flow stays on
the match surface instead of asking the player to read a raw request payload.

## 5. Battle flow clarity improvements

The match view now has a battle context panel showing attacker, target, booster,
guard state, combat numbers, outcome, and check state when available. Board
cards also receive attacker, target, booster, and guardian roles so the battle
reads as a table relationship instead of disconnected log entries.

## 6. Feedback states (accepted/blocked/stale/timeout/recovery)

The UI now summarizes action feedback in player language:

- accepted: the action was received and the table is updating.
- blocked: the action cannot be used from the current state.
- stale: the room changed first; choose again from the refreshed table.
- timeout: the timer expired or the server applied the timer result.
- recovery: restored server state is visible as connection/recovery context.

Technical codes are still available in compact detail rows, but they are no
longer the primary player-facing message.

## 7. Event/log role

The event log is now a recent-play support panel. It shows the newest relevant
events first, trims older noise, keeps event details compact, and avoids
competing with the board as the main way to understand the game.

## 8. Relationship to projection/realtime/authority

The multiplayer UI still renders `ProjectedMatchRoomClientState`. It consumes
participant-safe board, request, battle, clock, availability, and event
projection data. It does not inspect canonical `engineState` in the multiplayer
path and does not move gameplay legality onto the client.

## 9. What is intentionally NOT polished yet

This step does not add AAA animation, full VFX, a new rules engine path, or
client-side gameplay shortcuts. Some choice types still depend on server-owned
request/availability data before they can become fully ergonomic. Local
prototype controls remain separate from the persisted multiplayer path.

## 10. Summary

The match UI is now shaped around play: read the table, see whose turn it is,
understand what the game is waiting for, pick highlighted targets, follow battle
state, and recover from server feedback. It remains a thin projected client over
authoritative room/session state.
