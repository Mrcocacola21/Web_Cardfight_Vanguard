# Gameplay Abstraction Model

Status: Initial gameplay abstraction model  
Last updated: 2026-04-07

## 1. Overview

This document defines the gameplay abstraction model for the Cardfight!! Vanguard platform.

It exists to establish the foundational runtime concepts needed by future gameplay work without turning this step into a rules-engine implementation.

The model defines:

- `GameState`
- `PlayerState`
- runtime zones
- `CardInstance`
- `Action`
- `Event`
- effect registry and effect handlers
- timing
- priority
- replacement and continuous-effect placement
- circle and field topology

This document does not define:

- complete Vanguard gameplay rules
- concrete card implementations
- UI behavior
- catalog internals
- legality validation logic

The goal is to give `rules` a clean, event-driven, projection-based runtime abstraction that can grow without architectural drift.

## 2. Game State

### Decision: `GameState` Is Gameplay Truth During a Match

Decision:

- `GameState` is the authoritative source of truth for runtime match state inside gameplay.

Rationale:

- During a match, gameplay must have one authoritative state model for turn flow, zones, card instances, and pending resolution work.

Practical implication:

- UI may render from gameplay state.
- Catalog, legality, and web orchestration do not own runtime truth.

### State Shape

At minimum, `GameState` should contain:

- participating players
- current turn owner
- turn number
- current phase
- runtime card instances
- runtime zone ownership and contents
- pending event queue
- pending effect queue or equivalent resolution backlog

### Mutation Model

Decision:

- `GameState` should be treated as immutable at the architectural boundary, even if a future engine implementation uses controlled internal mutation for performance.

Rationale:

- The important rule is not "never mutate in memory."
- The important rule is "state changes only through explicit gameplay resolution flow."

Practical implication:

- No subsystem should patch runtime state ad hoc.
- All authoritative state changes must go through the same action and event pipeline.

## 3. Player State

### Decision: Each Player Owns Runtime Zones and Runtime Status

Decision:

- `PlayerState` is the gameplay-owned runtime representation of one player inside a match.

Rationale:

- Gameplay must reason per player about zones, resources, activity, and status.

Practical implication:

- Each player state should own the player's zone layout and player-specific runtime status.

### Player State Contents

At minimum, `PlayerState` should contain:

- gameplay player identity
- owned zones
- player status
  - active, waiting, defeated, or equivalent runtime state

Damage and soul are represented as runtime zones first. If summary counters exist, they must remain secondary derived conveniences rather than a second source of truth.

## 4. Zones

### Decision: Runtime Zones Are Typed and Separate

Decision:

- Gameplay zones must be explicit typed zones, not one undifferentiated container.

Rationale:

- Deck, hand, drop, damage, soul, field, ride deck, and G zone have different runtime semantics.

Practical implication:

- Runtime state must preserve zone identity explicitly.
- Effects and actions should target named runtime zones rather than infer meaning from list position.

### Baseline Zone Set

The baseline gameplay abstraction should be able to represent at least:

- `deck`
- `hand`
- `drop`
- `damage`
- `soul`
- `field`
- `ride-deck`
- `g-zone`
- `order-zone`

This is a baseline runtime vocabulary, not a claim that every format activates every zone.

### Zone Activation Rule

Whether a zone is active for a given match is determined by gameplay setup using:

- deck snapshot
- gameplay-facing catalog projection
- gameplay-facing format projection

## 5. CardInstance

### Decision: Gameplay Operates on Card Instances, Not Catalog Cards

Decision:

- Gameplay should use `CardInstance` as the runtime card object.

Rationale:

- A runtime object needs ownership, controller, location, and temporary state.
- Canonical catalog `Card` does not and should not carry runtime state.

Practical implication:

- Gameplay reads canonical card meaning through gameplay-facing projections.
- Gameplay stores match-specific facts on `CardInstance`.

### CardInstance Contents

At minimum, `CardInstance` should contain:

- instance identity
- canonical `CardId`
- owner
- current controller
- current zone
- orientation or rest/stand state where applicable
- face-up or visibility state where applicable
- temporary modifiers or similar runtime state

### Boundary Rule

`CardInstance` must not become:

- a raw catalog card clone
- a printing-level object
- a UI component state object

## 6. Actions

### Decision: Actions Represent Intent, Not State Mutation

Decision:

- A gameplay action is an intended operation proposed by a player or by the system.

Rationale:

- Actions capture what someone is trying to do.
- They are not themselves proof that the operation was valid or completed.

Practical implication:

- An action must be validated and resolved before it changes authoritative state.

### Baseline Action Categories

The gameplay abstraction should be able to represent at least:

- play card
- ride
- attack
- activate ability
- pass priority or equivalent no-op turn-flow action

These categories are baseline examples, not a closed final list.

## 7. Events

### Decision: Events Represent Facts That Occurred

Decision:

- A gameplay event is a fact that happened during resolution.

Rationale:

- Effects and triggered behavior should react to what happened, not to speculative intent.

Practical implication:

- Runtime systems should trigger off events, not off raw UI actions.

### Baseline Event Categories

The abstraction should be able to represent at least:

- card moved
- attack declared
- damage dealt
- ability activated
- turn advanced
- effect enqueued

These are baseline event families, not an exhaustive event taxonomy.

## 8. Action Flow

### Decision: Gameplay Uses Action -> Event -> State Flow

Decision:

- The canonical resolution flow is:
- action proposed
- action validated
- action resolved into events
- events applied to state
- resulting events and pending effects processed until the state stabilizes

Rationale:

- This separates intention, validation, fact production, and state transition.
- It also gives effect systems a clean place to react without mutating state ad hoc.

Practical implication:

- Actions do not mutate state directly.
- Event application is the authoritative state transition mechanism.

### Flow Detail

1. An action is submitted by a player or system flow.
2. Gameplay validates that the action is currently admissible in runtime state.
3. The resolver transforms the action into one or more events.
4. Events are applied to `GameState`.
5. Event-driven effects may enqueue additional effects or events.
6. The system continues until no pending events or effects remain.

## 9. Effect Registry

### Decision: Effect Resolution Must Use a Registry, Not CardId Switches

Decision:

- Gameplay must use an explicit effect registry that maps published effect references to effect handlers.

Rationale:

- Giant `switch(cardId)` or `if (cardId === ...)` logic does not scale, is hard to test, and couples runtime behavior directly to raw card identity branching.

Practical implication:

- The gameplay-facing catalog projection publishes `EffectRef`.
- The effect registry resolves those references to gameplay-owned handlers.

### Registry Role

The effect registry should:

- register known effect handlers
- map effect references to handler keys or handler instances
- provide one canonical lookup path from effect reference to runtime behavior

The registry must not:

- become a second catalog
- depend on printing identity
- rely on page-level logic to decide which handlers exist

## 10. Effect Handlers

### Decision: Effect Handlers Consume Context and Produce Further Resolution Work

Decision:

- An `EffectHandler` is a gameplay-owned abstraction that consumes gameplay context plus triggering input and emits further runtime work.

Rationale:

- Effects should react to game facts in a disciplined way.

Practical implication:

- An effect handler may emit new events, queue follow-up effects, or reject invalid activation in context.
- It should not be implemented as hidden UI code or catalog-side business logic.

### Handler Boundary

Effect handlers must not:

- live inside catalog data
- be hardcoded by card ID branching spread through the engine
- bypass the event pipeline by mutating state directly

## 11. Context Objects

### Decision: Gameplay Needs Explicit Context Objects

Decision:

- Gameplay abstractions should distinguish `GameContext`, `ActionContext`, and `EffectContext`.

Rationale:

- Different layers of runtime work need different scopes of information.

Practical implication:

- The engine can keep each abstraction narrow and avoid turning one giant mutable object into the universal API.

### Context Roles

`GameContext` should expose:

- current game state
- gameplay-facing format projection
- gameplay-facing card projection access
- effect registry

`ActionContext` should expose:

- game context
- proposed action
- action actor and optional action source

`EffectContext` should expose:

- game context
- source instance
- triggering action or triggering event
- effect reference identity

## 12. Event-Driven Model

### Decision: Gameplay Is Event-Driven by Default

Decision:

- The future gameplay engine should be event-driven by default.

Rationale:

- Triggered abilities, replacement behavior, queued resolution, and reactive mechanics are better modeled on top of facts and resolution queues than on direct imperative cross-calls.

Practical implication:

- Event emission and event application become first-class engine concepts.
- Effect logic subscribes to or handles relevant event categories instead of being invoked through arbitrary UI or page code.

### Event-Driven Rule

The engine should prefer:

- explicit event production
- explicit event application
- explicit pending-effect processing

It should reject:

- ad hoc direct state mutation
- UI-driven effect invocation
- giant card-specific conditional logic in central engine code

## 13. Timing Model

### Decision: Gameplay Needs Explicit Timing Structure Above Raw Event Emission

Decision:

- The gameplay model must recognize timing as an explicit runtime concept layered above raw phases and events.

Rationale:

- Vanguard gameplay depends not only on which phase exists, but also on when actions, auto abilities, and resolution windows are open.

Practical implication:

- Future runtime work should model:
  - turn phases;
  - timing windows inside those phases;
  - event-trigger points where effects become eligible to queue or resolve.

### Timing Model Baseline

At abstraction level, timing should distinguish:

- coarse turn phases
  - for example ride, main, battle, end;
- timing windows
  - moments in which specific action families or triggered effects may be processed;
- resolution windows
  - moments when pending effects or mandatory processing is handled before the game advances.

This document does not fix all official window names. It fixes the need for timing as a first-class gameplay abstraction.

### Timing Rule

Events may be emitted at any relevant point in resolution, but effect eligibility and further player choices must still respect the active timing window.

That prevents the engine from degenerating into:

- event happens;
- every possible handler fires immediately;
- page or caller code decides ordering informally.

## 14. Priority Model

### Decision: Runtime Choice Ownership Must Be Explicit

Decision:

- The gameplay model must explicitly represent priority or decision ownership for runtime choice flow.

Rationale:

- Actions and optional effects cannot be modeled safely unless the engine knows which player or system actor currently has the right to act or choose.

Practical implication:

- Future gameplay state should expose:
  - active player;
  - current decision owner when applicable;
  - pending choice or pending-resolution ownership.

### Priority Baseline

At domain level, priority should answer:

- who may currently propose an action;
- who must currently answer a required choice;
- whether the system is waiting on player input or on mandatory resolution;
- when control passes from one player to the other or back to system resolution.

Priority is not a UI affordance. It is gameplay truth.

## 15. Replacement and Continuous Effects

### Decision: Replacement and Continuous Effects Must Be First-Class Runtime Concepts

Decision:

- The gameplay model must reserve explicit conceptual space for replacement effects and continuous effects.

Rationale:

- Not all gameplay behavior can be modeled as simple event reaction after a fact occurs.
- Some effects alter how an event resolves or continuously modify state interpretation.

Practical implication:

- The event model should allow:
  - replacement evaluation before final event application where appropriate;
  - continuous state interpretation layers that affect legal actions, stats, or other derived runtime facts.

### Placement in the Resolution Flow

The abstraction should think in this order:

1. action intent
2. admissibility check in current timing and priority context
3. candidate event or state transition proposal
4. replacement-layer inspection when relevant
5. final event application
6. triggered and queued follow-up processing
7. continuous-state re-evaluation for derived gameplay facts

This is still abstract. It is enough to stop future engine work from assuming every effect is a post-event trigger only.

## 16. Circle and Field Topology

### Decision: `field` Is Not a Flat Runtime Area

Decision:

- The field must be understood as a structured topology, not as one generic list of in-play cards.

Rationale:

- Vanguard gameplay depends on where a unit is, not just that it is "on the field."

Practical implication:

- Future runtime state should be able to distinguish at least:
  - vanguard circle;
  - rear-guard circles;
  - order-related field occupancy when relevant.

### Baseline Field Topology

At abstraction level, the runtime model should support:

- one vanguard circle per player;
- multiple rear-guard circles per player;
- ride-deck-origin structures when enabled by format;
- G-zone-origin structures when enabled by format;
- order-zone or set-order occupancy where relevant.

This does not require full coordinate geometry now. It requires topology awareness.

### Topology Rule

If a runtime rule depends on where a card is positioned among active circles, that meaning belongs to gameplay state and gameplay field topology, not to catalog data or page layout.

## 17. Boundaries (Catalog / Legality)

### Decision: Gameplay Depends on Projections, Not Raw Catalog

Decision:

- Gameplay must consume only gameplay-facing projections and deck snapshot input, not raw catalog internals.

Rationale:

- Catalog truth and gameplay truth are different layers.

Practical implication:

- Gameplay reads canonical card identity and gameplay-relevant card facts through the gameplay-facing catalog projection.
- Gameplay reads runtime format meaning through the gameplay-facing format projection.

### Decision: Gameplay Does Not Own Legality

Decision:

- Gameplay must not validate deck construction or legality as part of runtime abstraction ownership.

Rationale:

- Admissibility before play is legality truth.
- Runtime state and runtime action validation are gameplay truth.

Practical implication:

- Gameplay setup may assume deck input has already crossed legality boundaries or has been admitted by a higher-level flow.
- Gameplay does not reinterpret bans, format eligibility, or restriction lists as part of ordinary runtime state transition logic.

## 18. Extensibility

### Decision: Extensibility Comes Through Registries, Projections, and Additive Runtime Vocabulary

Decision:

- The model must grow through additive handlers, additive event categories, additive action kinds, and additive projection data where justified.

Rationale:

- New cards, new mechanics, and new official formats should not require redesigning the gameplay core abstraction every time.

Practical implication:

- new cards enter through new `EffectRef` publications and handler registrations
- new mechanics enter through new event or handler families
- new formats enter through gameplay-facing format projection, not through raw format branching in engine internals
- richer field topology can be added later without collapsing all zones into one list today

### Anti-Patterns to Reject

- giant switch statements on `cardId`
- effect logic embedded in catalog types
- direct state mutation that bypasses action and event resolution
- UI-owned gameplay behavior
- dependence on raw catalog entities or printings
- legality logic mixed into runtime action resolution

## 19. Summary

The gameplay abstraction model of this project is built around these rules:

- `GameState` is gameplay truth during a match
- `PlayerState` owns player-specific runtime zone state and status
- runtime zones are explicit and typed
- gameplay operates on `CardInstance`, not on catalog entities directly
- actions represent intent
- events represent facts
- authoritative resolution follows `action -> event -> state`
- timing and priority are first-class runtime concerns
- replacement and continuous effects have explicit conceptual space in the model
- field topology is structured, not flat
- effect lookup goes through an explicit registry
- effect handlers consume context and produce further resolution work
- gameplay depends on gameplay-facing projections, not on raw catalog or legality internals

This gives the project a clean foundation for future rules-engine work without implementing the engine prematurely.
