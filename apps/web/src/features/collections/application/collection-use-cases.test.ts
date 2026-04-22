import { describe, expect, it, vi } from 'vitest'

import type { CollectionApplicationServices } from './collection-application-support'
import {
  addCollectionPrintingUseCase,
  decrementCollectionPrintingUseCase,
  removeCollectionPrintingUseCase,
  setCollectionPrintingQuantityUseCase,
} from './collection-use-cases'

describe('collection use cases', () => {
  it('adds a printing to the owner inventory by incrementing the printing-level row', async () => {
    const changeCollectionPrintingQuantity = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'item-1',
        ownerProfileId: 'profile-1',
        cardPrintingId: 'printing-1',
        quantity: 2,
        createdAt: '2026-04-22T10:00:00.000Z',
        updatedAt: '2026-04-22T11:00:00.000Z',
      },
    })
    const services = createServices({
      collectionsRepository: {
        changeCollectionPrintingQuantity,
      },
    })

    const result = await addCollectionPrintingUseCase(services, {
      authUserId: 'auth-user-1',
      printingId: 'printing-1',
      quantity: 2,
    })

    expect(result).toEqual({
      ok: true,
      data: {
        printingId: 'printing-1',
        quantity: 2,
        removed: false,
      },
    })
    expect(changeCollectionPrintingQuantity).toHaveBeenCalledWith({
      ownerProfileId: 'profile-1',
      cardPrintingId: 'printing-1',
      quantityDelta: 2,
    })
  })

  it('rejects non-positive add quantities before hitting persistence', async () => {
    const services = createServices()

    const result = await addCollectionPrintingUseCase(services, {
      authUserId: 'auth-user-1',
      printingId: 'printing-1',
      quantity: 0,
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'invalid-quantity',
        message:
          'Collection quantity must be a positive integer when adding a printing.',
      },
    })
  })

  it('treats different printings of the same gameplay card as separate mutation targets', async () => {
    const changeCollectionPrintingQuantity = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: 'item-regular',
          ownerProfileId: 'profile-1',
          cardPrintingId: 'printing-regular',
          quantity: 1,
          createdAt: '2026-04-22T10:00:00.000Z',
          updatedAt: '2026-04-22T11:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: 'item-alt',
          ownerProfileId: 'profile-1',
          cardPrintingId: 'printing-alt',
          quantity: 1,
          createdAt: '2026-04-22T10:05:00.000Z',
          updatedAt: '2026-04-22T11:05:00.000Z',
        },
      })
    const services = createServices({
      collectionsRepository: {
        changeCollectionPrintingQuantity,
      },
    })

    await addCollectionPrintingUseCase(services, {
      authUserId: 'auth-user-1',
      printingId: 'printing-regular',
    })
    await addCollectionPrintingUseCase(services, {
      authUserId: 'auth-user-1',
      printingId: 'printing-alt',
    })

    expect(changeCollectionPrintingQuantity).toHaveBeenNthCalledWith(1, {
      ownerProfileId: 'profile-1',
      cardPrintingId: 'printing-regular',
      quantityDelta: 1,
    })
    expect(changeCollectionPrintingQuantity).toHaveBeenNthCalledWith(2, {
      ownerProfileId: 'profile-1',
      cardPrintingId: 'printing-alt',
      quantityDelta: 1,
    })
  })

  it('decrements one owned printing and deletes the row when quantity reaches zero', async () => {
    const getCollectionItemByOwnerAndPrinting = vi.fn().mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'item-1',
        ownerProfileId: 'profile-1',
        cardPrintingId: 'printing-1',
        quantity: 1,
        createdAt: '2026-04-22T10:00:00.000Z',
        updatedAt: '2026-04-22T11:00:00.000Z',
      },
    })
    const changeCollectionPrintingQuantity = vi.fn().mockResolvedValue({
      ok: true,
      data: null,
    })
    const services = createServices({
      collectionsRepository: {
        getCollectionItemByOwnerAndPrinting,
        changeCollectionPrintingQuantity,
      },
    })

    const result = await decrementCollectionPrintingUseCase(services, {
      authUserId: 'auth-user-1',
      printingId: 'printing-1',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        printingId: 'printing-1',
        quantity: 0,
        removed: true,
      },
    })
    expect(changeCollectionPrintingQuantity).toHaveBeenCalledWith({
      ownerProfileId: 'profile-1',
      cardPrintingId: 'printing-1',
      quantityDelta: -1,
    })
  })

  it('rejects decrements for printings that are not currently owned', async () => {
    const services = createServices({
      collectionsRepository: {
        getCollectionItemByOwnerAndPrinting: vi.fn().mockResolvedValue({
          ok: true,
          data: null,
        }),
      },
    })

    const result = await decrementCollectionPrintingUseCase(services, {
      authUserId: 'auth-user-1',
      printingId: 'printing-1',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'collection-item-unavailable',
        message: 'This printing is not currently present in your collection.',
      },
    })
  })

  it('sets an exact positive quantity for one printing row', async () => {
    const setCollectionPrintingQuantity = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'item-1',
        ownerProfileId: 'profile-1',
        cardPrintingId: 'printing-1',
        quantity: 5,
        createdAt: '2026-04-22T10:00:00.000Z',
        updatedAt: '2026-04-22T12:00:00.000Z',
      },
    })
    const services = createServices({
      collectionsRepository: {
        setCollectionPrintingQuantity,
      },
    })

    const result = await setCollectionPrintingQuantityUseCase(services, {
      authUserId: 'auth-user-1',
      printingId: 'printing-1',
      quantity: 5,
    })

    expect(result).toEqual({
      ok: true,
      data: {
        printingId: 'printing-1',
        quantity: 5,
        removed: false,
      },
    })
    expect(setCollectionPrintingQuantity).toHaveBeenCalledWith({
      ownerProfileId: 'profile-1',
      cardPrintingId: 'printing-1',
      quantity: 5,
    })
  })

  it('removes a printing completely with an idempotent owner-scoped delete', async () => {
    const removeCollectionPrinting = vi.fn().mockResolvedValue({
      ok: true,
      data: undefined,
    })
    const services = createServices({
      collectionsRepository: {
        removeCollectionPrinting,
      },
    })

    const result = await removeCollectionPrintingUseCase(services, {
      authUserId: 'auth-user-1',
      printingId: 'printing-1',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        printingId: 'printing-1',
        quantity: 0,
        removed: true,
      },
    })
    expect(removeCollectionPrinting).toHaveBeenCalledWith({
      ownerProfileId: 'profile-1',
      cardPrintingId: 'printing-1',
    })
  })

  it('requires a persisted profile before collection mutations can run', async () => {
    const services = createServices({
      profilesRepository: {
        getProfileByAuthUserId: vi.fn().mockResolvedValue({
          ok: true,
          data: null,
        }),
      },
    })

    const result = await addCollectionPrintingUseCase(services, {
      authUserId: 'auth-user-1',
      printingId: 'printing-1',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'profile-required',
        message:
          'A persisted profile row is required before collection actions can run.',
      },
    })
  })
})

function createServices(overrides?: {
  readonly profilesRepository?: Partial<
    CollectionApplicationServices['profilesRepository']
  >
  readonly collectionsRepository?: Partial<
    CollectionApplicationServices['collectionsRepository']
  >
}): CollectionApplicationServices {
  return {
    profilesRepository: {
      getProfileByAuthUserId: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: 'profile-1',
        },
      }),
      ...overrides?.profilesRepository,
    },
    collectionsRepository: {
      changeCollectionPrintingQuantity: vi.fn(),
      getCollectionItemByOwnerAndPrinting: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: 'item-1',
          ownerProfileId: 'profile-1',
          cardPrintingId: 'printing-1',
          quantity: 2,
          createdAt: '2026-04-22T10:00:00.000Z',
          updatedAt: '2026-04-22T11:00:00.000Z',
        },
      }),
      removeCollectionPrinting: vi.fn(),
      setCollectionPrintingQuantity: vi.fn(),
      ...overrides?.collectionsRepository,
    },
  }
}
