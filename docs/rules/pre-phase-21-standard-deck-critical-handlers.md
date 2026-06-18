# Pre-Phase 21 Standard Deck Critical Handlers

## 1. Purpose

Step 21.0.2B attaches the six fixed Standard decks to the activated-effect,
continuation, order, resource, and generic operation runtime from 21.0.2A.

This is not full Standard card-pool completion. It is the critical deck-handler
layer needed before 21.0.3 full-match integration tests.

Canonical decks remain fixed:

- Stoicheia - Reguregnus
- Dark States - Heartluru
- Keter Sanctuary - Youthberk
- Brandt Gate - Prison
- Dragon Empire - Vyrgilla
- Lyrical Monasterio - Kairi

## 2. Relationship To 21.0.2A Runtime Seam

The handlers added here use the 21.0.2A contracts:

- `card.activate_effect` for manual deck effects;
- `GamePieceState.effectDefinitionIds` as the card/content binding seam;
- declarative `choose.pieces` continuations for request-heavy effects;
- generic resource, call, bind, bounce, imprison, and order-zone operations;
- typed handlers for battle-phase replacement, rewrite, release, and
  count-based modifier effects;
- card-bound triggered effect collection for printed AUTO handlers.

The UI/session layer still receives authoritative state changes from
`rules-core`; no deck logic is implemented as a UI workaround.

## 3. Deck-By-Deck Implemented Critical Handlers

### Reguregnus

Implemented:

- `standard-slice.reguregnus.call-of-deep-lands`: choose up to two cards from
  drop, call them to open rear-guard circles, then place the source order in
  order zone.
- `standard-slice.reguregnus.drop-call`: energy-blast one, then choose and call
  one card from drop.
- `standard-slice.reguregnus.battle-replace`: counter-blast one, retire two
  rear-guards, ride a replacement from drop as stand, move the previous
  vanguard to soul, apply drive-minus flag, and keep active battle state
  coherent when the attacker changes.

Core loop now covered: drop as value source, order-zone persistence, battle
vanguard replacement, retire/CB costs, and active-battle state integrity.

### Heartluru

Implemented:

- `standard-slice.heartluru.soul-call`: energy-blast one, choose up to two
  cards from soul, and call them to open rear-guard circles.
- `standard-slice.heartluru.attack-thresholds`: card-bound battle AUTO that
  counts order-zone cards, gives power at two orders, stands one rear-guard at
  three, and gives critical at four.

Core loop now covered: order-zone count pressure, soul-to-board conversion,
energy payment, attack-time power/critical scaling, and restand pressure.

### Youthberk

Implemented:

- `standard-slice.youthberk.revoldress`: activate from hand/drop, bind the
  current vanguard, ride the RevolForm as stand, apply drive-minus flag,
  power, and critical.

Core loop now covered: battle-phase form replacement, bind instead of soul for
the previous vanguard, and vanguard modifier application.

### Prison

Implemented:

- `standard-slice.prison.capture`: opponent-card imprison flow through
  `choose.pieces`, including private-zone responder ownership.
- `standard-slice.prison.release`: opponent-owned imprisoned card can activate
  release and call itself to its owner's open rear-guard circle.
- `standard-slice.prison.seraph-attack`: card-bound battle AUTO that scales
  power by imprisoned count and grants critical at two imprisoned cards.

Core loop now covered: prison capture, opponent release, cross-owner zone
movement, prison count scaling, and request ownership for hidden hand choices.

### Vyrgilla

Implemented:

- `standard-slice.vyrgilla.rewrite`: activate from hand, bind the current
  vanguard, ride Rewrite Form as stand, bind the first opposing rear-guard,
  stand own rear-guards, and apply vanguard power.

Core loop now covered: hand-based rewrite, bind-zone vanguard replacement,
opponent board bind, and front-row pressure setup.

### Kairi

Implemented:

- `standard-slice.kairi.choice-bounce`: choose up to two own rear-guards and
  return them to hand.
- `standard-slice.kairi.replay`: energy-blast one, choose up to two hand cards,
  and call them to open rear-guard circles.
- `standard-slice.kairi.attack-sequence`: typed bounce/replay sequence that
  returns two rear-guards, calls the first available hand cards, and gives the
  called units power.
- `standard-slice.kairi.placed-power`: card-bound placed/ride power hook for
  the bounded slice.

Core loop now covered: bounce, replay from hand, open-circle calls, energy
payment, and power on replayed units.

## 4. Deferred / Out-Of-Slice Cards

Still intentionally deferred:

- Reguregnus: Athanasios delayed ride-back, exact grade/name filters, Orgady,
  Meydith, Gliaane, Rotting Usurp, Pense, Philander, Yolanda.
- Heartluru: full Happy Toys marker taxonomy, Toys order top-five split,
  order-zone rest costs, Ruby Rouge, Almethys, Arlim, Philya.
- Youthberk: Exist full text, Rebuild drive-set branch, Corino, Ednyfed,
  Nebula order, non-core Keter tech.
- Prison: full Galaxy Eternal payment menu, Clearlight/Purelight full text,
  ability suppression after release, Corner Citrus, Lifle Royar, Flawless Lila.
- Vyrgilla: full Alfknights granted attack ability, Galaxian/Ultimate Skill
  search, MateUnit legality, Stardust Blade, Blazing Star Cross branch.
- Kairi: Penelopp/Appeleile same-column triggers, Prism Pearl order,
  persona-sensitive end-turn bounce, Stille Nacht, Lucciel, Precia, Warmia,
  Desiel, Laterna, Octavia.

These are not claimed as complete in 21.0.2B. They remain bounded follow-up
work if 21.0.3 full-match tests prove a concrete blocker.

## 5. Coverage Matrix Update

| Deck       | Implemented                                                                                                | Bounded assumptions                                                                    | Deferred                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Reguregnus | Call from drop, order-zone placement, EB drop call, battle replacement, CB/retire, battle attacker rewrite | Replacement source is first eligible drop card in the bounded slice                    | Athanasios, exact filters, support package                   |
| Heartluru  | EB soul call, order-count attack thresholds, restand/power/critical                                        | Happy Toys identity is represented by source bindings/counts, not full marker taxonomy | Toys order full text, position-specific toy package          |
| Youthberk  | Revoldress replacement, bind previous vanguard, power/critical/drive flag                                  | One bounded RevolForm handler represents the critical battle form change               | Exist/Rebuild branches, Corino/Ednyfed/Nebula                |
| Prison     | Capture, release, prison count attack scaling                                                              | Release calls to first open owner rear-guard; full release payment menu deferred       | Galaxy menu, Purelight/Clearlight full support, suppression  |
| Vyrgilla   | Rewrite from hand, bind previous vanguard, bind opposing rear, stand own board                             | Opponent bind and stand choices are deterministic first/all for the slice              | MateUnit, Ultimate Skill orders, granted attack ability      |
| Kairi      | Choice bounce, EB replay, typed attack bounce/replay/power                                                 | Replay uses first open circles and bounded hand selection                              | Same-column restanders, Prism Pearl, persona end-turn branch |

## 6. Known Bounded Assumptions

- Triggered Standard slice effects are collected from card-bound
  `effectDefinitionIds`; they do not pollute global triggered candidates.
- Several critical handlers intentionally use deterministic first/open targets
  where the first playable slice does not require user-visible branching.
- Printed once-per-turn limits, exact phase legality metadata, full
  grade/name/card-tag filters, and complete end-turn delayed effects are not
  universalized in this step.
- The implementation proves deck-critical effect routes, not full-match win
  condition coverage across every pair. That is 21.0.3.

## 7. Summary

21.0.2B adds the first real deck-complete handler layer for the six Standard
targets. Each deck now has engine-owned critical handlers, request-heavy paths
where needed, and regression tests proving its signature loop through the
current runtime.

The next correct step is 21.0.3 full-match integration tests. Those tests should
validate whole-game continuity and identify any remaining card text that is
truly match-blocking rather than optional tech.
