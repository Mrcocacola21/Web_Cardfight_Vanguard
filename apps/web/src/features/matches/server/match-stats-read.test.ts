import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MatchStatsUseCasesModule from '@/features/matches/application/match-stats-use-cases'

const mocks = vi.hoisted(() => ({
  getCurrentProfileState: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  createMatchHistoryRepository: vi.fn(),
  getMatchStatsViewUseCase:
    vi.fn<typeof MatchStatsUseCasesModule.getMatchStatsViewUseCase>(),
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

vi.mock('@/features/matches/application/match-stats-use-cases', () => ({
  getMatchStatsViewUseCase: mocks.getMatchStatsViewUseCase,
}))

import { getMatchStatsPageState } from './match-stats-read'

describe('getMatchStatsPageState', () => {
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
      listAllMatchHistoryItemsByOwner: vi.fn(),
    })
    mocks.getMatchStatsViewUseCase.mockResolvedValue({
      ok: true,
      data: {
        totalMatches: 4,
        wins: 2,
        losses: 1,
        draws: 1,
        winRate: 0.5,
        topDecks: [],
      },
    })
  })

  it('returns ready page state for the current owner profile', async () => {
    const result = await getMatchStatsPageState()

    const firstCall = mocks.getMatchStatsViewUseCase.mock.calls[0]

    expect(firstCall).toBeDefined()

    if (!firstCall) {
      throw new Error('Expected getMatchStatsViewUseCase to be called.')
    }

    const [services, command] = firstCall

    expect(services.repository).toBeDefined()
    expect(command).toEqual({
      ownerProfileId: 'profile-owner',
    })
    expect(result).toEqual({
      kind: 'ready',
      viewerDisplayName: 'Azure Pilot',
      stats: {
        totalMatches: 4,
        wins: 2,
        losses: 1,
        draws: 1,
        winRate: 0.5,
        topDecks: [],
      },
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

    const result = await getMatchStatsPageState()

    expect(result).toEqual({
      kind: 'profile-unavailable',
    })
  })

  it('returns an auth error when the viewer is signed out', async () => {
    mocks.getCurrentProfileState.mockResolvedValueOnce({
      kind: 'signed-out',
    })

    const result = await getMatchStatsPageState()

    expect(result).toEqual({
      kind: 'error',
      message: 'Match stats require an authenticated session.',
    })
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled()
    expect(mocks.getMatchStatsViewUseCase).not.toHaveBeenCalled()
  })
})
