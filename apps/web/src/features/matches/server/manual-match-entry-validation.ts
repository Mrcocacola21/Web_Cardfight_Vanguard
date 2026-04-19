import type { ManualMatchEntryResult } from '@/features/matches/application/match-create-use-cases'

export interface ManualMatchEntryDraft {
  readonly deckId: string
  readonly opponentProfileId: string
  readonly result: ManualMatchEntryResult
  readonly playedOn: string
  readonly playedAt: string
  readonly notes: string | null
}

export interface ManualMatchEntryValidationErrors {
  readonly deckId?: string
  readonly opponentProfileId?: string
  readonly result?: string
  readonly playedOn?: string
  readonly notes?: string
}

export type ManualMatchEntryValidationResult =
  | {
      readonly ok: true
      readonly data: ManualMatchEntryDraft
    }
  | {
      readonly ok: false
      readonly errors: ManualMatchEntryValidationErrors
    }

const manualMatchEntryResults = ['win', 'loss', 'draw'] as const
const manualMatchNotesMaxLength = 1000

export function validateManualMatchEntryDraft(input: {
  readonly deckId: string
  readonly opponentProfileId: string
  readonly result: string
  readonly playedOn: string
  readonly notes: string
}): ManualMatchEntryValidationResult {
  const deckId = input.deckId.trim()
  const opponentProfileId = input.opponentProfileId.trim()
  const result = input.result.trim()
  const playedOn = input.playedOn.trim()
  const notesValue = input.notes.trim()
  const errors: {
    deckId?: string
    opponentProfileId?: string
    result?: string
    playedOn?: string
    notes?: string
  } = {}

  if (deckId.length === 0) {
    errors.deckId = 'Choose one of your saved decks.'
  }

  if (opponentProfileId.length === 0) {
    errors.opponentProfileId = 'Select an opponent profile.'
  }

  if (!isManualMatchEntryResult(result)) {
    errors.result = 'Result must be win, loss, or draw.'
  }

  const playedAt = resolvePlayedAt(playedOn)

  if (!playedAt) {
    errors.playedOn = 'Choose a valid played date.'
  }

  if (notesValue.length > manualMatchNotesMaxLength) {
    errors.notes = `Notes must stay within ${manualMatchNotesMaxLength} characters.`
  }

  if (
    errors.deckId ||
    errors.opponentProfileId ||
    errors.result ||
    errors.playedOn ||
    errors.notes
  ) {
    return {
      ok: false,
      errors,
    }
  }

  return {
    ok: true,
    data: {
      deckId,
      opponentProfileId,
      result: isManualMatchEntryResult(result) ? result : 'draw',
      playedOn,
      playedAt: playedAt ?? new Date().toISOString(),
      notes: notesValue.length > 0 ? notesValue : null,
    },
  }
}

export function resolveDefaultPlayedOnDate(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

function resolvePlayedAt(playedOn: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(playedOn)) {
    return null
  }

  const playedAt = `${playedOn}T00:00:00.000Z`
  const parsed = new Date(playedAt)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString().slice(0, 10) === playedOn
    ? parsed.toISOString()
    : null
}

function isManualMatchEntryResult(
  value: string,
): value is ManualMatchEntryResult {
  return (manualMatchEntryResults as readonly string[]).includes(value)
}
