# State Model Foundation

## 1. Purpose

`packages/rules-core` now defines the first real gameplay state foundation for the future rules engine through `GameState`, `PlayerState`, and `ZoneState`.

## 2. Separation from UI/DB

The state model is pure domain data. It does not depend on Next.js, React, Supabase, repositories, browser state, transport code, or importer-shaped persistence models. The contracts are serializable in principle and suitable for deterministic pure transitions later.

## 3. GameState

`GameState` is the root aggregate for a match. It owns:

- match identity and attached `formatId`;
- lifecycle status and revision;
- turn context through `TurnState`;
- participating players;
- all runtime zones;
- all runtime pieces;
- global gameplay flags;
- pending engine choice requests.

It does not encode concrete mechanics such as draw, ride, attack, or effect resolution.

## 4. PlayerState

`PlayerState` represents one player inside the match. It owns:

- match-scoped player identity;
- seat information;
- player status;
- the set of owned zone ids;
- generic counters and flags for future player-level resources.

This keeps player state richer than a simple bag of zones without hardcoding Vanguard-specific mechanics prematurely.

## 5. ZoneState

`ZoneState` is the reusable primitive for gameplay locations. It owns:

- zone identity and generic zone kind;
- zone scope and optional player ownership;
- visibility policy for hidden-information handling;
- layout metadata for ordering, occupancy, capacity, and optional slots;
- occupant references to runtime pieces.

Zone semantics are carried by metadata rather than by format-specific fields. The same shape can represent deck, hand, drop, damage, soul, bind, ride deck, G deck, guardian, or temporary zones later.

## 6. Identity model

The state model separates identities explicitly:

- `CardId`: canonical card definition identity from shared contracts;
- `PieceId`: match-scoped runtime identity for a concrete in-game piece;
- `PlayerId`: match-scoped runtime player identity;
- `ZoneId` and `ZoneSlotId`: runtime location identities.

Ownership, control, and location are also kept separate. A runtime piece references owner/controller, while zone membership is the source of truth for current location.

## 7. Relation to deck/catalog

The gameplay state does not store collection printings or inventory information. Runtime pieces may reference canonical `CardId` through `cardDefinitionId`, but catalog truth, deck truth, and gameplay truth remain separate. Deck snapshots and gameplay-facing catalog projections can initialize this state later without becoming the state model itself.

## 8. Format-agnostic decisions

The state model keeps Standard, V Premium, and Premium out of the core shape. There are no format-specific fields such as dedicated ride-deck or G-zone properties on `GameState`, `PlayerState`, or `ZoneState`. Format adapters can later choose which zones, slots, and flags exist for a match.

## 9. Not implemented

This step does not implement:

- reducers or full transition logic;
- action admissibility rules;
- draw, ride, attack, or effect resolution;
- format adapters;
- card-specific handlers;
- player-specific view projection for hidden information.

## 10. Summary

`rules-core` now has a coherent gameplay state foundation with explicit runtime identities, reusable zone semantics, generic player resources, invariant helpers, and clean separation from UI, DB, collection, and format-specific concerns. That foundation is ready for subsequent action, event, reducer, and adapter work.
