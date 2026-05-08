import { describe, expect, it, vi } from 'vitest'

import type { CollectionInventoryApplicationServices } from './collection-inventory-use-cases'
import type { StoredCollectionInventoryItem } from './collection-inventory-repository'
import { listCollectionInventoryViewUseCase } from './collection-inventory-use-cases'

type CollectionInventoryPrinting = NonNullable<
  StoredCollectionInventoryItem['printing']
>
type CollectionInventoryProduct = NonNullable<
  CollectionInventoryPrinting['product']
>
type CollectionInventoryCard = NonNullable<CollectionInventoryPrinting['card']>
type CollectionInventoryPrintingFixture = Omit<
  Partial<CollectionInventoryPrinting>,
  'product' | 'card'
> & {
  readonly product?: Partial<CollectionInventoryProduct> | null
  readonly card?: Partial<CollectionInventoryCard> | null
}

describe('listCollectionInventoryViewUseCase', () => {
  it('returns owner-scoped inventory totals and keeps distinct printings distinct', async () => {
    const services = createServices([
      createItem({
        id: 'item-1',
        cardPrintingId: 'printing-1',
        quantity: 2,
        updatedAt: '2026-04-22T11:00:00.000Z',
        printing: {
          printingKey: 'printing.azure-vanguard-dragon.d-bt01.001.en',
          collectorNumber: '001',
          rarity: 'RRR',
          printedName: 'Azure Vanguard Dragon',
          isAlternateArt: true,
          isPromoVariant: false,
          artVariant: 'special-foil',
          localeCode: 'en',
          product: {
            officialCode: 'D-BT01',
            name: 'Genesis of Azure',
            releaseDate: '2021-05-14',
          },
          card: {
            name: 'Azure Vanguard Dragon',
          },
        },
      }),
      createItem({
        id: 'item-2',
        cardPrintingId: 'printing-2',
        quantity: 1,
        updatedAt: '2026-04-22T10:30:00.000Z',
        printing: {
          printingKey: 'printing.azure-vanguard-dragon.pr-g01.010.en',
          collectorNumber: '010',
          rarity: 'PR',
          printedName: 'Azure Vanguard Dragon',
          isAlternateArt: false,
          isPromoVariant: true,
          artVariant: null,
          localeCode: 'en',
          product: {
            officialCode: 'PR-G01',
            name: 'Anniversary Pack',
            releaseDate: '2019-08-09',
          },
          card: {
            name: 'Azure Vanguard Dragon',
          },
        },
      }),
    ])

    const result = await listCollectionInventoryViewUseCase(services, {
      ownerProfileId: 'profile-1',
      query: {
        view: 'binder',
        sort: 'recent',
      },
    })

    expect(result).toEqual({
      ok: true,
      data: {
        totalOwnedPrintings: 2,
        totalOwnedCopies: 3,
        items: [
          expect.objectContaining({
            id: 'item-1',
            cardPrintingId: 'printing-1',
            quantity: 2,
          }),
          expect.objectContaining({
            id: 'item-2',
            cardPrintingId: 'printing-2',
            quantity: 1,
          }),
        ],
      },
    })
  })

  it('sorts inventory entries by quantity when requested', async () => {
    const services = createServices([
      createItem({
        id: 'item-1',
        cardPrintingId: 'printing-1',
        quantity: 1,
        printing: {
          printingKey: 'printing.a',
          collectorNumber: '001',
          rarity: 'C',
          printedName: 'Alpha',
          isAlternateArt: false,
          isPromoVariant: false,
          artVariant: null,
          localeCode: 'en',
          product: {
            officialCode: 'D-BT01',
            name: 'Set A',
            releaseDate: '2021-01-01',
          },
          card: {
            name: 'Alpha',
          },
        },
      }),
      createItem({
        id: 'item-2',
        cardPrintingId: 'printing-2',
        quantity: 4,
        printing: {
          printingKey: 'printing.b',
          collectorNumber: '002',
          rarity: 'RRR',
          printedName: 'Beta',
          isAlternateArt: false,
          isPromoVariant: false,
          artVariant: null,
          localeCode: 'en',
          product: {
            officialCode: 'D-BT02',
            name: 'Set B',
            releaseDate: '2021-02-01',
          },
          card: {
            name: 'Beta',
          },
        },
      }),
    ])

    const result = await listCollectionInventoryViewUseCase(services, {
      ownerProfileId: 'profile-1',
      query: {
        view: 'list',
        sort: 'quantity',
      },
    })

    if (!result.ok) {
      throw new Error('Expected successful collection inventory result.')
    }

    expect(result.data.items.map((item) => item.id)).toEqual([
      'item-2',
      'item-1',
    ])
  })

  it('does not collapse same-card printings when card name and release context match', async () => {
    const services = createServices([
      createItem({
        id: 'item-regular',
        cardPrintingId: 'printing-regular',
        quantity: 2,
        printing: {
          printingKey: 'printing.azure-vanguard-dragon.d-bt01.001.regular',
          collectorNumber: '001',
          rarity: 'RRR',
          printedName: 'Azure Vanguard Dragon',
          isAlternateArt: false,
          isPromoVariant: false,
          artVariant: null,
          localeCode: 'en',
          product: {
            officialCode: 'D-BT01',
            name: 'Genesis of Azure',
            releaseDate: '2021-05-14',
          },
          card: {
            name: 'Azure Vanguard Dragon',
          },
        },
      }),
      createItem({
        id: 'item-alt',
        cardPrintingId: 'printing-alt',
        quantity: 1,
        printing: {
          printingKey: 'printing.azure-vanguard-dragon.d-bt01.001.alt',
          collectorNumber: '001',
          rarity: 'SP',
          printedName: 'Azure Vanguard Dragon',
          isAlternateArt: true,
          isPromoVariant: false,
          artVariant: 'special-foil',
          localeCode: 'en',
          product: {
            officialCode: 'D-BT01',
            name: 'Genesis of Azure',
            releaseDate: '2021-05-14',
          },
          card: {
            name: 'Azure Vanguard Dragon',
          },
        },
      }),
    ])

    const result = await listCollectionInventoryViewUseCase(services, {
      ownerProfileId: 'profile-1',
      query: {
        view: 'binder',
        sort: 'name',
      },
    })

    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error('Expected a successful collection inventory result.')
    }

    expect(result.data.totalOwnedPrintings).toBe(2)
    expect(result.data.totalOwnedCopies).toBe(3)
    expect(result.data.items).toHaveLength(2)
    expect(result.data.items[0]).toMatchObject({
      id: 'item-alt',
      cardPrintingId: 'printing-alt',
      quantity: 1,
    })
    expect(result.data.items[0]?.printing?.rarity).toBe('SP')
    expect(result.data.items[1]).toMatchObject({
      id: 'item-regular',
      cardPrintingId: 'printing-regular',
      quantity: 2,
    })
    expect(result.data.items[1]?.printing?.rarity).toBe('RRR')
  })

  it('keeps stale items readable instead of dropping them from the inventory view', async () => {
    const services = createServices([
      createItem({
        id: 'item-stale',
        cardPrintingId: 'printing-stale',
        quantity: 3,
        printing: null,
        catalogState: 'stale',
      }),
    ])

    const result = await listCollectionInventoryViewUseCase(services, {
      ownerProfileId: 'profile-1',
      query: {
        view: 'binder',
        sort: 'name',
      },
    })

    expect(result).toEqual({
      ok: true,
      data: {
        totalOwnedPrintings: 1,
        totalOwnedCopies: 3,
        items: [
          expect.objectContaining({
            id: 'item-stale',
            cardPrintingId: 'printing-stale',
            catalogState: 'stale',
            printing: null,
          }),
        ],
      },
    })
  })
})

function createServices(
  items: readonly ReturnType<typeof createItem>[],
): CollectionInventoryApplicationServices {
  return {
    repository: {
      listCollectionInventoryItemsByOwner: vi.fn().mockResolvedValue({
        ok: true,
        data: items,
      }),
    },
  }
}

function createItem(input?: {
  readonly id?: string
  readonly cardPrintingId?: string
  readonly quantity?: number
  readonly updatedAt?: string
  readonly printing?: CollectionInventoryPrintingFixture | null
  readonly catalogState?: 'ready' | 'stale'
}) {
  return {
    id: input?.id ?? 'item-1',
    ownerProfileId: 'profile-1',
    cardPrintingId: input?.cardPrintingId ?? 'printing-1',
    quantity: input?.quantity ?? 1,
    createdAt: '2026-04-22T10:00:00.000Z',
    updatedAt: input?.updatedAt ?? '2026-04-22T11:00:00.000Z',
    catalogState: input?.catalogState ?? 'ready',
    printing:
      input?.printing === null
        ? null
        : createPrintingFixture(input?.printing, input?.cardPrintingId),
  }
}

function createPrintingFixture(
  input?: CollectionInventoryPrintingFixture,
  fallbackPrintingId = 'printing-1',
): CollectionInventoryPrinting {
  return {
    id: input?.id ?? fallbackPrintingId,
    printingKey: input?.printingKey ?? 'printing.default',
    collectorNumber: input?.collectorNumber ?? '001',
    rarity: input?.rarity ?? 'C',
    localeCode: input?.localeCode ?? 'en',
    regionCode: input?.regionCode ?? 'en',
    printedName: input?.printedName ?? 'Default Card',
    artVariant: input?.artVariant ?? null,
    isAlternateArt: input?.isAlternateArt ?? false,
    isPromoVariant: input?.isPromoVariant ?? false,
    product:
      input?.product === null ? null : createProductFixture(input?.product),
    card: input?.card === null ? null : createCardFixture(input?.card),
  }
}

function createProductFixture(
  input?: Partial<CollectionInventoryProduct>,
): CollectionInventoryProduct {
  return {
    id: input?.id ?? 'product-1',
    canonicalKey: input?.canonicalKey ?? 'product.default',
    officialCode: input?.officialCode ?? 'D-BT01',
    name: input?.name ?? 'Default Set',
    productCategory: input?.productCategory ?? 'booster',
    productKind: input?.productKind ?? 'main',
    releaseDate: input?.releaseDate ?? '2021-01-01',
    regionCode: input?.regionCode ?? 'en',
  }
}

function createCardFixture(
  input?: Partial<CollectionInventoryCard>,
): CollectionInventoryCard {
  return {
    id: input?.id ?? 'card-1',
    canonicalKey: input?.canonicalKey ?? 'card.default',
    name: input?.name ?? 'Default Card',
    grade: input?.grade ?? 3,
    cardType: input?.cardType ?? 'normal-unit',
    nation: input?.nation ?? 'Dragon Empire',
    clan: input?.clan ?? null,
    triggerType: input?.triggerType ?? null,
  }
}
