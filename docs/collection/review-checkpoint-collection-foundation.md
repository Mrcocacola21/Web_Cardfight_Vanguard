# Collection Foundation Review Checkpoint

## 1. Executive Summary

Phase 14 now reads as one coherent collector subsystem instead of four isolated
features.

Collection ownership, binder/list read-side, printing-level hardening, and
wishlist/favorites all preserve the same core boundary: catalog truth describes
printings, while user-owned rows overlay private ownership and preference
state.

## 2. Scope Reviewed

- user collection foundation
- binder/list inventory read model
- printing-level semantic hardening
- wishlist/favorites preference layer
- repository, application, server, UI, and docs boundaries
- relevant tests for web and db packages

## 3. Collection Model Review

Collection is modeled as owner-owned inventory over `collection_items` with
explicit quantity semantics and a separate preference model in
`collection_printing_preferences`.

This is no longer a shadow deck model and no longer tries to act as catalog
truth.

## 4. Printing-Level Semantics Review

The main invariant holds end-to-end.

- collection identity is owner + printing
- quantity stays on the printing row
- binder/list read model returns distinct rows for distinct printings
- wishlist/favorites also target exact printings
- tests explicitly guard against drift toward entity-level ownership

## 5. Deck Boundary Review

The deck boundary remains intact.

Deck persistence stays canonical-card based, while collection persistence stays
printing-based. No hidden assumption was found that "owned in collection"
automatically means "available for deck".

## 6. Catalog Boundary Review

Catalog remains the published source of card, product, and printing truth.

Collection repositories only read catalog-linked summaries and never write into
catalog tables. Missing linked printing summaries degrade to stale inventory
state instead of rewriting ownership semantics.

## 7. Quantity / Inventory Review

Inventory behavior is coherent.

- no negative quantities
- no persistent zero rows
- decrement to zero removes the row
- uniqueness is enforced on owner + printing
- add/remove/update paths remain predictable for repeated actions

## 8. Wishlist/Favorites Review

Preferences are semantically separate from ownership.

Owned quantity does not imply wishlist/favorite state, and wishlist/favorite
state does not imply owned quantity. Preference rows are private, printing-based
and stored separately from collection inventory rows.

## 9. Binder/List Review

Binder and list are two renderings over one owner-scoped inventory read model.

Printing identity stays visible enough through printing labels, rarity, variant
markers, release context, and per-printing actions. The page reads as
inventory, not as raw DB rows and not as copied deck UI.

## 10. Auth / Privacy / RLS Review

Owner-only protection is consistent across collection and preferences.

Server reads resolve the current profile, server mutations resolve the current
authenticated owner, and DB tables enforce owner-only RLS on
`owner_profile_id`. No UI-only privacy illusion was found in the collection
subsystem.

## 11. Test Coverage Review

Current coverage is strong for the scope of Phase 14.

- db tests cover collection persistence, preference persistence, invalid
  printing rejection, and printing-based boundaries
- web tests cover inventory mutations, binder/list rendering, preference
  rendering, owner-scoped read paths, and printing distinction in UI
- `@web-vg/web test`, `@web-vg/web typecheck`, `@web-vg/db test`, and
  `@web-vg/db typecheck` pass in the current workspace

The local Docker-backed `@web-vg/db test:db` checkpoint could not run in this
environment because Docker Desktop was unavailable, so that remains an
environmental rather than semantic blocker.

## 12. Top Findings

### Medium - Preference profile-resolution boundary was typed too broadly

- Issue: preference use cases reused the collection profile resolver, but the
  resolver signature still required the write-side collection repository shape
- Why it matters: this weakened the application boundary and broke web
  typecheck, making preference flows look coupled to inventory mutation
  semantics
- Recommendation: narrow the resolver to the profile repository contract only

### Low - Wishlist/favorites foundation document was missing

- Issue: Step 14.4 shipped code and tests without its requested semantic doc
- Why it matters: Phase closure needs explicit documentation of the ownership
  vs preference split and printing-level choice
- Recommendation: add the missing short engineering doc

### Low - Preference section UI test assumed a single remove action

- Issue: the test expected one remove button even though two owner-owned
  preference rows correctly render two remove actions
- Why it matters: the failing assertion obscured the real health of the
  subsystem
- Recommendation: align the test with the actual per-entry action model

## 13. Fixes Applied

- narrowed collection profile resolution typing so preference use cases depend
  only on the profile lookup contract
- fixed the preference section UI test to assert two remove actions for two
  distinct preference rows
- added `docs/collection/wishlist-favorites-foundation.md`

## 14. Final Verdict

**GO**

Phase 14 is ready to close.

Collection remains a clean collector-facing subsystem:

- inventory is owner-owned and printing-based
- preferences are a separate private axis
- deck semantics remain separate
- catalog truth remains authoritative
- tests now protect the main semantic boundaries with a green package-level
  baseline
