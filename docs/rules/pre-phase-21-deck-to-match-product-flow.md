# PRE-PHASE 21.0.6 - Deck to Match Product Flow

## 1. Purpose

Close the product gap between a saved deck and a playable persisted match room.
The user-facing path is now:

1. open `/decks`;
2. choose a saved Standard deck;
3. click **Start match**;
4. select a visible opponent profile;
5. create a persisted room server-side;
6. redirect into `/matches/play/[roomId]`.

No player has to manually create, copy, or paste a room id.

## 2. Why manual room bootstrap was no longer acceptable

The Standard slice already had deck-backed bootstrap, persisted room storage,
participant projection, realtime polling, and reconnect foundations. Keeping the
main path dependent on service-role test helpers or hand-made room ids would hide
the real product risk: whether a normal user can move from a deck to a match.

## 3. Chosen deck-to-match flow

The canonical bounded flow is direct challenge from an owned deck:

- deck list/detail links to `/matches/start?deckId=...`;
- the start page loads only an owned, current-version Standard deck;
- the user searches the protected visible-profile surface for an opponent;
- server action receives only `deckId` and `opponentProfileId`;
- the server reloads deck/profile/catalog truth, validates, bootstraps, persists,
  and redirects to the projected room route.

The created room is initialized and started server-side through existing
`match.ready` and `match.start` transitions before persistence, so the play route
opens as an active gameplay room rather than a dead setup shell.

## 4. Deck validation / ownership / room creation contract

Room creation is not a cosmetic UI shortcut:

- auth user must resolve to a persisted profile;
- selected deck must be owned by that profile;
- selected deck must have a current saved version;
- selected deck must be Standard;
- selected opponent must be a visible non-self profile;
- all deck card ids must resolve through the catalog repository;
- deck validation must pass before bootstrap;
- the room id is generated server-side;
- persisted room creation uses the existing match-session storage adapter.

The first participant uses the selected real deck snapshot and gameplay card
definitions. The second participant currently receives a bounded Standard
sparring deck so the vertical slice can open a real two-participant room without
inventing opponent deck submission in this step.

## 5. Relationship to persisted room path

The flow writes through `createPersistedMatchSessionAdapter(...).createPersistedRoom`.
The resulting room is opened by `/matches/play/[roomId]`, which already loads
the persisted session and renders participant-safe projection. The product flow
therefore feeds the same storage/projection path as reconnect and realtime sync.

## 6. Relationship to projection / realtime / recovery

The client never receives canonical `engineState` from the creation flow. It only
redirects to the room id after the authoritative server write succeeds. From
that point on, the match UI uses the existing projected multiplayer client,
polling, command submission, stale handling, timeout/recovery visibility, and
participant access checks.

## 7. Local prototype vs real product flow

`/matches/play/local` remains the explicit local prototype. The deck-to-match
flow does not fall back to it and does not reuse its in-memory room bootstrap as
the product route. Shared UI improvements can still benefit both paths, but the
real product path is persisted and participant-projected.

## 8. What is intentionally NOT implemented yet

- full matchmaking;
- lobby invitations;
- opponent deck selection/submission;
- ready-up waiting room UX;
- rematch flow;
- public room browser;
- bot AI for solo play;
- automatic sharing of the created room link outside normal navigation.

These are separate product layers. This step only closes the bounded Standard
deck -> persisted room -> projected match path.

## 9. Summary

21.0.6 replaces developer-only room bootstrap with a real deck-backed product
entrypoint. A user can start from an owned Standard deck, select a visible
opponent, create a persisted authoritative room, and land in the playable
projected match UI without knowing internal room ids or storage helpers.
