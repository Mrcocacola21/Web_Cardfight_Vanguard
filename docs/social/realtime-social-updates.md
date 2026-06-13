# Realtime Social Updates

## 1. Purpose

Phase 20.2 adds bounded live updates for social state where stale data hurts the
current UX. The first target is the owner-only friends dashboard: active
friendships, incoming pending requests, and outgoing pending requests.

## 2. Why only limited social state was chosen for realtime

Not every social surface needs live delivery. User search, public profile pages,
and profile privacy editing already work with normal server reads and action
feedback. The stale UX is most visible on `/friends`, where another user can
send, accept, decline, or remove relationship state while the dashboard is open.

## 3. Chosen realtime scope

Live now:

- new incoming friend requests on `/friends`
- outgoing requests disappearing after accept/decline
- accepted requests becoming active friendships
- removed friendships disappearing from the affected dashboard

Not live now:

- user search results
- public profile relationship badges
- profile/privacy editor state
- presence or online status
- notifications or global social event feeds

## 4. Delivery model

The delivery model is server-mediated polling:

- `GET /api/social/friends/realtime`
- transport id: `server_route_social_dashboard_polling`
- full owner-safe dashboard snapshot replacement on the client

The route does not accept a `profileId`. It resolves the current authenticated
profile through the same server read model used by `/friends`.

## 5. Privacy/RLS boundaries

The browser does not subscribe to raw `social.*` tables. The route returns only
the existing friends dashboard projection for the current user. Profile
visibility fields and privacy-filtered summaries are produced by the repository
views and RLS-backed server read path, then rendered as client-safe data.

Unauthorized users receive `auth_required`. Authenticated users without a
profile receive `profile_required`. No other user's dashboard state is selectable
from the client.

## 6. Client update model

The client keeps a single dashboard snapshot and replaces it with the newest
server snapshot. It does not infer friendship rules locally, does not apply
optimistic relationship transitions, and treats duplicate snapshots as harmless.
If refresh fails, the current visible dashboard remains in place and the sync
badge reports the error.

## 7. What is intentionally NOT realtime yet

This step does not implement Supabase Realtime subscriptions, websocket social
fanout, presence, notifications, cross-project event buses, optimistic social
state reconciliation, or live updates on every user/profile/search page.

## 8. Summary

Social realtime is now useful but narrow. The friends dashboard updates live
through an authenticated, owner-safe, server-mediated snapshot route while
remaining separate from gameplay room realtime and preserving the existing
auth/privacy/RLS model.
