import { STANDARD_FORMAT_ID } from '@web-vg/rules-core'
import type { DeckDetailRecord } from '@web-vg/db/repositories/decks'

import { getDeckDetailById } from '@/features/decks/server/deck-read'
import { getCurrentProfileState } from '@/features/profiles/server/profile-read'

export type DeckToMatchRoomPageState =
  | {
      readonly kind: 'ready'
      readonly viewerDisplayName: string
      readonly deck: DeckDetailRecord
    }
  | {
      readonly kind: 'profile-unavailable'
    }
  | {
      readonly kind: 'deck-unavailable'
      readonly message: string
    }
  | {
      readonly kind: 'error'
      readonly message: string
    }

export async function getDeckToMatchRoomPageState(input: {
  readonly deckId: string
}): Promise<DeckToMatchRoomPageState> {
  const deckId = input.deckId.trim()

  if (deckId.length === 0) {
    return {
      kind: 'deck-unavailable',
      message: 'Open a saved deck before starting a match room.',
    }
  }

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
      message: 'Sign in before starting a multiplayer match room.',
    }
  }

  if (!currentProfileState.profile) {
    return {
      kind: 'profile-unavailable',
    }
  }

  const deckResult = await getDeckDetailById(deckId)

  if (!deckResult.ok) {
    return {
      kind: 'error',
      message: deckResult.error.message,
    }
  }

  if (
    !deckResult.data ||
    deckResult.data.ownerProfileId !== currentProfileState.profile.id
  ) {
    return {
      kind: 'deck-unavailable',
      message: 'No saved deck owned by the current profile matches this flow.',
    }
  }

  if (!deckResult.data.currentVersion) {
    return {
      kind: 'deck-unavailable',
      message: 'The selected deck needs a current saved version first.',
    }
  }

  if (deckResult.data.format.id !== STANDARD_FORMAT_ID) {
    return {
      kind: 'deck-unavailable',
      message: 'Only Standard decks can start a Pre-Phase 21 gameplay room.',
    }
  }

  return {
    kind: 'ready',
    viewerDisplayName: currentProfileState.profile.displayName,
    deck: deckResult.data,
  }
}
