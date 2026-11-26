# Card Script Format (`vg-card-script/1`)

## 1. Model

The engine ships the rules and one generic interpreter. Card abilities are
**data**: one JSON script per card, authored and maintained outside the engine
(card database / community repository), the same split EDOPro uses between its
core and its card scripts.

- No TypeScript per card. Adding a card means adding a JSON file.
- Every player decision is an explicit step. When a step needs input, the
  engine pauses with a normal pending choice request, the client answers, and
  the script continues from where it stopped.
- A paused script is `pc + chosen pieces (+ step progress)` stored on
  `GameState.effectContinuations[].script`. AUTO abilities that triggered but
  wait behind it are stored on `GameState.pendingTriggers`. Both are plain
  JSON, so they survive the persisted match-session round trip.
- Scripts are validated before loading. Errors carry a JSON path, so authors
  can fix them without reading engine code.

Code lives in `packages/rules-core/src/scripts/`. Example cards (original
placeholders, not cards from any published game) are in
`packages/rules-core/src/scripts/examples/test-cards.ts` and exported as
`EXAMPLE_CARD_SCRIPTS`.

## 2. Where scripts are loaded

### In the web app

Put one JSON file per card in `apps/web/src/card-scripts/` and list it in
`apps/web/src/card-scripts/index.ts`. That is the only step:

- `apps/web/src/features/matches/engine/match-engine.ts` builds one runtime
  from `CARD_SCRIPTS` and the scripted engine adapters.
- The realtime route (`/api/matches/rooms/[roomId]/realtime`), local rooms,
  deck-to-match setup and client availability probes all use those adapters,
  so the client never disagrees with the server about what a card can do.
- The adapters keep the default adapter ids, so existing persisted rooms pick
  up scripts without migration. Each command binds scripted abilities to the
  room's cards by `cardDefinitionId` before it runs.

`CARD_SCRIPTS` ships empty: the engine contains no card content.

### From code

```ts
import { createScriptedMatchRoomEngineAdapters } from '@web-vg/match-session'
import { applyGameAction, createCardScriptRuntime } from '@web-vg/rules-core'

// Throws CardScriptLoadError (every issue, with card id and path) if invalid.
const runtime = createCardScriptRuntime(scripts, {
  random: seededRandom, // optional: shuffle source, defaults to Web Crypto
})

// Match rooms: pass these as `engineAdapters`.
const adapters = createScriptedMatchRoomEngineAdapters(runtime)

// Raw engine: bind once, then pass the options to every transition.
const state = runtime.bindCardScripts(initialState)
applyGameAction(state, submission, runtime.transitionOptions)

// "Available actions" panel: ACT abilities usable right now.
runtime.listActivatableAbilities(state, playerId)
```

An ACT ability is started with the existing `card.activate_effect` action,
using the id from `runtime.effectDefinitionIdsForCard(cardId)`.

## 3. Script shape

```json
{
  "format": "vg-card-script/1",
  "cardId": "test-tide-adept",
  "name": "Tide Adept",
  "abilities": [
    {
      "id": "drop-call",
      "type": "ACT",
      "zones": ["rear_guard_circle"],
      "oncePerTurn": true,
      "text": "[ACT](RC)[1/Turn]: [Soul Blast 1] Choose up to one grade 1 or lower card from your drop, and call it to (RC).",
      "cost": [{ "do": "soul_blast", "count": 1 }],
      "effect": [
        {
          "do": "choose",
          "as": "unit",
          "from": { "player": "self", "zone": "drop" },
          "filter": { "grade": { "lte": 1 } },
          "min": 0,
          "max": 1
        },
        { "do": "call", "target": "$unit" }
      ]
    }
  ]
}
```

### Ability types

| Type      | What it does                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------- |
| `AUTO`    | Triggers on an event (`on`). Runs `cost` then `effect`.                                                       |
| `ACT`     | The player starts it with `card.activate_effect` in their main phase, with no choice pending.                 |
| `CONT`    | Always on while `zones` and `condition` hold. `power` / `critical` steps only. Recomputed after every action. |
| `REPLACE` | "If this card would be retired, put it into X instead." Uses `replaces` + `instead`, optionally `zones`.      |

### Fields

| Field           | Applies to    | Meaning                                                                                   |
| --------------- | ------------- | ----------------------------------------------------------------------------------------- |
| `cardId`        | script        | Must equal `GamePieceState.cardDefinitionId` of the card.                                 |
| `id`            | all           | Ability id, unique within the card, `^[a-z][a-z0-9-]*$`.                                  |
| `on`            | AUTO          | `ride`, `call`, `attack`, `boost`, `guard`.                                               |
| `subject`       | AUTO          | Whose event: `this` (default), `other` (another card), `any`.                             |
| `subjectFilter` | AUTO          | With `other`/`any`: `player` (`self`/`opponent`), `zones`, `filter` on the event's card.  |
| `zones`         | all           | Zones this card must be in, e.g. `["vanguard_circle"]` for (VC). CONT defaults to VC/RC.  |
| `oncePerTurn`   | AUTO, ACT     | Usable once per turn per card. The flag clears at end of turn.                            |
| `optional`      | AUTO          | Ask "use it?" first. Required when an AUTO has a cost.                                    |
| `condition`     | AUTO/ACT/CONT | AUTO: does nothing if false. ACT: activation is refused. CONT: bonus is off while false.  |
| `cost`          | AUTO, ACT     | Steps paid first. ACT costs are checked before activation; an unpayable ACT cannot start. |
| `effect`        | AUTO/ACT/CONT | Steps run after the cost.                                                                 |
| `replaces`      | REPLACE       | `retire`.                                                                                 |
| `instead`       | REPLACE       | `hand`, `drop`, `soul`, `bind`, `deck_top`, `deck_bottom` (the card owner's zone).        |
| `text`          | all           | Rules text. Shown to players as the prompt of the ability's choices.                      |

## 4. Steps

"self" / "opponent" are always relative to the controller of the card.

| Step                             | Fields                                                                                           | Player decision                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `choose`                         | `as`, `from` (zone or list) **or** `among` (`$var`), `filter`, `min`, `max`, `chooser`, `prompt` | `choose.pieces`. In effects, does as much as possible if fewer cards exist. |
| `move`                           | `target`, `to`: `hand` `drop` `soul` `bind` `deck_top` `deck_bottom`                             | none. Goes to the **owner's** zone. Never moves a vanguard.                 |
| `retire`                         | `target`                                                                                         | none. Rear-guards only. REPLACE abilities can redirect it.                  |
| `call`                           | `target`                                                                                         | `choose.zone` with the open circles when more than one is open.             |
| `stand` / `rest`                 | `target`                                                                                         | none. Units on circles only.                                                |
| `power` / `critical`             | `target`, `amount`                                                                               | none. Until end of turn (CONT: while the condition holds).                  |
| `draw`                           | `count`, `player`                                                                                | none.                                                                       |
| `counter_blast`                  | `count`                                                                                          | which face-up damage, asked only when there is a real choice.               |
| `counter_charge`                 | `count`                                                                                          | which face-down damage, same rule.                                          |
| `soul_blast`                     | `count`                                                                                          | which soul cards, same rule.                                                |
| `soul_charge`                    | `count`                                                                                          | none (top of deck).                                                         |
| `energy_blast` / `energy_charge` | `count`                                                                                          | none. Energy caps at 10.                                                    |
| `look_top`                       | `count`, `as`                                                                                    | none. Stores the top N deck cards as `$as` (seen only by the chooser).      |
| `exclude`                        | `as`, `from` (`$var`), `minus` (`$var`)                                                          | none. "The rest": `from` without `minus`.                                   |
| `shuffle`                        | `player`                                                                                         | none. Uses the runtime random source; emits `zone.shuffled`.                |
| `if`                             | `cond`, `then`, `else`                                                                           | none.                                                                       |
| `may`                            | `then`, `prompt`                                                                                 | `confirm.boolean`.                                                          |
| `choose_one`                     | `options: [{ key, label, steps }]` (2+), `prompt`                                                | `choose.option`; the client shows `label` (falls back to `key`).            |

**Targets:** `source`, `my_vanguard`, `opponent_vanguard`, `$name` for pieces
stored by an earlier step, `$trigger` (AUTO: the card(s) the event is about),
or a group `{ "player": "self", "zone": "rear_guard_circle", "filter": {…} }`
for every matching card. The validator rejects a `$name` that is not stored
earlier on the same path.

**Filters** (`choose.filter`, `count.filter`, group targets,
`subjectFilter.filter`): `grade`, `power` (comparison objects, power includes
modifiers), `cardType`, `triggerType` (lists), `orientation` (`stand`/`rest`),
`faceUp` (damage), `excludeSource`.

**Conditions:** `all`, `any`, `not`,
`{ "count": { "player", "zone", "filter" }, "gte": 3 }`,
`{ "chosen": "name", "gte": 1 }`, `{ "turn": "self" }`, `{ "phase": "main" }`,
`{ "sourceIn": ["rear_guard_circle"] }`. Comparisons are `eq`, `gte`, `lte`,
`gt`, `lt`.

**Zones:** `hand`, `deck`, `drop`, `soul`, `damage`, `bind`, `order_zone`,
`rear_guard_circle`, `vanguard_circle`.

### Common patterns

Look at the top 3, take one, rest to the bottom:

```json
[
  { "do": "look_top", "count": 3, "as": "top" },
  { "do": "choose", "as": "pick", "among": "$top", "min": 0, "max": 1 },
  { "do": "move", "target": "$pick", "to": "hand" },
  { "do": "exclude", "as": "rest", "from": "$top", "minus": "$pick" },
  { "do": "move", "target": "$rest", "to": "deck_bottom" }
]
```

Search the deck, then shuffle:

```json
[
  {
    "do": "choose",
    "as": "found",
    "from": { "player": "self", "zone": "deck" },
    "filter": { "grade": { "eq": 0 } },
    "min": 0,
    "max": 1
  },
  { "do": "move", "target": "$found", "to": "hand" },
  { "do": "shuffle" }
]
```

"When another of your units is placed on (RC), it gets +2000":

```json
{
  "id": "ally-placed",
  "type": "AUTO",
  "on": "call",
  "subject": "other",
  "subjectFilter": { "player": "self", "zones": ["rear_guard_circle"] },
  "zones": ["rear_guard_circle"],
  "effect": [{ "do": "power", "target": "$trigger", "amount": 2000 }]
}
```

## 5. Rules behaviour

- **Several AUTO abilities from one event.** They resolve one by one. When one
  pauses for a choice, the rest are stored on `GameState.pendingTriggers` and
  resolve after the paused ability finishes, including after the room is
  saved and reloaded between requests. Before this, the others were dropped.
- **CONT** values live in `continuousPowerModifier` /
  `continuousCriticalModifier` on piece state. They are recomputed from scratch
  after every transition, so a bonus disappears as soon as its condition stops
  holding, and turn-end cleanup does not erase it. Combat reads them as
  `continuous_*` components; clients see one combined modifier.
- **REPLACE** rules are bound to the card instance
  (`GamePieceState.replacements`) and applied inside zone transfers, so every
  rules path that retires the card respects them. The moved card's reason
  becomes `replaced:retire`.
- Calling a card from a script emits `card.called`, so the called card's own
  "when placed" AUTO abilities trigger. The engine call transition also emits
  a `card.call` timing window; before this, "when placed on (RC)" abilities
  never triggered from a normal call.

### Battle flow on the server

- Clients may not send system actions. After every accepted participant
  command the realtime runtime runs the battle steps nobody decides
  (`advanceMandatoryMatchRoomFlow` → `resolveNextMandatoryBattleAction`):
  drive check (vanguard attacker), combat comparison, damage check, battle
  close. Each runs as a recorded system command and stops as soon as a player
  must answer something (e.g. a trigger choice).
- A **rear-guard hit** has no damage check. It is retired to its owner's drop
  when the battle closes (`battle.completed` reason `rear_guard_retired`,
  `retiredPieceIds`). The retire goes through zone transfers, so REPLACE
  abilities apply, and CONT power counts in the combat comparison.

## 6. Choices and safety

- Answers are checked twice: by the reducer (request type, eligible ids) and by
  the script (count, legality). An invalid answer leaves the request pending;
  the state does not change.
- Choices from hidden zones (deck, hand, `look_top`) are `responder-only`.
- Requests carry a `prompt` (the step prompt, else the ability `text`) and
  option `label`s; circle choices list `availableSlotIds` and the client
  answers with the slot.

## 7. Not supported yet

- Optional ("you may") replacement effects, and replacements for events other
  than retire.
- CONT effects other than power/critical (e.g. "cannot be hit by…", keyword
  grants), and CONT applied mid-transition (it is recomputed after each one).
- AUTO triggers beyond ride/call/attack/boost/guard: drive/damage check, end
  of turn, "when put into soul / retired / hit".
- Choosing card order (e.g. "put them on the bottom in any order").
- Drawing from an empty deck draws what remains; the script does not cause a
  deck-out loss.
- A paused script resumes by program counter. A match must keep the same
  script version from start to finish; scripts should be versioned per match.
- The multiplayer match UI still offers no ride / call / attack / boost /
  ACT buttons (only ready, end turn, concede and answering requests), so a
  battle cannot be started from the browser yet. The engine and server
  support these actions; the client controls are missing.
