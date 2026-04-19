# Social Foundation Review Checkpoint

## 1. Executive Summary

Phase 12 social foundation is now coherent enough to be treated as one system
instead of disconnected feature slices. Search, friend-request lifecycle,
friendship persistence, friend removal, friends dashboard reads, and privacy
flags all resolve against the same app-facing profile and friendship models.

No critical auth, privacy, or lifecycle break was found in the reviewed code
paths. The main remaining concerns are product/policy constraints rather than
immediate security defects:

- discoverability and requestability are intentionally coupled to public
  profile visibility
- profile pairs are history-locked after the first friend request
- RLS confidence still relies more on migration review and unit tests than on
  DB-backed auth-context tests

Verdict: **GO WITH CONDITIONS**

## 2. Scope Reviewed

Reviewed areas:

- user search read model and UI
- public profile read path
- friend-request creation
- accept / decline lifecycle
- friendship persistence and removal
- friends dashboard read model and integrated actions
- privacy flags persistence and server-side resolution
- related repositories, migrations, server actions, and tests

Key source-of-truth surfaces reviewed:

- `user_data.public_profiles`
- `user_data.visible_profiles`
- `social.friend_relationships`
- `social.friendships`
- `social.active_friendships_overview`
- `social.incoming_pending_friend_requests`
- `social.outgoing_pending_friend_requests`

## 3. Search Review

Search is grounded on the app-facing profile surface, not raw auth identity.

- search reads from `user_data.public_profiles`
- only public profiles participate
- only public-safe summary fields are returned
- friends-only and private profiles do not appear in search
- friends-only/private bio does not leak through search because the public
  view nulls non-public bio content

Assessment:

- coherent with the current privacy baseline
- no auth-table leakage found
- no relationship-state leakage found in search results

Constraint:

- because requestability also depends on the public profile surface, users who
  set profile visibility to `friends` become undiscoverable and unavailable for
  first-time friend requests

## 4. Friend Request Lifecycle Review

The request lifecycle is explicit and mostly well-contained.

- self-request is blocked
- duplicate pending requests are blocked
- only `pending -> accepted` and `pending -> declined` are allowed transitions
- recipient-only mutation is enforced in both use case and RLS layers
- accepting a request requires confirming the resulting friendship edge
- declining a request does not create friendship state

Assessment:

- lifecycle semantics are strict and understandable
- request history is not reused as active friendship state
- race handling is pragmatic and stable at the application layer

Constraint:

- request history is intentionally sticky; resend/reconnect flows are not yet
  implemented

## 5. Friendship Model Review

Friendship is modeled as a separate persisted edge in `social.friendships`.

- accepted requests create a friendship edge through DB trigger-backed sync
- active friendship state is queried from `social.friendships`, not inferred
  from accepted requests
- removal deletes the active friendship edge only
- request history remains intact after removal
- friendship queries normalize the pair order to keep the model symmetric

Assessment:

- the friendship model is separate and clean
- removal is symmetric in meaning
- no half-broken split-brain state was found in the reviewed flows

Constraint:

- because request history stays unique per pair, a removed friendship does not
  yet allow reconnection

## 6. Privacy Flags Review

Privacy flags are minimal but coherent.

Viewer categories are explicit:

- owner
- friend
- authenticated non-friend
- guest

Visibility levels are explicit:

- `public`
- `friends`
- `private`

Current governed content:

- profile route visibility through `profiles.visibility`
- bio visibility through `profiles.bio_visibility`
- search result summary through `user_data.public_profiles`
- friend/dashboard summary reads through the social overview views

Assessment:

- server-side privacy resolution is real, not just UI hiding
- pending request is not treated as friendship
- actual friendship edges are the only source of friend-scoped access
- the new flags extend the old profile model without obvious contradictory
  branches

## 7. Friends Page Review

The friends page is a real dashboard read model rather than three random UI
queries glued together.

- one server-backed read path aggregates active friends, incoming pending
  requests, and outgoing pending requests
- state separation is clear and matches the data model
- read path is owner-only because it resolves from the current authenticated
  profile
- integrated actions reuse existing accept / decline / remove use cases

Assessment:

- the page reads actual graph state
- no second friendship model was found
- privacy-sensitive summaries stay filtered by the server-backed views

## 8. Auth / RLS Consistency Review

Overall consistency is good.

- request creation is requester-owned and RLS-limited
- request accept/decline is recipient-only in use case and RLS
- friendship removal is participant-only in use case and RLS
- friends dashboard reads are anchored to `user_data.current_profile_id()`
- profile privacy writes are anchored to the authenticated session, not to form
  input

Review conclusion:

- no obvious UI-only authorization was found
- no direct auth-table social reads were found
- no broad social query was found that bypasses the intended ownership model

One small inconsistency was fixed during review:

- public profile page state no longer silently downgrades signed-in viewers to
  guest semantics when auth/profile lookup fails

## 9. Test Coverage Review

Current posture is solid at the application, repository, and UI levels.

Covered well:

- search query normalization and public-surface reads
- self-request / duplicate-request invariants
- recipient-only accept / decline behavior
- friendship removal symmetry and strict not-found semantics
- owner/friend/non-friend/guest privacy resolution
- pending request not granting friend-only visibility
- friends dashboard section separation
- profile privacy settings validation and save flow

Residual gap:

- there is still no DB-backed auth-context suite that executes the actual RLS
  policies and privacy views under multiple viewer identities

That is the main remaining confidence gap before calling the foundation
“fully regression-hardened.”

## 10. Top Findings

### Finding 1

- Severity: Medium
- Issue: Discoverability and first-time requestability are coupled to public
  profile visibility.
- Evidence:
  `apps/web/src/features/social/application/friend-request-use-cases.ts:65`
  `supabase/migrations/20260418120000_add_friend_relationship_authorization_rls.sql:17`
  `supabase/migrations/20260418190000_add_profile_privacy_flags.sql:37`
- Why it matters:
  Setting profile visibility to `friends` closes the profile to search and also
  blocks new inbound friend requests. That is coherent, but it means `friends`
  currently behaves as both “friends-only route access” and “not discoverable /
  not requestable.”
- Recommendation:
  Keep this policy explicit for now. Before deeper social growth, decide
  whether discoverability and requestability need their own future flags.

### Finding 2

- Severity: Medium
- Issue: Profile-pair history is permanently locked after the first request.
- Evidence:
  `supabase/migrations/20260408121800_create_friend_relationships.sql:21`
  `apps/web/src/features/social/application/friend-request-use-cases.ts:336`
- Why it matters:
  Declined pairs and removed former friends cannot reconnect without changing
  the schema/application lifecycle. That is acceptable for the current phase,
  but it becomes a constraint on future social flows.
- Recommendation:
  Before implementing reconnect/resend flows, decide whether uniqueness should
  protect only active pending requests or full historical pairs.

### Finding 3

- Severity: Medium-Low
- Issue: RLS and privacy-view correctness are reviewed and unit-tested, but not
  yet DB-verified under multiple auth identities.
- Evidence:
  Policies and views are defined in:
  `supabase/migrations/20260418120000_add_friend_relationship_authorization_rls.sql`
  `supabase/migrations/20260418143000_add_friend_request_lifecycle_and_friendships.sql`
  `supabase/migrations/20260418160000_add_friendship_removal_authorization.sql`
  `supabase/migrations/20260418190000_add_profile_privacy_flags.sql`
- Why it matters:
  Application/use-case tests are strong, but they do not fully protect against
  policy or view regressions in the database layer.
- Recommendation:
  Add a focused DB-backed auth-context suite for search visibility,
  visible-profile reads, request mutation permissions, and friendship removal
  permissions before relying on Phase 12 as a long-lived closed foundation.

## 11. Fixes Applied

Applied during this review checkpoint:

- fixed public profile page state so authenticated auth/profile lookup failures
  surface as errors instead of silently degrading to guest visibility semantics
- added regression tests covering that public-profile auth/viewer-state seam

Files changed for the review fix:

- `apps/web/src/features/profiles/server/public-profile-read.ts`
- `apps/web/src/features/profiles/server/public-profile-read-page.test.ts`

## 12. Final Verdict

**GO WITH CONDITIONS**

Rationale:

- the social foundation is coherent as a system
- no critical auth, privacy, or lifecycle conflict was found
- the remaining issues are mostly explicit policy constraints and test-depth
  gaps, not architectural collapse

Phase 12 can be closed **if** the team accepts the current product semantics:

- only public profiles are discoverable and requestable
- reconnect/resend is intentionally unsupported for now
- DB-backed RLS/privacy verification is scheduled before broader social growth
