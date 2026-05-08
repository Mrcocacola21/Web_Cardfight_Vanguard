# Basic Match UI Foundation

## 1. Purpose

The basic match UI is the first live gameplay screen for a match room. It lets a developer open a room, inspect the hosted engine state, submit representative commands, and see structured engine outcomes.

It is a prototype match screen, not the final board client.

## 2. Why the match UI is thin over match room + engine

The UI does not own gameplay truth. It keeps the current `MatchRoom` aggregate in client state and sends commands through `submitMatchRoomCommand`.

`GameState` remains engine-owned inside the room. Components render state and collect input, but they do not call reducers, patch zones, decide legality, or duplicate action availability logic.

## 3. Route / entrypoint

The live prototype route is:

- `/matches/play/[roomId]`

This keeps the playable room path separate from historical match routes such as `/matches` and `/matches/new`.

## 4. Layout structure

The screen has:

- header with room status, format, room revision, engine revision, and active player
- player summary panels
- main gameplay surface with compact per-player zone counts
- controls panel for representative room commands
- pending request panel
- structured last-result panel
- session summary panel

The main gameplay surface is intentionally ready for future spatial zone rendering.

## 5. What state is rendered now

Current rendering includes:

- room id and room lifecycle status
- format and engine adapter
- engine status and revision
- active turn player, turn number, phase, and step
- both players, seats, player statuses, zone counts, piece counts, and flags
- zone kind summaries and occupant counts
- pending request type, responder, purpose, visibility, selection bounds, and eligible piece count

## 6. How action submission works

The client creates a local prototype room through `@web-vg/match-session`, then submits commands through `submitMatchRoomCommand`.

Representative commands include:

- player ready
- start match
- begin mulligan
- advance phase
- keep hand for mulligan choice
- concede

Accepted results replace the current room with the returned room. Invalid and blocked results keep the current room unchanged and render their structured result.

## 7. How invalid / blocked / pending states are shown

The last-result panel displays:

- `accepted`: transition id, engine revision, emitted events
- `invalid`: structured code and message
- `blocked`: structured code, message, and blocking request ids

Pending requests are shown independently from last result, so an awaiting-choice engine state is visible even before another command is attempted.

## 8. What is intentionally NOT implemented yet

- realtime multiplayer transport
- persistence/reconnect
- final board layout
- complete zone rendering
- full action palette
- action availability projection
- target selection UX
- effect stack UI
- spectator mode
- polished animation layer

## 9. Summary

`/matches/play/[roomId]` is now a real local match screen over the match room aggregate. It renders room and engine state, routes input through the room boundary, shows accepted/invalid/blocked/pending states, and leaves gameplay legality inside `rules-core`.
