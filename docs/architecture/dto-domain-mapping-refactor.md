# DTO to Domain Mapping Refactor

## 1. Purpose

Move persistence DTO to domain mapping below the transport and application layers so server actions and use cases no longer know raw database record shapes.

## 2. What was wrong before

Deck write-side flows had DTO/domain mapping in the web layer. Server-action driven flows had already been thinned, but the extracted use cases still worked with `DeckRecord`, `CreateDeckInput`, and `SaveDeckInput`, and they manually assembled domain `Deck` objects from repository DTOs.

## 3. New mapping location

DTO/domain mapping now lives in deck infrastructure adapters:

- `apps/web/src/features/decks/infrastructure/deck-write-repository.ts`
- `apps/web/src/features/decks/infrastructure/deck-write-repository.mapper.ts`

The repository adapter wraps `@web-vg/db` repositories, maps raw persistence records into domain-oriented structures, and maps domain writes back into persistence DTOs.

## 4. Repository responsibilities

The deck write repository adapter now owns:

- profile id lookup for deck ownership resolution
- `DeckRecord -> Deck` mapping
- domain create/save payload mapping back into DB DTOs
- shielding application/use-case code from `CreateDeckInput`, `SaveDeckInput`, and `DeckRecord`

## 5. Transport simplification

Server actions stay thin and only:

- resolve auth/session context
- call use cases
- adapt results to `redirect`, `revalidatePath`, and UI-friendly errors

They no longer participate in DTO/domain mapping, and the use cases no longer depend on raw deck persistence records.

## 6. Dependency direction

The dependency direction is now:

- server actions -> application use cases
- application use cases -> application repository contract
- infrastructure deck repository adapter -> `@web-vg/db` repositories
- domain package -> no dependency on web or infrastructure

## 7. Behavioral compatibility

This refactor is behavior-preserving. Deck create/delete/duplicate and builder save/mutation flows keep the same validation messages, ownership checks, persistence semantics, and Next.js redirect/revalidation behavior.

## 8. Summary

The web layer no longer owns persistence-to-domain translation for deck write flows. Mapping is centralized in a repository adapter and mapper module, application orchestration now works with domain-oriented structures, and the layering between transport, application, and infrastructure is cleaner and easier to test.
