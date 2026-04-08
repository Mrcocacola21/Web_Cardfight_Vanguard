# Write-Side Transaction Strategy

## 1. Why This Strategy Is Needed

The project already has:

- normalized content, user, and gameplay schemas;
- repository boundaries;
- generated DB types;
- first read-side flows.

The remaining risk is write-side consistency for mutations that span multiple
tables. Supabase/PostgREST calls are not magically transactional across
multiple repository queries, so chained app-side writes must not be treated as
atomic just because they happen in one function.

## 2. Current Multi-Table Mutation Risks

The nearest real cases are:

- create deck:
  - insert `user_data.decks`
  - insert `user_data.deck_versions`
  - insert `user_data.deck_cards`
  - update `decks.current_version_id`
- future deck update with replacement semantics:
  - update deck metadata
  - create a new version
  - replace current composition
  - repoint `current_version_id`
- future collection-slice replacement:
  - replace a coherent set of collection items
- future gameplay room bootstrap:
  - create `gameplay.match_rooms`
  - create `gameplay.room_players`
  - create initial `gameplay.room_snapshots`
  - possibly create initial `gameplay.pending_choices`

Current `createDeck` is still a best-effort orchestration path with cleanup.
That is acceptable as a temporary foundation signal, but it is not a durable
strategy for write-heavy feature growth.

## 3. Write Consistency Principles

- Single-statement writes may stay as direct repository queries.
- Multi-table writes that create or replace one aggregate require real
  atomicity.
- Partial writes must not leave externally visible aggregate state in a shape
  the domain does not recognize.
- Repository methods must return application-level success or failure, not raw
  transaction details.
- UI and React components must never orchestrate write sequences.

## 4. Preferred Transaction Strategy

Preferred strategy for multi-table mutations in this project:

- put transactional write units in Postgres;
- expose them as SQL functions;
- call them through Supabase RPC from the repository layer;
- map the returned payload into repository read models or mutation result
  models.

Why:

- Postgres is the real transaction boundary;
- Supabase client calls from application code are separate requests;
- DB-side transactional units can atomically insert, update, replace, and
  validate relational state without pretending that best-effort cleanup is
  equivalent.

Preferred shape:

1. repository receives a typed mutation input;
2. repository calls one RPC / SQL function for the atomic unit;
3. SQL function performs the multi-table mutation inside one transaction;
4. repository maps the returned record or error into a narrow result shape.

## 5. Repository Responsibilities

Repositories may:

- execute single-table writes directly when one statement is sufficient;
- call transactional RPC functions for multi-table aggregate mutations;
- map DB payloads into narrow read models or mutation result shapes;
- normalize DB errors into repository-level errors.

Repositories must not:

- leak raw Supabase client usage into app/UI code;
- claim atomicity for chained application-side queries;
- expose raw row bundles and leave the caller to assemble aggregate meaning;
- move transactional orchestration into React, server components, or server
  actions.

## 6. Near-Term Use Cases

### `profiles.upsertProfileByAuthUserId`

- Scope: single table.
- Strategy: direct repository write is sufficient.
- Reason: one upsert statement is already atomic enough for current semantics.

### `decks.createDeck`

- Scope: multi-table aggregate creation.
- Strategy: migrate to one transactional DB-side write unit before deck
  write-side expands.
- Reason: `decks`, `deck_versions`, `deck_cards`, and
  `decks.current_version_id` must succeed or fail together.

### `decks.replaceCurrentDeckVersion`

- Scope: replace-style mutation.
- Strategy: DB-side transactional unit is required.
- Reason: half-applied composition replacement is not acceptable.

### `gameplay.bootstrapMatchRoom`

- Scope: runtime aggregate creation.
- Strategy: DB-side transactional unit is required.
- Reason: a room without coherent players and initial state is not a valid
  runtime aggregate.

## 7. What Is Acceptable Best-Effort vs What Requires Atomicity

Acceptable best-effort:

- single-table writes such as profile upsert;
- post-commit cache invalidation or route revalidation;
- non-authoritative side effects such as logging;
- cleanup of transient process-local work that is not visible as persisted
  domain state.

Requires atomicity:

- create or replace one persisted aggregate across multiple tables;
- any mutation that changes a parent row and its authoritative children
  together;
- any replacement write where old and new slices must not coexist halfway;
- gameplay runtime bootstraps that establish authoritative current state.

Unacceptable best-effort:

- chaining multi-table inserts or updates in repository code and calling the
  result “transactional enough”;
- exposing partially created deck or gameplay aggregates to later reads;
- using application-layer cleanup as a substitute for DB transactions.

## 8. Immediate Tactical Recommendations

- Treat current `createDeck` as transitional, not as the pattern to copy.
- For the next real multi-table write flow, add one explicit SQL function and
  call it via repository RPC instead of expanding best-effort orchestration.
- Keep single-table writes simple; do not route everything through RPC.
- Introduce replacement-write RPCs only for real aggregate cases, not as a
  generic framework.

## 9. Anti-Patterns To Avoid

- fake transactions implemented as several repository calls in sequence;
- giant “unit of work” abstraction layer before real need appears;
- pushing write orchestration into server actions or components;
- mixing mutation semantics with UI form handling;
- returning raw DB internals so callers must reconstruct mutation meaning.

## 10. Final Recommendations

- Keep direct repository writes for single-table operations.
- Use DB-side transactional units through RPC for multi-table aggregate writes.
- Do not expand write-heavy features on top of best-effort cleanup patterns.
- Introduce transaction-backed deck writes first, because `decks` is the
  nearest aggregate with clear multi-table consistency requirements.
