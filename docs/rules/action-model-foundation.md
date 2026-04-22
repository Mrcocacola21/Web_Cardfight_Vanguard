# Action Model Foundation

## 1. Purpose

`packages/rules-core` now defines a formal action model for gameplay intents. Actions are the language the future rules engine will consume before reducer, event, and choice layers are added.

## 2. Why gameplay uses actions instead of UI events

Gameplay must reason in domain terms such as `card.ride`, `battle.declare_attack`, or `turn.end_phase`. UI concerns such as clicks, drags, taps, route handlers, or form payloads may map into those actions later, but they must not define the engine contract.

## 3. Role of the action model

The action model represents intended state-changing gameplay commands from players or from the engine itself. It is not a browser interaction model, transport DTO, DB mutation shape, or emitted history/event record.

## 4. Action categories

The current foundation includes:

- match actions: ready, start, concede;
- turn-flow actions: pass priority, end phase, end turn, advance phase, advance step, resolve mandatory flow;
- zone action: move piece;
- card actions: play, ride, call;
- battle actions: declare attack, guard.

This is a baseline gameplay vocabulary, not a complete Vanguard rules catalog.

## 5. Actor and target semantics

Actions distinguish actors explicitly:

- player actions carry `actor: { kind: 'player'; playerId }`;
- system actions carry `actor: { kind: 'system'; system }`.

Targets and references also stay in gameplay terms:

- `PieceId` for runtime pieces;
- `ZoneId` and `ZoneSlotId` for runtime locations;
- attack targets are either a runtime piece or a match-scoped player.

## 6. Relationship to `GameState`

The action model references only gameplay identities already used by `GameState`, `PlayerState`, and `ZoneState`. It does not use persistence ids, collection printings, or UI-specific references. That keeps the action model and state model part of one coherent future engine.

## 7. Relationship to future event/request/reducer layers

- Action: intended gameplay command.
- Event: fact produced by resolution.
- Request/choice: interactive question the game asks while resolving.
- Reducer/transition: pure logic that validates and applies actions against `GameState`.

These layers are intentionally separate even though they will connect later.

## 8. Format-agnostic design choices

The action vocabulary is gameplay-meaningful without hardcoding Standard, V Premium, or Premium behavior into the base contracts. Format-specific availability and legality can later be handled by adapters and validators rather than by rewriting the core action model.

## 9. What is intentionally NOT implemented yet

This step does not implement:

- reducer behavior;
- action admissibility validation;
- effect resolution;
- request/choice handling;
- transport or UI adapters;
- format-specific action restrictions.

## 10. Summary

`rules-core` now has a formal action model with discriminated unions, explicit player/system actor semantics, gameplay-scoped references, and a small but real gameplay vocabulary. That gives the future engine a stable intent language for event, request, and reducer work.
