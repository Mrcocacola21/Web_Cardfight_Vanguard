# Pre-Phase 21 Standard Target Decks

## 1. Purpose

Step 21.0.1 fixes the canonical Standard vertical-slice deck roster for the
next gameplay/content pass. This is not an effect implementation step. It is the
bounded planning input for effect completeness, deck-to-match flow, match UI,
realtime/session testing, and human playtests.

The target slice is final for this phase:

- Stoicheia - Reguregnus
- Dark States - Heartluru
- Keter Sanctuary - Youthberk
- Brandt Gate - Prison
- Dragon Empire - Vyrgilla
- Lyrical Monasterio - Kairi

No alternatives are in scope for 21.0.1.

## 2. Why These 6 Decks Were Fixed as the Standard Vertical Slice

These decks cover a narrow but high-signal Standard workload:

- battle-phase vanguard replacement and restanding: Reguregnus, Youthberk,
  Vyrgilla;
- set-order and order-zone state: Heartluru, Prison, Kairi, Reguregnus;
- opponent-card zone movement: Prison, Vyrgilla, Reguregnus;
- multi-step request chains with deck, drop, hand, soul, bind, order zone, and
  rear-guard choices;
- stateful power/critical/drive modifiers that must survive battle sequencing
  and realtime projection;
- UI pressure from target selection, zone readability, pending choices, and
  multi-attack turns.

The point is not to chase the whole Standard metagame. The point is to prove the
client can run a real, automatic Standard match loop for six fixed archetypes.

Primary VG-Paradox deck profile inputs:

- Reguregnus: https://vg-paradox.com/subpage/DeckInfo/ENG/D/ReguregnusTops
- Heartluru: https://vg-paradox.com/subpage/DeckInfo/ENG/D/HeartluruTops
- Youthberk: https://vg-paradox.com/subpage/DeckInfo/ENG/D/YouthberkTops
- Prison: https://vg-paradox.com/subpage/DeckInfo/ENG/D/PrisonTops
- Vyrgilla: https://vg-paradox.com/subpage/DeckInfo/ENG/D/VyrgillaTops
- Kairi: https://vg-paradox.com/subpage/DeckInfo/ENG/D/KairiTops

## 3. Canonical Deck Roster

| Nation             | Deck       | Representative reference list                                                                 | Why this list                                                                                                                                               |
| ------------------ | ---------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stoicheia          | Reguregnus | Denzel Tan, rank 4, Bushiroad Summer Festival 2026 Indonesia, June 6 2026, DeckLog `3P5CK`    | Recent Global Standard Reguregnus top with an accessible English DeckLog list.                                                                              |
| Dark States        | Heartluru  | Eric, rank 1, Bushiroad Summer Festival 2026 Indonesia, June 6 2026, DeckLog `704UP`          | Recent first-place Global Standard list with the full Heartluru toy/order package.                                                                          |
| Keter Sanctuary    | Youthberk  | zadijyne, rank 23, Bushiroad Summerfest 2026 Long Beach, May 24 2026, DeckLog `39XBZ`         | Latest accessible Global Standard Youthberk list from the VG-Paradox profile, using the current Rebuild/Exist shell.                                        |
| Brandt Gate        | Prison     | sf0z, rank 2, Bushiroad Summer Festival 2026 Indonesia, June 6 2026, DeckLog `75CNF`          | Recent high-rank Global Standard list with the current Clearlight/Eternal Prison package and Purelight top end.                                             |
| Dragon Empire      | Vyrgilla   | Remy1ch1, rank 5, Bushiroad Championship Series 25/26 Jakarta, March 29 2026, DeckLog `2QD1X` | Recent accessible Global Standard Vyrgilla list with Rewrite Form, Ezerwur, Ultimate Skill orders, and bind pressure.                                       |
| Lyrical Monasterio | Kairi      | Monkai, rank 2, Bushiroad Summerfest 2026 Long Beach, May 24 2026, DeckLog `29HYB`            | Latest accessible Global Standard Kairi list. Kairi stats on VG-Paradox are sparse/mixed, so this concrete Kairi DeckLog list is the canonical slice input. |

## 4. Deck Profiles

### 4.1 Stoicheia - Reguregnus

Reference list: https://decklog-en.bushiroad.com/view/3P5CK

Main deck:

- 3x Deeplands, Reguregnus
- 4x Deeplands, Reguregnus Athanasios
- 2x Rotting Usurp Dragon
- 4x Deeplands, Orgady
- 1x Mutual Feelings Maiden, Pense
- 3x Deeplands, Meydith
- 3x Deeplands, Gliaane
- 3x Conceited Noble, Philander
- 2x Unwavering Maiden, Yolanda
- 3x Lunar New Year of the Horse, 2026
- Trigger suite: 16 trigger units, including 1x Source Dragon Deity of
  Blessings, Blessfavor
- Orders/defense: 4x Call of Deep Lands, 1x Protection: Twincast,
  1x Elementaria Sanctitude

Ride deck:

- Deeplands, Meldeygo
- Deeplands, Grazkayne
- Deeplands, Zilgaan
- Deeplands, Reguregnus
- Energy Generator

Core cards:

- Ride line: Meldeygo, Grazkayne, Zilgaan, Reguregnus, Energy Generator.
- Boss loop: Deeplands, Reguregnus and Deeplands, Reguregnus Athanasios.
- Engine order: Call of Deep Lands.
- Must-have support: Deeplands, Orgady, Deeplands, Meydith, Deeplands,
  Gliaane.
- Resource/defense floor: energy, counter-blast, soul-blast, retire costs,
  sentinel/blitz order, overtrigger.

Mandatory effects:

- Play Call of Deep Lands from hand or drop with alternate cost, call up to two
  grade-bounded cards from drop, then either place the order in order zone or
  bind the played copy and modify the existing order-zone continuous boost.
- Track units placed from drop this turn by Reguregnus/Call of Deep Lands so
  order-zone continuous power applies correctly.
- Reguregnus ACT: energy-blast to call from drop.
- Reguregnus end-of-battle AUTO: counter-blast and retire two rear-guards, ride
  a different grade 3 Reguregnus from drop as stand, apply drive -2, and carry
  trigger power/critical increases from the previous vanguard to the new one.
- Athanasios on-place from Reguregnus: soul-blast, call base Reguregnus from
  drop, then delayed end-turn ride that unit as rest.
- Athanasios attack drive +1 when it was placed from drop and opponent is grade
  3 or greater.
- Ride-line search/discard setup for Call of Deep Lands and drop loading.

Optional tech:

- Rotting Usurp Dragon, Mutual Feelings Maiden, Pense, Philander, Yolanda, and
  the exact trigger-print spread can be represented as normal units/triggers
  until their card-specific effects become necessary.
- Flowering Sweet Shop or other non-reference Stoicheia tech is out of this
  first slice.

Mechanics/rule seams:

- Drop-zone as an active call/ride source.
- Normal orders playable from drop.
- Order-zone persistent state and same-name order counting.
- End-of-battle vanguard ride as stand.
- Trigger modifier transfer across vanguard replacement.
- Delayed end-turn ride-back effect.
- Multi-target cost payment: counter-blast, soul-blast, energy-blast, retire.
- Request-heavy drop selection, rear-guard selection, and open circle calls.

Testing role:

- Engine: proves battle-phase vanguard replacement, modifier transfer, delayed
  effects, and drop recursion.
- UI: stresses drop selection, order-zone visibility, trigger modifier
  continuity, and showing which Reguregnus is the current vanguard.
- Realtime/session: stresses revision churn during one battle, pending drop
  target choices, and recovery after chained ride/call/end-turn effects.

### 4.2 Dark States - Heartluru

Reference list: https://decklog-en.bushiroad.com/view/704UP

Main deck:

- 3x Sugary and Scary Land, Heartluru
- 4x Toys Monster, Blavyloss
- 4x Giant Fluffy
- 3x Fashion Doll, Ruby Rouge
- 4x Block Horse
- 4x Sparkly Bunny
- 1x Purple Jeweled Beast, Almethys
- 3x Steam Maiden, Arlim
- 2x Opener of Heart, Philya
- Trigger suite: 16 trigger units, including 1x Spiritual King of
  Determination, Olbaria
- Orders/defense: 4x Toys Are Made for Children, 1x Fire Regalis,
  1x Elementaria Sanctitude

Ride deck:

- Cute Teddy Bear, Titi
- Nutcracker Soldier, Nutcrumbs
- Coaster Shark
- Sugary and Scary Land, Heartluru
- Energy Generator

Core cards:

- Ride line: Titi, Nutcrumbs, Coaster Shark, Heartluru, Energy Generator.
- Boss: Sugary and Scary Land, Heartluru.
- Engine order: Toys Are Made for Children.
- Happy Toys package: Blavyloss, Giant Fluffy, Sparkly Bunny, Block Horse.
- Resource floor: soul setup, order-zone count, counter-blast, energy-blast.

Mandatory effects:

- `Happy Toys` marker/subtype must be queryable by effects.
- Multiple Toys Are Made for Children copies must persist in order zone and be
  countable by Heartluru.
- Toys Are Made for Children on-put: top-five search, reveal up to two Happy
  Toys, choose one to hand and send the rest to soul.
- Toys Are Made for Children order-zone ACT: rest two same-name orders and move
  a Happy Toys from drop to soul.
- Heartluru ACT: energy-blast and call Happy Toys from soul up to the order-zone
  count.
- Heartluru attack AUTO: graduated thresholds at two, three, and four orders,
  including front-row Happy Toys restands, power, drive +1, and opponent grade
  gate.
- Position-specific Happy Toys effects: left/right/front/back row restand
  triggers, guard restriction, retire-at-end-turn, and back-row intercept.
- Ride-line reveal-grade-3 search for Toys Are Made for Children.

Optional tech:

- Ruby Rouge, Almethys, Arlim, Philya, Fire Regalis, and exact trigger choices
  can defer until the toy/order core is playable.
- Non-reference Dark States draw/filter tech can defer.

Mechanics/rule seams:

- Set-order stacking and order-zone rest costs.
- Soul as a call source and Happy Toys staging zone.
- Position-sensitive rear-guard effects.
- Repeated battle-phase restands and guard restriction.
- Top-card search with split destinations: hand and soul.
- Counter-blast, energy-blast, soul-blast, and order-zone rest costs.

Testing role:

- Engine: proves order-zone counts, marker-based filtering, soul calls,
  position-aware continuous/AUTO effects, and restand sequencing.
- UI: stresses order-zone count display, soul selection, position labels, and
  showing restand/guard-restrict modifiers clearly.
- Realtime/session: stresses multi-request main phase setup followed by dense
  battle-phase restand chains.

### 4.3 Keter Sanctuary - Youthberk

Reference list: https://decklog-en.bushiroad.com/view/39XBZ

Main deck:

- 3x Youthberk "Skyfall Arms: Rebuild"
- 4x Youthberk "RevolForm: Exist"
- 1x Decisive Axe Dragon
- 4x Knight of Sworn Oath, Ednyfed
- 1x Exalted Dragon
- 4x Forefront Knight, Teithfallt
- 4x Cerrgaon
- 4x Bard of Brave Instrument, Corino
- 3x Palladium Zeal Dragon
- Trigger suite: 16 trigger units, including 1x Spiritual King of Aquatics,
  Idosfaro
- Orders/defense: 4x The Nebula Knight's Path to Reach for the Stars,
  1x Fire Regalis, 1x Elementaria Sanctitude

Ride deck:

- Unsullied Eyes, Youth
- Squire of Spear Streaks, Youth
- Sorrowful Ardent Light, Youth
- Youthberk "Skyfall Arms: Rebuild"
- Energy Generator

Core cards:

- Ride line: Unsullied Eyes, Squire, Sorrowful Ardent Light, Rebuild, Energy
  Generator.
- Boss loop: Youthberk "Skyfall Arms: Rebuild" and Youthberk "RevolForm:
  Exist".
- Must-have support: Ednyfed, Corino, Cerrgaon.
- Engine order: The Nebula Knight's Path to Reach for the Stars.

Mandatory effects:

- RevolDress from hand or drop at end of battle: ride RevolForm as stand,
  apply drive -2, and preserve battle-phase turn structure.
- Rebuild rode-upon-during-battle effect: discard from hand and set a vanguard's
  drive to 1 until end of turn.
- Rebuild replacement rule: when it rides over a grade 3 RevolForm, bind the
  unit rode upon instead of moving it to soul.
- Exist on-place by RevolDress: energy-blast to stand a rear-guard, apply
  front-row power based on bind-zone RevolForm presence, and apply critical +1
  if same-name Exist is bound.
- Exist end-turn ride-back from soul as rest.
- Corino: from deck placement or discard during turn, search deck/drop for
  RevolForm, then put a hand card into soul.
- Ednyfed: top-seven search with branch to hand or open-circle call, plus bind
  zone/vanguard Youthberk count power.
- Nebula order: playable from drop, bind itself, then top-seven grade-bounded
  call.

Optional tech:

- Decisive Axe Dragon, Exalted Dragon, Teithfallt, Palladium Zeal Dragon, Fire
  Regalis, and exact trigger-print variants can defer.
- Nebula Knight-specific second mode can defer unless a future Youthberk variant
  needs it.

Mechanics/rule seams:

- Battle-phase ride from hand/drop.
- Bind instead of soul replacement.
- End-turn ride-back from soul.
- Drive reduction and drive set-to-one effects.
- Bind-zone same-name/count checks.
- Search deck/drop, discard-triggered effects, and open-circle calls.
- Order playable from drop and self-bind resolution.

Testing role:

- Engine: proves RevolDress, battle-phase vanguard changes, bind replacement,
  and end-turn restoration.
- UI: stresses vanguard history, bind-zone readability, drive changes, and
  battle continuation after a new vanguard is placed.
- Realtime/session: stresses one battle producing multiple authoritative
  revisions and replay/recovery around pending hand/drop ride choices.

### 4.4 Brandt Gate - Prison

Reference list: https://decklog-en.bushiroad.com/view/75CNF

Main deck:

- 3x Aurora Fierce Princess, Seraph Purelight
- 2x Aurora Battle Princess, Seraph Clearlight
- 4x Aurora Battle Princess, Flawless Lila
- 1x Veirmeil Exordia
- 1x Aurora Battle Princess, Welt Khipple
- 4x Aurora Battle Princess, Corner Citrus
- 4x Security Upgrader
- 4x Aurora Battle Princess, Lifle Royar
- 3x Violate Dragon
- 3x Blitz Staff, Muna
- Trigger suite: 16 trigger units, including 1x Star Dragon Deity of Infinitude,
  Eldobreath
- Orders/defense: 1x Galaxy Eternal Prison, Galactolus, 1x Fire Regalis,
  2x Explosive! Melting Heart!, 1x Elementaria Sanctitude

Ride deck:

- Aurora Battle Princess, Ruby Red
- Aurora Battle Princess, Kyanite Cobalt
- Aurora Battle Princess, Risatt Peach
- Aurora Battle Princess, Seraph Clearlight
- Energy Generator

Core cards:

- Ride line: Ruby Red, Kyanite Cobalt, Risatt Peach, Seraph Clearlight, Energy
  Generator.
- Prison order: Galaxy Eternal Prison, Galactolus.
- Boss/top end: Seraph Clearlight and Seraph Purelight.
- Must-have support: Flawless Lila, Corner Citrus, Lifle Royar.
- Defense floor: Violate Dragon and current blitz/sentinel package.

Mandatory effects:

- Prison zone must hold opponent-owned cards under the Prison player's order
  zone, with ownership and controller projection preserved.
- Galaxy Eternal Prison must expose opponent release actions during their normal
  call timing: soul-blast one to call one imprisoned card, or counter-blast one
  to call two.
- Prison release must create explicit opponent choices and call to valid rear
  circles.
- Clearlight and support cards must imprison from rear-guard, drop, hand, and
  soul according to effect source.
- Clearlight attack thresholds must count imprisoned cards for power/drive and
  handle rear-guard self-to-soul plus draw.
- Clearlight soul-blast rider effect must suppress AUTO abilities from units
  called by Prison release until the relevant duration ends.
- Purelight placement must ask the opponent to choose cards from hand,
  rear-guards, and soul to imprison, then apply front-row power/critical scaling
  by imprisoned count.
- Corner Citrus/Lifle/Flawless Lila must cover imprison-on-place, draw, search,
  power, and restand thresholds.

Optional tech:

- Welt Khipple, Veirmeil Exordia, Blitz Staff Muna, Security Upgrader details,
  Explosive! Melting Heart!, Fire Regalis, and exact trigger spread can defer.
- Older Galaxy Central Prison lists are not the primary baseline for this slice.

Mechanics/rule seams:

- Opponent cards in your order-zone-hosted prison.
- Opponent-choice requests from private and public zones.
- Opponent release actions during normal call windows.
- Zone movement from prison to rear-guard with ability-suppression modifiers.
- Count-based continuous front-row power/critical.
- Grade 4 ride/top-end handling.
- High hidden-information pressure from hand-to-prison choices.

Testing role:

- Engine: proves a new shared zone model, opponent-card control, release costs,
  and count-based prison scaling.
- UI: stresses prison-zone readability, opponent card ownership, release
  affordances, and hidden/public target prompts.
- Realtime/session: stresses cross-player pending requests, private hand choice
  projection, and convergence after opponent-owned cards move through prison.

### 4.5 Dragon Empire - Vyrgilla

Reference list: https://decklog-en.bushiroad.com/view/2QD1X

Main deck:

- 4x Vyrgilla, "Rewrite Form: Alfknights"
- 2x Rewrite the Star, Vyrgilla
- 2x Flag-raising of Courage, Fanvare
- 4x Dragonvortex, Belligeacro
- 1x Opening of the End, Enwing
- 1x Dragritter, Miqdard
- 4x Ezerwur
- 4x Dragritter, Nirmihn
- 3x Stealth Dragon, Utsuroi
- 4x Stealth Fiend, Shenryi
- Trigger suite: 16 trigger units, including 1x Dragon Deity King of
  Resurgence, Dragveda
- Orders/defense: 1x Blazing Star Cross, 1x Stardust Blade,
  1x Protection: Twincast, 1x Defensing Roar, 1x Elementaria Sanctitude

Ride deck:

- Vyrgilla
- Rising Star, Vyrgilla
- Shooting Star, Vyrgilla
- Rewrite the Star, Vyrgilla
- Energy Generator

Core cards:

- Ride line: Vyrgilla, Rising Star, Shooting Star, Rewrite the Star, Energy
  Generator.
- Rewrite loop: Rewrite the Star, Vyrgilla and Vyrgilla, "Rewrite Form:
  Alfknights".
- Mate/unit pressure: Ezerwur, Fanvare, Nirmihn.
- Ultimate Skill order baseline: Stardust Blade first, Blazing Star Cross as
  follow-up if needed.

Mandatory effects:

- Rewrite Form from hand: bind the current Rewrite the Star on vanguard circle,
  ride Alfknights as stand, search deck/drop for a `Galaxian` and an Ultimate
  Skill card, and schedule end-turn ride-back of the bound card as rest.
- Alfknights temporary vanguard ability: when it attacks, counter-blast to stand
  all front-row rear-guards and gain drive +1.
- Alfknights front-row power modifier based on same-name cards in soul.
- Rewrite the Star ACT: energy-blast to bind an opponent rear-guard and call a
  grade 2 unit from drop.
- Rewrite the Star attack AUTO: counter-blast to stand a grade 2 rear-guard.
- Ezerwur `MateUnit` legality: cannot be ridden and can only be called/guarded
  with a Vyrgilla vanguard.
- Stardust Blade: order play cost, top-five grade-bounded call, temporary
  vanguard effects for replacement call after opponent retire and power by
  normal units on board/drop.
- Nirmihn: top-seven grade 3+ search and counter-charge if no hit.

Optional tech:

- Blazing Star Cross critical text, Enwing, Belligeacro, Utsuroi, Miqdard,
  Defensing Roar, Twincast, Fire/Regalis-style generic orders, and exact trigger
  printings can defer behind the Rewrite/Ezerwur loop.
- Full Ultimate Skill taxonomy can start as a card tag plus order subtype.

Mechanics/rule seams:

- Hand-activated vanguard replacement.
- Bind current vanguard as cost and delayed ride-back.
- Search deck/drop with two different target classes.
- Opponent rear-guard bind.
- Grade-2-specific call/stand targets.
- MateUnit legality.
- Temporary granted vanguard abilities.
- Front-row multi-stand pressure.

Testing role:

- Engine: proves hand-based transformation, opponent bind, granted abilities,
  MateUnit gates, and delayed vanguard restoration.
- UI: stresses bind-zone/vanguard-history clarity, front-row stand indicators,
  and displaying temporary granted effects.
- Realtime/session: stresses long command chains with deck/drop searches,
  opponent-zone movement, and battle-phase revision bursts.

### 4.6 Lyrical Monasterio - Kairi

Reference list: https://decklog-en.bushiroad.com/view/29HYB

Main deck:

- 3x Astesice△Live, Kairi
- 3x Loving Pink, Francette
- 3x Light in the Sea, Laterna
- 1x Amantes Amentes, Octavia
- 4x Resonance of Reflection, Appeleile
- 3x Seven Hues Bridge, Lucciel
- 3x Dazzle Bubble Paradise, Precia
- 4x Soaring Bubble, Penelopp
- 1x Best Served Hot, Warmia
- 1x Unwelcoming in Private, Desiel
- 1x Lunar New Year of the Horse, 2026
- Trigger suite: 16 trigger units, including 1x Spiritual King of Brightsky,
  Meridzanblia
- Orders/defense: 3x Prism Pearl & Twinkle Powder, 2x Stille Nacht,
  1x Fire Regalis, 1x Elementaria Sanctitude

Ride deck:

- Astesice, Mion
- Mermaid Idol, Sedna
- Top Idol, Aqua
- Astesice△Live, Kairi

The selected DeckLog export has four ride-deck cards. The slice still needs the
format energy resource because this Kairi list uses energy-blast effects; that
should be normalized by Standard setup if the deck snapshot lacks an explicit
Energy Generator entry.

Core cards:

- Ride line: Mion, Sedna, Aqua, Astesice△Live Kairi, plus Standard energy
  resource normalization.
- Boss: Astesice△Live, Kairi.
- Bounce/restand package: Penelopp and Appeleile.
- Search/value package: Prism Pearl & Twinkle Powder, Lucciel, Precia.

Mandatory effects:

- Kairi continuous modifier: rear-guards placed this turn get power while
  opponent is grade 3 or greater.
- Kairi attack AUTO: choose up to two rear-guards, return them to hand, pay
  counter-blast, call up to two hand cards to open rear circles, and apply drive
  +1 when the opponent is grade 3 or greater.
- Kairi end-turn AUTO: bounce one rear-guard, or two if persona ride happened.
- Penelopp and Appeleile must trigger when another front-row rear-guard is
  returned to hand by Kairi, then stand their columns with soul/energy costs.
- Appeleile search: reveal ride-deck Mermaid or check Mermaid vanguard, then
  top-seven search for Mermaid normal units or Prism Pearl & Twinkle Powder.
- Prism Pearl set order: back-row Mermaid boost and order-zone ACT power buff.
- Open rear-circle call selection and same-column stand resolution must be
  deterministic and UI-visible.

Optional tech:

- Stille Nacht, Fire Regalis, Elementaria, Lucciel Persona Shield ticket,
  Precia defensive draw/bounce, Warmia, Desiel, Laterna, Octavia, and exact
  trigger spread can defer after the Kairi bounce/call/restand loop works.
- Walbrigia or older Astesice x Live variants observed in sparse Kairi profile
  stats are intentionally not the first playable Kairi baseline.

Mechanics/rule seams:

- Return rear-guards to hand as cost/effect.
- Call from hand during battle to open circles.
- Placed-this-turn continuous modifiers.
- Same-column restand effects.
- Persona-ride-dependent end-turn scaling.
- Set-order boost granting and order-zone ACT.
- Energy-blast and counter-blast in a multi-step battle request.

Testing role:

- Engine: proves bounce/call/stand sequencing, open-circle validation,
  placed-this-turn tracking, and persona-sensitive delayed cleanup.
- UI: stresses board readability after units leave and re-enter, hand call
  requests, open-circle targeting, and same-column highlight.
- Realtime/session: stresses hidden hand choices, multiple battle-phase board
  mutations, and recovery after chained bounce/call/restand commands.

## 5. Effect Coverage Checklist by Deck

### Reguregnus

Must implement now:

- Call of Deep Lands from hand/drop, order-zone persistence, same-name order
  count, bind played copy, and placed-from-drop continuous boost.
- Reguregnus -> Athanasios battle-phase ride loop with drive -2, trigger
  modifier transfer, and end-turn ride-back.
- Drop calls, grade-bounded target filters, retire/CB/SB/EB costs.

Can defer:

- Non-core Stoicheia draw/filter support and exact generic defensive tech.
- Full alternate tech packages outside the reference list.

Nice later:

- Rich UI explanation for inherited trigger modifiers and delayed ride-back.

### Heartluru

Must implement now:

- Toys Are Made for Children set-order stack, on-put top-five split, order-zone
  rest cost, and Happy Toys marker queries.
- Heartluru soul-call and attack threshold resolution at two/three/four orders.
- Position-specific Happy Toys restand, power, critical, guard restriction, and
  back-row intercept basics.

Can defer:

- Ruby Rouge/Almethys/Philya/Arlim card-specific value effects.
- Exact trigger/defensive tech behavior beyond generic trigger/sentinel/blitz.

Nice later:

- UI affordances for left/right/front/back row effects before the player clicks
  targets.

### Youthberk

Must implement now:

- RevolDress from hand/drop, battle-phase vanguard ride as stand, drive -2,
  bind-instead-of-soul, and end-turn ride-back.
- Exist on-RevolDress effects: stand rear-guard, front-row power, critical, and
  bind-zone checks.
- Corino, Ednyfed, and Nebula order as the minimum search/call support.

Can defer:

- Teithfallt, Palladium, Decisive Axe, Exalted Dragon, and generic tech details.
- Nebula Knight-specific second order mode.

Nice later:

- Dedicated vanguard timeline UI for original unit, RevolForm, bind, soul, and
  ride-back state.

### Prison

Must implement now:

- Prison zone, Galaxy Eternal release actions, opponent-card ownership, and
  opponent target requests from hand/rear-guard/soul/drop.
- Clearlight/Purelight imprison effects, imprisoned-card count thresholds, and
  release ability-suppression.
- Corner Citrus, Lifle Royar, and Flawless Lila minimum imprison/draw/restand
  support.

Can defer:

- Welt Khipple, Veirmeil, Muna, Explosive! Melting Heart!, and exact generic
  defensive tech.
- Older Galaxy Central Prison package unless a future list is selected.

Nice later:

- High-polish prison panel with per-owner visibility, release preview, and
  count-derived modifier preview.

### Vyrgilla

Must implement now:

- Rewrite Form hand activation, bind-current-vanguard cost, Alfknights ride as
  stand, deck/drop search, granted vanguard restand ability, and end-turn
  ride-back.
- Rewrite the Star bind/call/stand effects and Ezerwur MateUnit legality.
- Stardust Blade as the first Ultimate Skill order.

Can defer:

- Blazing Star Cross critical branch, Enwing, Belligeacro, Utsuroi, Miqdard,
  Defensing Roar, and exact generic defensive tech.

Nice later:

- Full Ultimate Skill taxonomy and UI treatment for granted vanguard text.

### Kairi

Must implement now:

- Kairi attack bounce/call/drive flow, end-turn bounce, placed-this-turn power
  tracking, and persona-sensitive cleanup.
- Penelopp/Appeleile same-column restand triggers and costs.
- Prism Pearl & Twinkle Powder set-order basics and Standard energy resource
  normalization for the selected four-card ride-deck export.

Can defer:

- Stille Nacht, Lucciel ticket generation, Precia defensive mode, Warmia,
  Desiel, Laterna, Octavia, and exact trigger/defensive tech.

Nice later:

- Board animation and request grouping for bounce-to-hand followed by call-back
  during the same attack.

## 6. What Is Intentionally Out of Scope for This Slice

- V Premium and Premium deck selection.
- Replacing any of the six fixed decks with easier implementation targets.
- Full card-by-card implementation for every tech card in every reference list.
- Automatic metagame aggregation across all VG-Paradox tops.
- Japanese-only or image-only list reconstruction where an English DeckLog
  baseline exists.
- Productized tournament import or source syncing.
- Advanced UI polish beyond what is needed to make the six decks playable and
  debuggable.
- WebSocket/SSE fanout work unrelated to the current polling/session baseline.

## 7. Summary

The Standard vertical slice is now fixed to Reguregnus, Heartluru, Youthberk,
Prison, Vyrgilla, and Kairi.

Each deck has one concrete reference list, a minimum viable core, mandatory
effect workload, deferrable tech, mechanics/rule seams, and engine/UI/realtime
testing role. This closes the "we will choose decks later" gap and gives
21.0.2 through 21.0.6 an implementable workload instead of a meta overview.
