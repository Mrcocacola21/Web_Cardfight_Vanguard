# Manual Match Entry Foundation

## 1. Purpose

Manual match entry is the first real user-facing match-history flow. It lets a signed-in user record a played match before any gameplay engine exists, while still attaching that record to real deck and profile entities.

## 2. Manual Match Entry Model

The create flow records one owner-owned match with:

- one selected owner deck
- one selected opponent profile
- one owner-perspective result: `win`, `loss`, or `draw`
- one played date
- optional notes

The saved row stays a personal history record. It does not create shared match ownership.

## 3. Deck Linkage

Deck selection uses the current user’s persisted deck list. On save, the flow resolves the chosen deck to its current `deck_version_id` and stores that version on the owner participant row.

The flow rejects:

- missing deck selection
- decks not owned by the current user
- decks without a current persisted version

A DB trigger also prevents `social.match_participants` from referencing a deck version owned by another profile.

## 4. Opponent Linkage

Opponent selection uses the protected `user_data.visible_profiles` surface instead of raw auth identity. This means:

- public profiles can be selected
- already-visible friend profiles can be selected
- hidden profiles remain unavailable

The flow does not require friendship, but it also does not bypass profile visibility.

## 5. Result / Date / Notes Fields

- result is a typed field: `win`, `loss`, `draw`
- played date is required and stored as the match timestamp
- notes are optional plain text

The flow maps the owner result onto participant rows:

- owner `win` -> opponent `loss`
- owner `loss` -> opponent `win`
- owner `draw` -> opponent `draw`

## 6. Ownership and Authorization Model

Manual match entry remains owner-owned:

- the current auth user resolves to exactly one owner profile
- the match is created only for that owner profile
- selected deck must belong to that owner
- selected opponent must be visible through the current profile read policy

RLS on `social.matches` and `social.match_participants` still keeps persisted match data owner-scoped.

## 7. UI Entry Point

The UI entry point is:

- `/matches/new`

It is a protected route with:

- deck selector
- opponent search and selection
- result selector
- played date field
- notes field
- save action

## 8. What Is Intentionally NOT Implemented Yet

- match list and filters
- edit/delete flows
- external freeform opponents
- match stats projections
- shared two-user authoritative match records
- gameplay-generated records
- tournament or bracket logic

## 9. Summary

This step turns match history into a real product flow: a user can now record a structured, owner-owned match backed by a real deck and a real visible opponent profile. That is enough foundation for the next step: match list and filters.
