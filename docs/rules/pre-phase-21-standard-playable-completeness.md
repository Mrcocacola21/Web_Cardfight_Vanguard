# Pre-Phase 21 Standard Playable Completeness

## 1. Purpose

Step 21.0.2 is the implementation pass that should turn the fixed six-deck
Standard slice into real playable decks. This document records the current
engine-backed scope after the first grounded implementation pass.

Current verdict: the slice is not yet playable-complete. The repo now has the
Standard zone/resource foundation needed by the slice, but the six target decks
still require card content, activated effect dispatch, effect continuations
after choices, and card-specific handlers before a full match can be played
without manual rulings.

## 2. Canonical 6-Deck Slice

The target roster remains fixed:

- Stoicheia - Reguregnus, DeckLog `3P5CK`
- Dark States - Heartluru, DeckLog `704UP`
- Keter Sanctuary - Youthberk, DeckLog `39XBZ`
- Brandt Gate - Prison, DeckLog `75CNF`
- Dragon Empire - Vyrgilla, DeckLog `2QD1X`
- Lyrical Monasterio - Kairi, DeckLog `29HYB`

No deck substitutions are in scope.

## 3. Deck-by-Deck Playable Scope

### Reguregnus

Core loop cards: Deeplands, Reguregnus; Deeplands, Reguregnus Athanasios; Call
of Deep Lands; Orgady; Meydith; Gliaane.

Mandatory rideline: Meldeygo, Grazkayne, Zilgaan, Reguregnus, Standard energy
resource.

Must-have effects: Call of Deep Lands from hand/drop, order-zone persistence,
drop calls, placed-from-drop power, Reguregnus end-of-battle ride from drop,
drive -2, trigger modifier transfer, Athanasios call/ride-back loop, CB/SB/EB
and retire costs.

Required interactions: order zone, drop as call/ride source, bind, end-of-battle
vanguard replacement, delayed end-turn ride-back, modifier transfer.

Status: not playable. Shared order zone, bind zone, generic movement, CB/SB, and
battle basics exist; card-specific Reguregnus effects do not.

### Heartluru

Core loop cards: Sugary and Scary Land, Heartluru; Toys Are Made for Children;
Blavyloss; Giant Fluffy; Sparkly Bunny; Block Horse.

Mandatory rideline: Titi, Nutcrumbs, Coaster Shark, Heartluru, Standard energy
resource.

Must-have effects: Happy Toys marker queries, Toys set-order stack, top-five
split to hand/soul, order-zone rest cost, Heartluru soul call, attack threshold
restands/power/drive, position-specific Happy Toys abilities.

Required interactions: order-zone counts, order-zone rest costs, soul calls,
marker filtering, position-aware restands, guard restrictions.

Status: not playable. Order zone and energy counter now exist; marker queries,
set-order effects, and Heartluru/Happy Toys handlers do not.

### Youthberk

Core loop cards: Youthberk "Skyfall Arms: Rebuild"; Youthberk "RevolForm:
Exist"; Ednyfed; Corino; Cerrgaon; Nebula order.

Mandatory rideline: Unsullied Eyes, Squire, Sorrowful Ardent Light, Rebuild,
Standard energy resource.

Must-have effects: RevolDress from hand/drop, battle-phase ride as stand, drive
-2, bind-instead-of-soul replacement, Exist on-RevolDress stand/power/critical,
end-turn ride-back from soul, Corino/Ednyfed/Nebula search and call support.

Required interactions: battle-phase vanguard change, bind replacement, drive
modification, search deck/drop, discard-triggered flow, order playable from
drop.

Status: not playable. Existing generic ride/combat/bind primitives are
insufficient because RevolDress and its replacement/delayed effects are absent.

### Prison

Core loop cards: Galaxy Eternal Prison, Galactolus; Seraph Clearlight; Seraph
Purelight; Corner Citrus; Lifle Royar; Flawless Lila.

Mandatory rideline: Ruby Red, Kyanite Cobalt, Risatt Peach, Seraph Clearlight,
Standard energy resource.

Must-have effects: prison zone holding opponent-owned cards, opponent release
actions, release choices and costs, imprison from hand/rear-guard/drop/soul,
Clearlight/Purelight imprisoned-count scaling, release ability suppression,
support imprison/draw/search/restand.

Required interactions: opponent-owned cards in a player-owned prison zone,
opponent private/public choices, prison-to-rear-guard release, ability
suppression, grade 4 handling.

Status: partially founded, not playable. Standard bootstrap now creates a
public `prison` zone and tests prove opponent-owned cards can be moved into it
without rewriting owner/controller. Prison card effects, release actions, and
private-choice imprison flows are still missing.

### Vyrgilla

Core loop cards: Rewrite the Star, Vyrgilla; Vyrgilla, "Rewrite Form:
Alfknights"; Ezerwur; Fanvare; Nirmihn; Stardust Blade.

Mandatory rideline: Vyrgilla, Rising Star, Shooting Star, Rewrite the Star,
Standard energy resource.

Must-have effects: hand-activated Rewrite Form, bind current vanguard, ride
Alfknights as stand, deck/drop search for Galaxian and Ultimate Skill, granted
attack ability, front-row restand, end-turn ride-back, opponent rear-guard bind,
drop call, Ezerwur MateUnit legality.

Required interactions: hand activation, opponent bind, delayed vanguard
restoration, granted temporary abilities, grade-specific call/stand, order play.

Status: not playable. Bind and generic movement exist; Rewrite Form, MateUnit,
Ultimate Skill orders, and temporary granted abilities do not.

### Kairi

Core loop cards: Astesice Live Kairi; Penelopp; Appeleile; Prism Pearl &
Twinkle Powder; Lucciel; Precia.

Mandatory rideline: Mion, Sedna, Aqua, Kairi, Standard energy resource.

Must-have effects: placed-this-turn power, attack bounce/call/drive +1 flow,
end-turn bounce, persona-sensitive bounce count, Penelopp/Appeleile same-column
restand triggers, Prism Pearl set-order boost and ACT power.

Required interactions: bounce to hand, battle-phase call from hand to open
circles, placed-this-turn tracking, same-column restand, order-zone ACT,
counter-blast and energy-blast.

Status: not playable. Order zone and energy counter now exist; Kairi
bounce/call/restand handlers and placed-this-turn tracking do not.

## 4. What Was Implemented

- Standard deck-backed bootstrap now creates a public `order_zone` for each
  player.
- Standard deck-backed bootstrap now creates a public `prison` zone for each
  player.
- Standard deck-backed bootstrap now initializes a public `energy` counter at
  `0` for each player, independent of whether a DeckLog export contains an
  Energy Generator entry.
- Rules-core Standard zone constants now expose `order_zone` and `prison`.
- Regression tests now prove:
  - Standard bootstrap includes order zone, prison zone, and energy counter.
  - A player-owned prison zone can hold an opponent-owned card via the engine
    zone transfer primitive while preserving owner/controller fields.

Existing foundation confirmed during this pass:

- normal ride/call, generic zone movement, bind/drop/soul/damage zones;
- battle declaration, guard, drive/damage checks, trigger resolution;
- materialized power/critical modifiers consumed by combat;
- Persona Ride and Twin Drive foundation effects;
- counter-blast, counter-charge, soul-blast, and soul-charge operations.

## 5. What Was Intentionally Excluded/Deferred

Deferred optional tech from 21.0.1 remains out of scope: non-core support cards,
exact trigger print variants, generic defensive tech beyond current engine
basics, and alternate archetype packages.

Critical work not implemented yet because it requires missing runtime/content
seams:

- target card content for these six reference lists;
- effectRefs/effect definitions for the target cards;
- player action for activating card abilities;
- Standard `card.play` implementation for orders;
- energy-blast as a resource operation;
- generic effect operations for search, call, retire, bind, bounce, ride, and
  move-to-order-zone/prison;
- continuation model for arbitrary card effects after `choose.*` responses;
- card-specific handlers for Reguregnus, Heartluru, Youthberk, Prison,
  Vyrgilla, and Kairi.

## 6. Effect Coverage Matrix

| Deck       | Implemented                                                          | Implemented with bounded assumptions                                          | Missing critical effects                                                                             | Deferred optional tech                                                                |
| ---------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Reguregnus | order zone, bind/drop zones, generic movement, CB/SB basics          | energy exists as a counter only                                               | Call of Deep Lands, drop ride/call loop, Athanasios, modifier transfer, EB, retire-cost effect flow  | Rotting Usurp, Pense, Philander, Yolanda, exact defenses                              |
| Heartluru  | order zone, soul zone, CB/SB basics, energy counter                  | order-zone rest cost not implemented; only the zone exists                    | Toys set-order effects, Happy Toys tags, soul-call, threshold restands, position effects             | Ruby Rouge, Almethys, Arlim, Philya, exact defenses                                   |
| Youthberk  | bind/soul/drop zones, normal ride, combat basics                     | battle-phase ride would require effect-owned movement, not player `card.ride` | RevolDress, bind-instead-of-soul, Exist, ride-back, Corino, Ednyfed, Nebula order                    | Teithfallt, Palladium, Decisive Axe, Exalted Dragon                                   |
| Prison     | prison zone, opponent-owned card can occupy prison, generic movement | imprison test uses system movement, not a card effect or opponent request     | Galaxy release, Clearlight/Purelight, private-choice imprison, ability suppression, support handlers | Welt, Veirmeil, Muna, Explosive, exact defenses                                       |
| Vyrgilla   | bind zone, generic movement, combat basics, energy counter           | none of the Rewrite loop is effect-backed yet                                 | Rewrite Form, Alfknights, MateUnit legality, Stardust Blade, opponent bind/call/stand                | Blazing Star Cross branch, Enwing, Belligeacro, Utsuroi, Miqdard                      |
| Kairi      | order zone, hand/rear zones, energy counter, generic movement        | bounce/call can only be manual system movement today                          | Kairi attack/end-turn effects, Penelopp/Appeleile, Prism Pearl, placed-this-turn tracking, EB        | Stille Nacht, Lucciel ticket, Precia defensive mode, Warmia, Desiel, Laterna, Octavia |

## 7. Known Bounded Assumptions

- `energy` is currently represented as a public player counter initialized to
  `0`; there is no Energy Generator lifecycle or energy-blast operation yet.
- `prison` is a public player-scoped multi zone. This is enough for ownership
  and projection foundations, but not enough for Galaxy Eternal release timing.
- `order_zone` is a public ordered multi zone. Set-order play, order-zone rest
  costs, and same-name order counts still need effect/runtime work.
- The current effect runtime resolves automatic triggered effects only; manual
  activated abilities are represented in types but are not exposed as playable
  actions.
- Generic `choose.*` requests can be validated and consumed, but arbitrary
  card-effect continuations after the response are not implemented.

## 8. Summary

21.0.2 is not honestly closed as playable completeness. This pass converted
three shared Standard blockers into engine state (`order_zone`, `prison`, and
`energy`) and added regression coverage for the Prison ownership seam.

The next implementation pass should not start with more deck selection. It
should add the missing runtime seam for activated/card effects and request
continuations, then implement the six decks' critical handlers against the
fixed scope above.
