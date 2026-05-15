# Real Deck-to-Match Bootstrap

## 1. Purpose

Step 0.8 replaces local match fixture pieces with a deterministic bootstrap from real deck truth. A match now starts from validated deck snapshots and gameplay card definitions, then creates engine pieces, zones, and card stats from that input.

## 2. Why synthetic fixture bootstrap had to be replaced

The gameplay engine can now use card stats, combat math, damage, triggers, turn structure, resources, and board semantics. Keeping local matches on synthetic `p1:card:*` fixture cards would leave a semantic gap between deck builder truth, catalog/content truth, and live match truth. It would also make realtime or persisted sessions depend on non-reproducible demo state.

## 3. Canonical match bootstrap input

The canonical input is a resolved match-ready player payload:

- player id and seat;
- immutable `DeckSnapshot`;
- validation proof for the selected format;
- resolved `GameplayCard[]` definitions for every card id in the snapshot;
- optional runtime key for deterministic local piece and zone ids.

The bootstrap does not accept prebuilt per-zone fixture pieces as its source of truth.

## 4. Deck snapshot model

The match uses an explicit `DeckSnapshot`, not a live mutable deck reference. This keeps the match independent from later deck edits and gives future room persistence/reconnect a stable input to replay or audit.

Bootstrap rejects snapshots that are incomplete, mismatched to the match format, structurally malformed, or not backed by a successful validation proof.

## 5. Deck -> gameplay piece translation

For each player, the snapshot is expanded into deterministic gameplay pieces:

- main deck entries become card pieces, with the opening hand drawn from the top of the expanded main deck;
- a grade 0 ride deck card becomes the starting vanguard;
- remaining ride deck cards are ordered by grade for prototype ride flow;
- G deck entries populate the G deck zone;
- all runtime pieces preserve the original `cardDefinitionId`.

The bootstrap also builds the engine card stats snapshot from the provided `GameplayCard[]`, so `cardDefinitionId` resolves to gameplay-ready stats inside `GameState`.

## 6. Initial zone placement model

The bounded current baseline is Standard-oriented:

- main deck: remaining main deck after opening hand;
- hand: opening hand, default size 5;
- vanguard circle: grade 0 ride deck card;
- ride deck: remaining ride cards;
- G deck: snapshot G section if present;
- rear-guard, guardian, damage, soul, drop, bind: initialized empty with canonical engine zones.

Mulligan remains a later engine request/choice flow over this deck-backed state.

## 7. Local prototype path

The local prototype now creates two reproducible seeded demo `Deck`s, validates them through `@web-vg/deck-validation`, resolves local catalog-like `GameplayCard` definitions, and calls `createDeckBackedGameState`.

The prototype remains easy to start, but its match state is now deck-backed rather than fixture-piece-backed.

## 8. Failure behavior

Bootstrap fails explicitly for:

- missing or duplicate player identity/seat/runtime keys;
- format mismatch;
- invalid deck validation proof;
- incomplete or malformed deck snapshot;
- missing gameplay card definitions;
- invalid engine card stats;
- missing grade 0 starting vanguard in Standard;
- generated state invariant failure.

There is no silent fallback to synthetic pieces.

## 9. What is intentionally NOT implemented yet

This step does not implement matchmaking, production deck selection UX, database repositories inside match session, realtime room creation, persisted match records, reconnect, mulligan product polish, or every future format-specific setup nuance.

## 10. Summary

`match-session` now owns a clean deck-to-engine bootstrap boundary. Deck builder and validation produce deck truth, catalog/content provides gameplay card truth, and `rules-core` receives only pure gameplay state and card stats. This closes the fixture-era bootstrap gap while keeping package boundaries intact.
