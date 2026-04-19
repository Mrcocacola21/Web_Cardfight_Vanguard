# User Search Foundation

## 1. Purpose

Provide a first social read surface that lets users find other users without
breaking the existing profile/privacy model.

## 2. Searchable user surface

Search is built on the profile layer, not on raw auth identity.

- source of truth: `user_data.public_profiles`
- app-facing entity: public profile surface
- searchable field in this step: `display_name`
- public profile route target: `/users/[profileId]`

`auth.users`, email, and other auth/provider internals are not part of the
search surface.

## 3. Privacy model for search

Search participates in privacy enforcement.

- only public profiles are searchable
- private profiles do not appear in results
- friends-only profiles do not appear in results
- owner, other signed-in users, and guests all get the same search result set
- search results contain only public-safe profile summary fields
- `bio` is present only when the profile bio itself is `public`

This keeps search honest with the current visibility semantics instead of
creating a search-only exception path.

## 4. Search query behavior

- query param: `q`
- empty query returns no directory listing
- whitespace is trimmed and collapsed
- one-character noise tokens are ignored
- search is case-insensitive over `display_name`
- result count is capped server-side

This is intentionally a small baseline, not a recommendation engine or fuzzy
search system.

## 5. Result shape

Each result contains:

- `id`
- `displayName`
- `avatarUrl`
- `bio`

Those fields are already part of the existing public profile surface, but the
bio remains filtered to public-only visibility.

## 6. Integration with public profiles

Each search result links to the existing public profile route:

- `/users/[profileId]`

Search does not introduce a second user representation. It is only a discovery
surface for the current public profile model.

## 7. What is intentionally NOT implemented yet

- friend requests
- friendship state in search results
- social graph queries
- suggested users or recommendations
- username/email lookup
- private-profile exceptions
- fuzzy/full-text search infrastructure

## 8. Summary

The first user search surface is now explicit, server-backed, profile-based,
and privacy-constrained. It is narrow on purpose so future friend-request and
social-graph work can build on a stable public profile foundation.
