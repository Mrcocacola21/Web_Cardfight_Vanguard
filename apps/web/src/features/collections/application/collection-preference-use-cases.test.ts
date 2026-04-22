import { describe, expect, it, vi } from 'vitest'

import type { CollectionPreferenceApplicationServices } from './collection-preference-use-cases'
import type { StoredCollectionPrintingPreferenceItem } from './collection-preference-repository'
import {
  getCollectionPrintingPreferenceStateUseCase,
  listCollectionPreferenceOverviewUseCase,
  setCollectionPrintingPreferenceUseCase,
} from './collection-preference-use-cases'

describe('collection preference use cases', () => {
  it('adds a wishlist preference for one printing without touching ownership quantity', async () => {
    const upsertCollectionPrintingPreference = vi.fn().mockResolvedValue({
      ok: true,
      data: createPreference({
        id: 'pref-wishlist',
        cardPrintingId: 'printing-1',
        preferenceKind: 'wishlist',
      }),
    })
    const services = createServices({
      collectionsRepository: {
        upsertCollectionPrintingPreference,
      },
    })

    const result = await setCollectionPrintingPreferenceUseCase(services, {
      authUserId: 'auth-user-1',
      printingId: 'printing-1',
      preferenceKind: 'wishlist',
      isPresent: true,
    })

    expect(result).toEqual({
      ok: true,
      data: {
        printingId: 'printing-1',
        preferenceKind: 'wishlist',
        isPresent: true,
      },
    })
    expect(upsertCollectionPrintingPreference).toHaveBeenCalledWith({
      ownerProfileId: 'profile-1',
      cardPrintingId: 'printing-1',
      preferenceKind: 'wishlist',
    })
  })

  it('adds a favorite preference independently from wishlist state', async () => {
    const upsertCollectionPrintingPreference = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: createPreference({
          id: 'pref-wishlist',
          cardPrintingId: 'printing-1',
          preferenceKind: 'wishlist',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        data: createPreference({
          id: 'pref-favorite',
          cardPrintingId: 'printing-1',
          preferenceKind: 'favorite',
        }),
      })
    const services = createServices({
      collectionsRepository: {
        upsertCollectionPrintingPreference,
      },
    })

    await setCollectionPrintingPreferenceUseCase(services, {
      authUserId: 'auth-user-1',
      printingId: 'printing-1',
      preferenceKind: 'wishlist',
      isPresent: true,
    })
    const result = await setCollectionPrintingPreferenceUseCase(services, {
      authUserId: 'auth-user-1',
      printingId: 'printing-1',
      preferenceKind: 'favorite',
      isPresent: true,
    })

    expect(result).toEqual({
      ok: true,
      data: {
        printingId: 'printing-1',
        preferenceKind: 'favorite',
        isPresent: true,
      },
    })
    expect(upsertCollectionPrintingPreference).toHaveBeenNthCalledWith(1, {
      ownerProfileId: 'profile-1',
      cardPrintingId: 'printing-1',
      preferenceKind: 'wishlist',
    })
    expect(upsertCollectionPrintingPreference).toHaveBeenNthCalledWith(2, {
      ownerProfileId: 'profile-1',
      cardPrintingId: 'printing-1',
      preferenceKind: 'favorite',
    })
  })

  it('removes one preference kind idempotently without touching the other kind', async () => {
    const removeCollectionPrintingPreference = vi.fn().mockResolvedValue({
      ok: true,
      data: undefined,
    })
    const services = createServices({
      collectionsRepository: {
        removeCollectionPrintingPreference,
      },
    })

    const result = await setCollectionPrintingPreferenceUseCase(services, {
      authUserId: 'auth-user-1',
      printingId: 'printing-1',
      preferenceKind: 'favorite',
      isPresent: false,
    })

    expect(result).toEqual({
      ok: true,
      data: {
        printingId: 'printing-1',
        preferenceKind: 'favorite',
        isPresent: false,
      },
    })
    expect(removeCollectionPrintingPreference).toHaveBeenCalledWith({
      ownerProfileId: 'profile-1',
      cardPrintingId: 'printing-1',
      preferenceKind: 'favorite',
    })
  })

  it('reads current preference state per printing and preserves both flags separately', async () => {
    const services = createServices({
      collectionsRepository: {
        listCollectionPrintingPreferencesByOwnerAndPrinting: vi
          .fn()
          .mockResolvedValue({
            ok: true,
            data: [
              createPreference({
                id: 'pref-wishlist',
                cardPrintingId: 'printing-1',
                preferenceKind: 'wishlist',
              }),
              createPreference({
                id: 'pref-favorite',
                cardPrintingId: 'printing-1',
                preferenceKind: 'favorite',
              }),
            ],
          }),
      },
    })

    const result = await getCollectionPrintingPreferenceStateUseCase(
      {
        collectionsRepository: services.collectionsRepository,
      },
      {
        ownerProfileId: 'profile-1',
        printingId: 'printing-1',
      },
    )

    expect(result).toEqual({
      ok: true,
      data: {
        wishlisted: true,
        favorited: true,
      },
    })
  })

  it('builds separate wishlist and favorite sections for the same canonical card with different printings', async () => {
    const services = createServices({
      collectionsRepository: {
        listCollectionPrintingPreferenceItemsByOwner: vi
          .fn()
          .mockResolvedValue({
            ok: true,
            data: [
              createPreferenceItem({
                id: 'pref-alt',
                cardPrintingId: 'printing-alt',
                preferenceKind: 'wishlist',
                updatedAt: '2026-04-22T11:05:00.000Z',
                printing: {
                  id: 'printing-alt',
                  printingKey: 'printing.azure-vanguard-dragon.d-bt01.001.alt',
                  collectorNumber: '001',
                  rarity: 'SP',
                  localeCode: 'en',
                  regionCode: 'en',
                  printedName: 'Azure Vanguard Dragon',
                  artVariant: 'special-foil',
                  isAlternateArt: true,
                  isPromoVariant: false,
                  product: {
                    id: 'product-1',
                    canonicalKey: 'product.d-bt01.genesis-of-azure',
                    officialCode: 'D-BT01',
                    name: 'Genesis of Azure',
                    productCategory: 'booster',
                    productKind: 'main',
                    releaseDate: '2021-05-14',
                    regionCode: 'en',
                  },
                  card: {
                    id: 'card-1',
                    canonicalKey: 'card.azure-vanguard-dragon',
                    name: 'Azure Vanguard Dragon',
                    grade: 3,
                    cardType: 'normal-unit',
                    nation: 'Dragon Empire',
                    clan: null,
                    triggerType: null,
                  },
                },
              }),
              createPreferenceItem({
                id: 'pref-regular',
                cardPrintingId: 'printing-regular',
                preferenceKind: 'favorite',
                updatedAt: '2026-04-22T11:00:00.000Z',
                printing: {
                  id: 'printing-regular',
                  printingKey: 'printing.azure-vanguard-dragon.d-bt01.001.en',
                  collectorNumber: '001',
                  rarity: 'RRR',
                  localeCode: 'en',
                  regionCode: 'en',
                  printedName: 'Azure Vanguard Dragon',
                  artVariant: null,
                  isAlternateArt: false,
                  isPromoVariant: false,
                  product: {
                    id: 'product-1',
                    canonicalKey: 'product.d-bt01.genesis-of-azure',
                    officialCode: 'D-BT01',
                    name: 'Genesis of Azure',
                    productCategory: 'booster',
                    productKind: 'main',
                    releaseDate: '2021-05-14',
                    regionCode: 'en',
                  },
                  card: {
                    id: 'card-1',
                    canonicalKey: 'card.azure-vanguard-dragon',
                    name: 'Azure Vanguard Dragon',
                    grade: 3,
                    cardType: 'normal-unit',
                    nation: 'Dragon Empire',
                    clan: null,
                    triggerType: null,
                  },
                },
              }),
            ],
          }),
      },
    })

    const result = await listCollectionPreferenceOverviewUseCase(
      {
        collectionsRepository: services.collectionsRepository,
      },
      {
        ownerProfileId: 'profile-1',
      },
    )

    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error('Expected a successful collection preference overview.')
    }

    expect(result.data.totalWishlistItems).toBe(1)
    expect(result.data.totalFavoriteItems).toBe(1)
    expect(result.data.wishlistItems).toHaveLength(1)
    expect(result.data.favoriteItems).toHaveLength(1)
    expect(result.data.wishlistItems[0]).toMatchObject({
      id: 'pref-alt',
      cardPrintingId: 'printing-alt',
      preferenceKind: 'wishlist',
    })
    expect(result.data.wishlistItems[0]?.printing?.rarity).toBe('SP')
    expect(result.data.wishlistItems[0]?.printing?.isAlternateArt).toBe(true)
    expect(result.data.favoriteItems[0]).toMatchObject({
      id: 'pref-regular',
      cardPrintingId: 'printing-regular',
      preferenceKind: 'favorite',
    })
    expect(result.data.favoriteItems[0]?.printing?.rarity).toBe('RRR')
    expect(result.data.favoriteItems[0]?.printing?.isAlternateArt).toBe(false)
  })
})

function createServices(overrides?: {
  readonly profilesRepository?: Partial<
    CollectionPreferenceApplicationServices['profilesRepository']
  >
  readonly collectionsRepository?: Partial<
    CollectionPreferenceApplicationServices['collectionsRepository']
  >
}): CollectionPreferenceApplicationServices {
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
      listCollectionPrintingPreferenceItemsByOwner: vi.fn().mockResolvedValue({
        ok: true,
        data: [],
      }),
      listCollectionPrintingPreferencesByOwnerAndPrinting: vi
        .fn()
        .mockResolvedValue({
          ok: true,
          data: [],
        }),
      upsertCollectionPrintingPreference: vi.fn(),
      removeCollectionPrintingPreference: vi.fn().mockResolvedValue({
        ok: true,
        data: undefined,
      }),
      ...overrides?.collectionsRepository,
    },
  }
}

function createPreference(input?: {
  readonly id?: string
  readonly cardPrintingId?: string
  readonly preferenceKind?: 'wishlist' | 'favorite'
}) {
  return {
    id: input?.id ?? 'pref-1',
    ownerProfileId: 'profile-1',
    cardPrintingId: input?.cardPrintingId ?? 'printing-1',
    preferenceKind: input?.preferenceKind ?? 'wishlist',
    createdAt: '2026-04-22T10:00:00.000Z',
    updatedAt: '2026-04-22T11:00:00.000Z',
  }
}

function createPreferenceItem(input?: {
  readonly id?: string
  readonly cardPrintingId?: string
  readonly preferenceKind?: 'wishlist' | 'favorite'
  readonly updatedAt?: string
  readonly printing?: StoredCollectionPrintingPreferenceItem['printing']
}) {
  return {
    ...createPreference(input),
    updatedAt: input?.updatedAt ?? '2026-04-22T11:00:00.000Z',
    catalogState: 'ready' as const,
    printing:
      input?.printing === undefined
        ? {
            id: 'printing-1',
            printingKey: 'printing.default',
            collectorNumber: '001',
            rarity: 'C',
            localeCode: 'en',
            regionCode: 'en',
            printedName: 'Default Card',
            artVariant: null,
            isAlternateArt: false,
            isPromoVariant: false,
            product: {
              id: 'product-1',
              canonicalKey: 'product.default',
              officialCode: 'D-BT01',
              name: 'Default Set',
              productCategory: 'booster',
              productKind: 'main',
              releaseDate: '2021-01-01',
              regionCode: 'en',
            },
            card: {
              id: 'card-1',
              canonicalKey: 'card.default',
              name: 'Default Card',
              grade: 3,
              cardType: 'normal-unit',
              nation: 'Dragon Empire',
              clan: null,
              triggerType: null,
            },
          }
        : input.printing,
  }
}
