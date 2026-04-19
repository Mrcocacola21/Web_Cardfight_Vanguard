# Friends Page Foundation

## 1. Purpose

Provide one protected, owner-only social dashboard where the current user can
see the active friendship graph and pending friend-request state without
guessing across multiple routes.

## 2. Route / entrypoint

- Protected route: `/friends`
- Secondary entrypoints:
  - protected navigation
  - profile page link to the dedicated dashboard

## 3. Social graph read model

The page uses one server-backed read path: `getFriendsDashboardPageState`.

It resolves the current owner profile and aggregates three repository-backed
projections:

- active friendships
- incoming pending friend requests
- outgoing pending friend requests

The UI does not assemble the graph from ad hoc client-side reads.

## 4. Friends section

The friends section renders active friendship edges only.

Each item shows:

- public-safe display name or a privacy-safe placeholder
- avatar when the public profile surface exposes it
- short privacy-safe summary
- link to the public profile when that route is currently available
- remove-friend action

## 5. Incoming requests section

The incoming section renders pending requests where the current profile is the
recipient.

Each item shows:

- sender summary from the public profile surface when available
- link to public profile when available
- `Accept`
- `Decline`

## 6. Outgoing requests section

The outgoing section renders pending requests where the current profile is the
requester.

Each item shows:

- recipient summary from the public profile surface when available
- `pending` state
- link to public profile when available

Cancel/resend flows are intentionally not implemented here.

## 7. Privacy / ownership semantics

- `/friends` is owner-only; it never accepts an arbitrary profile id
- the dashboard reads only the current authenticated profile graph
- active friendships can show friend-scoped summary data when the target
  profile allows `friends` visibility
- pending request sections stay public-safe; they do not unlock friend-only
  data
- when another profile is no longer route-visible, the dashboard keeps the
  relationship row but hides the profile link and private-only data
- private/public profile rules remain enforced by the existing public profile
  surface and database-backed views

## 8. Actions integrated on the page

The page reuses existing social mutations:

- accept request
- decline request
- remove friend

The page does not duplicate social rules in UI components; actions still route
through the existing use-case and repository architecture.

## 9. What is intentionally NOT implemented yet

- cancel outgoing request
- resend after decline/removal
- friends-only privacy flags
- pagination/infinite scrolling
- recommendations or social feed
- chat/notifications

## 10. Summary

`/friends` is now the central baseline social dashboard. It exposes active
friends, incoming requests, and outgoing requests through one owner-safe read
model while preserving the existing profile visibility boundaries.
