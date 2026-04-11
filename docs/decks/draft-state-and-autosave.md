# Draft State and Autosave

## Purpose

Provide a reliable single-user draft workflow for the deck builder so routine
editing does not lose work on refresh, route navigation, or transient save
errors.

## What counts as draft state

The draft is the current editable deck snapshot for one deck builder session.
At this stage it includes:

- deck composition by canonical `CardEntity`
- deck title and description fields as part of the persisted deck snapshot
- card display data needed to render restored unsaved rows after refresh or
  route changes

The draft does not create a parallel deck product. It is a temporary editing
state for the existing deck aggregate.

## Autosave strategy

- The client keeps the latest editable draft in memory for responsive editing.
- The server remains the source of truth for persisted deck state.
- Every local change marks the draft as unsaved and schedules a debounced
  autosave.
- Autosave persists the full draft snapshot through the deck server action,
  domain layer, and repository path.
- Repeated quick edits are coalesced into one autosave request.
- A temporary `sessionStorage` backup exists only as a recovery aid until the
  latest draft is successfully persisted.

## Unsaved, saving, saved, and error states

- `Saved`: the latest editable draft matches the latest persisted deck snapshot.
- `Unsaved changes`: local edits exist and autosave is pending.
- `Saving...`: autosave is currently writing the latest draft to the server.
- `Could not save changes`: autosave failed and the local draft is still kept
  in memory and in temporary session backup storage.

The UI shows this as a compact builder status badge plus a short explanatory
line. The error state also exposes a minimal retry action.

## Refresh and navigation behavior

- A successful autosave becomes the durable server-side deck state.
- While changes are still unsaved, the current draft is mirrored into
  `sessionStorage`.
- Refreshing the page or navigating away and back in the same browser session
  restores that temporary draft and immediately re-enters the autosave flow.
- A `beforeunload` guard warns the user when they try to refresh or leave while
  the builder still has unsaved or actively saving work.

## Failure handling

- Save failures do not discard the current local draft.
- The builder remains editable after a save failure.
- The user sees an explicit error state instead of silent loss.
- The user can retry immediately, and any new edit returns the builder to the
  normal unsaved -> saving -> saved cycle.

## What is intentionally NOT implemented yet

- collaborative editing
- merge/conflict resolution between multiple editors
- offline-first sync
- version history UI
- manual save mode parallel to autosave
- full deck validation semantics

## Summary

The current builder uses one practical model: local draft for responsiveness,
debounced server autosave for durability, temporary session backup for recovery,
and a compact save-state surface for honesty. This keeps the deck builder
stable now and leaves room for future metadata editing without rewriting the
save model.
