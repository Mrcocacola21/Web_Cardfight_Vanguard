# Match History Foundation Review Checkpoint

## 1. Executive Summary

Phase 13 now reads as one coherent subsystem rather than a bag of isolated features.

The core model stays owner-owned, deck-linked, opponent-linked, and clearly separate from gameplay runtime state. Personal stats and friend-opponent stats are both derived from the same match-record source of truth instead of introducing a second mutable analytics layer.

The main remaining risks are not architectural collapse risks. They are scope-boundary risks:

- RLS confidence is stronger in schema design than in DB-backed regression coverage.
- Historical deck fidelity still depends on live deck linkage because snapshotting is intentionally not implemented yet.
- Full-history reads are acceptable at current scale, but the next scale step should move list/filter work deeper into repository queries or pagination.

## 2. Scope Reviewed

Reviewed as one subsystem:

- match record model and persistence
- manual match entry flow
- deck linkage
- opponent/social linkage
- match list with filters
- personal stats
- friend-opponent stats
- auth, ownership, privacy, and RLS posture
- test coverage posture

## 3. Match Model Review

The match model is clean for the current product phase.

- `social.matches` remains a persisted record model, not a gameplay session model.
- `entry_source` cleanly separates `manual` from future `gameplay`.
- `status`, `playedAt`, `notes`, and participant result fields are explicit and typed.
- Ownership is centered on `recorded_by_profile_id`, which keeps the phase aligned with personal-history semantics.
- The separate `match_participants` table gives future flexibility without forcing a shared authoritative two-user match model now.

Verdict:
The model is stable enough for later editing, list/detail, and gameplay-generated record adapters.

## 4. Deck Linkage Review

Deck linkage is implemented honestly through real owned deck versions.

- Manual entry resolves a real owner deck and uses its current persisted deck version.
- Application logic blocks attaching another user's deck.
- RLS on `deck_versions` and the trigger on `social.match_participants` provide data-layer protection.
- Read models degrade gracefully when deck linkage becomes stale or missing.

Tradeoff:
Historical deck context is not snapshot-based. If decks or deck versions are later removed, history survives but may lose title/version readability.

Verdict:
The linkage is architecturally clean and safe, with a known historical-fidelity tradeoff rather than a design bug.

## 5. Opponent/Social Linkage Review

Opponent linkage is also clean.

- Match records reference profile-layer identities, not raw auth identities.
- Manual entry uses `visible_profiles`, so it respects privacy/friend-aware visibility instead of bypassing it.
- Opponent selection does not require friendship unless visibility rules already allow the profile to be seen.
- Friend-opponent stats reuse the same opponent linkage rather than introducing a second social-opponent model.

Important positive detail:
Historical opponent linkage now preserves the stable opponent profile id even when the opponent profile summary is no longer visible. That keeps history and friend-opponent matching consistent without leaking hidden profile fields.

Verdict:
Social linkage is a bridge to match history, not a collapsed combined model.

## 6. Manual Entry Flow Review

The manual entry flow is product-coherent and architecturally clean.

- Validation is centralized in `manual-match-entry-validation.ts`.
- The server action remains a thin adapter.
- The use case owns owner-profile resolution, deck ownership checks, opponent visibility checks, self-opponent blocking, and write orchestration.
- The flow stores explicit result/date/notes fields without pretending to be gameplay runtime.

Verdict:
Manual entry already behaves like a real product feature, not a temporary hack.

## 7. Match List Review

The list route is structurally clean:

- protected owner-only route
- server-backed read model
- filter normalization in query parsing
- filter application in the application layer
- UI consumes a stable list projection rather than raw DB rows

Fix applied during this checkpoint:

- The list read model no longer silently works over only the first 100 records.
- It now reads the full owner history before computing total count, filters, and available deck options.

Remaining tradeoff:
This keeps semantics correct now, but it also means the current list foundation is full-read based rather than query/pagination optimized.

Verdict:
Correct and coherent for current scope, with a future scale boundary that is explicit rather than hidden.

## 8. Personal Stats Review

Personal stats are implemented the right way for this phase.

- They are derived from match records.
- There is no second source of truth or mutable stats table.
- Aggregation formulas are explicit and stable.
- Top-decks aggregation is shared infrastructure, not duplicated page logic.
- Empty state is honest and does not fake analytics before there are tracked matches.

Verdict:
This is a sound baseline analytics layer.

## 9. Friend-Opponent Stats Review

Friend-opponent stats are architecturally consistent with the personal stats layer.

- They are owner-owned scoped aggregations over the same match records.
- Current active friendships are used as a filter scope only.
- Pending requests do not count as friendship.
- Former-friend policy is explicit: historical matches remain valid elsewhere, but current friend-opponent stats only include current active friends.
- No privacy leakage to the friend is introduced by this route.

Verdict:
The social bridge is clean and scoped. It does not introduce a second analytics system.

## 10. Auth / Privacy / RLS Review

The authorization posture is coherent across layers.

- `social.matches` and `social.match_participants` are protected by owner-only RLS policies.
- Manual entry resolves the current auth user to the current profile before writes.
- Deck attachment is protected by both application checks and a DB trigger that enforces deck ownership.
- List, personal stats, and friend-opponent stats are all resolved from the current profile server-side.
- Opponent visibility stays constrained by `visible_profiles` instead of bypassing profile privacy rules.

No obvious UI-only hiding problem was found in Phase 13 surfaces.

Residual concern:
Most confidence here comes from schema policies plus application tests, not from DB-backed negative authorization tests against a real policy environment.

## 11. Test Coverage Review

Coverage is meaningfully better than a superficial feature-phase test suite.

What is covered well:

- manual entry validation and use-case invariants
- deck ownership and self-opponent rejection
- list filtering behavior and stale-link fallbacks
- personal stats aggregation
- friend-opponent current-friend scoping
- page-state wiring and key UI states
- repository query shape and fallbacks

What is still thinner than ideal:

- DB-backed cross-user RLS regression tests
- higher-volume pagination/query behavior tests for the list surface

Verdict:
The phase is reasonably protected against normal behavioral regressions, but not yet maximally protected against policy drift at the database boundary.

## 12. Top Findings

### Finding 1

- Severity: Medium
- Issue: Match-history authorization confidence is stronger in migrations and unit tests than in DB-backed negative tests.
- Why it matters: A future RLS policy change or schema/view drift could weaken owner-only guarantees without being caught by the current mostly mocked test suite.
- Recommendation: Add a small set of DB-backed cross-user tests before expanding match sharing, editing, or broader social analytics.

### Finding 2

- Severity: Low
- Issue: Historical deck fidelity still depends on live deck linkage rather than immutable deck snapshots.
- Why it matters: Deleting or heavily mutating decks can reduce long-term readability of historical match records and top-deck analytics.
- Recommendation: Decide whether future phases need snapshot fields for deck title/version before building features that assume immutable historical deck identity.

### Finding 3

- Severity: Low
- Issue: Current list and stats foundations rely on loading the owner's full match history into application memory.
- Why it matters: This is fine for foundational scale, but it becomes a cost and latency issue once history volume grows materially.
- Recommendation: Introduce query-side filtering and minimal pagination when Phase 13 grows beyond foundational personal-history scale.

## 13. Fixes Applied

- Corrected the match-history list read model so it no longer silently truncates history to the first 100 records before computing total counts and filters.

## 14. Final Verdict

**GO WITH CONDITIONS**

Phase 13 is coherent enough to close as a foundation phase.

The subsystem boundaries are still crisp:

- match records are not pretending to be gameplay runtime
- stats remain derived
- deck linkage and social linkage stay references, not absorbed state
- owner-only semantics remain consistent through application code and RLS design

The remaining conditions are non-blocking for closing the phase, but they should stay on the near-term engineering backlog:

- add DB-backed authorization regression tests
- decide when historical deck snapshotting becomes product-critical
- move toward query-side pagination/filtering when match volume justifies it
