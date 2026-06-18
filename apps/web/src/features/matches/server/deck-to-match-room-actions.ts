'use server'

import { randomUUID } from 'node:crypto'

import {
  createCatalogRepository,
  createDbClient,
  createDbPersistedMatchSessionStorage,
  createDecksRepository,
  createProfilesRepository,
} from '@web-vg/db'
import type { CatalogCardEntityRecord } from '@web-vg/db/repositories/catalog'
import type { DeckDetailRecord } from '@web-vg/db/repositories/decks'
import { createPersistedMatchSessionAdapter } from '@web-vg/match-session'
import type {
  MatchDeckValidationProof,
  MatchRoomId,
  MatchRoomParticipantId,
} from '@web-vg/match-session'
import type { ActionId, PlayerId } from '@web-vg/rules-core'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createDeckBuilderDraft } from '@/features/decks/deck-builder-draft'
import { validateDeckBuilderDraft } from '@/features/decks/deck-builder-validation'
import { getDeckBuilderValidationData } from '@/features/decks/server/deck-builder-validation-read'
import { getCurrentAuthState } from '@/features/auth/server/auth-session'
import {
  createDeckToMatchRoomUseCase,
  type DeckToMatchRoomErrorCode,
  type DeckToMatchRoomIdFactory,
} from '@/features/matches/application/deck-to-match-room-use-cases'
import { getSupabaseServiceRoleEnv } from '@/lib/supabase/config'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import type { DeckToMatchRoomFormState } from './deck-to-match-room-form-state'

export async function createDeckToMatchRoomAction(
  _previousState: DeckToMatchRoomFormState,
  formData: FormData,
): Promise<DeckToMatchRoomFormState> {
  const deckId = readFormString(formData, 'deckId')
  const opponentProfileId = readFormString(formData, 'opponentProfileId')

  if (!deckId || !opponentProfileId) {
    return {
      status: 'error',
      message: 'Choose a deck and a visible opponent before starting.',
      fieldErrors: {
        ...(deckId ? {} : { deckId: 'Open a saved deck first.' }),
        ...(opponentProfileId
          ? {}
          : { opponentProfileId: 'Select a visible opponent profile.' }),
      },
    }
  }

  const authClient = await createSupabaseServerClient()
  const authState = await getCurrentAuthState({ client: authClient })

  if (authState.kind === 'signed-out') {
    return {
      status: 'error',
      message: 'Sign in before starting a multiplayer match room.',
      fieldErrors: {},
    }
  }

  if (authState.kind === 'error') {
    return {
      status: 'error',
      message: authState.message,
      fieldErrors: {},
    }
  }

  let roomSessions

  try {
    roomSessions = createPersistedMatchSessionAdapter({
      storage: createDbPersistedMatchSessionStorage(
        createDbClient(getSupabaseServiceRoleEnv()),
      ),
    })
  } catch {
    return {
      status: 'error',
      message:
        'The persisted multiplayer match storage backend is not configured.',
      fieldErrors: {},
    }
  }

  const result = await createDeckToMatchRoomUseCase(
    {
      profilesRepository: createProfilesRepository(authClient),
      decksRepository: createDecksRepository(authClient),
      catalogRepository: createCatalogRepository(authClient),
      validationService: {
        validateDeck: validateDeckDetailForMatchRoom,
      },
      roomSessions,
      idFactory: cryptoRoomIdFactory,
      now: () => new Date().toISOString(),
    },
    {
      authUserId: authState.user.id,
      deckId,
      opponentProfileId,
    },
  )

  if (!result.ok) {
    return mapDeckToMatchRoomErrorToFormState(
      result.error.code,
      result.error.message,
    )
  }

  revalidatePath('/matches')
  revalidatePath('/decks')
  revalidatePath(`/decks/${encodeURIComponent(deckId)}`)

  redirect(`/matches/play/${encodeURIComponent(result.data.roomId)}`)
}

export async function validateDeckDetailForMatchRoom(input: {
  readonly deck: DeckDetailRecord
  readonly catalogCards: readonly CatalogCardEntityRecord[]
}): Promise<MatchDeckValidationProof> {
  const validationData = await getDeckBuilderValidationData({
    initialDeck: input.deck,
    catalogCards: input.catalogCards,
  })
  const validation = validateDeckBuilderDraft(
    createDeckBuilderDraft(input.deck),
    validationData,
  )

  return {
    isValid: validation.isValid,
    source: 'deck-builder-validation',
    errorCount: validation.summary.errorCount,
    issueCodes: validation.issues.map((issue) => issue.code),
  }
}

export const cryptoRoomIdFactory: DeckToMatchRoomIdFactory = {
  createRoomId() {
    return randomUUID() as MatchRoomId
  },
  createParticipantId(input) {
    return `${input.roomId}:participant:${input.seat + 1}` as MatchRoomParticipantId
  },
  createPlayerId(input) {
    return `${input.roomId}:player:${input.seat + 1}` as PlayerId
  },
  createActionId(input) {
    return `${input.roomId}:action:${input.label}:${input.revision}` as ActionId
  },
}

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key)

  return typeof value === 'string' ? value.trim() : ''
}

function mapDeckToMatchRoomErrorToFormState(
  code: DeckToMatchRoomErrorCode,
  message: string,
): DeckToMatchRoomFormState {
  switch (code) {
    case 'deck-unavailable':
    case 'unsupported-format':
    case 'deck-invalid':
      return {
        status: 'error',
        message,
        fieldErrors: {
          deckId: message,
        },
      }
    case 'opponent-unavailable':
    case 'self-opponent':
      return {
        status: 'error',
        message,
        fieldErrors: {
          opponentProfileId: message,
        },
      }
    case 'profile-required':
    case 'room-access-denied':
    case 'catalog-unavailable':
    case 'bootstrap-failed':
    case 'room-persist-failed':
    case 'repository-failed':
    default:
      return {
        status: 'error',
        message,
        fieldErrors: {},
      }
  }
}
