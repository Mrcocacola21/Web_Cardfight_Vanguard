# Event Model Foundation

## 1. Purpose

`packages/rules-core` now defines a gameplay event model for domain facts. Events are the language of observable consequences that future reducer, trigger, and effect layers will produce and observe.

## 2. Why engine needs events

The engine must distinguish between what was attempted and what actually happened. Actions express intent. Events express resulting facts such as a card moving, a phase advancing, or an attack being declared.

## 3. Event vs action

- Action: domain command or intent.
- Event: past-tense domain fact.

Example:

- action: `battle.declare_attack`
- event: `battle.attack_declared`

That separation keeps the engine honest about validation and resolution.

## 4. Event vs request/choice

Events describe facts that already happened. Requests and choices will later describe questions the game still needs answered. An event is never a prompt.

## 5. Event categories

The current event foundation includes:

- match events: started, ended;
- turn events: started, ended, phase advanced, step advanced;
- piece event: moved;
- card events: played, rode, called;
- battle events: attack declared, guard declared;
- player resource events: counter changed, flag changed.

## 6. Relationship to `GameState`

Events use the same gameplay identities as the state model:

- `PlayerId` for match-scoped players;
- `PieceId` for runtime pieces;
- `ZoneId` and `ZoneSlotId` for gameplay locations.

This keeps events compatible with `GameState`, `PlayerState`, and `ZoneState` without leaking collection printings, persistence ids, or UI payload semantics.

## 7. Relation to reducer/effects

The future reducer layer should accept an action, evolve `GameState`, and emit ordered events. The future effect layer should observe those events as trigger input. The current event model is designed as that reducer output and trigger observation surface.

## 8. Granularity decisions

The model uses a middle-ground granularity:

- a generic `piece.moved` event exists for broad movement observation;
- more specific facts such as `card.played`, `card.rode`, `card.called`, and `battle.attack_declared` also exist when gameplay meaning matters.

Sequence numbers are included so future transitions can return ordered multi-event results without needing a full event pipeline yet.

## 9. Not implemented

This step does not implement:

- effect resolution;
- event bus infrastructure;
- persistence or replay protocols;
- network event payloads;
- full reducer behavior;
- complete Vanguard trigger taxonomy.

## 10. Summary

`rules-core` now has a coherent event model with past-tense gameplay facts, explicit origins, gameplay-scoped identifiers, category-level vocabulary, and ordered transition compatibility. That is enough to support the upcoming request/choice and reducer foundations without semantic rewrite.
