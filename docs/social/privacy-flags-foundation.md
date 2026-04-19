# Privacy Flags Foundation

## 1. Purpose

Introduce a minimal privacy model before deeper social features expand. The
goal is to keep public, friend-scoped, and owner-only reads explicit and
server-enforced.

## 2. Viewer categories

Current privacy resolution distinguishes four viewer categories:

- `owner`
- `friend`
- `authenticated-non-friend`
- `guest`

Pending requests are not treated as friendship.

## 3. Visibility levels

The baseline visibility enum is:

- `public`
- `friends`
- `private`

`private` is owner-only. `friends` is resolved only from an accepted friendship
edge. `public` is readable by everyone.

## 4. What content is governed now

This step applies privacy flags to the current profile/social surfaces:

- profile route discoverability through `profiles.visibility`
- bio read visibility through `profiles.bio_visibility`
- search result summaries through `user_data.public_profiles`
- friends dashboard summaries through social overview views

Display name and avatar remain part of the minimal profile summary surface.

## 5. Server-side privacy resolution model

Server-side reads are the source of truth.

- `/users/[profileId]` resolves through `user_data.visible_profiles`
- search resolves through `user_data.public_profiles`
- friend-scoped dashboard summaries resolve through social overview views tied
  to the authenticated owner profile
- the app resolves viewer category from owner/friend/auth state and consumes
  already-filtered records

The UI does not guess privacy; it renders filtered data.

## 6. Relationship to current profile visibility

`visibility` is the baseline gate for whether the profile route can be opened.
`bioVisibility` is a scoped override for the bio field and cannot be broader
than `visibility`.

Examples:

- profile `public` + bio `friends`: everyone can open the route, only friends
  see the bio
- profile `friends` + bio `friends`: only friends and the owner can open the
  route and see the bio
- profile `private` + bio `private`: only the owner can open the route

## 7. Settings/edit surface

Privacy flags are editable on the protected `/profile` route inside the
existing profile editor.

The current controls are:

- `Profile visibility`
- `Bio visibility`

Saves go through the authenticated server action and the profile management use
case, not through client-only state.

## 8. What is intentionally NOT implemented yet

- per-field privacy controls beyond the current baseline
- separate discoverability flags
- friend-list visibility controls
- match-history visibility controls
- block/mute/report systems
- advanced deck-sharing privacy

## 9. Summary

The social layer now has a small but explicit privacy foundation. Public,
friend-only, and owner-only reads are persisted, server-backed, and integrated
into search, profile routes, and the friends dashboard without inventing a new
ACL system.
