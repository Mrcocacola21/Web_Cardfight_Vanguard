# Friend Removal Foundation

## 1. Purpose

Provide a controlled exit path from an active friendship. Removing a friend
must break the active social edge without rewriting historical friend-request
records.

## 2. Friendship removal semantics

Active friendships live in `social.friendships`.

Friend removal uses a hard delete of the active friendship row:

- the friendship stops being active immediately
- the result is symmetric for both participants
- there is no separate half-removed state
- repeated removal returns strict not-found semantics instead of pretending the
  edge still exists

## 3. Relationship to request history

Historical request data stays in `social.friend_relationships`.

- accepted request rows are not rewritten during friend removal
- removal only affects the active friendship layer
- request lifecycle history and friendship state stay related, but separate

## 4. Authorization model

- only authenticated users with a current profile may remove a friend
- only a friendship participant may delete the active edge
- non-participants and already-removed pairs resolve as not found
- enforcement happens in the use case, repository path, and RLS delete policy

## 5. Use-case flow

1. transport resolves auth and current profile
2. use case loads the active friendship by current profile + target profile
3. if no active friendship exists, the result is `friendship-not-found`
4. repository deletes the `social.friendships` row
5. transport maps the structured result into UI feedback and revalidates the
   public profile route

## 6. UI entry point

- `Remove friend` appears on `/users/[profileId]` when the viewed profile is an
  active friend
- the action uses an explicit confirmation step before deletion
- after removal, the public profile falls back to a non-active historical state

## 7. What is intentionally NOT implemented yet

- re-send/reconnect flow for a previously accepted-and-removed pair
- sender-side cancel for pending requests
- block system
- notifications
- bulk friend management UI
- full friends page

## 8. Summary

Friendship removal now cleanly deletes only the active friendship edge, keeps
accepted request history intact, and stays participant-only through both
application rules and RLS. This is enough to build a friends page on top of a
trustworthy active friendship model instead of overloading request history.
