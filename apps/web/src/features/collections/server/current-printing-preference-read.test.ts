// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentProfileState: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  createCollectionPreferenceRepository: vi.fn(),
  getCollectionPrintingPreferenceStateUseCase: vi.fn(),
}))

vi.mock('@/features/profiles/server/profile-read', () => ({
  getCurrentProfileState: mocks.getCurrentProfileState,
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
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
    getCollectionPrintingPreferenceStateUseCase:
      mocks.getCollectionPrintingPreferenceStateUseCase,
  }),
)

import { getCurrentPrintingPreferenceState } from './current-printing-preference-read'

describe('getCurrentPrintingPreferenceState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({})
    mocks.createCollectionPreferenceRepository.mockReturnValue({
      listCollectionPrintingPreferencesByOwnerAndPrinting: vi.fn(),
    })
  })

  it('returns a signed-out state when no authenticated session exists', async () => {
    mocks.getCurrentProfileState.mockResolvedValueOnce({
      kind: 'signed-out',
    })

    const result = await getCurrentPrintingPreferenceState('printing-1')

    expect(result).toEqual({
      kind: 'signed-out',
    })
  })

  it('loads the current owner-scoped wishlist/favorite flags for one printing', async () => {
    mocks.getCurrentProfileState.mockResolvedValueOnce({
      kind: 'ready',
      authUser: {
        id: 'auth-user-1',
        email: 'collector@example.com',
      },
      profile: {
        id: 'profile-1',
        displayName: 'Azure Collector',
      },
    })
    mocks.getCollectionPrintingPreferenceStateUseCase.mockResolvedValueOnce({
      ok: true,
      data: {
        wishlisted: true,
        favorited: false,
      },
    })

    const result = await getCurrentPrintingPreferenceState('printing-1')

    expect(
      mocks.getCollectionPrintingPreferenceStateUseCase,
    ).toHaveBeenCalledWith(expect.any(Object), {
      ownerProfileId: 'profile-1',
      printingId: 'printing-1',
    })
    expect(result).toEqual({
      kind: 'ready',
      ownerProfileId: 'profile-1',
      wishlisted: true,
      favorited: false,
    })
  })

  it('returns profile-required when the auth user does not have a persisted profile yet', async () => {
    mocks.getCurrentProfileState.mockResolvedValueOnce({
      kind: 'ready',
      authUser: {
        id: 'auth-user-1',
        email: 'collector@example.com',
      },
      profile: null,
    })

    const result = await getCurrentPrintingPreferenceState('printing-1')

    expect(result).toEqual({
      kind: 'profile-required',
    })
  })
})
