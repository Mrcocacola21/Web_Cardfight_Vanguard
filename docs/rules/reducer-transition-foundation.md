# Reducer / Transition Foundation

## 1. Purpose

`packages/rules-core` now defines a single reducer / transition foundation for deterministic gameplay state evolution.

## 2. Why engine needs a single transition mechanism

The engine must have one domain-safe place where actions and choice responses are applied to `GameState`. Without that, state changes would spread across UI callbacks, ad hoc helpers, or runtime orchestration code, and determinism would degrade immediately.

## 3. Reducer / transition role

The reducer is the engine-level state evolution boundary. It accepts formal engine input, checks basic transition preconditions, returns a structured result, and stays independent from UI, DB, network, and browser concerns.

It is not:

- a React reducer;
- a transport handler;
- a DB mutation orchestrator;
- an event bus;
- a full effect engine;
- a format adapter.

## 4. Transition input/output contract

The reducer foundation now accepts two deterministic input kinds:

- `action`: `GameActionSubmission`
- `choice_response`: `GameChoiceResponseSubmission`

It returns a `TransitionResult` union with first-class outputs:

- applied result: `nextState`, emitted `events`, and resulting `pendingRequests`
- invalid result: unchanged `currentState`, failure `code`, and message
- blocked result: unchanged `currentState`, blocking requests, and message

## 5. Valid vs invalid vs blocked transitions

- `applied`: the reducer accepted the input and produced a new revision of `GameState`
- `invalid`: the input is structurally incompatible with the current engine state or not implemented by this foundation
- `blocked`: the engine is waiting on a pending request and cannot accept the new input yet

The current reducer treats pending requests as an ordered queue. New actions are blocked while a request is pending, except `match.concede`, and choice responses must resolve the head request first.

## 6. Relationship to state/action/event/request models

- `GameState`: source and result of every accepted transition
- action model: primary command input for gameplay intent
- event model: observable facts emitted by accepted transitions
- request/choice model: pending decision boundary and response continuation path

The reducer is the composition point between these layers without collapsing them into one contract.

## 7. Determinism guarantees

The reducer reads only its explicit inputs. It does not access time, random sources, browser APIs, DB state, or transport layers. Transition ids and emitted event ids are derived deterministically from current revision and input identity, so identical inputs produce identical results.

## 8. Internal organization choices

The implementation uses:

- one root reducer entrypoint;
- one action path and one choice-response path;
- small action-specific transition handlers;
- shared helpers for revision checks, result construction, and piece relocation.

This keeps the foundation extensible without introducing a premature framework.

## 9. What is intentionally NOT implemented yet

This step does not implement:

- full Vanguard rules legality
- effect resolution
- automatic continuation after complex multi-step requests
- full turn engine
- format-specific restrictions
- persistence, replay, or network orchestration

Only representative foundation transitions are implemented.

## 10. Summary

`rules-core` now has a real deterministic transition layer. It accepts engine inputs, produces structured applied/invalid/blocked results, integrates state/action/event/request contracts coherently, and gives future mechanics, validation boundaries, and format adapters a stable place to evolve game state.
