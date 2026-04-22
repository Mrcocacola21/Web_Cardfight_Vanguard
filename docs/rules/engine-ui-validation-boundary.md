# Engine/UI Validation Boundary

## 1. Purpose

This boundary defines how presentation code may interact with `@web-vg/rules-core` without taking ownership of gameplay logic.

## 2. Engine vs UI responsibilities

Engine owns:

- gameplay legality
- state transitions
- emitted events
- pending requests
- invalid and blocked outcomes
- gameplay truth

UI owns:

- rendering `GameState`
- collecting user intent
- sending engine commands
- displaying accepted, invalid, blocked, and request-driven results

UI does not patch `GameState`, duplicate reducer logic, or decide gameplay legality.

## 3. Input contract

UI talks to the engine through a single command boundary:

- `EngineCommand`
- `dispatchEngineCommand(currentState, command)`
- `rulesEngineBoundary.dispatch(currentState, command)`

The command kinds are:

- `action`
- `choice_response`

The boundary accepts only domain-safe submissions. It does not accept DOM events, browser state patches, form schemas, or transport payload shapes.

## 4. Output contract

The engine returns a normalized `EngineDispatchResult` union:

- `accepted`: new state, emitted events, and pending requests
- `invalid`: unchanged state with structured code and message
- `blocked`: unchanged state with structured code, message, and blocking requests

This keeps UI focused on presentation instead of reducer internals such as `nextState` vs `currentState` branches.

## 5. Invalid/blocked handling

Legality is exposed through reducer-owned outcomes:

- invalid means the engine rejected the command
- blocked means the engine is waiting for a pending request first

The UI may render those results, but it does not recompute them independently.

## 6. Requests/choices flow

Pending requests are engine-owned. UI renders them from engine output and submits a structured `choice_response` command. Request options and request ordering remain part of engine truth.

## 7. Realtime future compatibility

The boundary matches an authoritative interaction pattern:

- client sends command
- engine validates and applies
- engine returns structured result

That same contract can later sit behind local prototypes, server authority, or realtime orchestration without rewriting gameplay rules into UI code.

## 8. Not implemented

This step does not implement:

- a match UI
- websocket protocols
- multiplayer visibility projections
- full action availability hinting
- effect-driven interaction runtime

It only fixes the engine/UI contract and prevents reducer logic from leaking into presentation code.

## 9. Summary

`rules-core` now exposes a thin engine boundary facade for UI integration. UI sends commands and renders structured engine results; the engine remains the single source of truth for legality, requests, events, and state transitions.
