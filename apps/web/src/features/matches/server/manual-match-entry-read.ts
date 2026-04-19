import { listDecksByOwnerProfileId } from '@/features/decks/server/deck-read'
import { getCurrentProfileState } from '@/features/profiles/server/profile-read'
import { resolveDefaultPlayedOnDate } from '@/features/matches/server/manual-match-entry-validation'
import type { MatchEntryDeckOption } from '@/features/matches/match-entry.types'

export type ManualMatchEntryPageState =
  | {
      readonly kind: 'ready'
      readonly viewerDisplayName: string
      readonly deckOptions: readonly MatchEntryDeckOption[]
      readonly defaultPlayedOn: string
    }
  | {
      readonly kind: 'profile-unavailable'
    }
  | {
      readonly kind: 'decks-unavailable'
    }
  | {
      readonly kind: 'error'
      readonly message: string
    }

export async function getManualMatchEntryPageState(): Promise<ManualMatchEntryPageState> {
  const currentProfileState = await getCurrentProfileState()

  if (currentProfileState.kind === 'error') {
    return {
      kind: 'error',
      message: currentProfileState.message,
    }
  }

  if (currentProfileState.kind === 'signed-out') {
    return {
      kind: 'error',
      message: 'Manual match entry requires an authenticated session.',
    }
  }

  if (!currentProfileState.profile) {
    return {
      kind: 'profile-unavailable',
    }
  }

  const decksResult = await listDecksByOwnerProfileId(
    currentProfileState.profile.id,
  )

  if (!decksResult.ok) {
    return {
      kind: 'error',
      message: decksResult.error.message,
    }
  }

  const deckOptions = decksResult.data
    .filter((deck) => deck.currentVersionId && deck.currentVersionNumber)
    .map((deck) => ({
      id: deck.id,
      title: deck.title,
      formatDisplayName: deck.format.displayName,
      currentVersionId: deck.currentVersionId ?? '',
      currentVersionNumber: deck.currentVersionNumber ?? 1,
      updatedAt: deck.updatedAt,
    }))

  if (deckOptions.length === 0) {
    return {
      kind: 'decks-unavailable',
    }
  }

  return {
    kind: 'ready',
    viewerDisplayName: currentProfileState.profile.displayName,
    deckOptions,
    defaultPlayedOn: resolveDefaultPlayedOnDate(),
  }
}
