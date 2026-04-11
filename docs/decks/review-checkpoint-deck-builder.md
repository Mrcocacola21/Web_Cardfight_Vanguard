# Deck Builder Review Checkpoint

## 1. Executive Summary

Verdict: `GO WITH CONDITIONS`

The current deck builder is usable as a real product workflow. The screen is
structurally clear, add/remove/quantity behavior is predictable, and the
draft/autosave model is strong enough for a first builder foundation.

The builder is not in redesign territory, but it does carry a few conditions
that must stay explicit before Phase 10:

- validation must layer on top of the existing draft model instead of creating
  a second competing client truth;
- metadata-driven format changes must stay aligned with the catalog read path;
- UI density must stay controlled as validation messages and richer content are
  introduced.

## 2. Scope Reviewed

- `/decks/[deckId]` builder route and page composition
- metadata editing block
- catalog panel and deck panel interactions
- add/remove/quantity flows
- draft state and autosave behavior
- save-state feedback and retry path
- client draft model and server persistence path
- readiness for Phase 10 integration

## 3. UX Review

The builder currently works as a practical user screen rather than a developer
debug surface.

Positive points:

- the screen has a clear top-to-bottom reading order: header, metadata,
  catalog, current deck;
- the left/right mental model is understandable on desktop and stacks
  acceptably on smaller screens;
- add/remove/quantity actions are obvious and do not require knowledge of
  importer/catalog internals;
- empty states are honest and not noisy.

Weaknesses:

- the screen is already moderately dense, especially once metadata, save
  status, search, and deck rows all coexist;
- as soon as validation errors are added, the current layout will need
  discipline to avoid turning into a control wall.

## 4. Layout / Interaction Review

The layout is readable and the main regions are conceptually separated.

Positive points:

- metadata is visually separated from the catalog and current deck surfaces;
- catalog and deck panels have distinct responsibilities;
- save-state feedback lives in the header and does not interrupt core actions;
- mobile fallback is acceptable because the layout collapses into stacked cards
  instead of forcing a broken two-column squeeze.

Risk area:

- the header badge cluster can become crowded if validation badges, more deck
  status, or sync indicators are added without pruning.

## 5. Add/Remove/Quantity Review

The core composition workflow is in good shape.

Positive points:

- add flow is the same whether the user comes from the base catalog list or
  filtered search results;
- repeated add operations increment quantity instead of creating duplicate deck
  rows;
- decrement/remove behavior is predictable and keeps the deck aggregate clean;
- the temporary copy cap is surfaced clearly enough for the current phase.

Acceptable trade-off:

- the builder still uses a coarse UX cap rather than real format-aware rules.
  This is correct for the current phase as long as Phase 10 becomes the source
  of formal legality.

## 6. Draft State / Autosave Review

This is the strongest part of the current builder.

Positive points:

- local draft edits feel immediate;
- autosave is debounced and not tied to every render;
- `Saved`, `Unsaved changes`, `Saving...`, and error states are explicit;
- save failures keep local work intact and expose a retry path;
- session backup gives a practical same-session recovery path after refresh or
  accidental navigation.

Acceptable trade-off:

- recovery durability is session-scoped, not offline-first or multi-device.
  That is the right scope for this phase.

## 7. State Management Review

The state model is still healthy, but it is close enough to complexity that it
now needs architectural discipline.

Current truths:

- server-loaded deck detail for initial composition;
- client draft as the editable working truth;
- `lastSavedDraft` as persisted comparison baseline;
- small local UI-only state such as pending tag input and transient title text;
- session storage backup as temporary recovery aid.

Assessment:

- this is still manageable and understandable;
- the current model has one real editable truth: the draft;
- the extra local state is limited and purposeful, not yet scattered chaos.

Condition:

- validation must not introduce its own mutable deck state. It should evaluate
  the existing draft and render derived feedback from it.

## 8. Optimistic Updates Review

The builder uses a partial optimistic model, and that is the correct choice.

What it does well:

- card and metadata edits apply locally first;
- persistence happens asynchronously through autosave;
- there is no fake server-confirmed state pretending to be final before save.

What it deliberately does not do:

- no complex rollback orchestration;
- no mutation queue visualizer;
- no collaborative conflict model.

Assessment:

- this is honest optimism, not misleading optimism.

## 9. Domain Boundary Review

Boundary cleanliness remains good.

- deck composition is still canonical-card based, not printing-based;
- UI triggers domain-shaped operations instead of rebuilding business rules
  ad hoc in view code;
- repository remains persistence-oriented;
- metadata lives inside the deck aggregate and shares the same save pipeline as
  cards;
- the builder is not trying to become the validation engine.

## 10. Readiness for Validation Phase

The builder is ready to move into Phase 10, with conditions.

Why it is ready:

- there is a stable deck draft to validate;
- save-state behavior is understandable enough to coexist with validation;
- quantity/add/remove semantics are already normalized at the aggregate level;
- metadata and composition share one persistence path.

What Phase 10 must avoid:

- adding a second client-owned deck state for validation;
- turning validation messages into blocking UI noise everywhere at once;
- reintroducing printing-level semantics into the builder.

## 11. Top Findings

### Finding 1

- issue: format changes could leave the catalog panel visually attached to the
  old server-loaded format until a manual refresh
- why it matters: this creates a direct UX inconsistency between deck metadata
  truth and catalog read truth
- severity: `MEDIUM`
- recommendation: refresh the server-driven route after a successful persisted
  format change so catalog truth and builder metadata stay aligned

### Finding 2

- issue: invalid deck name editing uses a small dual-state model
  (`titleInput` vs persisted draft title)
- why it matters: the model is fine now, but if more fields copy this pattern
  casually the builder will drift into fragmented local truth
- severity: `ACCEPTABLE TRADE-OFF`
- recommendation: keep transient invalid-input handling narrowly scoped and do
  not spread it to other builder fields without a stronger form-state plan

### Finding 3

- issue: the builder layout is already moderately dense before validation
  messaging arrives
- why it matters: Phase 10 can easily turn the screen into a status-heavy,
  cluttered workspace if feedback is injected without hierarchy
- severity: `ACCEPTABLE TRADE-OFF`
- recommendation: add validation surfaces as one clearly bounded summary area
  instead of sprinkling warnings across metadata, header, catalog, and deck
  rows simultaneously

## 12. Fixes Applied

- applied a small builder fix so successful format changes now trigger a route
  refresh and reload the catalog panel against the persisted format boundary
- added focused regression coverage for that behavior

## 13. Final Verdict

`GO WITH CONDITIONS`

The current deck builder is solid enough to support Phase 10. It is not
feature-complete, but it is no longer fragile prototype territory.

Move forward to validation if the next phase keeps these rules:

- draft state remains the only editable client truth;
- validation remains derived from draft state;
- new UX feedback is introduced with strict hierarchy;
- catalog/read-side alignment remains server-truth-first.
