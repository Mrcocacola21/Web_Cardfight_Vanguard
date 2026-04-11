# Rebased Roadmap: Phase 9-25

Status: repo-aligned execution plan after Phase 8 and the stabilization follow-up

Execution assumptions:

- Phase 8 is complete.
- The pre-Phase 9 stabilization block is already closed:
  - publication lifecycle accounting is tracked back into `import_jobs`
  - one persisted local runtime-backed pipeline run exists
  - baseline owner-based authorization and RLS exist for user-owned data
- Deck composition remains canonical-card based.
- Collection remains printing-based.
- Catalog remains published source of truth.

## PRE-PHASE 9 STABILIZATION (Closed)

This block is no longer future work. It is the baseline the next phases assume.

- S1. Close publication lifecycle accounting
  - publication updates tracked import-job lifecycle and published counts
- S2. Prove one persisted local runtime-backed pipeline run
  - real DB, real source/job, raw -> normalization -> review -> publication
- S3. Introduce baseline authorization and RLS
  - owner-based protection for profiles, decks, collections, and matches

## PHASE 9 - DECK BUILDER FOUNDATION

### 9.1. Complete deck domain and persistence foundation

Signature: finish the existing deck package, schema, and repository baseline so
the deck model behaves as a real write-side product surface rather than a read
demo.

- deck aggregate and metadata invariants
- deck version ownership and mutation rules
- canonical-card composition remains explicit

### 9.2. Complete deck list and deck detail read surfaces

Signature: deepen the existing read-side pages so they support the full builder
workflow instead of acting only as repository-backed inspection pages.

- list affordances
- detail affordances
- duplicate / archive / delete entry points

### 9.3. Add deck creation flow on top of the existing deck boundary

Signature: first real write workflow for decks, built on existing profile,
format, repository, and RLS foundations.

- choose format
- create empty deck
- attach initial metadata

### 9.4. Build the editable deck builder workspace

Signature: turn the current read baseline into the main deck editing surface
using canonical card identity and published catalog truth.

- catalog-driven card lookup
- current deck composition pane
- section-aware editing

### 9.5. Add deck composition write flows

Signature: introduce add/remove/update behavior for deck cards without switching
to printing-level semantics.

- add canonical card
- remove canonical card
- move between supported sections where allowed

### 9.6. Complete copy-count and section-count behavior

Signature: provide practical builder feedback before full validation becomes the
source of formal deck legality.

- per-card copy counts
- section totals
- early local guardrails

### 9.7. Complete draft-state handling

Signature: protect deck editing from accidental data loss and make builder state
reliable under navigation and refresh.

- autosave strategy
- unsaved changes state
- optimistic vs persisted state clarity

### 9.8. Extend deck metadata workflows

Signature: turn the existing deck record into a usable organizer object, not
just a composition container.

- title
- description
- tags
- favorite / archive handling

### 9.9. Deck builder review checkpoint

Signature: validate that the builder remains canonical-card based, stateful
without chaos, and cleanly separated from validation logic.

### 9.10. Deck builder tests checkpoint

Signature: lock down the core user flows before validation work deepens the
stack.

- unit
- component
- targeted end-to-end

## PHASE 10 - DECK VALIDATION

### 10.1. Complete the validation core module

Signature: build the first real validator on top of existing deck contracts,
legality contracts, and restriction data foundations.

### 10.2. Build the format-aware validation pipeline

Signature: formalize one validation entrypoint that can dispatch by format and
supported scope.

### 10.3. Implement common deck rules

Signature: lock the shared invariants before format-specific rules diverge.

- deck size
- section presence
- duplicate limits

### 10.4. Implement Standard validation for the declared supported content scope

Signature: Standard remains the first trustworthy format because it matches the
published content track.

- ride deck rules
- nation / construction constraints
- supported-scope honesty

### 10.5. Add V Premium validation extension points

Signature: do not pretend to fully support V Premium yet; add the architectural
hooks and smoke-level rules needed so later V content expansion does not start
from zero.

- clan-oriented construction hooks
- unsupported-scope behavior

### 10.6. Add Premium validation extension points

Signature: establish the structural path for Premium without overclaiming full
historical support before content and gameplay maturity exist.

- main deck / G deck shape hooks
- unsupported-scope behavior

### 10.7. Integrate restriction-list support into validation

Signature: use the existing restriction data path as evaluation input rather
than UI decoration.

- banned
- limited
- choice restrictions

### 10.8. Surface validation results in the builder UI

Signature: validation must be user-facing and actionable, not a hidden server
concern.

- errors
- warnings
- supported-boundary messaging

### 10.9. Validation review checkpoint

Signature: confirm the rule system is extensible and still aligned with format
and content boundaries.

### 10.10. Validation tests checkpoint

Signature: protect rule behavior with deck snapshots and supported-scope cases.

## PHASE 11 - STANDARD CONTENT EXPANSION

### 11.1. Extend the existing importer/publication stack from wave 1 to a usable D/DZ slice

Signature: move from wave-1 proof to enough published Standard content for real
deck workflows.

### 11.2. Continue booster-by-booster Standard ingestion

Signature: preserve the current operational model instead of replacing it with a
bulk one-off content dump.

### 11.3. Extend supported Standard product lines

Signature: broaden beyond boosters where it materially improves the companion
workflow.

- start decks
- title boosters
- lyrical / special series as justified by supported scope

### 11.4. Continue data enrichment on published Standard content

Signature: maintain data-first enrichment as content grows.

- legalities
- restrictions
- keywords / mechanics
- printing coverage

### 11.5. Standard content review checkpoint

Signature: verify that importer, publication, enrichment, and catalog truth stay
coherent as Standard breadth grows.

## PHASE 12 - SOCIAL FOUNDATION

### 12.1. Complete user lookup on top of existing profile and social schema foundations

Signature: social workflows should build on existing identity and RLS baselines,
not bypass them.

### 12.2. Add friend-request write flows

Signature: turn the existing friend relationship model into a real product
workflow.

### 12.3. Complete request response lifecycle

Signature: pending, accepted, and rejected states must stay explicit.

### 12.4. Add controlled friendship removal

Signature: social state must be reversible and owner-safe.

### 12.5. Build the friend list page and basic social management surface

Signature: give users one stable place to inspect and manage their current
social graph.

### 12.6. Extend privacy flags from baseline security into product-facing visibility rules

Signature: privacy now becomes a product behavior layer on top of the already
closed authorization floor.

- public
- private
- friend-scoped where explicitly supported

### 12.7. Social review and tests checkpoint

Signature: validate that social behavior stays consistent with auth, RLS, and
profile visibility.

## PHASE 13 - MATCH HISTORY AND STATS

### 13.1. Complete match history domain and persistence workflows

Signature: build on the existing social match schema instead of inventing a
separate match record model.

### 13.2. Add manual match logging

Signature: begin with practical post-game value before realtime gameplay exists.

### 13.3. Attach deck and opponent references

Signature: match history should link to real decks and real users where
available.

### 13.4. Complete recorded match facts

Signature: persist the minimum useful post-game information.

- win / loss / draw
- notes
- date

### 13.5. Build match history list and filters

Signature: manual history is only useful if it can be queried and revisited.

### 13.6. Build basic stats views

Signature: close the discover-build-validate-play-track loop with simple
aggregates.

- win rate
- deck usage
- match totals

### 13.7. Add friend-linked match stats where explicitly supported

Signature: connect match history to the social layer without inventing a full
competitive platform.

### 13.8. Match history review checkpoint

Signature: confirm that match history remains distinct from gameplay runtime and
uses deck/social identities cleanly.

### 13.9. Match history tests checkpoint

Signature: protect calculations, filters, and ownership behavior.

## PHASE 14 - COLLECTION / BINDER MODE

### 14.1. Complete the collection domain and repository layer

Signature: build on the existing printing-level schema and RLS foundation rather
than redefining ownership semantics.

### 14.2. Add collection mutation workflows

Signature: support inventory operations without collapsing printings into
canonical entities.

- add / remove
- quantity changes

### 14.3. Build binder and list views on top of printing-level truth

Signature: collection UI must remain inventory-facing rather than becoming a
second deck surface.

### 14.4. Add wishlist and favorites inside the collection model

Signature: extend the collector workflow without blurring deck and collection
ownership.

### 14.5. Collection review and tests checkpoint

Signature: verify that collection stays printing-level and separate from deck
truth and catalog truth.

## PHASE 15 - RULES ENGINE FOUNDATION

### 15.1. Evolve `packages/rules-core` from abstraction baseline into executable engine foundation

Signature: the package already exists; the task now is to turn typed contracts
into runtime engine structure.

### 15.2. Stabilize `GameState`, `PlayerState`, and `ZoneState`

Signature: these become operational runtime objects, not only type sketches.

### 15.3. Complete the action model

Signature: gameplay state changes must flow through explicit actions, not UI
side effects.

### 15.4. Complete the event model

Signature: rules and effects need a stable event stream for resolution.

### 15.5. Complete the choice/request model

Signature: the engine must represent required player input formally.

### 15.6. Build the reducer / transition model

Signature: establish deterministic state transitions before mechanics and
effects deepen.

### 15.7. Finalize the engine/UI boundary

Signature: UI remains a client of rules-core, not an owner of game logic.

### 15.8. Rules-core review checkpoint

Signature: confirm the engine stays a clean domain core and not a UI-coupled
state bag.

### 15.9. Rules-core tests checkpoint

Signature: lock down state transitions before mechanics multiply.

## PHASE 16 - FORMAT ADAPTERS

### 16.1. Add the Standard format adapter

Signature: first real adapter on top of the rules-core foundation and current
content maturity.

### 16.2. Add the V Premium format adapter baseline

Signature: define the extension path before full V gameplay depth arrives.

### 16.3. Add the Premium format adapter baseline

Signature: support coexistence assumptions without collapsing all format logic
into one rules path.

### 16.4. Extract shared mechanics hooks

Signature: avoid copying format behavior across adapters.

### 16.5. Format smoke tests checkpoint

Signature: confirm each adapter boots and respects the rules-core boundary.

## PHASE 17 - CORE GAMEPLAY MECHANICS

### 17.1. Add draw / shuffle / mulligan

Signature: first playable-loop mechanics on top of the executable rules core.

### 17.2. Add ride / call

Signature: establish Vanguard's core placement actions before deeper combat
logic.

### 17.3. Add attack / boost / guard

Signature: complete the basic battle loop.

### 17.4. Add drive check / damage check

Signature: encode Vanguard-specific resolution mechanics at engine level.

### 17.5. Complete zone transfer semantics

Signature: formalize movement between gameplay zones.

- soul
- drop
- bind
- damage
- ride deck
- G deck

### 17.6. Add state flags

Signature: card state must stay structured and explicit.

- rest
- stand
- locked
- imprisoned

### 17.7. Gameplay mechanics review checkpoint

Signature: validate that the engine still scales without devolving into
hard-coded edge-case logic.

### 17.8. Gameplay mechanics tests checkpoint

Signature: protect the basic playable loop before effect logic deepens.

## PHASE 18 - EFFECT SYSTEM

### 18.1. Build the effect registry

Signature: effects must become explicit runtime registrations, not ad hoc card
special cases.

### 18.2. Connect keyword/mechanics data to engine-level keyword handling

Signature: the existing catalog keyword data becomes engine input, not only
catalog metadata.

### 18.3. Introduce the hybrid effect model

Signature: mix typed handlers and declarative configs where that keeps the
system practical.

### 18.4. Implement the first real effects

Signature: prove the effect architecture against real cards rather than only
abstract interfaces.

### 18.5. Add event-triggered resolution

Signature: bind effects to the event model already established in rules-core.

### 18.6. Add stack / queue semantics if required by the chosen engine model

Signature: formalize ordering instead of hiding it in handler call order.

### 18.7. Effect system review checkpoint

Signature: confirm the effect layer scales and does not collapse engine
boundaries.

### 18.8. Effect system tests checkpoint

Signature: treat effect resolution as a high-risk regression surface.

## PHASE 19 - PLAYABLE MATCH PROTOTYPE

### 19.1. Complete match room workflows on top of existing gameplay persistence foundations

Signature: gameplay persistence artifacts already exist; the task is to make
them operational and coherent with the rules engine.

### 19.2. Build the basic match UI

Signature: expose the engine through a minimal but real play surface.

### 19.3. Render core gameplay zones

Signature: the UI must show state by zone, not through generic lists.

### 19.4. Complete visible zone coverage for the prototype

Signature: include the main areas needed for a real Vanguard turn loop.

- hand
- vanguard
- rear-guard
- damage
- drop
- ride deck
- G deck where applicable

### 19.5. Show available actions

Signature: the UI should reflect engine affordances rather than expecting users
to guess legal moves.

### 19.6. Add the event log

Signature: necessary for debugging, comprehension, and later multiplayer work.

### 19.7. Deliver a local single-session gameplay prototype

Signature: first real proof that the engine and UI can produce a playable loop.

### 19.8. Match UI review checkpoint

Signature: confirm the prototype is a real interactive loop, not a disconnected
debug screen.

### 19.9. Match UI tests checkpoint

Signature: protect the basic match interaction surface before realtime work.

## PHASE 20 - REALTIME

### 20.1. Add realtime sync for match rooms

Signature: layer synchronization on top of an already coherent local match
model.

### 20.2. Add realtime updates for social state where it improves UX

Signature: limit realtime scope to meaningful state changes rather than turning
every user surface into a subscription problem.

### 20.3. Add reconnect and recovery behavior

Signature: realtime is not credible without continuity after dropped sessions.

### 20.4. Formalize optimistic vs authoritative state handling

Signature: preserve server truth and engine authority while keeping the UI
responsive.

### 20.5. Realtime review checkpoint

Signature: validate that synchronization does not blur gameplay, social, and
ownership boundaries.

### 20.6. Realtime tests checkpoint

Signature: protect sync, reconnect, and authoritative-state behavior.

## PHASE 21 - V PREMIUM EXPANSION

### 21.1. Extend importer/publication/catalog support to V product lines

Signature: broaden content support through the existing operational pipeline.

### 21.2. Extend legality and restriction data for V support

Signature: content breadth without legality truth is not usable support.

### 21.3. Add V-specific mechanics and gifts support across catalog, validation, and runtime layers

Signature: keep format-specific meaning explicit instead of hiding it in ad hoc
exceptions.

### 21.4. Import V waves incrementally

Signature: continue the wave-by-wave operational model rather than replacing it.

### 21.5. V Premium review and tests checkpoint

Signature: confirm content, legality, and gameplay assumptions still align.

## PHASE 22 - PREMIUM EXPANSION

### 22.1. Support mixed-era coexistence safely

Signature: Premium needs explicit coexistence handling rather than accidental
cross-era blending.

### 22.2. Add G units, stride, and G guard support

Signature: these are foundational for Premium's real identity.

### 22.3. Extend Premium legality and mapping logic

Signature: make mixed-era support explicit and auditable.

### 22.4. Import older Premium-relevant waves incrementally

Signature: historical ingestion must still respect the same importer ->
publication boundary.

### 22.5. Premium review and tests checkpoint

Signature: validate coexistence across catalog, validation, and gameplay layers.

## PHASE 23 - SECURITY / RLS (Expansion)

### 23.1. Extend baseline RLS into fine-grained product behavior

Signature: this phase deepens the already existing authorization floor rather
than introducing it for the first time.

### 23.2. Add advanced authorization for sharing and public surfaces

Signature: only now broaden beyond owner-only defaults where product behavior
demands it.

- public decks
- friend-scoped reads
- sharing-aware visibility

### 23.3. Run a broader security audit

Signature: review accumulated access paths across catalog, user-owned data,
social, and gameplay surfaces.

### 23.4. Security review checkpoint

Signature: verify that access rules stayed coherent as features expanded.

### 23.5. Security tests checkpoint

Signature: protect policy behavior with automated enforcement checks.

## PHASE 24 - UI / PERFORMANCE / DX

### 24.1. UI polish pass

Signature: improve surfaces after the core flows are stable enough to stop
moving every week.

### 24.2. Responsive pass

Signature: make the mature surfaces reliable across device classes.

### 24.3. Accessibility pass

Signature: systematize accessibility once primary workflows have stabilized.

### 24.4. Performance pass

Signature: optimize the catalog, deck, and gameplay surfaces against real
bottlenecks rather than imagined ones.

- search
- rendering
- large lists

### 24.5. Caching and data-fetching review

Signature: align data-loading behavior with the now-mature product surface.

### 24.6. DX cleanup checkpoint

Signature: reduce accrued tooling and workflow friction after the heavy feature
phases.

## PHASE 25 - DOCS / DEPLOY / RELEASE

### 25.1. Bring README and operator-facing docs in line with the real system

Signature: top-level docs must reflect the actual repository and supported
product scope.

### 25.2. Consolidate architecture docs

Signature: gather the built system into a coherent architecture map.

### 25.3. Consolidate data model docs

Signature: preserve clarity across catalog, importer, user-owned, legality, and
gameplay data layers.

### 25.4. Consolidate rules engine docs

Signature: gameplay behavior cannot rely on code-only understanding.

### 25.5. Finalize the contribution guide

Signature: keep future engineering work aligned with the repo's real
boundaries.

### 25.6. Formalize deployment

Signature: make deployment a maintained product workflow rather than an ad hoc
developer ritual.

### 25.7. Prepare the production checklist

Signature: capture operational, security, and product readiness criteria
explicitly.

### 25.8. Release review checkpoint

Signature: final engineering gate before release.

### 25.9. Final test-suite checkpoint

Signature: confirm that critical product and system paths still hold together at
release time.
