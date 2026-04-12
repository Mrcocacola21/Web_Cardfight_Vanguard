import { describe, expect, it, vi } from 'vitest'

import type { ProfileApplicationServices } from './profile-application-support'
import { saveCurrentProfileUseCase } from './profile-management-use-cases'

describe('saveCurrentProfileUseCase', () => {
  it('persists the requested profile update and returns the profile id', async () => {
    const repositoryDouble = createRepositoryDouble()
    repositoryDouble.upsertProfileByAuthUserId.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'profile-1',
      },
    })

    const result = await saveCurrentProfileUseCase(
      { repository: repositoryDouble.repository },
      {
        authUserId: 'auth-user-1',
        displayName: 'Azure Pilot',
        avatarUrl: 'https://example.com/avatar.png',
        bio: 'Ride the Vanguard.',
        visibility: 'public',
      },
    )

    expect(repositoryDouble.upsertProfileByAuthUserId).toHaveBeenCalledWith({
      authUserId: 'auth-user-1',
      displayName: 'Azure Pilot',
      avatarUrl: 'https://example.com/avatar.png',
      bio: 'Ride the Vanguard.',
      visibility: 'public',
    })
    expect(result).toEqual({
      ok: true,
      data: {
        profileId: 'profile-1',
      },
    })
  })

  it('maps repository failures into application errors', async () => {
    const repositoryDouble = createRepositoryDouble()
    repositoryDouble.upsertProfileByAuthUserId.mockResolvedValueOnce({
      ok: false,
      error: {
        message: 'Profile write failed.',
      },
    })

    const result = await saveCurrentProfileUseCase(
      { repository: repositoryDouble.repository },
      {
        authUserId: 'auth-user-1',
        displayName: 'Azure Pilot',
        avatarUrl: null,
        bio: null,
        visibility: 'private',
      },
    )

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'repository-failed',
        message: 'Profile write failed.',
      },
    })
  })
})

function createRepositoryDouble() {
  const ensureProfileByAuthUserId = vi.fn()
  const upsertProfileByAuthUserId = vi.fn()

  return {
    repository: {
      ensureProfileByAuthUserId,
      upsertProfileByAuthUserId,
    } satisfies ProfileApplicationServices['repository'],
    ensureProfileByAuthUserId,
    upsertProfileByAuthUserId,
  }
}
