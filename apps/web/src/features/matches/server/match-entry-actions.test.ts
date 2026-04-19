// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MatchCreateUseCasesModule from '@/features/matches/application/match-create-use-cases'

import { initialManualMatchEntryFormState } from './manual-match-entry-form-state'
import { initialMatchOpponentSearchFormState } from './match-opponent-search-form-state'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getCurrentAuthState: vi.fn(),
  createDecksRepository: vi.fn(),
  createProfilesRepository: vi.fn(),
  createMatchRecordUseCase:
    vi.fn<typeof MatchCreateUseCasesModule.createMatchRecordUseCase>(),
  createMatchHistoryRepository: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/auth/server/auth-session', () => ({
  getCurrentAuthState: mocks.getCurrentAuthState,
}))

vi.mock('@web-vg/db', () => ({
  createDecksRepository: mocks.createDecksRepository,
  createProfilesRepository: mocks.createProfilesRepository,
}))

vi.mock('@/features/matches/infrastructure/match-history-repository', () => ({
  createMatchHistoryRepository: mocks.createMatchHistoryRepository,
}))

vi.mock('@/features/matches/application/match-create-use-cases', () => ({
  createMatchRecordUseCase: mocks.createMatchRecordUseCase,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import {
  createManualMatchEntryAction,
  searchMatchOpponentProfilesAction,
} from './match-entry-actions'

describe('createManualMatchEntryAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({})
    mocks.getCurrentAuthState.mockResolvedValue({
      kind: 'ready',
      user: {
        id: 'auth-user-1',
        email: 'pilot@example.com',
      },
    })
    mocks.createDecksRepository.mockReturnValue({
      getDeckById: vi.fn(),
    })
    mocks.createProfilesRepository.mockReturnValue({
      getVisibleProfileById: vi.fn(),
      getProfileByAuthUserId: vi.fn(),
      searchVisibleProfiles: vi.fn(),
    })
    mocks.createMatchHistoryRepository.mockReturnValue({
      getOwnerProfileIdByAuthUserId: vi.fn(),
      createMatchRecord: vi.fn(),
    })
  })

  it('passes validated manual-entry input into the use case', async () => {
    mocks.createMatchRecordUseCase.mockResolvedValueOnce({
      ok: true,
      data: {
        matchId: 'match-1',
        ownerProfileId: 'profile-owner',
        opponentProfileId: 'profile-opponent',
      },
    })

    const formData = new FormData()
    formData.set('deckId', 'deck-1')
    formData.set('opponentProfileId', 'profile-opponent')
    formData.set('result', 'draw')
    formData.set('playedOn', '2026-04-18')
    formData.set('notes', 'Round 1 test game.')

    const result = await createManualMatchEntryAction(
      initialManualMatchEntryFormState,
      formData,
    )

    const firstCall = mocks.createMatchRecordUseCase.mock.calls[0]

    expect(firstCall).toBeDefined()

    if (!firstCall) {
      throw new Error('Expected createMatchRecordUseCase to be called.')
    }

    const [services, command] = firstCall

    expect(services.matchHistoryRepository).toBeDefined()
    expect(services.decksRepository).toBeDefined()
    expect(services.profilesRepository).toBeDefined()
    expect(command).toEqual({
      authUserId: 'auth-user-1',
      deckId: 'deck-1',
      opponentProfileId: 'profile-opponent',
      result: 'draw',
      playedAt: '2026-04-18T00:00:00.000Z',
      notes: 'Round 1 test game.',
    })
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(1, '/matches')
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, '/matches/new')
    expect(result).toEqual({
      status: 'success',
      message: 'Match recorded.',
      fieldErrors: {},
      createdMatchId: 'match-1',
    })
  })

  it('returns field errors for invalid form input before calling the use case', async () => {
    const formData = new FormData()
    formData.set('deckId', '')
    formData.set('opponentProfileId', '')
    formData.set('result', 'unknown')
    formData.set('playedOn', 'bad-date')
    formData.set('notes', '')

    const result = await createManualMatchEntryAction(
      initialManualMatchEntryFormState,
      formData,
    )

    expect(mocks.createMatchRecordUseCase).not.toHaveBeenCalled()
    expect(result).toEqual({
      status: 'error',
      message: 'Match entry is incomplete or invalid.',
      fieldErrors: {
        deckId: 'Choose one of your saved decks.',
        opponentProfileId: 'Select an opponent profile.',
        result: 'Result must be win, loss, or draw.',
        playedOn: 'Choose a valid played date.',
      },
      createdMatchId: null,
    })
  })

  it('maps deck ownership failures back into stable field feedback', async () => {
    mocks.createMatchRecordUseCase.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'deck-unavailable',
        message: 'Choose one of your own saved decks before recording a match.',
      },
    })

    const formData = new FormData()
    formData.set('deckId', 'deck-other')
    formData.set('opponentProfileId', 'profile-opponent')
    formData.set('result', 'win')
    formData.set('playedOn', '2026-04-18')
    formData.set('notes', '')

    const result = await createManualMatchEntryAction(
      initialManualMatchEntryFormState,
      formData,
    )

    expect(result).toEqual({
      status: 'error',
      message: 'Choose one of your own saved decks before recording a match.',
      fieldErrors: {
        deckId: 'Choose one of your own saved decks.',
      },
      createdMatchId: null,
    })
  })

  it('blocks manual match creation when the viewer is signed out', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'signed-out',
    })

    const formData = new FormData()
    formData.set('deckId', 'deck-1')
    formData.set('opponentProfileId', 'profile-opponent')
    formData.set('result', 'win')
    formData.set('playedOn', '2026-04-18')
    formData.set('notes', '')

    const result = await createManualMatchEntryAction(
      initialManualMatchEntryFormState,
      formData,
    )

    expect(mocks.createMatchRecordUseCase).not.toHaveBeenCalled()
    expect(result).toEqual({
      status: 'error',
      message: 'Sign in before recording match history.',
      fieldErrors: {},
      createdMatchId: null,
    })
  })
})

describe('searchMatchOpponentProfilesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({})
    mocks.getCurrentAuthState.mockResolvedValue({
      kind: 'ready',
      user: {
        id: 'auth-user-1',
        email: 'pilot@example.com',
      },
    })
    mocks.createProfilesRepository.mockReturnValue({
      getProfileByAuthUserId: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: 'profile-owner',
        },
      }),
      searchVisibleProfiles: vi.fn().mockResolvedValue({
        ok: true,
        data: [
          {
            id: 'profile-owner',
            displayName: 'Owner',
            avatarUrl: null,
            bio: null,
            visibility: 'public',
            bioVisibility: 'public',
            bioVisible: false,
          },
          {
            id: 'profile-opponent',
            displayName: 'Azure Rival',
            avatarUrl: null,
            bio: 'Visible profile bio.',
            visibility: 'friends',
            bioVisibility: 'friends',
            bioVisible: true,
          },
        ],
      }),
      getVisibleProfileById: vi.fn(),
    })
  })

  it('returns ready state with visible-profile results and filters out the current owner profile', async () => {
    const formData = new FormData()
    formData.set('query', 'Azure Rival')

    const result = await searchMatchOpponentProfilesAction(
      initialMatchOpponentSearchFormState,
      formData,
    )

    expect(result).toEqual({
      kind: 'ready',
      query: 'Azure Rival',
      results: [
        {
          id: 'profile-opponent',
          displayName: 'Azure Rival',
          avatarUrl: null,
          bio: 'Visible profile bio.',
          visibility: 'friends',
          bioVisibility: 'friends',
          bioVisible: true,
        },
      ],
    })
  })

  it('returns an idle too-short state for noisy opponent searches', async () => {
    const formData = new FormData()
    formData.set('query', 'a')

    const result = await searchMatchOpponentProfilesAction(
      initialMatchOpponentSearchFormState,
      formData,
    )

    expect(result).toEqual({
      kind: 'idle',
      query: 'a',
      reason: 'too-short',
    })
  })

  it('returns an auth error when opponent search is attempted while signed out', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'signed-out',
    })

    const formData = new FormData()
    formData.set('query', 'Azure')

    const result = await searchMatchOpponentProfilesAction(
      initialMatchOpponentSearchFormState,
      formData,
    )

    expect(result).toEqual({
      kind: 'error',
      query: 'Azure',
      message: 'Sign in before searching for opponent profiles.',
    })
  })
})
