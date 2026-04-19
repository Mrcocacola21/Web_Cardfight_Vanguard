# Match History Model

## 1. Purpose

Match history exists before a gameplay engine because recorded real-world matches already have user value. The system needs a stable place to store those records without pretending that manual logging is the same thing as running a playable match.

## 2. Why Match History Exists Before Gameplay Engine

`social.matches` is the user-facing history layer. It stores that a match happened, who owns the record, when it happened, and the persisted participant outcomes. Future gameplay runtime state stays in `gameplay.*` and may later create or attach to the same recorded history shape.

## 3. Core Match Record Model

The foundation uses two persisted layers:

- `social.matches`
  - owner profile
  - format
  - visibility
  - record status
  - entry source (`manual` or future `gameplay`)
  - played timestamp
  - notes
  - created/updated timestamps
- `social.match_participants`
  - participant profile
  - optional deck version reference
  - participant result
  - optional seat order
  - optional participant notes

This keeps the owner-owned match record separate from participant-level linkage.

## 4. Ownership Model

Match history is owner-owned by default. `social.matches.recorded_by_profile_id` is the owning profile, and baseline RLS keeps reads and writes scoped to that owner. A participant row does not imply co-ownership.

## 5. Opponent Linkage

Opponent linkage is represented through participant rows, not through a second owner. For the current phase, opponent linkage is profile-based and optional at the model level. Freeform external opponent names are intentionally not implemented yet.

## 6. Deck Linkage

Deck linkage is optional and stored on `social.match_participants.deck_version_id`. This keeps match history attached to a concrete saved deck revision when available, without introducing deck snapshot/version-freezing semantics in this phase.

## 7. Relationship to Future Gameplay Engine

The model is intentionally not runtime gameplay state:

- `social.matches` is recorded history
- `gameplay.match_rooms` is live or recoverable runtime state

The new `entry_source` field makes that split explicit. Future gameplay flows can create the same kind of history row with `entry_source = 'gameplay'` instead of forcing a second history model.

## 8. What Is Intentionally NOT Implemented Yet

- manual match entry UI or server action
- opponent picker flows
- freeform external opponents
- match editing/deletion flows
- stats projections
- shared authoritative two-user match ownership
- gameplay event log or runtime engine logic

## 9. Summary

Phase 13.1 establishes a clean owner-owned match history foundation: one persisted match record, zero or more participant rows, optional social/deck linkage, and explicit separation from future gameplay runtime. That is enough to move safely into manual match entry next.
