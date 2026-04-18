# Friend Request Lifecycle

## 1. Purpose

Turn a sent friend request into an explicit recipient-controlled lifecycle.
Requests no longer stop at `pending`: the recipient can accept or decline, and
acceptance creates a separate persisted friendship edge.

## 2. Request states

`social.friend_relationships` remains the request/history record.

- `pending`
- `accepted`
- `declined`
- `cancelled`

This step implements recipient handling for `pending` requests. `cancelled`
remains reserved for future sender-driven flows.

## 3. Allowed transitions

- `pending -> accepted`
- `pending -> declined`

`accepted`, `declined`, and `cancelled` are terminal for this foundation.
Handled requests cannot transition again through the normal recipient update
path.

## 4. Recipient-only control

- only the `addressee_profile_id` may accept or decline a request
- the sender cannot accept their own request
- unrelated users cannot mutate another request
- enforcement happens in the use case, repository query shape, and database RLS

## 5. Friendship creation model

Active friendships are stored separately in `social.friendships`.

- one row per unordered profile pair
- canonical pair ordering via `first_profile_id` / `second_profile_id`
- `friend_request_id` points back to the accepted request row
- accepted request history stays in `social.friend_relationships`
- active social graph state lives in `social.friendships`

Friendship creation is synchronized on accepted requests through a database
trigger, so the transition and edge creation stay atomic at the persistence
layer.

## 6. UI entry points

- send request from `/users/[profileId]`
- accept or decline from the incoming requests section on `/profile`

The inbox only renders pending requests and shows structured success/error
feedback for accept and decline actions.

## 7. What is intentionally NOT implemented yet

- sender-side cancel flow
- friends list page
- friendship badges across search/profile surfaces
- notifications, chat, blocking, or recommendation logic

## 8. Summary

Friend requests now have a strict recipient-owned lifecycle. `pending`
requests can become `accepted` or `declined`, accepted requests create an
explicit friendship edge, and terminal states are protected from repeated
transitions. Friendship removal now builds on top of this model without
treating accepted requests as the social graph itself.
