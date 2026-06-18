# Pre-Phase 21 Match Product Flow Overhaul

## Purpose

This pass moves the Standard match surface further away from an engineering dashboard and toward a playable Cardfight!! Vanguard client:

- projected match rooms render a playmat-like table with card faces, hidden backs, zones, battle/request emphasis, and card inspection;
- visible cards carry participant-safe card detail data from projection, not canonical engine internals;
- multiplayer entry now has a human lobby path: invite, accept/decline, choose decks, ready, start persisted match.

## Playmat and Card Presentation

The match board remains a thin client over projected room state. Visible pieces render as card faces with name, grade, power, shield, critical, type, nation, trigger, and effect references when projected. Hidden pieces render as card backs and keep card identity/text out of the DOM.

If a projected card later includes an image URL, the renderer can use it. Today the Standard slice primarily uses the structured fallback card face because the local QA catalog does not yet publish official card images for every slice card.

## Card Inspect UX

Cards on the board, hand, and visible piles are focusable/clickable. Hover/focus provides transient inspection and click pins a `Card inspect` surface with an enlarged card and full projected details. Hidden cards can also be inspected, but the panel explicitly says the card is hidden by participant-safe projection.

## Invite to Lobby Flow

The canonical human path is now:

1. open `/matches/lobby` or use the deck page `Invite to match` entry;
2. choose a visible opponent profile and send a Standard invite;
3. the invited player accepts or declines;
4. accepted lobbies show both participants, deck status, ready state, and format;
5. each participant chooses one owned saved Standard deck;
6. each participant marks ready;
7. start is blocked until both decks and both ready flags are present;
8. start creates a real persisted room and redirects to `/matches/play/[roomId]`.

The older direct deck-to-match path remains a separate legacy/dev-friendly path and is no longer the primary CTA from deck list/detail screens.

## Authority and Projection

Lobby rows live in `social.match_lobby_invites` with participant RLS. Application use cases enforce:

- only visible opponents can be invited;
- only the invitee can accept or decline;
- only lobby participants can choose decks, ready, or start;
- selected decks must be owned by the acting profile, Standard, and saved;
- match start uses two real deck snapshots and creates a persisted session through match-session storage.

The final `started` transition is performed from the server-side service-role path after the authoritative persisted room is created. The play screen continues to use the projected persisted room route.

## Tests

Focused tests cover:

- playmat structure and hidden/visible card rendering;
- pinned card inspection without hidden-card leakage;
- local and basic match views with projected card details;
- deck CTAs pointing users to the lobby path;
- lobby use-case gates for accepted invites, deck selection, ready state, and blocked start.

## Intentional Limits

This is not a full matchmaking platform. There is no queue, tournament pairing, chat, spectator mode, or production notification channel for invites yet. Official card image ingestion is also not complete; the fallback card renderer is the product-grade bridge until the catalog has image assets for the Standard slice.

## Summary

The match product path is now closer to a real Vanguard client: players can invite another person, meet in a lobby, select valid decks, ready up, enter a persisted projected match, and inspect card-like surfaces instead of reading text-only debug blocks.
