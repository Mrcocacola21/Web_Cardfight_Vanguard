# Friend Requests Foundation

## 1. Purpose

Introduce the first explicit social edge in the product: one user sends a
friend request to another through the profile layer.

## 2. Friend request model

Persistence uses `social.friend_relationships`.

- `id`
- `requester_profile_id`
- `addressee_profile_id`
- `status`
- `requested_at`
- `responded_at`

This step only creates new rows in `pending` state, but the model already
keeps `accepted`, `declined`, and `cancelled` available for the lifecycle
step documented in `friend-request-lifecycle.md`.

## 3. Allowed lifecycle states

- `pending`
- `accepted`
- `declined`
- `cancelled`

Requests are created in `pending`. Recipient handling is documented separately
in `friend-request-lifecycle.md`.

## 4. Invariants

- sender and recipient must be different profiles
- sender identity comes from the authenticated profile, not from UI input
- only one relationship row may exist per unordered pair of profiles
- existing rows are never silently overwritten
- private/unavailable recipients are not requestable in this step

## 5. Permission / privacy assumptions

- friend requests require an authenticated session
- the sender must resolve to the current app-facing profile
- recipients must exist on the public profile surface
- private profiles remain non-requestable because they are not exposed through
  `user_data.public_profiles`

This keeps requestability aligned with current discoverability semantics.

## 6. Use-case flow

1. transport resolves auth and current sender profile
2. use case validates auth, self-request, recipient availability, and existing
   relationship state
3. repository inserts a `pending` relationship row
4. transport maps the structured result into UI feedback

## 7. UI entry points

Current entry point:

- friend request card on `/users/[profileId]`
- incoming requests section on `/profile`

Guests get a sign-in CTA instead of a send action. Owners do not get a
self-request action.

## 8. What is intentionally NOT implemented yet

- sender-side cancel actions
- friends list page
- friendship badges in user search results
- notifications
- resend flows after declined/cancelled
- blocking/followers/chat

## 9. Summary

Friend requests are now explicit, profile-based, repository-backed, and guarded
by both application invariants and RLS. The lifecycle and friendship edge now
build on this foundation in `friend-request-lifecycle.md`.
