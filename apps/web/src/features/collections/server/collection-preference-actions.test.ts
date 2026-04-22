// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as CollectionPreferenceUseCasesModule from '@/features/collections/application/collection-preference-use-cases'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getCurrentAuthState: vi.fn(),
  createProfilesRepository: vi.fn(),
  createCollectionPreferenceRepository: vi.fn(),
  setCollectionPrintingPreferenceUseCase:
    vi.fn<
      typeof CollectionPreferenceUseCasesModule.setCollectionPrintingPreferenceUseCase
    >(),
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

vi.mock(
  '@/features/collections/infrastructure/collection-preference-repository',
  () => ({
    createCollectionPreferenceRepository:
      mocks.createCollectionPreferenceRepository,
  }),
)

vi.mock(
  '@/features/collections/application/collection-preference-use-cases',
  () => ({
    setCollectionPrintingPreferenceUseCase:
      mocks.setCollectionPrintingPreferenceUseCase,
  }),
)

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import { setCollectionPrintingPreferenceAction } from './collection-preference-actions'

describe('collection preference actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({})
    mocks.getCurrentAuthState.mockResolvedValue({
      kind: 'ready',
      user: {
        id: 'auth-user-1',
        email: 'collector@example.com',
      },
    })
    mocks.createProfilesRepository.mockReturnValue({
      getProfileByAuthUserId: vi.fn(),
    })
    mocks.createCollectionPreferenceRepository.mockReturnValue({
      listCollectionPrintingPreferenceItemsByOwner: vi.fn(),
      listCollectionPrintingPreferencesByOwnerAndPrinting: vi.fn(),
      upsertCollectionPrintingPreference: vi.fn(),
      removeCollectionPrintingPreference: vi.fn(),
    })
  })

  it('routes wishlist adds through the preference use case and revalidates the current path', async () => {
    mocks.setCollectionPrintingPreferenceUseCase.mockResolvedValueOnce({
      ok: true,
      data: {
        printingId: 'printing-1',
        preferenceKind: 'wishlist',
        isPresent: true,
      },
    })

    const formData = new FormData()
    formData.set('printingId', 'printing-1')
    formData.set('preferenceKind', 'wishlist')
    formData.set('isPresent', 'true')
    formData.set('returnPath', '/catalog/printings/printing-1')

    await setCollectionPrintingPreferenceAction(formData)

    expect(mocks.setCollectionPrintingPreferenceUseCase).toHaveBeenCalledWith(
      expect.any(Object),
      {
        authUserId: 'auth-user-1',
        printingId: 'printing-1',
        preferenceKind: 'wishlist',
        isPresent: true,
      },
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      '/catalog/printings/printing-1',
    )
  })

  it('routes favorite removals through the same presence-based preference use case', async () => {
    mocks.setCollectionPrintingPreferenceUseCase.mockResolvedValueOnce({
      ok: true,
      data: {
        printingId: 'printing-1',
        preferenceKind: 'favorite',
        isPresent: false,
      },
    })

    const formData = new FormData()
    formData.set('printingId', 'printing-1')
    formData.set('preferenceKind', 'favorite')
    formData.set('isPresent', 'false')
    formData.set('returnPath', '/collection')

    await setCollectionPrintingPreferenceAction(formData)

    expect(mocks.setCollectionPrintingPreferenceUseCase).toHaveBeenCalledWith(
      expect.any(Object),
      {
        authUserId: 'auth-user-1',
        printingId: 'printing-1',
        preferenceKind: 'favorite',
        isPresent: false,
      },
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/collection')
  })
})
