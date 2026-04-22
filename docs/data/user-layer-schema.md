# User Layer Schema

## 1. Scope

This schema covers the first durable user-owned layer needed for:

- user-facing profiles
- named collections and collection items
- persisted decks and deck versions
- deck composition
- friend relationships
- recorded match history

Included:

- `user_data.profiles`
- `user_data.collections`
- `user_data.collection_items`
- `user_data.decks`
- `user_data.deck_versions`
- `user_data.deck_cards`
- `social.friend_relationships`
- `social.matches`
- `social.match_participants`

Out of scope for this step:

- auth flows
- gameplay runtime state
- legality results as durable deck truth
- importer data
- content-layer canonical entities
- tournament systems
- chat, notifications, and admin tooling

Canonical inside the user layer:

- profile-facing identity
- collection ownership
- deck metadata and versioned composition
- friendship state
- recorded match facts

Derived or intentionally deferred:

- deck snapshots as immutable published artifacts
- legality caches and legality history
- collection rollups by canonical card
- public deck preview projections

Transient:

- editor draft noise
- UI filters
- live match room state
- in-progress legality evaluation state

## 2. Core Tables

### User-owned data

- `user_data.profiles`
  - app-level user profile separate from auth-provider internals
- `user_data.collections`
  - named inventory/binder/wishlist containers
- `user_data.collection_items`
  - printing-level owned or desired quantities
- `user_data.decks`
  - format-bound deck aggregates
- `user_data.deck_versions`
  - immutable revisions of one persisted deck
- `user_data.deck_cards`
  - canonical card entries for one deck version

### Social data

- `social.friend_relationships`
  - pending and accepted friendship state
- `social.matches`
  - recorded user-facing match history rows
- `social.match_participants`
  - participant rows and outcomes per match

## 3. Key Relationships

- `profile -> auth identity`
  - optional one-to-one link via `auth_user_id`
- `profile -> collections`
  - one profile owns many collections
- `profile -> collection_items`
  - one profile owns many printing-level inventory rows
- `profile -> decks`
  - one profile owns many decks
- `deck -> deck_versions`
  - one deck has many immutable revisions
- `deck_version -> deck_cards`
  - one deck version contains many canonical card entries
- `friend_relationships -> profiles`
  - one relationship links exactly two profiles
- `matches -> match_participants`
  - one recorded match has many participant rows

## 4. Profiles

`user_data.profiles` is the user-facing identity record.

Important decisions:

- it has its own primary key
- `auth_user_id` is optional and unique
- auth-provider linkage is not the profile’s only identity source
- profile display fields stay modest: `username`, `display_name`, `bio`, `avatar_url`, `visibility`

This keeps app/social semantics separate from auth-provider mechanics.

## 5. Collections

Current collection foundation is intentionally owner-owned inventory first.

- `user_data.collection_items`
  - stores `owner_profile_id`
  - stores `card_printing_id`
  - stores positive `quantity`
  - enforces one row per `owner + printing`
- `user_data.collections`
  - remains available as deferred container metadata for future named binder or wishlist surfaces
  - is not the runtime ownership root for the current private inventory flow

Collection items stay printing-level on purpose:

- regular, alt-art, promo, or rarity variants remain separate owned rows when they are separate printings
- canonical card grouping can be derived later through
  `catalog.card_printings -> catalog.card_entities`
- quantity zero removes the inventory row instead of keeping ambiguous zero-count rows

This keeps collection semantics distinct from deck semantics.

## 6. Decks and Deck_Cards

Deck persistence is version-aware.

- `user_data.decks`
  - stores deck metadata, owner, format attachment, visibility, and current version pointer
- `user_data.deck_versions`
  - stores immutable revisions of the same format-bound deck
- `user_data.deck_cards`
  - stores sectioned canonical card entries per version

Important identity decision:

- `deck_cards` use `catalog.card_entities`
- they do not use `catalog.card_printings`

That matches the deck, legality, and gameplay contracts:

- deck composition is canonical-card-based
- printing-level preference remains a future presentation concern

Deck snapshots are intentionally not stored in this schema yet. They remain derived artifacts that may be persisted later as immutable publications if sharing/history flows require them.

## 7. Friends Model

Friend requests and accepted friendships are unified in one practical table:

- `social.friend_relationships`

The row carries:

- requester
- addressee
- status
- request and response timestamps

Why this shape:

- it is enough for future social pages
- it avoids two-table request/friendship choreography this early
- it still keeps request vs accepted state explicit

The schema prevents duplicate rows for the same unordered pair of users.

## 8. Matches Model

Matches are stored as recorded product history, not runtime engine state.

- `social.matches`
  - stores the recorded match fact, format, visibility, timing, and notes
- `social.match_participants`
  - stores participants, optional deck-version references, and result per participant

This keeps the boundary explicit:

- a match-history row is not a gameplay event log
- a participant result is not a runtime action trace
- future gameplay engine state belongs elsewhere

## 9. Constraints and Indexing Rationale

Important constraints:

- unique case-insensitive usernames
- unique collection names per owner
- one default collection per owner and collection kind
- unique printing inventory row per `owner_profile_id + card_printing_id`
- one deck current-version pointer constrained to the same deck
- unique deck version numbers inside one deck
- unique canonical card entry per `deck_version + section + card_entity`
- friendship uniqueness by unordered user pair
- one participant row per `match + profile`

Important indexes:

- owner-based collection and deck lookups
- format-based deck and match lookups
- reverse lookups by `card_printing_id` and `card_entity_id`
- incoming/outgoing friendship lists by status
- profile match-history lookups

## 10. What Is Intentionally Out of Scope

This schema does not yet model:

- auth/session flows
- deck legality-result storage
- immutable deck snapshot storage
- gameplay runtime sessions
- event logs or replay data
- tournament brackets
- chat, notifications, or moderation
- repository abstractions or RLS policies

Those belong to later layers and should not be forced into the first user-layer schema.
