import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MatchHistoryListUseCasesModule from '@/features/matches/application/match-history-list-use-cases'

const mocks = vi.hoisted(() => ({
  getCurrentProfileState: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  createMatchHistoryRepository: vi.fn(),
  listMatchHistoryViewUseCase:
    vi.fn<typeof MatchHistoryListUseCasesModule.listMatchHistoryViewUseCase>(),
}))

vi.mock('@/features/profiles/server/profile-read', () => ({
  getCurrentProfileState: mocks.getCurrentProfileState,
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/matches/infrastructure/match-history-repository', () => ({
  createMatchHistoryRepository: mocks.createMatchHistoryRepository,
}))

vi.mock('@/features/matches/application/match-history-list-use-cases', () => ({
  listMatchHistoryViewUseCase: mocks.listMatchHistoryViewUseCase,
}))

import { getMatchHistoryListPageState } from './match-history-list-read'

describe('getMatchHistoryListPageState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentProfileState.mockResolvedValue({
      kind: 'ready',
      authUser: {
        id: 'auth-user-1',
        email: 'pilot@example.com',
      },
      profile: {
        id: 'profile-owner',
        displayName: 'Azure Pilot',
      },
    })
    mocks.createSupabaseServerClient.mockResolvedValue({
      kind: 'client',
    })
    mocks.createMatchHistoryRepository.mockReturnValue({
      listMatchHistoryItemsByOwner: vi.fn(),
    })
    mocks.listMatchHistoryViewUseCase.mockResolvedValue({
      ok: true,
      data: {
        totalMatchCount: 2,
        matches: [
          {
            id: 'match-1',
          },
        ],
        availableDecks: [
          {
            deckId: 'deck-1',
            label: 'Keter Balance',
          },
        ],
      },
    })
  })

  it('returns ready page state for the current profile owner', async () => {
    const query = {
      result: 'win',
      deckId: 'deck-1',
      opponent: 'Azure',
      formatId: 'standard',
      playedFrom: '2026-04-01',
      playedTo: '2026-04-30',
    } as const

    const result = await getMatchHistoryListPageState(query)

    const firstCall = mocks.listMatchHistoryViewUseCase.mock.calls[0]

    expect(firstCall).toBeDefined()

    if (!firstCall) {
      throw new Error('Expected listMatchHistoryViewUseCase to be called.')
    }

    const [services, command] = firstCall

    expect(services.repository).toBeDefined()
    expect(command).toEqual({
      ownerProfileId: 'profile-owner',
      query,
    })
    expect(result).toEqual({
      kind: 'ready',
      viewerDisplayName: 'Azure Pilot',
      query,
      totalMatchCount: 2,
      matches: [
        {
          id: 'match-1',
        },
      ],
      availableDecks: [
        {
          deckId: 'deck-1',
          label: 'Keter Balance',
        },
      ],
    })
  })

  it('returns profile-unavailable when no persisted profile exists', async () => {
    mocks.getCurrentProfileState.mockResolvedValueOnce({
      kind: 'ready',
      authUser: {
        id: 'auth-user-1',
        email: 'pilot@example.com',
      },
      profile: null,
    })

    const result = await getMatchHistoryListPageState({
      result: 'all',
      deckId: null,
      opponent: '',
      formatId: 'all',
      playedFrom: null,
      playedTo: null,
    })

    expect(result).toEqual({
      kind: 'profile-unavailable',
    })
  })

  it('returns an auth error when the viewer is signed out', async () => {
    mocks.getCurrentProfileState.mockResolvedValueOnce({
      kind: 'signed-out',
    })

    const result = await getMatchHistoryListPageState({
      result: 'all',
      deckId: null,
      opponent: '',
      formatId: 'all',
      playedFrom: null,
      playedTo: null,
    })

    expect(result).toEqual({
      kind: 'error',
      message: 'Match history requires an authenticated session.',
    })
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled()
    expect(mocks.listMatchHistoryViewUseCase).not.toHaveBeenCalled()
  })
})
