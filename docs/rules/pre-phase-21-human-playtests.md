# Pre-Phase 21 Human Playtests

## 1. Purpose

Step 21.0.5 prepares the Standard vertical slice for real human matches. The goal is not to claim that tests prove playability. The goal is to give two players and one operator a repeatable way to run matches, observe friction, and turn findings into a triage-ready backlog.

No real human matches are claimed by this document. This step creates the playtest framework.

## 2. Why automated tests were not enough

The current automated coverage proves important seams: deck-backed setup, Standard slice handlers, full-match integration flows, projection-safe multiplayer rendering, stale/recovery handling, and the playmat UI. Those tests still cannot answer whether a person understands what to do under pressure.

Human playtests must specifically look for:

- legal actions that are technically present but hard to find;
- request prompts that read correctly in tests but confuse players;
- battle, trigger, resource, prison, bounce, and rewrite flows that become unclear on the board;
- optimistic, stale, timeout, and recovery states that make players think an action was lost;
- missing or bounded card/effect behavior that blocks real decisions.

## 3. Chosen playtest path

Canonical path for real playtests: `/matches/play/[roomId]`.

This is the persisted, authenticated, participant-projected multiplayer route. It loads authoritative room state from persisted match-session storage, resolves the signed-in participant, renders participant-safe projected state, and submits actions through `POST /api/matches/rooms/[roomId]/realtime`.

`/matches/play/local` remains useful for smoke checks and UI demos, but it is not the official human playtest path because it creates an in-browser local prototype room.

Current honest setup constraint: the app exposes the persisted room play route, but it does not yet expose a product room-creation/deck-selection UI for live Standard playtests. For now, a playtest operator must seed a persisted room using the same service-role storage boundary used by e2e support, then give each player the same `/matches/play/[roomId]` URL while they are signed in as room participants.

Minimum room setup facts to record before each run:

- room id;
- player profile ids and display names;
- participant seats;
- deck fixture/deck code per seat;
- app commit/branch;
- whether local Supabase or a shared environment was used.

## 4. 6-deck playtest roster

The playtest roster is fixed to the Standard slice decks:

| Seat deck  | Nation             | Reference       | Current playtest entry point        | Bounded assumptions to watch                                                                                                                         |
| ---------- | ------------------ | --------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reguregnus | Stoicheia          | DeckLog `3P5CK` | Standard slice fixture/handler path | Drop calls, order placement, energy/counterblast costs, battle replacement and drive-minus flow are critical. Exact support package remains bounded. |
| Heartluru  | Dark States        | DeckLog `704UP` | Standard slice fixture/handler path | Order count, soul-call, energy payment, restand, power, and critical thresholds are critical. Full Happy Toys taxonomy is bounded.                   |
| Youthberk  | Keter Sanctuary    | DeckLog `39XBZ` | Standard slice fixture/handler path | Revoldress, bind previous vanguard, power/critical, and battle continuation are critical. Full Exist/Rebuild branches are bounded.                   |
| Prison     | Brandt Gate        | DeckLog `75CNF` | Standard slice fixture/handler path | Capture, release, opponent-owned prison cards, and prison-count attack pressure are critical. Full Galaxy/Purelight/Clearlight menu is bounded.      |
| Vyrgilla   | Dragon Empire      | DeckLog `2QD1X` | Standard slice fixture/handler path | Rewrite from hand, bind previous vanguard, opponent bind, and standing own board are critical. Full MateUnit/Ultimate Skill package is bounded.      |
| Kairi      | Lyrical Monasterio | DeckLog `29HYB` | Standard slice fixture/handler path | Bounce, replay, energy payment, attack sequence, and replayed-unit power are critical. Same-column and persona-sensitive branches are bounded.       |

Players should not improvise deck selection during the session. The operator assigns decks before room creation and records the assignment in the playtest log.

## 5. Session protocol

Prerequisites:

- both players have app accounts and profile rows;
- the operator has access to the target environment and service-role match-session storage setup;
- the operator can create or load a persisted room with the chosen two participants and Standard slice deck fixtures;
- both players use separate browser profiles, devices, or contexts;
- the bug log template is open before the match starts.

Launch:

1. Start the environment: `corepack pnpm dev:up`, then `corepack pnpm dev`.
2. Confirm both players can sign in and open `/profile`.
3. Operator creates a persisted room for the selected matchup.
4. Operator sends `/matches/play/[roomId]` to both players.
5. Both players open the route and confirm they see the correct side, opponent, status, and assigned deck.
6. Players ready/start and play normally. The operator does not coach unless the session is blocked.
7. On every issue, pause only long enough to record the required bug-log fields, then continue if possible.
8. After the match, record winner, stopping point, unresolved confusion, and the top three fixes that would most improve the next session.

Recovery drill for at least one match per session:

- one player refreshes during an active pending request;
- one player backgrounds the tab and returns after the opponent acts;
- one player attempts an action after the other player has advanced the room.

## 6. Observation categories

Gameplay correctness pain points:

- illegal or missing actions;
- wrong effect outcome;
- incorrect battle, trigger, resource, prison, bind, bounce, or rewrite resolution;
- broken deck loop or match completion.

Confusing request states:

- unclear what the game is waiting for;
- unclear why a choice exists;
- unclear which targets are legal;
- multi-step choice context lost after a response.

Stale / optimistic UX problems:

- accepted action appears late, duplicated, or lost;
- stale conflict text does not tell the player what to do;
- optimistic pending state hides whether the command reached the server;
- action rail stays disabled or misleading after an update.

Recovery / reconnect pain points:

- refresh loses visible context;
- rejoin shows a board but not the pending choice;
- timeout or recovery state is ambiguous;
- non-participant/access-denied state is not actionable.

Board readability:

- current turn, phase, active player, or active request is unclear;
- attacker, target, booster, guardian, damage, drop, bind, order, prison, or hand state is hard to read;
- opponent hidden information is either too hidden to reason about or accidentally exposed.

Target selection friction:

- legal targets are not visually obvious;
- illegal targets look clickable;
- selected state is easy to miss;
- confirm/cancel flow feels like a form rather than card-game interaction.

## 7. Structured bug log format

Use `docs/qa/pre-phase-21-playtest-bug-log-template.md` for every session.

Required issue fields:

- date/session;
- room id and room path;
- matchup and decks;
- player seat/perspective;
- reproduction steps;
- expected behavior;
- actual behavior;
- category: `rules bug`, `UX bug`, `sync bug`, `clarity bug`, `missing card/effect`, or `recovery issue`;
- severity: `S0 blocker`, `S1 major`, `S2 annoying`, or `S3 polish`;
- impact bucket: `blocker`, `annoying`, or `polish`;
- evidence: screenshot, event-log excerpt, room revision, engine revision, or notes;
- suggested next owner if obvious.

Triage rule:

- a blocked match creates a top-priority backlog item even if a workaround exists;
- repeated confusion from two players is a UX bug, not user error;
- bounded/missing card behavior is logged as `missing card/effect`, not silently treated as a rules bug.

## 8. Recommended playtest matrix

First pass matrix:

| Priority | Matchup                 | Why                                                                                                                             |
| -------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Reguregnus vs Prison    | Drop/order/battle replacement pressure against prison capture/release. High chance of request, zone, and ownership confusion.   |
| 2        | Heartluru vs Kairi      | Order/resource threshold deck against bounce/replay deck. Good for request readability and repeated board state changes.        |
| 3        | Youthberk vs Vyrgilla   | Form-change deck against rewrite/bind deck. Stresses vanguard replacement clarity and active battle context.                    |
| 4        | Prison vs Vyrgilla      | Control/capture against opponent-board bind/rewrite. Stresses cross-owner card movement and recovery from complex board states. |
| 5        | Reguregnus vs Heartluru | Resource-heavy decks on both sides. Good for energy/counterblast/soul/order readability.                                        |
| 6        | Kairi vs Youthberk      | Bounce/replay against form replacement. Good for target selection and board memory after repeated movement.                     |

Run each listed deck at least once. If time allows, replay the top two most confusing matchups with seats swapped.

Do not run a 6x6 exhaustive matrix yet. The first objective is to find product blockers and recurring confusion, not tournament coverage.

## 9. What is intentionally NOT claimed yet

This step does not claim that human matches were played.

It also does not claim:

- full production matchmaking exists;
- opponent deck submission exists in the product room flow;
- players can self-select the six decks in product UI;
- all six DeckLog lists are fully implemented as exact 50-card competitive decks;
- every card in the references has full printed text;
- WebSocket fanout, offline play, or complete timeout automation exists;
- automated tests can replace this playtest loop.

## 10. Summary

21.0.5 is ready to run real human playtests through the persisted projected multiplayer route. After 21.0.6, the preferred product entrypoint is `/matches/start?deckId=...` from an owned Standard deck; exact six-deck matchup sessions may still need operator-prepared saved decks until full opponent deck submission exists. The six-deck roster is fixed, the observation categories are explicit, and the bug log format is triage-ready. Actual playtest findings must be recorded separately after real people play real sessions.
