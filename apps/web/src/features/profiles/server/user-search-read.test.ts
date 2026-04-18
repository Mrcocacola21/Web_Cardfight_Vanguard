// @vitest-environment node

import type { PublicProfileRecord } from '@web-vg/db/repositories/profiles'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultUserSearchResultLimit } from '@/features/profiles/user-search-query'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  createProfilesRepository: vi.fn(),
  searchPublicProfiles: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@web-vg/db', () => ({
  createProfilesRepository: mocks.createProfilesRepository,
}))

import { getUserSearchPageState } from './user-search-read'

describe('getUserSearchPageState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({})
    mocks.createProfilesRepository.mockReturnValue({
      searchPublicProfiles: mocks.searchPublicProfiles,
    })
  })

  it('stays idle and avoids persistence work for empty or too-short queries', async () => {
    await expect(
      getUserSearchPageState({
        kind: 'idle',
        inputValue: '',
        reason: 'empty',
      }),
    ).resolves.toEqual({
      kind: 'idle',
      reason: 'empty',
    })

    await expect(
      getUserSearchPageState({
        kind: 'idle',
        inputValue: 'a',
        reason: 'too-short',
      }),
    ).resolves.toEqual({
      kind: 'idle',
      reason: 'too-short',
    })

    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled()
    expect(mocks.searchPublicProfiles).not.toHaveBeenCalled()
  })

  it('loads public profile results through the repository-backed search path', async () => {
    const results: readonly PublicProfileRecord[] = [
      {
        id: 'profile-public-1',
        displayName: 'Azure Pilot',
        avatarUrl: 'https://images.example/avatar.png',
        bio: 'Public pilot bio.',
      },
    ]
    mocks.searchPublicProfiles.mockResolvedValueOnce({
      ok: true,
      data: results,
    })

    await expect(
      getUserSearchPageState({
        kind: 'searchable',
        inputValue: 'Azure Pilot',
        searchText: 'Azure Pilot',
      }),
    ).resolves.toEqual({
      kind: 'ready',
      results,
    })

    expect(mocks.searchPublicProfiles).toHaveBeenCalledWith(
      'Azure Pilot',
      defaultUserSearchResultLimit,
    )
  })

  it('maps repository failures into an error page state', async () => {
    mocks.searchPublicProfiles.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'query-failed',
        message: 'Failed to search public profiles.',
      },
    })

    await expect(
      getUserSearchPageState({
        kind: 'searchable',
        inputValue: 'Azure',
        searchText: 'Azure',
      }),
    ).resolves.toEqual({
      kind: 'error',
      message: 'Failed to search public profiles.',
    })
  })
})
