# Deck Builder Tests Checkpoint

## 1. Scope of This Checkpoint

This checkpoint covers the builder baseline before validation work begins:

- deck domain invariants
- deck list -> create -> open builder chain at unit/integration depth
- builder add/remove/quantity behavior
- draft/autosave save-state behavior
- metadata editing through the same draft/save pipeline
- owner-safe deck detail routing where relevant
- entity-based deck integrity

This checkpoint does not try to cover:

- format validation rules
- gameplay/runtime rules
- collection semantics
- a large browser matrix

## 2. What Was Tested

- `packages/decks/src/deck-operations.test.ts`
  - aggregate invariants
  - metadata mutations
  - quantity rules
- `apps/web/src/features/decks/server/deck-actions.test.ts`
  - create / duplicate / delete server flows
- `apps/web/src/features/decks/server/deck-builder-actions.test.ts`
  - add / increment / decrement / save draft server behavior
- `apps/web/src/components/decks/deck-create-form.test.tsx`
  - create flow UI entry
- `apps/web/src/components/decks/deck-builder-view.test.tsx`
  - builder render, empty state, add/remove/quantity, draft/autosave, metadata
- `apps/web/src/app/(protected)/decks/[deckId]/page.test.tsx`
  - owner-bound route behavior and catalog read wiring

## 3. Domain Logic Coverage

Covered at the domain level:

- `addCard`
- `removeCard`
- `setCardCount`
- `incrementCard`
- `decrementCard`
- no duplicate row creation for the same `CardEntity`
- quantity floor and builder-level max guard
- metadata mutations without touching canonical composition

This is the main protection for deck integrity before validation rules land.

## 4. Builder UI Flow Coverage

Covered at the component/integration level:

- builder layout renders from server-loaded deck data
- empty deck state
- add card from catalog
- add the same card twice without duplicate deck rows
- decrement to zero removes the row
- search-based add uses the same add path
- copy-cap disable state
- route-level owned deck load
- route-level non-owner -> `notFound()`

## 5. Draft / Autosave Coverage

Covered:

- local edit marks the builder dirty
- autosave returns state to saved
- repeated edits coalesce into one autosave request
- save failure keeps the local draft and surfaces retry state
- temporary draft backup restores after refresh/navigation

This part is strong enough for Phase 10 input because the save-state model is now protected by tests instead of only manual review.

## 6. Metadata Coverage

Covered through the same builder draft pipeline:

- name edit
- format edit
- description edit
- tags add/remove
- favorite toggle
- metadata backup restore
- metadata autosave through the same save action as deck cards

## 7. Entity-Level Integrity Coverage

The checkpoint explicitly protects the deck boundary:

- deck cards are asserted through `cardEntityId`
- repeated add/search flows preserve one row per entity
- builder route and builder actions stay catalog/entity-based
- no test path introduces printing-level semantics into deck state

## 8. E2E Coverage

A dedicated deck browser sanity path was prepared in:

- `tests/e2e/decks.spec.ts`
- `apps/web/scripts/test-decks-e2e.mjs`

Current status:

- the spec is intentionally skipped
- reason: the authenticated browser runtime still hits an upstream auth/profile
  read gap before profile-owned deck reads become stable

This means there is still no green deck-specific browser confidence path today.
That gap is documented rather than hidden.

## 9. What Is Still Not Covered

- green browser-level deck builder flow on the real runtime
- delete/duplicate deck behavior at browser level
- multi-browser matrix
- save-failure behavior at browser level
- validation messaging, because Phase 10 has not started yet

## 10. Current Risks

- `MEDIUM`: deck builder browser confidence is still blocked by the current auth/profile runtime gap. Unit/component coverage is strong, but one real user path remains unproven in the browser.
- `ACCEPTABLE TRADE-OFF`: delete/duplicate are covered at server/list levels, not by a browser path yet.
- `ACCEPTABLE TRADE-OFF`: no validation-rule coverage exists here by design; that belongs to Phase 10.

## 11. Final Verdict

`GO WITH CONDITIONS`

Reasoning:

- the deck builder baseline is now well protected at domain, server, route, and component levels
- autosave/draft and metadata behavior are meaningfully covered
- entity-based deck integrity is explicitly defended
- but a green browser-level deck workflow is still blocked by an upstream auth/profile runtime issue

Practical recommendation:

- it is reasonable to move into Phase 10 validation work
- do not treat the deck builder as fully end-to-end hardened until the auth/profile runtime gap is closed and the skipped deck e2e path can run green
