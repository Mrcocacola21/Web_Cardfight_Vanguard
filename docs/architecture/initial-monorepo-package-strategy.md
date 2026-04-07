# Initial Monorepo Package / Export Strategy

Status: Initial monorepo and package-boundary strategy  
Last updated: 2026-04-07

## Why This Document Exists

This document translates the approved bounded contexts and shared contracts into an initial monorepo package strategy.

The project already has architecture-level boundaries. That is not enough by itself. If those boundaries are not reflected in package structure and export rules, the codebase will drift toward the same failure modes the architecture documents were written to prevent:

- `web` pages becoming the real home of business logic;
- `shared` code turning into an unbounded misc bucket;
- `rules` importing full `catalog` internals because it is convenient;
- `decks` and `legality` creating cycle-prone cross-imports;
- `importer` concerns leaking into runtime packages;
- deep imports bypassing every intended boundary.

For this project, monorepo governance is part of architecture, not a cosmetic repository choice. Cardfight!! Vanguard already puts pressure on:

- content growth;
- format-specific behavior;
- legality boundaries;
- gameplay expansion;
- importer-to-catalog publication flow;
- multiple cross-context contracts.

The package strategy must therefore be explicit before broad parallel implementation begins.

### Decision 1: Treat Package Structure as Boundary Enforcement

**Decision**

- The initial monorepo must reflect bounded contexts and published contracts directly.

**Rationale**

- If the package graph does not mirror the architecture, the codebase will quickly ignore the architecture.

**Practical implication**

- Package names, dependency directions, and export surfaces are part of the system design and should be reviewed as such.

## Proposed Initial Package Set

### Decision 2: Start with a Small but Explicit Package Set

**Decision**

- The initial monorepo should start with the following applications and packages:
- `apps/web`
- `packages/contracts`
- `packages/ui`
- `packages/catalog`
- `packages/importer`
- `packages/decks`
- `packages/legality`
- `packages/rules`
- `packages/social`
- `packages/db` as a thin infrastructure package, if created

**Rationale**

- This is the smallest package set that still preserves the approved context map, published contracts, and future gameplay path.
- It is large enough to prevent early boundary collapse, but small enough to be implemented without turning the repository into an over-segmented maze.

**Practical implication**

- The first implementation wave does not need dozens of packages.
- It does need explicit homes for bounded contexts, contract publication, UI composition, and optional infrastructure plumbing.

### Package Classification

| Package              | Category                      | Initial Status                  |
| -------------------- | ----------------------------- | ------------------------------- |
| `apps/web`           | app/composition               | required now                    |
| `packages/contracts` | shared boundary package       | required now                    |
| `packages/ui`        | presentation primitives       | required now                    |
| `packages/catalog`   | bounded domain package        | required now                    |
| `packages/importer`  | bounded domain package        | required now                    |
| `packages/decks`     | bounded domain package        | required now                    |
| `packages/legality`  | bounded domain package        | required now                    |
| `packages/rules`     | bounded domain package        | thin stub now, deeper later     |
| `packages/social`    | bounded domain package        | thin package now, broader later |
| `packages/db`        | infrastructure helper package | optional now, narrow if used    |

## Package Roles and Ownership

### Decision 3: Each Package Must Have One Clear Job

**Decision**

- Each initial package should have a narrowly stated purpose, explicit ownership, and explicit non-ownership rules.

**Rationale**

- A package without a clear non-ownership rule will slowly absorb whatever nearby logic is most convenient.

**Practical implication**

- New files should be placed by ownership first, not by whatever package already exists.

| Package              | Purpose                                                             | What It Owns                                                                                                                              | What It May Consume                                                          | What It Must Not Own                                                                            |
| -------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `apps/web`           | delivery, route composition, orchestration, thin API entry points   | page composition, interaction wiring, app-level orchestration                                                                             | public exports from all domain packages, `packages/ui`, `packages/contracts` | domain truth, legality semantics, gameplay logic, importer workflow                             |
| `packages/contracts` | physical home for published cross-context contracts                 | only approved shared boundary contracts and contract-level primitives                                                                     | nothing context-specific beyond approved contracts                           | internal domain models, repositories, UI models, storage rows, misc utilities                   |
| `packages/ui`        | reusable presentation primitives and design-system-level components | visual components, styling primitives, layout helpers                                                                                     | optionally owner-neutral contract-safe primitives                            | domain logic, legality, gameplay, importer logic, format semantics                              |
| `packages/catalog`   | canonical content domain and catalog-facing projections             | canonical cards, printings, products, catalog read models, gameplay-facing card projection publication                                    | `packages/contracts`, optional `packages/db`                                 | importer workflow state, legality rules, gameplay runtime logic                                 |
| `packages/importer`  | raw ingestion, normalization flow, review flow, provenance          | source adapters, parsing flow, normalization, source mappings, review state                                                               | `packages/contracts`, optional `packages/db`                                 | canonical catalog truth, legality meaning, gameplay meaning                                     |
| `packages/decks`     | deck domain, deck versions, snapshots, user-owned deck workflows    | deck versions, deck metadata, deck snapshot publication, deck lifecycle services                                                          | `packages/contracts`, optional `packages/db`                                 | legality rules, runtime gameplay state, social graph semantics                                  |
| `packages/legality`  | legality truth, format profile publication, validation semantics    | format profile publication, legality request semantics, legality results, restriction interpretation, capability publication for legality | `packages/contracts`, optional `packages/db`                                 | deck persistence, UI logic, importer flow, gameplay runtime logic                               |
| `packages/rules`     | gameplay truth and runtime-facing projections                       | gameplay-facing format projection, runtime setup adapters, future gameplay state/actions/effects                                          | `packages/contracts`, optionally `packages/db` later if justified            | catalog internals, legality ownership, UI ownership                                             |
| `packages/social`    | profiles, relationships, sharing concerns                           | social visibility, profile rules, shared-deck social metadata                                                                             | `packages/contracts`, optional `packages/db`                                 | deck composition ownership, legality logic, gameplay logic                                      |
| `packages/db`        | low-level persistence helpers only                                  | database client bootstrap, migration harnesses, shared low-level DB utilities if truly common                                             | nothing domain-specific as source of truth                                   | domain models, repository contracts as cross-context truth, shared persistence schema semantics |

## Package Dependency Directions

### Decision 4: Default to Contract-Mediated Dependencies

**Decision**

- The safe default is:
- bounded domain packages depend on `packages/contracts`;
- `apps/web` composes bounded packages;
- direct imports between sibling domain packages should be exceptional;
- no package may import another package's internals.

**Rationale**

- This keeps bounded contexts real in code and avoids the most predictable package cycles, especially around `decks`, `legality`, and `rules`.

**Practical implication**

- Cross-context interaction should usually happen through published contracts and app-level composition, not through direct package-to-package reach-through.

### Allowed Direct Dependency Pattern

| Package             | Allowed Direct Dependencies                                                                                                                                                             | Notes                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `apps/web`          | `packages/contracts`, `packages/ui`, `packages/catalog`, `packages/importer` only if admin/review UI exists, `packages/decks`, `packages/legality`, `packages/rules`, `packages/social` | top-level composition only                                                           |
| `packages/ui`       | none by default, or `packages/contracts` only where the dependency is presentation-safe                                                                                                 | keep UI as domain-agnostic as possible                                               |
| `packages/catalog`  | `packages/contracts`, optional `packages/db`                                                                                                                                            | must not depend on `importer`, `legality`, `rules`, or `web`                         |
| `packages/importer` | `packages/contracts`, optional `packages/db`                                                                                                                                            | must not depend on `catalog` internals; publication targets must come from contracts |
| `packages/decks`    | `packages/contracts`, optional `packages/db`                                                                                                                                            | must not depend on `legality` internals or `catalog` internals                       |
| `packages/legality` | `packages/contracts`, optional `packages/db`                                                                                                                                            | must not depend on `decks`, `importer`, `rules`, or `web` implementations            |
| `packages/rules`    | `packages/contracts`, optional `packages/db` later if match persistence is added                                                                                                        | must not depend on `catalog` internals, `legality`, or `web`                         |
| `packages/social`   | `packages/contracts`, optional `packages/db`                                                                                                                                            | must not depend on `decks` internals, `legality`, or `rules`                         |
| `packages/db`       | none of the domain packages as semantic dependencies                                                                                                                                    | infrastructure helper, not an architecture owner                                     |

### Decision 5: Context Dependencies Do Not Automatically Mean Direct Package Dependencies

**Decision**

- A context-level dependency such as `decks -> legality` or `rules -> catalog` should usually be realized through contracts, projections, and app-level composition, not by importing sibling package internals.

**Rationale**

- Context maps describe who may consume whose published truth.
- They do not justify direct code dependency on the supplier's implementation.

**Practical implication**

- `rules` should consume gameplay-facing catalog and format projections through published contracts.
- It should not import catalog repositories, catalog entities, or legality modules.

### Prohibited Dependencies

- any package -> `apps/web`
- `packages/catalog` -> `packages/importer`
- `packages/catalog` -> `packages/legality`
- `packages/catalog` -> `packages/rules`
- `packages/decks` -> `packages/importer`
- `packages/decks` -> `packages/rules`
- `packages/legality` -> `packages/importer`
- `packages/legality` -> `packages/rules`
- `packages/rules` -> `packages/catalog` internals
- `packages/rules` -> `packages/legality`
- `packages/social` -> `packages/legality`
- `packages/social` -> `packages/rules`
- `packages/ui` -> domain packages as a home for domain logic
- any circular dependency between bounded domain packages

## Export Policy

### Decision 6: Every Package Must Expose an Intentional Public Surface

**Decision**

- Each package must export only an explicit public API.
- Deep imports across package boundaries are disallowed by policy.

**Rationale**

- Boundary discipline is meaningless if consumers can bypass it with file-path imports into another package's `internal`, `src`, or adapter folders.

**Practical implication**

- If a consumer needs something that is not publicly exported, the first answer is not "just deep import it."
- The first answer is either:
- it should stay internal; or
- a new public export must be added intentionally and reviewed.

### Export Rules

- Public exports should be stable, narrow, and documented by purpose.
- Subpath exports are acceptable only when they are intentional public seams.
- Internal helpers, repositories, evaluators, parsers, reducers, and mappers must remain internal.
- A package should never export "everything from src".
- If a type or function crosses a bounded-context boundary, that crossing must be explainable as a published contract or published service surface.

### Decision 7: Keep Domain Contracts Separate from Internal Implementations

**Decision**

- Exported contract types should not force consumers to know the supplier package's internal model shape.

**Rationale**

- Public surfaces should survive internal refactors.

**Practical implication**

- For example, `packages/legality` may expose a validation service surface and legality result contract.
- It must not expose internal rule evaluator graphs, restriction-source loaders, or storage row shapes.

## Shared Contracts Placement Guidance

### Decision 8: `packages/contracts` Must Stay Narrow and Owner-Governed

**Decision**

- `packages/contracts` should exist as the physical home for approved cross-context contracts only.
- Semantic ownership of each contract remains with the bounded context already designated as its owner.

**Rationale**

- A dedicated contracts package prevents type-level cycles and gives the monorepo one explicit place for boundary contracts.
- Without ownership discipline, that same package becomes a giant shared blob and destroys the architecture.

**Practical implication**

- `packages/contracts` is a dependency-breaker, not a new domain.
- It should be organized by owner namespace or contract family, and every exported contract should be traceable to one owning context.

### What Belongs in `packages/contracts`

- card identity contract
- format profile contract
- deck snapshot contract
- legality validation request contract
- legality result contract
- capability-support contract surfaces
- gameplay-facing catalog projection contract
- gameplay-facing format projection contract
- minimal cross-context identifiers and envelopes needed to express those contracts

### What Does Not Belong in `packages/contracts`

- full domain entities from any context
- repository interfaces that are internal to one context
- parser models
- storage rows
- UI props or component models
- generic helpers because "multiple packages might use them"
- experimental types that are not yet stable boundary contracts

### Decision 9: Shared Contracts Are an Exception Surface, Not the Default Home for Shared Code

**Decision**

- If a type, helper, or model does not clearly cross a bounded-context boundary, it should not go into `packages/contracts`.

**Rationale**

- The easiest way to destroy package boundaries is to confuse "shared across contexts" with "used in more than one file."

**Practical implication**

- A utility used by only `catalog` and `importer` does not automatically belong in `packages/contracts`.
- It should remain internal or be duplicated until a real shared boundary need exists.

## Layering Model

### Decision 10: Use a Simple Four-Part Layering Model

**Decision**

- The initial monorepo should be understood through four high-level layers:
- contract layer
- bounded domain layer
- infrastructure sidecar layer
- presentation/composition layer

**Rationale**

- The layering model should be simple enough to guide implementation without becoming academic ceremony.

**Practical implication**

- The layers are:

1. `packages/contracts`
   - published cross-context contracts only
2. bounded domain packages
   - `packages/catalog`
   - `packages/importer`
   - `packages/decks`
   - `packages/legality`
   - `packages/rules`
   - `packages/social`
3. infrastructure sidecar
   - `packages/db` if needed
4. presentation and composition
   - `packages/ui`
   - `apps/web`

### Layering Rules

- lower layers must not depend on higher layers
- `apps/web` is the primary place where bounded packages are composed together
- `packages/ui` should remain presentation-first, not a second app layer
- `packages/db` must not become the owner of domain meaning

## Startup Pragmatism

### Decision 11: Start Thin Where the Domain Is Future-Facing, Not Where the Boundary Is Critical

**Decision**

- Some packages may begin thin or stubbed.
- Critical boundaries must still be represented from day one.

**Rationale**

- The project should not over-fragment the repository before there is real implementation pressure.
- It also should not postpone the boundaries that prevent architectural collapse.

**Practical implication**

- `packages/rules` may start as a thin package exporting runtime-facing format and catalog projection consumers, placeholder setup services, and test-safe stubs rather than a full engine.
- `packages/social` may start thin if the first implementation wave is catalog/decks/legality-heavy.
- `packages/db` may begin as a narrow infra helper package, or be omitted temporarily if equivalent low-level wiring stays isolated and does not leak across contexts.
- `apps/web` may host the initial thin API/orchestration layer rather than forcing a second application package immediately.
- The monorepo should not be split into per-subfeature packages until real pressure exists.

## Anti-Patterns

- deep imports into another package's internal files
- package-level circular dependencies
- `packages/ui` owning domain logic
- `packages/contracts` becoming a giant misc or utils bucket
- `packages/catalog` internals imported into `packages/rules`
- `apps/web` defining business rules locally because it is convenient
- `packages/importer` types leaking into runtime packages
- `packages/db` becoming the real architecture owner through shared row models
- exporting internal evaluators, parsers, repository adapters, or reducers as public API
- turning one bounded package into multiple pseudo-public entrypoints with no ownership rules

## Practical Examples

### Example 1: What `packages/legality` Should Export

Allowed public surface:

- legality service interface or invocation boundary
- published format profile surface
- legality validation request semantics
- legality result surface
- legality capability publication surface

Must remain internal:

- restriction interpreters
- evaluator pipelines
- source-specific rule loaders
- storage mapping code

### Example 2: What `packages/decks` May Consume

Allowed:

- contract definitions for deck snapshot publication
- contract definitions for legality request/result handling
- card identity references needed to construct snapshots

Not allowed:

- importing `packages/legality` evaluator internals
- importing `packages/catalog` canonical entities directly into deck internals
- storing legality logic inside deck services

### Example 3: What `packages/rules` May Read

Allowed:

- gameplay-facing catalog projection contract
- gameplay-facing format projection contract
- deck snapshot contract or gameplay-prepared input contract built from it

Not allowed:

- full catalog entities
- printing-heavy catalog models
- legality internals
- UI state or page-level interpretation of format behavior

### Example 4: What `apps/web` May Compose

Allowed:

- public catalog queries
- deck services
- legality validation calls
- social read/write flows
- UI components from `packages/ui`

Not allowed:

- defining canonical format behavior in route code
- rebuilding legality meaning from raw deck editor state
- importing internal files from bounded packages

### Example 5: What Must Stay Internal in `packages/importer`

Internal only:

- parser-specific raw source shapes
- heuristic matching helpers
- review-queue internals
- normalization staging details

Published outward only through approved boundaries:

- normalized publication-ready content contracts
- provenance references only where explicitly justified by the architecture

## Final Recommendations

### Decision 12: Start with Explicit Bounded Packages and Narrow Public Surfaces

**Decision**

- The recommended initial implementation strategy is:
- create the bounded packages now;
- keep `packages/contracts` narrow and reviewed;
- keep `apps/web` as the only top-level composition app for the first wave;
- keep `packages/ui` presentation-only;
- enforce no deep imports and no domain-package cycles from the first commit.

**Rationale**

- This is the smallest package strategy that preserves the architecture already approved through checkpoint-04.

**Practical implication**

- The first safe implementation sequence after this document is:

1. create monorepo roots and package boundaries;
2. define public export entrypoints for each initial package;
3. create `packages/contracts` with only the approved contract surfaces;
4. scaffold `packages/catalog`, `packages/importer`, `packages/decks`, and `packages/legality`;
5. add thin `packages/rules` and `packages/social` placeholders;
6. wire `apps/web` as the composition layer without granting it domain ownership.

## Open Questions for Later Package Evolution

- Whether `packages/rules` should later split into `rules-core` and `match-room` once gameplay depth exists.
- Whether `packages/social` should later split shared-deck publishing from profile/relationship logic.
- Whether some owner packages should later expose dedicated public subpath entrypoints for read models, projections, or admin-facing operations.
- Whether a separate server/application package becomes justified once API orchestration outgrows `apps/web`.
- Whether `packages/db` should remain a thin infra helper or be replaced by per-context persistence adapters once the repository layer matures.
