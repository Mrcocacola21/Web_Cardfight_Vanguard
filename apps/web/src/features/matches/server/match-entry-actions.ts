'use server'

import { createDecksRepository, createProfilesRepository } from '@web-vg/db'
import { revalidatePath } from 'next/cache'

import { getCurrentAuthState } from '@/features/auth/server/auth-session'
import { createMatchRecordUseCase } from '@/features/matches/application/match-create-use-cases'
import { createMatchHistoryRepository } from '@/features/matches/infrastructure/match-history-repository'
import { resolveUserSearchRouteQuery } from '@/features/profiles/user-search-query'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import {
  initialManualMatchEntryFormState,
  type ManualMatchEntryFormState,
} from './manual-match-entry-form-state'
import {
  initialMatchOpponentSearchFormState,
  type MatchOpponentSearchFormState,
} from './match-opponent-search-form-state'
import { validateManualMatchEntryDraft } from './manual-match-entry-validation'

const manualMatchOpponentSearchLimit = 8

export async function createManualMatchEntryAction(
  _previousState: ManualMatchEntryFormState,
  formData: FormData,
): Promise<ManualMatchEntryFormState> {
  const client = await createSupabaseServerClient()
  const authState = await getCurrentAuthState({ client })

  if (authState.kind === 'signed-out') {
    return {
      status: 'error',
      message: 'Sign in before recording match history.',
      fieldErrors: {},
      createdMatchId: null,
    }
  }

  if (authState.kind === 'error') {
    return {
      status: 'error',
      message: authState.message,
      fieldErrors: {},
      createdMatchId: null,
    }
  }

  const deckIdValue = formData.get('deckId')
  const opponentProfileIdValue = formData.get('opponentProfileId')
  const resultValue = formData.get('result')
  const playedOnValue = formData.get('playedOn')
  const notesValue = formData.get('notes')

  const validation = validateManualMatchEntryDraft({
    deckId: typeof deckIdValue === 'string' ? deckIdValue : '',
    opponentProfileId:
      typeof opponentProfileIdValue === 'string' ? opponentProfileIdValue : '',
    result: typeof resultValue === 'string' ? resultValue : '',
    playedOn: typeof playedOnValue === 'string' ? playedOnValue : '',
    notes: typeof notesValue === 'string' ? notesValue : '',
  })

  if (!validation.ok) {
    return {
      status: 'error',
      message: 'Match entry is incomplete or invalid.',
      fieldErrors: validation.errors,
      createdMatchId: null,
    }
  }

  const result = await createMatchRecordUseCase(
    {
      matchHistoryRepository: createMatchHistoryRepository(client),
      decksRepository: createDecksRepository(client),
      profilesRepository: createProfilesRepository(client),
    },
    {
      authUserId: authState.user.id,
      deckId: validation.data.deckId,
      opponentProfileId: validation.data.opponentProfileId,
      result: validation.data.result,
      playedAt: validation.data.playedAt,
      notes: validation.data.notes,
    },
  )

  if (!result.ok) {
    return mapCreateMatchErrorToFormState(
      result.error.code,
      result.error.message,
    )
  }

  revalidatePath('/matches')
  revalidatePath('/matches/new')

  return {
    status: 'success',
    message: 'Match recorded.',
    fieldErrors: {},
    createdMatchId: result.data.matchId,
  }
}

export async function searchMatchOpponentProfilesAction(
  _previousState: MatchOpponentSearchFormState,
  formData: FormData,
): Promise<MatchOpponentSearchFormState> {
  const queryValue = formData.get('query')
  const inputValue = typeof queryValue === 'string' ? queryValue : ''
  const query = resolveUserSearchRouteQuery({
    q: inputValue,
  })

  if (query.kind === 'idle') {
    return {
      kind: 'idle',
      query: query.inputValue,
      reason: query.reason,
    }
  }

  const client = await createSupabaseServerClient()
  const authState = await getCurrentAuthState({ client })

  if (authState.kind !== 'ready') {
    return {
      kind: 'error',
      query: query.inputValue,
      message: 'Sign in before searching for opponent profiles.',
    }
  }

  const profilesRepository = createProfilesRepository(client)
  const currentProfileResult = await profilesRepository.getProfileByAuthUserId(
    authState.user.id,
  )

  if (!currentProfileResult.ok) {
    return {
      kind: 'error',
      query: query.inputValue,
      message: currentProfileResult.error.message,
    }
  }

  if (!currentProfileResult.data) {
    return {
      kind: 'error',
      query: query.inputValue,
      message: 'Create your profile before searching for opponents.',
    }
  }

  const result = await profilesRepository.searchVisibleProfiles(
    query.searchText,
    manualMatchOpponentSearchLimit,
  )

  if (!result.ok) {
    return {
      kind: 'error',
      query: query.inputValue,
      message: result.error.message,
    }
  }

  return {
    kind: 'ready',
    query: query.inputValue,
    results: result.data.filter(
      (profile) => profile.id !== currentProfileResult.data?.id,
    ),
  }
}

function mapCreateMatchErrorToFormState(
  code:
    | 'profile-required'
    | 'deck-unavailable'
    | 'opponent-unavailable'
    | 'self-opponent'
    | 'repository-failed',
  message: string,
): ManualMatchEntryFormState {
  switch (code) {
    case 'deck-unavailable':
      return {
        status: 'error',
        message,
        fieldErrors: {
          deckId: 'Choose one of your own saved decks.',
        },
        createdMatchId: null,
      }
    case 'opponent-unavailable':
      return {
        status: 'error',
        message,
        fieldErrors: {
          opponentProfileId: 'Select a visible opponent profile.',
        },
        createdMatchId: null,
      }
    case 'self-opponent':
      return {
        status: 'error',
        message,
        fieldErrors: {
          opponentProfileId: message,
        },
        createdMatchId: null,
      }
    case 'profile-required':
    case 'repository-failed':
    default:
      return {
        status: 'error',
        message,
        fieldErrors: {},
        createdMatchId: null,
      }
  }
}

export { initialManualMatchEntryFormState, initialMatchOpponentSearchFormState }
