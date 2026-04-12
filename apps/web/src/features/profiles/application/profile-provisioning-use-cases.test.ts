import { describe, expect, it, vi } from 'vitest'

import type { ProfileApplicationServices } from './profile-application-support'
import {
  deriveInitialProfileDraft,
  ensureProfileForAuthUserUseCase,
  readMetadataDisplayName,
} from './profile-provisioning-use-cases'

describe('deriveInitialProfileDraft', () => {
  it('prefers an explicit display name from the registration flow', () => {
    expect(
      deriveInitialProfileDraft({
        preferredDisplayName: 'Azure Pilot',
        email: 'pilot@example.com',
      }),
    ).toEqual({
      displayName: 'Azure Pilot',
      avatarUrl: null,
      bio: null,
      visibility: 'private',
    })
  })

  it('falls back to the email local part when the preferred name is missing', () => {
    expect(
      deriveInitialProfileDraft({
        preferredDisplayName: '   ',
        email: 'orbital.rider@example.com',
      }),
    ).toEqual({
      displayName: 'orbital.rider',
      avatarUrl: null,
      bio: null,
      visibility: 'private',
    })
  })
})

describe('readMetadataDisplayName', () => {
  it('reads the display_name field when present', () => {
    expect(
      readMetadataDisplayName({
        display_name: 'Azure Pilot',
      }),
    ).toBe('Azure Pilot')
  })

  it('returns null when metadata does not expose a string display name', () => {
    expect(readMetadataDisplayName(null)).toBeNull()
    expect(readMetadataDisplayName({ display_name: 42 })).toBeNull()
  })
})

describe('ensureProfileForAuthUserUseCase', () => {
  it('ensures a profile row and returns the resulting profile id', async () => {
    const repositoryDouble = createRepositoryDouble()
    repositoryDouble.ensureProfileByAuthUserId.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'profile-1',
      },
    })

    const result = await ensureProfileForAuthUserUseCase(
      { repository: repositoryDouble.repository },
      {
        authUserId: 'auth-user-1',
        displayName: 'Azure Pilot',
        avatarUrl: null,
        bio: null,
        visibility: 'private',
      },
    )

    expect(repositoryDouble.ensureProfileByAuthUserId).toHaveBeenCalledWith({
      authUserId: 'auth-user-1',
      displayName: 'Azure Pilot',
      avatarUrl: null,
      bio: null,
      visibility: 'private',
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
    repositoryDouble.ensureProfileByAuthUserId.mockResolvedValueOnce({
      ok: false,
      error: {
        message: 'Profile ensure failed.',
      },
    })

    const result = await ensureProfileForAuthUserUseCase(
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
        message: 'Profile ensure failed.',
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
