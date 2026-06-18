# Pre-Phase 21 Standard Full-Match Integration Tests

## 1. Purpose

Step 21.0.3 proves that the six fixed Standard decks are no longer only
handler-complete in isolation. The slice now has engine-level full-match
integration coverage through deck bootstrap, ready/start, mulligan, ride deck,
main phase actions, activated effects, request continuations, battle flow,
trigger resolution, damage checks, and match end.

This is not UI/e2e coverage and not a full Standard card-pool matrix. It is the
first full-match shield for the six-deck Standard vertical slice.

## 2. Slice Decks Under Full-Match Test

The tested roster is unchanged:

- Stoicheia - Reguregnus
- Dark States - Heartluru
- Keter Sanctuary - Youthberk
- Brandt Gate - Prison
- Dragon Empire - Vyrgilla
- Lyrical Monasterio - Kairi

No replacement decks are introduced in this step.

## 3. Deck Fixture Strategy

The integration suite lives in
`packages/match-session/src/standard-slice-full-match.test.ts`.

Each target deck has a compact Standard slice fixture made from:

- a real `DeckSnapshot`;
- a grade 0-3 ride deck;
- main-deck core pieces, triggers, orders, and fillers;
- `GameplayCard.effectRefs` bound to the Standard slice effect ids from
  `rules-core`;
- successful deck-backed match bootstrap through `createDeckBackedGameState`.

Fixtures are intentionally playable slice fixtures, not complete competitive
50-card reproductions. Deferred tech from 21.0.1/21.0.2B is not smuggled into
these tests.

## 4. Effect Binding In Full-Match Flow

The suite verifies the content-to-runtime binding in two ways:

- bootstrap assertion: every fixture's bound effect ids appear on runtime
  `GamePieceState.effectDefinitionIds`;
- live flow assertion: activated and triggered effects are reached through
  real `applyGameAction` / `applyGameChoiceResponse` reducer transitions,
  using the default core effect registry and handler registry.

This covers the route:

`GameplayCard.effectRefs -> deck bootstrap -> runtime piece effect ids ->
card.activate_effect / triggered event -> request continuation -> state change`.

## 5. Full-Match Scenario Categories

Covered categories:

- fixture assembly for all six decks;
- match ready/start from deck-backed state;
- mulligan request and response;
- ride-deck progression to grade 3 through `card.ride`;
- Standard order play through `card.play`;
- activated effects through card-bound effect ids;
- `choose.pieces` continuation during live match state;
- prison capture and release;
- bind, bounce, call, soul, drop, order-zone, and damage-zone movement;
- trigger request continuation from a drive check;
- damage check continuation after multiple triggers;
- battle declaration, guard pass, drive check, combat, damage, and battle
  completion;
- damage-defeat match completion through real battle aftermath.

## 6. Deck-By-Deck Scenario Coverage

| Deck       | Core-line scenario                                                                                                                        | Signature-line scenario                                                                                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reguregnus | Deck-backed Reguregnus vs Prison starts, mulligans, rides to grade 3, stages drop/damage through reducer moves, and plays through battle. | Call of Deep Lands pauses on drop selection, resumes to call two units and place the order; Reguregnus battle replacement fires during an active battle, changes the attacker, then drive trigger plus lethal damage completes the match. |
| Heartluru  | Heartluru vs Kairi plays four set orders, stages soul, pays energy, soul-calls two units, then completes a battle.                        | Heartluru attack threshold resolves from order-zone count, giving power, critical, and battle pressure in the same full-match flow.                                                                                                       |
| Youthberk  | Youthberk vs Vyrgilla starts from deck bootstrap, rides, enters battle, and completes combat after transformation.                        | Revoldress activates from hand, binds the previous vanguard, rides the RevolForm as stand, and applies power/critical before battle continuation.                                                                                         |
| Prison     | Prison fixture assembles and a Prison match captures opponent-owned cards through request continuation.                                   | Captured card release calls from prison to owner rear-guard, then Seraph attack scales power from remaining prison count inside battle flow.                                                                                              |
| Vyrgilla   | Vyrgilla vs Youthberk starts, rides, calls a rear-guard, stages opponent board, and completes battle.                                     | Rewrite Form activates from hand, binds the previous vanguard, binds an opposing rear-guard, stands own rear-guards, and keeps battle continuation valid.                                                                                 |
| Kairi      | Kairi vs Heartluru starts, rides, calls rear-guards, and completes battle.                                                                | Kairi bounce request returns two rear-guards, replay pays energy and calls from hand, then attack sequence bounces/replays and powers called units.                                                                                       |

## 7. Cross-Deck Matchup Coverage

Representative matchups now covered:

- Reguregnus vs Prison: full start-to-finish lethal scenario.
- Heartluru vs Kairi: order/soul/resource pressure against a bounce deck.
- Youthberk vs Vyrgilla: form-change deck against rewrite/bind deck.
- Vyrgilla vs Youthberk: rewrite deck as active player with opponent board
  interaction.
- Kairi vs Heartluru: bounce/replay deck against order-resource deck.

The Prison release scenario uses a Prison fixture on the opposing side to prove
the current release handler requirement that the imprisoned source card is bound
to `standard-slice.prison.release`. Other tests provide non-mirror cross-deck
coverage for the slice.

## 8. What Is Intentionally Still Out Of Slice

Still not covered here:

- full 6x6 matchup matrix;
- UI/browser e2e;
- AI-driven play;
- exact competitive 50-card list validation;
- every optional tech card from the VG-Paradox lists;
- full Energy Generator gain lifecycle;
- printed once-per-turn metadata and complete timing legality;
- full printed text for all deferred 21.0.2B cards;
- full-match proof for every possible trigger/defensive branch.

Energy is granted in tests as a bounded fixture precondition because the public
energy counter and `energy_blast` foundation exist, but energy generation is not
part of 21.0.3.

## 9. Summary

21.0.3 adds the first full-match integration shield for the Standard vertical
slice. The six target deck fixtures assemble, effect ids bind into live match
state, request continuations survive real match flow, battle/trigger/damage
chains complete, and at least one scenario ends by damage defeat through normal
battle aftermath.

The slice is now match-proven enough to move to the next stage of integration
work, with the bounded exclusions above kept explicit.
