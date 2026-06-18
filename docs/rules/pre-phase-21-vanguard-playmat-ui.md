# Pre-Phase 21 Vanguard Playmat UI

## 1. Purpose

This step turns the match screen from a technical match inspector into a playable Cardfight!! Vanguard table. The UI remains a thin client over projected participant-safe state, but the player now reads the board through playmat layout, target highlights, battle context, and concise action feedback instead of reducer-shaped data.

## 2. Why the old UI still felt like a dashboard

The previous screen rendered useful state, but it grouped the table as panels and lists. Zones were present as data blocks, requests read like engine artifacts, blocked actions exposed raw issue codes, and the event log carried too much audit detail. The result was functional for debugging but too indirect for real play.

## 3. Chosen Vanguard playmat layout

The new surface is a two-sided facing playmat:

- opponent side on top, current player side on bottom;
- a central battle lane between them;
- Vanguard circle centered in each field;
- front and back rear-guard circles arranged as Vanguard columns;
- hand as a horizontal card band;
- deck, ride deck, drop, soul, damage, bind, order, prison, guardian, energy, and other support zones as side stacks.

## 4. Zone layout and board hierarchy

The main field is the visual priority: Vanguard circle, rear-guard circles, active cards, and empty circles are large and spatially meaningful. Support zones are smaller stack cards with counts. Hidden opponent cards stay present as card backs. Occupied, empty, targetable, unavailable, selected, attacker, target, booster, and guardian states are represented through board styling and data attributes.

## 5. Battle flow UX

Battle state is shown in two places: the central battle lane on the table and the side battle context rail. The table highlights attacker, target, booster, and guardian pieces, while the rail names the current status, attacker, target, and guard/no-guard context. Idle board state and active battle state now look different before the player reads the log.

## 6. Target/request UX

Requests are presented as human prompts, not raw request payloads. Legal targets are highlighted directly on the playmat, unavailable targets are visually muted, selected targets are marked, and confirm/cancel actions remain in the request flow. The player sees what the game is waiting for and where to interact.

## 7. Action/context/log UX

The match context layer summarizes active player, phase, request state, sync state, and revision state. The action rail uses playable labels such as Pending Request and explains why actions are blocked. Feedback states are explicit for accepted, blocked, stale, timeout, and recovery outcomes. The event log is now a recent-play support surface and filters noisy audit fields so it explains recent play without becoming the primary interface.

## 8. Relationship to projected authoritative state

The multiplayer UI still consumes projected participant-safe room state. It does not require canonical engine state, does not infer hidden information, and does not move gameplay truth to the client. Targetability, pending requests, battle status, available actions, sync status, and recovery feedback are rendered from projection and server responses.

## 9. What is intentionally NOT polished yet

This is not a final VFX client. It does not add card art pipelines, full animation timing, drag-and-drop, mobile-specific redesign, custom playmat skins, or complete Vanguard Online parity. The goal is a playable Standard slice surface with clear table semantics.

## 10. Summary

The match UI now reads as a Vanguard table: two facing fields, clear circles and stacks, visible battle lane, human request prompts, target highlighting, and useful feedback. It is still projection-driven and authoritative, but it no longer asks the player to understand the state machine in order to play.
