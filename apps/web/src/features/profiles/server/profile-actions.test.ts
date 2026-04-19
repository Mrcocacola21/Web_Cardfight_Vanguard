// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ProfileManagementUseCasesModule from '@/features/profiles/application/profile-management-use-cases'

import { initialProfileFormState } from './profile-form-state'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getCurrentAuthState: vi.fn(),
  createProfilesRepository: vi.fn(),
  saveCurrentProfileUseCase:
    vi.fn<typeof ProfileManagementUseCasesModule.saveCurrentProfileUseCase>(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/auth/server/auth-session', () => ({
  getCurrentAuthState: mocks.getCurrentAuthState,
}))

vi.mock('@web-vg/db', () => ({
  createProfilesRepository: mocks.createProfilesRepository,
}))

vi.mock('@/features/profiles/application/profile-management-use-cases', () => ({
  saveCurrentProfileUseCase: mocks.saveCurrentProfileUseCase,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import { saveCurrentProfileAction } from './profile-actions'

describe('saveCurrentProfileAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({})
    mocks.createProfilesRepository.mockReturnValue({
      upsertProfileByAuthUserId: vi.fn(),
      ensureProfileByAuthUserId: vi.fn(),
    })
  })

  it('returns an auth-required error when there is no authenticated session', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'signed-out',
    })

    const result = await saveCurrentProfileAction(
      initialProfileFormState,
      createProfileFormData({
        displayName: 'Azure Pilot',
        avatarUrl: '',
        bio: '',
        visibility: 'private',
        bioVisibility: 'private',
      }),
    )

    expect(result).toEqual({
      status: 'error',
      message:
        'You need an authenticated session before a profile can be saved.',
      fieldErrors: {},
    })
    expect(mocks.saveCurrentProfileUseCase).not.toHaveBeenCalled()
  })

  it('saves privacy flags through the authenticated owner context and ignores injected auth fields', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'ready',
      user: {
        id: 'auth-user-session',
        email: 'pilot@example.com',
      },
    })
    mocks.saveCurrentProfileUseCase.mockResolvedValueOnce({
      ok: true,
      data: {
        profileId: 'profile-1',
      },
    })

    const formData = createProfileFormData({
      displayName: 'Azure Pilot',
      avatarUrl: 'https://images.example/avatar.png',
      bio: 'Friend-scoped notes.',
      visibility: 'friends',
      bioVisibility: 'friends',
    })
    formData.set('authUserId', 'forged-auth-user')

    const result = await saveCurrentProfileAction(
      initialProfileFormState,
      formData,
    )

    const firstCall = mocks.saveCurrentProfileUseCase.mock.calls[0]

    expect(firstCall).toBeDefined()

    if (!firstCall) {
      throw new Error('Expected saveCurrentProfileUseCase to be called.')
    }

    const [services, command] = firstCall

    expect(services.repository).toBeDefined()
    expect(command).toEqual({
      authUserId: 'auth-user-session',
      displayName: 'Azure Pilot',
      avatarUrl: 'https://images.example/avatar.png',
      bio: 'Friend-scoped notes.',
      visibility: 'friends',
      bioVisibility: 'friends',
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/profile')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/friends')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/users')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/users/profile-1')
    expect(result).toEqual({
      status: 'success',
      message: 'Profile saved.',
      fieldErrors: {},
    })
  })

  it('returns validation feedback when scoped visibility is broader than the profile surface', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'ready',
      user: {
        id: 'auth-user-session',
        email: 'pilot@example.com',
      },
    })

    const result = await saveCurrentProfileAction(
      initialProfileFormState,
      createProfileFormData({
        displayName: 'Azure Pilot',
        avatarUrl: '',
        bio: 'Friend-scoped notes.',
        visibility: 'friends',
        bioVisibility: 'public',
      }),
    )

    expect(result).toEqual({
      status: 'error',
      message: 'Profile data is incomplete or invalid.',
      fieldErrors: {
        bioVisibility:
          'Bio visibility cannot be broader than profile visibility.',
      },
    })
    expect(mocks.saveCurrentProfileUseCase).not.toHaveBeenCalled()
  })
})

function createProfileFormData(values: Record<string, string>) {
  const formData = new FormData()

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value)
  }

  return formData
}
