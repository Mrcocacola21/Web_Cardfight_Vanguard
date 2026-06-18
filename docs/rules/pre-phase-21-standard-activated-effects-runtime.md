# Pre-Phase 21 Standard Activated Effects Runtime

## 1. Purpose

Step 21.0.2A adds the missing Standard capability layer that must exist before
the six fixed decks can be completed card-by-card.

This is not the deck-specific effect implementation pass. It makes activated
card effects, card/content bindings, request continuations, Standard order play,
and bounded generic movement/resource operations real engine-owned runtime
contracts.

## 2. Why Playable Completeness Was Blocked

The 21.0.2 pass established that the six-deck slice was not blocked by a few
missing handlers. The shared runtime could not yet express core Standard
behaviors:

- a player-initiated action for printed activated effects;
- binding a runtime piece to effect ids imported from card content;
- pausing an effect on `choose.*` and resuming the same effect flow;
- playing Standard orders through `card.play`;
- reusable operations for search, call, retire, bind, bounce, prison, order
  zone, and energy costs.

Without those seams, Reguregnus, Heartluru, Youthberk, Prison, Vyrgilla, and
Kairi would each require ad hoc runtime code before their actual card text could
be implemented.

## 3. Activated Card Effect Action Model

Activated effects are now first-class player actions:

- action type: `card.activate_effect`;
- actor: player;
- payload: `sourcePieceId` and `effectDefinitionId`;
- reducer path: `applyGameAction` -> activated-effect transition;
- default registry: core rules effect registry;
- optional runtime injection: `RuntimeTransitionOptions.activatedEffects`.

The transition rejects activations when the match is not in progress, the actor
does not exist, the source is not a runtime card piece, the actor does not
control the source, the effect id is unknown, the effect id is not bound to the
source piece, or the effect is not a manual activated effect.

Card-specific phase windows, once-per-turn flags, named costs, and other
printed legality clauses remain handler-level work for 21.0.2 deck completion.

## 4. Card/Content Effect Binding Seam

Deck bootstrap now maps `GameplayCard.effectRefs` into
`GamePieceState.effectDefinitionIds`.

That keeps catalog/importer concerns outside `rules-core` while giving the
runtime an authoritative source-to-effect binding:

- content owns effect reference ids;
- match bootstrap copies those ids to runtime pieces;
- `card.activate_effect` can only activate an id bound to its source piece;
- the effect registry resolves the id to executable runtime metadata.

Future deck-specific handlers plug in by registering effect definitions and
binding the imported card refs to those definitions.

## 5. Generic Continuation After `choose.*`

Declarative activated effects can now pause on `choose.pieces` and resume after
the matching choice response.

The continuation is serializable in `GameState.effectContinuations`:

- `continuationId`;
- pending `requestId`;
- source action, source piece, effect definition, actor player;
- current operation index;
- operation kind list for final resolution events.

On response, the reducer consumes the pending request, validates the response
through the existing request model, removes the continuation, resumes the same
operation list, emits `choice.response_resolved`, applies the remaining
operations, and emits `effect.resolved`.

## 6. `card.play` For Standard Orders

`card.play` is now exposed by the Standard adapter and implemented in the core
reducer for Standard order cards.

Current behavior:

- source and destination zones must belong to the acting player;
- the played piece must be an order card in `cardStats`;
- set orders move to `order_zone`;
- normal/blitz orders may move to `drop` or `order_zone`;
- the engine emits `piece.moved` and `card.played`;
- the transition creates `card.play` timing windows.

This is enough for the slice to stop treating orders as UI-side or manual
state changes. Card-specific order effects still resolve through activated or
triggered handlers.

## 7. Generic Effect Ops Added

The activated runtime now supports this bounded declarative operation set:

- `search`: select cards from a source zone and move them to another zone;
- `call`: select cards from a zone and call them to first open rear-guard
  slots;
- `retire`: move selected cards to owner drop;
- `bind`: move selected cards to owner/source/opponent bind;
- `bounce`: move selected cards to owner hand;
- `imprison`: move selected cards to the source controller's prison zone;
- `move_source_to_order_zone`: place the source piece into the source
  controller's order zone;
- resource ops: Counter Blast, Counter Charge, Soul Blast, Soul Charge, and
  Energy Blast.

Each non-trivial selection supports either deterministic first selection or a
real `choose.pieces` request with continuation.

## 8. Prison / Order Zone / Energy Foundation Status

Prison: Standard bootstrap creates a public player-owned `prison` zone, generic
`imprison` moves selected cards there without rewriting owner/controller, and
existing zone transfer state remains authoritative. Prison release actions,
release costs, and ability suppression are not implemented yet.

Order zone: Standard bootstrap creates `order_zone`; `card.play` can move set
orders there; generic `move_source_to_order_zone` supports order-zone
placement from effects. Persistent card-specific order auras and rest-cost
semantics are still deck-handler work.

Energy: Standard bootstrap creates a public `energy` counter. `energy_blast`
now decrements that counter and emits `resource.energy_blasted`. Energy gain and
full Energy Generator lifecycle are not implemented in this step.

## 9. What Is Intentionally Not Implemented Yet

- No Reguregnus, Heartluru, Youthberk, Prison, Vyrgilla, or Kairi card-specific
  handlers were completed here.
- No universal future-card scripting DSL was added.
- No UI/session shortcut owns gameplay consequences.
- No full Standard card pool support is implied.
- No full prison release/suppression system is implemented.
- No complete order framework for every printed order subtype is implemented.
- No per-card activation limits, named once-per-turn tracking, or full timing
  legality metadata is implemented yet.
- No full-match integration suite is added here; that remains 21.0.3.

## 10. Summary

21.0.2A closes the missing activated-effect runtime seam:

- activated effects are real player actions;
- content effect refs bind to runtime pieces;
- generic choices can pause and resume effect execution;
- Standard orders can be played through the reducer;
- bounded generic operations cover the shared movement/resource workload;
- prison, order zone, and energy now have usable runtime foundations.

After this step, deck-by-deck critical handler implementation for the six fixed
Standard decks is practical. The six decks are still not playable-complete until
those card-specific handlers are implemented and tested.
