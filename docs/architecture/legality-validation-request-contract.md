# Legality Validation Request Contract

Status: Cross-context legality input contract  
Last updated: 2026-04-07

## Why This Document Exists

This document defines what `legality` receives as its canonical input boundary.

The project already has:

- a published `deck snapshot` contract;
- a published `format profile` contract;
- a published capability-support model;
- a legality-result direction and validation-context model.

What was still missing is the explicit request contract by which another context asks `legality` to evaluate a deck.

Without that contract, the architecture will drift in predictable ways:

- `decks` will send raw editor or persistence-shaped data;
- `web app` will assemble legality inputs ad hoc;
- API or orchestration layers will invent local request semantics;
- unsupported and partially supported cases will be handled inconsistently;
- `legality` will become coupled to caller internals instead of published contracts.

### Decision 1: `Legality Validation Request` Is a Required Boundary Contract

Decision:

- The project must treat legality invocation as an explicit boundary contract, not as an ad hoc function call over whatever deck-shaped data happens to exist.

Rationale:

- Legality is a bounded context with its own truth layer.
- It needs one stable way to receive input regardless of which caller initiates validation.

Practical implication:

- Callers must build or transport a canonical legality validation request.
- `legality` must not accept raw editor state, page payloads, or persistence rows as its semantic input boundary.

## What a Legality Validation Request Is

A `legality validation request` in this project is:

- the minimal, stable, explicitly formed input contract by which a caller asks the `legality` context to evaluate the admissibility of a deck or deck-like subject under declared legality semantics.

It is not:

- a UI payload;
- a database row or persistence shape;
- raw builder state;
- a legality result;
- runtime gameplay state;
- a format profile;
- a substitute for capability publication.

### Decision 2: Request Means "Evaluate This Subject Under This Legality Invocation Context"

Decision:

- The request should represent an evaluation attempt, not just a deck object.

Rationale:

- Legality does not only need the deck-shaped subject.
- It also needs the legality-owned invocation semantics that explain what kind of evaluation is being requested.

Practical implication:

- A legality validation request must be more specific than "here is a deck."

## Why It Must Be a Separate Contract

The request contract is separate because `deck snapshot` and legality invocation are not the same thing.

`Deck snapshot` answers:

- what deck is being presented across contexts;
- which cards and sections it contains;
- which format is attached to that deck representation.

`Legality validation request` answers:

- what admissibility evaluation is being asked for;
- under which legality-owned target semantics the evaluation should run;
- whether the request is well-formed enough to evaluate at all.

### Decision 3: Deck Snapshot Is the Shared Deck Input; Validation Request Is the Canonical Legality Invocation Contract

Decision:

- `deck snapshot` remains the general deck input contract across contexts.
- `legality validation request` is the legality-specific invocation contract built on top of that deck input.

Rationale:

- If the two are collapsed, either the deck snapshot becomes legality-shaped or callers invent legality semantics outside `legality`.

Practical implication:

- The request contract should stay narrow.
- It should compose published deck input with legality-owned invocation meaning.

### Decision 4: The Request Contract Must Stay Narrower Than a New General-Purpose Shared Model

Decision:

- This contract should be treated as a narrow invocation boundary, not as a replacement for deck snapshot or a new generic transport object for every context.

Rationale:

- The architecture already limits shared contracts intentionally.
- The request contract exists only to define the legality input boundary cleanly.

Practical implication:

- Do not expand legality request into a catch-all object for UI state, deck editing, or gameplay preparation.

## Ownership of Request Semantics

### Decision 5: `Legality` Is the Sole Owner of Validation-Request Semantics

Decision:

- The `legality` context is the sole owner of what a legality validation request means.

Rationale:

- Request semantics define how legality should interpret its input boundary.
- That belongs to the bounded context that performs legality evaluation.

Practical implication:

- `decks`, `web app`, and API layers may construct or transport requests.
- They must not redefine target semantics, support interpretation, or request meaning.

### Decision 6: Callers May Assemble Requests, but They May Not Invent New Meanings

Decision:

- Non-legality callers may assemble a request only by using legality-owned request semantics and published upstream contracts.

Rationale:

- Construction and ownership are different concerns.

Practical implication:

- A caller may select a published validation target.
- It may not invent a local target such as "quick-check" unless `legality` has published what that means.

## Relationship to Deck Snapshot

### Decision 7: A Legality Validation Request Must Be Built on a Published Deck Snapshot

Decision:

- The request must carry a deck subject through the published `deck snapshot` contract or a stable reference to such a snapshot.

Rationale:

- `legality` should consume deck input through the same published boundary regardless of caller.
- That keeps it independent of deck storage internals and UI editor state.

Practical implication:

- If a caller cannot produce a valid deck snapshot, it does not yet have a legality-ready subject.

### Decision 8: Request Is Not Allowed to Contradict Snapshot Format Attachment

Decision:

- The effective deck format for legality must come from the attached format reference in the supplied deck snapshot.
- The request must not carry a contradictory local format override.

Rationale:

- Format attachment is already part of deck-version meaning.
- Letting the request override it would recreate multi-source format semantics.

Practical implication:

- Format selection happens in `decks`.
- Legality evaluation receives the chosen format through the snapshot it is asked to evaluate.

### Decision 9: Request Adds Legality Invocation Semantics, Not a Second Deck Representation

Decision:

- The request may add legality-oriented invocation data such as validation target or evaluation scope selection.
- It must not redefine deck structure or deck content beyond the supplied snapshot.

Rationale:

- `decks` owns deck representation.
- `legality` owns evaluation semantics.

Practical implication:

- The request should wrap or reference the snapshot, not mutate or reinterpret it.

## Required Request Content Categories

The legality request should contain only the categories needed to make legality invocation explicit.

### Required Category 1: Deck Subject

The request must identify the deck subject being evaluated through:

- an embedded published deck snapshot; or
- a stable reference to a published deck snapshot that `legality` can resolve without reading deck persistence internals directly.

### Required Category 2: Effective Format Reference

The request must make the effective format reference available through the attached format in the deck snapshot.

This does not require a second independent format field if the snapshot already carries the format key clearly.

### Required Category 3: Validation Target

The request must declare the legality-owned target semantics under which the evaluation is being requested.

Examples of conceptual targets include:

- general deck admissibility;
- publish or share readiness;
- gameplay-entry readiness.

The request should use a default target only if `legality` has defined one canonically.

### Required Category 4: Request Scope Markers When Legality Publishes Multiple Evaluation Scopes

If `legality` exposes more than one owner-defined evaluation scope within the same target family, the request must identify which published scope is being requested.

Examples:

- declared supported coverage boundary;
- strict readiness versus general informational validation.

This category exists only when legality has published a meaningful distinction. It must not be invented locally by callers.

### Required Category 5: Optional Correlation or Trace Reference

The request may carry a correlation or source reference that helps callers relate a returned legality result to the originating deck version, workflow step, or user action.

That reference must remain observational only. It must not alter legality meaning.

### Decision 10: The Request Must Contain Only What Legality Needs to Interpret and Execute Validation

Decision:

- Every field category in the request must justify itself as necessary either to identify the deck subject or to interpret legality-owned invocation semantics.

Rationale:

- The request boundary should remain stable and minimal.

Practical implication:

- If a field exists only for UI convenience or storage convenience, it does not belong in the request.

## Excluded Content Categories

The request must not include:

- UI-only state such as active tab, sorting, selected filters, or draft view mode;
- page-level warnings or display hints;
- temporary editor flags that do not affect legality semantics;
- full catalog entities or printing payloads;
- raw importer data or provenance records;
- social or sharing decoration fields;
- runtime gameplay state;
- hidden capability booleans such as "assume supported" or "skip unsupported mechanics";
- expected legality outcomes or caller guesses about the result;
- full persistence internals or database rows;
- a resolved legality result as if it were authoritative input.

### Decision 11: Request Must Not Smuggle Caller Assumptions into Legality

Decision:

- The request must not carry caller expectations that change how legality interprets rules or support.

Rationale:

- Legality must derive its conclusions from published contracts and owned semantics, not from hints supplied by callers.

Practical implication:

- A caller may request a published validation target.
- It may not pass hidden flags such as "treat partial support as good enough" or "ignore unsupported rule families."

## Validation Target Semantics

Validation target is the legality-owned answer to the question:

- "What kind of admissibility claim is the caller asking legality to make?"

It is not:

- a UI mode;
- a page name;
- a free-form caller intent string;
- an alternate rules engine;
- a permission for callers to change legality meaning.

### Decision 12: Validation Target Is an Owner-Defined Request Dimension

Decision:

- The request should include a validation target whenever target choice changes the expected admissibility claim or completeness threshold.

Rationale:

- The same deck may be checked for general informational feedback, for publish readiness, or for gameplay entry.
- Those flows should not create local custom logic outside `legality`.

Practical implication:

- Target semantics belong to `legality`.
- Callers select among published targets; they do not create them.

### Decision 13: Validation Target May Change Required Completeness, but Not Canonical Rule Meaning

Decision:

- Target selection may change how complete or authoritative the legality claim must be.
- It must not redefine the underlying format, restriction, or construction rules.

Rationale:

- A gameplay-entry target may require a stricter admissibility claim than draft feedback.
- That does not mean the rules themselves changed.

Practical implication:

- Target affects evaluation expectation, not rule ownership.

### Default Target Guidance

The architecture should assume one canonical default target unless `legality` publishes a more specific alternative:

- general deck admissibility for the attached format under current published support boundaries.

This default keeps ordinary deck-builder validation from inventing its own local meaning.

## Request Completeness and Incomplete Input Handling

Request completeness is about whether `legality` can interpret the request boundary correctly.

It is not:

- deck correctness;
- legality success;
- full capability support.

### Decision 14: A Request May Be Complete Even When the Deck Is Incomplete or Invalid

Decision:

- A request is complete when it contains a valid deck snapshot, an effective format reference, and enough legality-owned invocation semantics to begin evaluation.

Rationale:

- Legality often needs to evaluate decks that are currently incomplete or invalid.

Practical implication:

- A format-attached draft with explicit sections and resolved card identity may be a valid request even if it fails structure checks.

### Decision 15: Malformed Request, Incomplete Deck, Unsupported Capability, and Invalid Deck Must Stay Separate

Decision:

- The system must distinguish:
- malformed request;
- complete request over an incomplete or invalid deck subject;
- unsupported capability;
- partially supported evaluation;
- invalid legality outcome.

Rationale:

- These are different failure modes with different owners and different user meaning.

Practical implication:

- A malformed request is a boundary error, not a deck illegality.
- Unsupported capability is a platform-support statement, not a deck-quality statement.
- Invalid deck is a known failed legality conclusion within a valid evaluation attempt.

### Guidance on Malformed Request

The request should be treated as malformed when required contract elements are missing or contradictory, such as:

- no valid deck snapshot;
- unresolved attached format at the point validation is requested;
- unresolved canonical card identity where the snapshot contract requires resolution;
- contradictory request values that violate published legality semantics.

Malformed request should be rejected at the legality boundary or upstream orchestration layer. It should not be translated into `legal`, `illegal`, or `unsupported` deck semantics.

## Relationship to Capability Support

### Decision 16: Request Does Not Define Capability Support

Decision:

- The request may describe what evaluation is being asked for, but it must not declare whether the system supports that evaluation.

Rationale:

- Capability support is already a separately published owner-governed layer.

Practical implication:

- `legality` resolves support status by consulting published capability support and its own validation context assembly.
- Callers must not inject support truth through request flags.

### Decision 17: Unsupported and Partial Outcomes Must Emerge from Capability Support Plus Legality Semantics

Decision:

- Unsupported or partially supported legality outcomes must come from legality-owned interpretation of published capability support, not from informal caller-side conventions.

Rationale:

- Support-state handling must remain consistent across deck builder, API, and future gameplay-entry flows.

Practical implication:

- A caller should never send "assume supported mechanics" or "ignore unsupported checks" as request semantics.

## Caller Responsibilities

### Decks

`decks` may:

- assemble a legality request from a published deck snapshot;
- choose among legality-published validation targets;
- attach observational correlation data;
- store or display returned legality results.

`decks` must not:

- redefine request meaning;
- embed legality rules in deck assembly;
- bypass the request contract with persistence internals or editor-local state.

### Web App

`web app` may:

- orchestrate request flow between user action and legality invocation;
- pass through canonical request data;
- map user actions to published validation targets.

`web app` must not:

- become the owner of request semantics;
- build UI-specific request variants with different legality meaning;
- patch missing deck semantics at page level.

### API and Transport Layers

API-facing or transport-facing layers may:

- carry the canonical legality request across process or module boundaries;
- validate transport-level shape separately from domain meaning.

They must not:

- redefine domain semantics;
- convert convenience payloads into new legality meanings;
- infer support truth or validation targets that `legality` did not publish.

### Future Gameplay Entry

Future match-entry or gameplay-setup flows may:

- invoke `legality` using the same canonical request contract;
- choose a stricter legality-owned target such as gameplay-entry readiness if `legality` publishes that target.

They must not:

- replace legality request semantics with gameplay state or runtime assumptions.

## Anti-Patterns

The following practices are explicitly prohibited:

- `legality` consumes raw editor state directly.
- UI invents its own validation modes.
- `deck snapshot` and `legality validation request` are treated as identical without explicit discipline.
- the request carries UI hints that change legality meaning.
- the request carries expected-result assumptions.
- different callers construct semantically different requests for the same deck subject and target.
- request shape depends on persistence rows or storage internals.
- callers pass full catalog entities instead of canonical deck snapshot input.
- callers pass capability override flags instead of reading published support truth.

## Examples

### Example 1: Canonical Request from a Persisted Format-Bound Deck

- `decks` publishes a Standard deck snapshot with attached format key, explicit sections, canonical card references, and counts.
- The caller builds a legality request using that snapshot and the default target of general deck admissibility.
- `legality` evaluates the request under its validation context and returns a legality result.

This is the normal path.

### Example 2: Draft Deck with Incomplete Structure

- The builder has attached a format and resolved card identities.
- The ride deck is structurally explicit but incomplete.
- `decks` can still publish a valid deck snapshot.
- A legality request built from that snapshot is valid.
- `legality` may return `illegal` for known structure failure or `no_assertion` if some requested checks are only partially supported.

The request is complete even though the deck is not.

### Example 3: Gameplay-Entry Check Reuses the Same Request Boundary

- A future match-entry flow wants to ensure a deck is admissible before setup.
- It builds the same canonical legality request shape from the deck snapshot.
- It selects a legality-published gameplay-entry readiness target rather than inventing a custom pre-match rule path.

This keeps match entry aligned with the legality context instead of creating a second legality system.

### Example 4: Bad Raw Editor Input

- A page sends local unsaved builder state directly to `legality`.
- The payload includes current tab, local warnings, unresolved card picks, and visual grouping metadata.

This is invalid architecture. The page must first normalize that state into a published deck snapshot and then build a canonical legality request.

### Example 5: Bad Request with Hidden Assumptions

- A caller sends a request with a flag equivalent to "assume supported mechanics."
- `legality` then skips unsupported rule-family handling.

This is prohibited. Support handling must come from published capability support and legality-owned semantics, not from caller hints.

## Final Recommendations

- Treat legality validation request as a mandatory separate contract.
- Keep `legality` as the sole owner of request semantics, target meanings, and interpretation rules.
- Build the request on top of a published deck snapshot, not raw editor or persistence state.
- Do not let the request override deck-attached format meaning.
- Keep the request minimal: deck subject, effective format, legality-owned target semantics, and only the scope markers legality has explicitly published.
- Keep capability support outside the request and let `legality` resolve it from published support truth.
- Reject malformed requests as boundary failures, not as deck illegality.
- Treat the legality validation request as the canonical input boundary for all deck-admissibility evaluation.
