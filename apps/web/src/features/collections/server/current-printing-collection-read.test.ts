// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getCurrentAuthState: vi.fn(),
  createProfilesRepository: vi.fn(),
  createCollectionsRepository: vi.fn(),
  getProfileByAuthUserId: vi.fn(),
  getCollectionItemByOwnerAndPrinting: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/auth/server/auth-session', () => ({
  getCurrentAuthState: mocks.getCurrentAuthState,
}))

vi.mock('@web-vg/db', () => ({
  createProfilesRepository: mocks.createProfilesRepository,
  createCollectionsRepository: mocks.createCollectionsRepository,
}))

import { getCurrentPrintingCollectionState } from './current-printing-collection-read'

describe('getCurrentPrintingCollectionState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({})
    mocks.createProfilesRepository.mockReturnValue({
      getProfileByAuthUserId: mocks.getProfileByAuthUserId,
    })
    mocks.createCollectionsRepository.mockReturnValue({
      getCollectionItemByOwnerAndPrinting:
        mocks.getCollectionItemByOwnerAndPrinting,
    })
  })

  it('returns a signed-out state when no authenticated session exists', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'signed-out',
    })

    const result = await getCurrentPrintingCollectionState('printing-1')

    expect(result).toEqual({
      kind: 'signed-out',
    })
  })

  it('loads the current owner-scoped collection item for one printing', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'ready',
      user: {
        id: 'auth-user-1',
        email: 'collector@example.com',
      },
    })
    mocks.getProfileByAuthUserId.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'profile-1',
      },
    })
    mocks.getCollectionItemByOwnerAndPrinting.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'item-1',
        ownerProfileId: 'profile-1',
        cardPrintingId: 'printing-1',
        quantity: 3,
        createdAt: '2026-04-22T10:00:00.000Z',
        updatedAt: '2026-04-22T11:00:00.000Z',
      },
    })

    const result = await getCurrentPrintingCollectionState('printing-1')

    expect(mocks.getCollectionItemByOwnerAndPrinting).toHaveBeenCalledWith(
      'profile-1',
      'printing-1',
    )
    expect(result).toEqual({
      kind: 'ready',
      ownerProfileId: 'profile-1',
      item: {
        id: 'item-1',
        ownerProfileId: 'profile-1',
        cardPrintingId: 'printing-1',
        quantity: 3,
        createdAt: '2026-04-22T10:00:00.000Z',
        updatedAt: '2026-04-22T11:00:00.000Z',
      },
    })
  })

  it('returns profile-required when the auth user does not have a persisted profile yet', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'ready',
      user: {
        id: 'auth-user-1',
        email: 'collector@example.com',
      },
    })
    mocks.getProfileByAuthUserId.mockResolvedValueOnce({
      ok: true,
      data: null,
    })

    const result = await getCurrentPrintingCollectionState('printing-1')

    expect(result).toEqual({
      kind: 'profile-required',
    })
  })
})
