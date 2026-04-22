// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentProfileState: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  createCollectionInventoryRepository: vi.fn(),
  createCollectionPreferenceRepository: vi.fn(),
  listCollectionInventoryViewUseCase: vi.fn(),
  listCollectionPreferenceOverviewUseCase: vi.fn(),
}))

vi.mock('@/features/profiles/server/profile-read', () => ({
  getCurrentProfileState: mocks.getCurrentProfileState,
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock(
  '@/features/collections/infrastructure/collection-inventory-repository',
  () => ({
    createCollectionInventoryRepository:
      mocks.createCollectionInventoryRepository,
  }),
)

vi.mock(
  '@/features/collections/infrastructure/collection-preference-repository',
  () => ({
    createCollectionPreferenceRepository:
      mocks.createCollectionPreferenceRepository,
  }),
)

vi.mock(
  '@/features/collections/application/collection-inventory-use-cases',
  () => ({
    listCollectionInventoryViewUseCase:
      mocks.listCollectionInventoryViewUseCase,
  }),
)

vi.mock(
  '@/features/collections/application/collection-preference-use-cases',
  () => ({
    listCollectionPreferenceOverviewUseCase:
      mocks.listCollectionPreferenceOverviewUseCase,
  }),
)

import { getCollectionPageState } from './collection-page-read'

describe('getCollectionPageState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({})
    mocks.createCollectionInventoryRepository.mockReturnValue({
      listCollectionInventoryItemsByOwner: vi.fn(),
    })
    mocks.createCollectionPreferenceRepository.mockReturnValue({
      listCollectionPrintingPreferenceItemsByOwner: vi.fn(),
    })
  })

  it('loads the owner-scoped collection page view for the current profile', async () => {
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
    mocks.listCollectionInventoryViewUseCase.mockResolvedValueOnce({
      ok: true,
      data: {
        totalOwnedPrintings: 2,
        totalOwnedCopies: 3,
        items: [{ id: 'item-1' }],
      },
    })
    mocks.listCollectionPreferenceOverviewUseCase.mockResolvedValueOnce({
      ok: true,
      data: {
        totalWishlistItems: 1,
        totalFavoriteItems: 1,
        wishlistItems: [{ id: 'pref-1' }],
        favoriteItems: [{ id: 'pref-2' }],
      },
    })

    const result = await getCollectionPageState({
      view: 'binder',
      sort: 'recent',
    })

    expect(mocks.listCollectionInventoryViewUseCase).toHaveBeenCalledWith(
      expect.any(Object),
      {
        ownerProfileId: 'profile-1',
        query: {
          view: 'binder',
          sort: 'recent',
        },
      },
    )
    expect(mocks.listCollectionPreferenceOverviewUseCase).toHaveBeenCalledWith(
      expect.any(Object),
      {
        ownerProfileId: 'profile-1',
      },
    )
    expect(result).toEqual({
      kind: 'ready',
      viewerDisplayName: 'Azure Collector',
      query: {
        view: 'binder',
        sort: 'recent',
      },
      totalOwnedPrintings: 2,
      totalOwnedCopies: 3,
      items: [{ id: 'item-1' }],
      totalWishlistItems: 1,
      totalFavoriteItems: 1,
      wishlistItems: [{ id: 'pref-1' }],
      favoriteItems: [{ id: 'pref-2' }],
    })
  })

  it('returns profile-unavailable when the user has no persisted profile yet', async () => {
    mocks.getCurrentProfileState.mockResolvedValueOnce({
      kind: 'ready',
      authUser: {
        id: 'auth-user-1',
        email: 'collector@example.com',
      },
      profile: null,
    })

    const result = await getCollectionPageState({
      view: 'binder',
      sort: 'recent',
    })

    expect(result).toEqual({
      kind: 'profile-unavailable',
    })
    expect(mocks.listCollectionInventoryViewUseCase).not.toHaveBeenCalled()
  })
})
