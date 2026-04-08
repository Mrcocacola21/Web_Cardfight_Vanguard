# DB Review Checkpoint

## 1. Executive Summary

The database foundation is structurally sound and aligned with the current domain model.

- content, user, and gameplay persistence are cleanly separated
- `CardEntity` vs `CardPrinting` remains intact in schema and repository usage
- migrations replay successfully against local Supabase/Postgres with seeds
- generated DB types and the repository layer are aligned with the active schema

Current verdict: `GO WITH CONDITIONS`

There are no critical blockers for implementation-phase work, but two operational caveats remain important:

- write-side repository flows are still thin and not transaction-backed
- `updated_at` semantics are only partially enforced today and still rely on disciplined write paths

## 2. Scope Reviewed

Reviewed:

- content-layer schema
- user-layer schema
- gameplay persistence schema
- migration ordering and replayability
- seed alignment
- generated DB types
- repository/query-helper alignment

## 3. What Looks Strong

- Layering is clear: `catalog`, `legality`, `user_data`, `social`, and `gameplay` do not collapse into one mixed schema.
- Truth boundaries are respected:
  - catalog truth stays in content tables
  - legality content facts stay separate from legality results
  - gameplay runtime stays separate from user-facing match history
- `CardEntity -> CardPrinting` normalization is correct and consistent with deck and legality contracts.
- `decks` store canonical card identity, while `collections` store printing-level identity. This is the right split.
- `match_rooms`, `room_snapshots`, `room_events`, and `pending_choices` form a coherent runtime persistence model.
- Migrations are decomposed well and replay cleanly through `supabase db reset --local`.
- Seeds are intentionally small and do not try to replace importer truth.

## 4. Normalization Review

### Good

- `catalog.product_families`, `catalog.products`, `catalog.card_entities`, and `catalog.card_printings` are properly separated.
- `legality.rule_profiles` and child tables avoid flattening format semantics into weak magic strings on unrelated rows.
- `social.matches` and `gameplay.match_rooms` are intentionally separate, which prevents runtime-state leakage into recorded history.
- `deck_versions` and `deck_cards` separate persisted user deck composition from legality or gameplay artifacts.

### Findings

- `ACCEPTABLE TRADE-OFF`: gameplay payloads use JSONB for snapshots, events, and pending choices.
  - Why it matters: runtime state evolves faster than fully relational gameplay modeling.
  - Assessment: acceptable for foundation. The schema still preserves room/event/choice boundaries and avoids one giant room blob.

## 5. Keys and Relationships Review

### Strong

- `format -> rule_profiles` is explicit and version-aware.
- `product -> card_printings` and `card_entity -> card_printings` are explicit and non-ambiguous.
- `deck -> deck_versions -> deck_cards` is structurally correct.
- gameplay composite foreign keys correctly keep `actor_room_player_id`, `active_room_player_id`, and `owner_room_player_id` room-local.

### Findings

- `MEDIUM`: write-side deck persistence is not transaction-backed.
  - Why it matters: `createDeck` spans `decks`, `deck_versions`, `deck_cards`, and a follow-up `current_version_id` update.
  - Current behavior: the repository uses best-effort cleanup on failure.
  - Recommendation: keep current foundation, but move multi-row write flows to an explicit transaction strategy before write-heavy feature work expands.

## 6. Index Review

### Strong

- product lookup paths are covered
- card printing lookups by `card_entity_id` and `product_id` are covered
- deck and version ownership lookups are covered
- gameplay event ordering is covered by the unique `(room_id, event_sequence)` index
- pending choice lookups by `(room_id, status)` are covered
- friendship uniqueness and status-based inbox/outbox lookups are covered

### Findings

- `MEDIUM`, fixed in this step: `legality.choice_restriction_rules` had no direct index on `restriction_list_id`.
  - Why it matters: fetching all choice restrictions for one active list would force weaker plans as data grows.
  - Fix: added `choice_restriction_rules_restriction_list_idx`.

## 7. Truth Boundary Review

### Strong

- importer concerns are not leaked into canonical catalog tables
- legality results are not stored as durable content truth
- gameplay runtime is not stored in user-facing match-history tables
- deck persistence does not pretend to be legality storage

### Findings

- no boundary violations found in the active schema or repository layer

## 8. Extensibility Review

### Strong

- new product families and products can be added without structural rewrites
- new rule profile versions and new restriction lists can be published without replacing prior truth
- gameplay persistence can evolve into reconnect/recovery flows without breaking room/event/snapshot semantics
- user layer can add more collection kinds, deck sharing, and social reads without redesigning the current core

### Findings

- `LOW`: `updated_at` columns are present on mutable tables, but database-level maintenance is not universal.
  - Why it matters: ordering indexes such as `decks_owner_idx` and `gameplay_match_rooms_status_idx` only stay trustworthy if writers consistently update `updated_at`.
  - Fix applied now: the current `createDeck` repository path updates `updated_at` when attaching the initial version.
  - Recommendation: adopt a consistent cross-repository policy or add DB-level automation before write surface area grows.

## 9. Seeds / Types / Repo Alignment

### Strong

- local seed replay succeeds through `supabase db reset --local`
- generated DB types can still be regenerated successfully
- repository layer uses generated DB types instead of hand-written row types
- repositories map rows into read models instead of leaking raw DB rows

### Findings

- `LOW`: `supabase db lint` did not complete cleanly in the local CLI run because `pgsql_check` failed to initialize.
  - Why it matters: this limits one validation signal in the local workflow.
  - Assessment: this did not block migration replay or type generation, so it is not a schema blocker.
  - Recommendation: treat it as tooling follow-up, not as a DB-foundation blocker.

## 10. Risk Register

- `MEDIUM`: multi-table write repositories currently rely on best-effort cleanup instead of true transactions.
- `LOW`: `updated_at` governance is not fully automated yet.
- `LOW`: local `supabase db lint` is currently less reliable than `db reset` replay in this environment.

## 11. Fixes Applied

- Added `choice_restriction_rules_restriction_list_idx` for legality choice-rule lookup.
- Updated the `createDeck` repository write path to touch `updated_at` when the initial current-version pointer is attached.

## 12. Remaining Issues

- No critical schema redesign is required.
- Before broader write-heavy implementation, the project should settle on a transaction strategy for multi-table writes.
- Before larger mutable feature surfaces land, `updated_at` handling should become uniformly enforced either in repositories or at the database layer.

## 13. Final Verdict

`GO WITH CONDITIONS`

Why:

- the schema is normalized enough, bounded enough, and replayable enough to support implementation work now;
- there are no critical blockers in keys, relationships, or truth boundaries;
- the remaining issues are operational write-path concerns, not schema-foundation failures.
