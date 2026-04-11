# Post-Phase 8 Roadmap Review

Date: 2026-04-10
Verdict: REORDER BEFORE CONTINUING

Status note:

- this document is the review snapshot that triggered the roadmap correction
- the repo-aligned follow-up plan now lives in
  [roadmap-rebase-after-phase-8.md](./roadmap-rebase-after-phase-8.md)
- the detailed execution artifact now lives in
  [rebased-roadmap-phase-9-25.md](./rebased-roadmap-phase-9-25.md)

## 1. Purpose

Review whether the project is ready to continue after Phase 8 and whether the
current roadmap order is technically and operationally sound.

This document is not a feature proposal. It is a program-level architecture and
delivery review intended to answer one question:

- should the team continue exactly as planned;
- should the team stabilize first;
- or should the near-term roadmap be reordered before further feature work.

## 2. Current Project Readiness After Phase 8

Overall assessment: the project is materially stronger than a prototype, but it
is not ready to follow the current next-phase order unchanged.

What is genuinely in place now:

- importer pipeline exists and has already crossed the full wave-1 chain
  through raw import, normalization, review, publication, and catalog UI
- content truth boundaries are real:
  - raw import
  - normalization
  - review
  - published catalog truth
- `CardEntity` vs `CardPrinting` semantics have been validated on real wave-1
  content
- product and card pages already read published catalog truth rather than
  importer-layer data
- legality and keyword/mechanics enrichment already follow a data-first model
- user-layer persistence foundations already exist for:
  - collections
  - decks
  - matches
  - friend relationships
- deck read-side foundations and deck repositories already exist

What is still incomplete in ways that matter for next-phase sequencing:

- publication lifecycle accounting is not fully closed back into import tracking
- a fully persisted local runtime-backed importer/publication proof is still
  weaker than the service-level and repository-harness proof
- user-owned write features do not yet have a baseline RLS / authorization
  discipline
- the currently published content slice is still too small to make the product's
  full deck workflow genuinely useful at product level

## 3. Strengths

The current state has several real strengths that should not be understated:

- architecture is not muddled:
  - importer owns ingestion
  - catalog owns published truth
  - legality owns admissibility semantics
  - rules remains separate from legality
  - web app remains a composition layer
- the project already has unusually strong documentation for:
  - truth boundaries
  - bounded contexts
  - deck and legality contracts
  - card identity policy
  - ingestion/publication flow
- the repository and schema foundations are ahead of what the roadmap wording
  now implies
- the team has been using review checkpoints and test checkpoints regularly
  instead of letting large stretches of work go unvalidated

These are strong signs that the project can scale. The issue is sequencing, not
foundational chaos.

## 4. Weak Points / Risks

### Risk 1

- Severity: HIGH
- Issue: the roadmap puts `Collection / Binder Mode` ahead of the core
  deck-builder and legality workflow even though the product scope defines deck
  building and legality as v1-critical and collection depth as later.
- Why it matters: this would prioritize a secondary ownership workflow ahead of
  the primary discover-build-validate-share-track loop.
- Recommendation: move collection later and put deck builder plus validation
  first.

### Risk 2

- Severity: HIGH
- Issue: `Security / RLS` is far too late at Phase 23 for a roadmap that starts
  adding user-owned deck, collection, match, and social write flows in Phases
  9-13.
- Why it matters: once those write surfaces exist, retrofitting access policy
  becomes more expensive and riskier. The current app foundation explicitly
  still lacks per-resource authorization.
- Recommendation: introduce a baseline security/authorization stabilization
  block before write-heavy user features expand.

### Risk 3

- Severity: HIGH
- Issue: `Standard Content Expansion` is postponed until Phase 20 even though
  deck builder, deck validation, social deck sharing, and match history all
  depend on a larger usable published content slice than wave 1.
- Why it matters: wave 1 is enough to prove architecture, but not enough to make
  the core companion workflow operationally valuable.
- Recommendation: move Standard content expansion much earlier, shortly after
  deck-builder and validation foundations are in place.

### Risk 4

- Severity: MEDIUM
- Issue: the roadmap wording is already behind the actual repo state. For
  example, `packages/decks`, deck persistence foundations, deck repositories,
  and deck read-side screens already exist.
- Why it matters: if the roadmap describes already-built foundations as future
  work, planning and checkpoint criteria become unreliable.
- Recommendation: re-baseline the roadmap around the actual current state and
  express the next work as completion/deepening steps rather than greenfield
  creation where that is no longer true.

### Risk 5

- Severity: MEDIUM
- Issue: publication lifecycle accounting still has an operational gap.
- Why it matters: the content pipeline is architecturally correct, but before
  scaling booster-by-booster it should write publication progress and counts
  back into the tracked import-job lifecycle.
- Recommendation: fix publication-stage job accounting before further content
  expansion.

## 5. Hidden Dependencies

The near-term roadmap contains several implicit prerequisites that should be
made explicit.

### Collection vs Printing Ownership

Collection is not just another card list.

- collection items are printing-level ownership facts
- deck entries are canonical-card references
- binder views may aggregate, but they must not redefine card identity

This dependency is already modeled correctly in docs and schema, but it is
precisely why collection should not lead the next product phase.

### Deck Builder vs Content Truth

Deck builder depends on more than UI/editor work:

- stable canonical card identity
- published catalog truth
- format attachment
- legality-aware catalog metadata
- enough published content to build meaningful decks

The current wave proves the architecture, but not yet a truly useful deck pool.

### Validation vs Legality Maturity

Validation depends on:

- format profiles
- restriction lists
- canonical card identity
- supported-scope honesty
- deck snapshot contract

Those foundations are largely designed, and parts already exist, but validation
should come soon so later phases stop relying on architectural intent alone.

### Social / Privacy vs Missing Security Baseline

Social features imply:

- user visibility policy
- deck audience policy
- owner vs viewer access rules
- friend-scoped reads

Without baseline authorization and RLS, social features will push visibility and
access logic into ad hoc app code.

### Match History vs Deck Ownership

Match history is not independent:

- it references users
- it may reference deck versions
- it depends on ownership and visibility rules

It should come after deck foundations are trustworthy, not before.

### Realtime vs Authoritative Ownership

Realtime requires more than transport:

- authoritative mutation source
- reconnect semantics
- permission boundaries
- conflict handling

That is too expensive to place before the single-user and async ownership flows
are fully settled.

## 6. Roadmap Order Review

Current near-term order is not ideal.

### 6.1 Collection Before Deck Builder

This is the clearest sequencing mistake.

Product scope already says:

- deck builder is core v1
- deck legality is core v1
- deeper collection/binder features are later

Collection is valuable, but it is not the next highest-leverage capability.

### 6.2 Security / RLS at Phase 23

This is too late.

A full security hardening phase can remain later, but baseline resource
ownership and RLS cannot wait until after:

- deck writes
- collection writes
- social relationships
- match history

### 6.3 Standard Content Expansion at Phase 20

This is also too late.

Without broader Standard content:

- deck builder becomes a mostly technical exercise
- validation cannot be stress-tested against meaningful decks
- deck sharing and match logging are much less valuable

Expansion does not need to precede every foundation step, but it must move much
closer to the deck + validation phases.

### 6.4 Rules Engine Timing

The current instinct to keep deeper gameplay/rules work after deck, legality,
and manual match workflows is good.

What is wrong is not that rules are later. What is wrong is delaying core deck
and content work while putting collection and distant gameplay-adjacent phases
in front of it.

## 7. Delivery Realism Review

The roadmap is not unrealistic because the features are impossible. It is
unrealistic because it mixes three different planning modes:

- greenfield creation steps
- continuation steps on already existing foundations
- distant expansion phases that should depend on product learning

Current delivery concerns:

- some phases are too broad and will likely hide multiple architectural
  checkpoints inside one heading
- some steps describe work that is already partially present in code or schema
- the current order would create a long gap between content-ingestion maturity
  and the point where content breadth becomes truly useful to users
- the security phase is positioned as if authorization is a late hardening task
  rather than a prerequisite for user-owned write surfaces

The project is not in trouble, but the roadmap needs to become more executional
and less aspirational.

## 8. Recommended Verdict

Verdict: REORDER BEFORE CONTINUING

Reason:

- the project is technically ready to continue
- but it is not ready to continue in the current order
- the biggest problem is not missing foundation quality
- the biggest problem is that the next phases do not reflect the actual product
  priorities, architectural dependencies, or already-built foundations

## 9. Pre-Phase Tasks

Before the next major feature phase, do one short stabilization block.

### PRE-PHASE 9 STABILIZATION

- S1. Close publication lifecycle accounting.
  - publication should update tracked job stage/status and published counts
  - run one fully persisted local importer-to-publication execution through the
    actual runtime path
- S2. Introduce baseline authorization and RLS for existing user-owned data.
  - at minimum: profiles, decks, collections, and matches
  - the goal is not a final security program, but a safe ownership baseline
- S3. Re-baseline the roadmap against the actual repo state.
  - treat `decks` as an existing foundation
  - treat deck read-side as existing
  - keep collection printing-level and deck canonical-level ownership explicit

This block should stay small. It is not a new feature phase.

## 10. Revised Roadmap Order

Recommended near-term order for the next major block:

### Phase 9 — Deck Builder Foundation

- complete write-side deck workflows on top of the existing deck boundary
- move from read baseline to real creation/editing flows

### Phase 10 — Deck Validation

- implement the legality contract against the deck snapshot
- make the supported scope explicit and trustworthy

### Phase 11 — Standard Content Expansion

- move booster-by-booster Standard growth much earlier
- expand the published card pool enough to make deck workflows useful

### Phase 12 — Social Foundation

- keep it deck-centered
- focus on visibility, sharing, and basic friend-linked use cases

### Phase 13 — Match History And Stats

- build on stable deck ownership and visibility rules
- keep it manual and practical

### Phase 14 — Collection / Binder Mode

- move collection here, after the core discover-build-validate-share-track loop
  exists in usable form

### Phase 15 — Rules Engine Foundation

- keep gameplay runtime logic after the core companion loop

### Phase 16 — Format Adapters

- deepen gameplay/runtime interpretation after rules-core foundation exists

Additional note:

- the current full `Security / RLS` phase can remain later as a broader audit
  and hardening phase, but its baseline ownership protections cannot wait that
  long

## 11. Final Recommendation

Do not continue exactly as currently planned.

The right move is:

1. run a short stabilization batch;
2. reorder the next block around deck builder and deck validation;
3. move Standard content expansion much earlier;
4. push collection behind the core v1 companion loop instead of ahead of it.

This project is not blocked by weak architecture.

It is blocked by the risk of using a roadmap order that no longer matches:

- the declared v1 product value;
- the actual repo state;
- the real dependency graph of decks, legality, content, security, and social
  features.
