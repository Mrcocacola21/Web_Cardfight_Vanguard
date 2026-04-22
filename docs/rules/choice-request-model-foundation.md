# Choice / Request Model Foundation

## 1. Purpose

`packages/rules-core` now defines a gameplay choice/request model for pending decisions the engine requires from players.

## 2. Why requests

Not every transition can resolve from an action alone. Gameplay often reaches a point where the engine must ask a player to choose cards, targets, zones, options, or a yes/no answer before resolution can continue.

## 3. Request vs action

- Action: intended gameplay command.
- Request: engine-issued prompt for a required decision.
- Response: gameplay-safe answer to that prompt.

Example:

- action: `battle.declare_attack`
- request: choose guard cards
- response: selected guard pieces

## 4. Request vs event

Events describe facts that already happened. Requests describe unresolved decisions that must still be answered. A request is never emitted history.

## 5. Contracts

The foundation introduces:

- `GameChoiceRequest` as a discriminated union for engine prompts;
- `GameChoiceResponse` as a discriminated union for answers;
- `requestId` and `responderPlayerId` as stable match-scoped linkage;
- optional `RequestContext` for source action/event and related runtime references;
- invariant helpers to validate request shape and request-response compatibility.

## 6. Categories

The current request vocabulary includes:

- `choose.pieces`
- `choose.target`
- `choose.zone`
- `choose.option`
- `confirm.boolean`

Responses cover piece, target, zone, option, boolean, and explicit pass/skip answers.

## 7. Relation to `GameState`

`GameState` now carries `pendingRequests`. Requests use the same gameplay identities as the rest of the engine:

- `PlayerId` for the responding player;
- `PieceId` for runtime pieces;
- `ZoneId` and `ZoneSlotId` for selectable locations.

The model does not use UI widget ids, session ids, collection printings, or persistence row ids.

## 8. Future role

This layer is the contract between the pure engine and future drivers such as UI or server runtimes. Reducers and effect resolution can later create pending requests, pause resolution, consume `GameChoiceResponse`, and continue deterministically.

## 9. Not implemented

This step does not implement:

- full reducer orchestration;
- effect resolution;
- multi-step request pipelines;
- hidden-information projections for different viewers;
- transport or websocket protocols;
- format-specific choice legality;
- ordered position selection inside zones.

## 10. Summary

`rules-core` now has a coherent request/choice foundation with engine-level prompts, gameplay-safe responses, match-scoped identities, pending request state, and validation helpers. That is enough to support the upcoming reducer work without collapsing requests into actions, events, or UI payloads.
