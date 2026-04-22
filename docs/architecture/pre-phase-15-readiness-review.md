# Pre-Phase 15 Readiness Review

## 1. Executive Summary

This document represents a thorough validation of the `Web_VG` monorepo following the completion of Phases 0 through 14. The primary objective is to act as a technical due-diligence gate before initiating **PHASE 15 — RULES ENGINE FOUNDATION**.

Overall, the foundation built across the first 14 phases is exceptionally strong. The project successfully navigated the transition from an early scaffolding state into a multi-package, robust modular monolith. Architectural boundaries are strictly preserved by package structure and ESLint rules. Critically, zero unresolved TS errors or failing tests remain in the `pnpm` workspace, reflecting a disciplined engineering culture.

However, moving to a Rules Engine represents a geometric leap in complexity. While the application and domain layers are highly mature, there is a critical gap in database-layer testing (specifically around RLS and transactional RPCs) that presents an asymmetric risk for Phase 15. The verdict is a **GO WITH CONDITIONS**.

## 2. Scope Reviewed

- **Modular Monolith Health:** Package boundaries (`apps/web`, `packages/*`), build orchestration (`turbo.json`, `package.json`), and CI/CD readiness.
- **Data Boundaries & Core Semantic Integrity:** Separation of `catalog` vs `importer` vs `decks`, and pure `domain` modeling correctness.
- **Database Posture:** Supabase schema, RPC migrations (Atomicity/Densification), and RLS.
- **Feature Ecosystems:** Social, Match History, Collection/Binder, Deck Validation.
- **Developer Workflow & Testing:** Local run ergonomics, `vitest` unit/domain mapping, and playwright coverage.

## 3. Foundation Phases Review (0–5)

**Status: MATURE & INTACT**
The bedrock of the application has not degraded despite the accumulation of features over the last 9 phases.

- **Monorepo Setup:** Clean, legible workspace. Package boundaries are functional, not decorative. `turbo` is present.
- **Domain Modeling:** Highly effective. The abstractions for `shared` vs `gameplay` vs `format-profiles` have held their structural shape beautifully. No "god packages" have naturally formed.
- **DB/Auth Base:** RLS and Supabase context correctly act as the source of truth for authorization.

## 4. Catalog / Importer / Content Review (6–8, 11)

**Status: HIGHLY MATURE**
The separation between ingestion (Importer) and consumption (Catalog) has proven highly resilient.

- **Catalog truth:** Remains strictly read-optimized for gameplay and deck building.
- **Importer boundary:** The importer handles the dirty work (JSON normalization, pipeline runs).
- **Integrity:** Zero dangerous heuristics have leaked into the canonical catalog tables. The tagging and keyword capabilities added in Phase 11 are solid enough to actually feed a rules engine.

## 5. Deck / Validation / Infra Review (9–10 + deck infra fixes)

**Status: STRONG (ARCHITECTURALLY), WEAK (OBSERVABILITY)**
The recent deck infrastructure fixes (shifting atomic writes and dense read aggregations to PL/pgSQL RPCs) are a massive success for data capability and latency.

- **Transaction/Security:** RLS and DB ownership successfully lock down deck mutations.
- **Validation:** Validation pipelines correctly enforce format/restriction rules and are heavily tested.
- **Caveat:** The entire DB mutation layer is completely untried in automated testing. The JS mappings are tested via mocks, creating a massive blind spot for database integrity.

## 6. Social Review (12)

**Status: COHERENT & SUFFICIENT**
The Social foundation covers friend requests, privacy flags, and profiles successfully.

- **Boundary:** Social concerns do not inappropriately bleed into core Gameplay or Deck models.
- **Integrity:** RLS gracefully handles visibility.
- **Verdict for Phase 15:** Safe to leave as-is. It operates on parallel tracks and will not block rules engine implementation.

## 7. Match History Review (13)

**Status: COHERENT**
Match models, personal stats, and deck linkages correctly function tracking "after-the-fact" reporting.

- **Data Model:** Clean division between `matches` and `gameplay_match_rooms`.
- **Verdict for Phase 15:** Safe. It is adequately primed to act as the consumer of the eventual Rules Engine outcomes.

## 8. Collection Review (14)

**Status: SOLIDIFIED**
Collections genuinely stayed focused on physically printed entities and real inventory tracking, strictly avoiding semantic drift into abstract gameplay constructs.

- **Semantics:** Printing-level preferences validate that the collector layer is decoupled from the deck execution layer.
- **Verdict for Phase 15:** Complete and decoupled.

## 9. Dev Workflow / Migrations / Local Run Review

**Status: EXCELLENT**
Migrations are robust, heavily ordered, and transactional. The absence of untracked `TODOs` in the migration pipeline demonstrates that the SQL state matches the application state flawlessly. It is operable by generic developers, not just the original author.

## 10. Test Coverage / Confidence Review

**Status: ACCEPTABLE FOR NOW, DANGEROUS FOR PHASE 15**

- Domain, mapper, and UI logic are rigorously tested. `npm run test` executes 348 assertions with 100% success.
- **The Gap:** There is zero DB-backed testing. This repository fundamentally relies on PostgreSQL for deep aggregate compilation and atomic mutation (e.g., decks, and soon, gameplay states). Relying solely on JS repository mocks means SQL syntax errors, RLS edge-case leaks, or RPC transaction failures are silent to CI until manual runtime testing.

## 11. Open Technical Debt

### Acceptable Debt (Non-Blocking)

- `packages/shared` has no formal admission contract other than discipline.
- `apps/web` has minor tsconfig path alias drift vs the allowed workspace package graph.
- Turbo relies mostly on `corepack pnpm -r` fallback rather than granular caching for all commands.
- Importer heavily relies on manual local script runs for hydration.

### Blocking Debt (Must Fix Before Phase 15)

- **DB Integration Test Harness:** The lack of automated testing for Supabase RPCs, triggers, and RLS policies. Rules engines demand extreme transactional guarantees (e.g., locking a match room state, pushing choice pending queues). If we enter Phase 15 without a way to assert PL/pgSQL logic automatically, the gameplay engine's integrity will rapidly degrade.

## 12. Readiness for Phase 15

To cleanly start **RULES ENGINE FOUNDATION**, the monorepo needs a highly deterministic transaction execution environment.

- The `deck semantics` and `catalog semantics` are pristine and completely ready to be read by the Rules Engine.
- The repository structure is ready to house `packages/rules-core` or similar safely.
- However, we **cannot** safely build complex state-machine changes on top of PostgreSQL capabilities without first writing integration tests for the capabilities already migrated in the `Deck` subsystem.

## 13. Final Verdict

**GO WITH CONDITIONS**

Phases 0–14 are fundamentally, genuinely closed. You have a highly mature, structurally sound, and scalable modular monolith with clean data boundaries.

### Exact Pre-Phase 15 Conditions:

1. **Establish DB-backed integration tests.** Introduce `PgTap` or a Supabase local testing harness. You must write at least 3-4 DB tests targeting the existing `user_data.save_deck_aggregate` RPC and associated RLS policies. Proving the DB testing workflow works on _Decks_ is mandatory before using it to build complex _Rules Engine_ transactions.
2. (Optional but recommended) Run a quick synchronization on `apps/web` tsconfig to finalize workspace boundaries.

Once condition #1 is met, you are clear to initiate Phase 15.
