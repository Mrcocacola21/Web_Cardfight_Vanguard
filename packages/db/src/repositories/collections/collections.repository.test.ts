import { afterEach, describe, expect, it } from 'vitest'

import { createSequentialMockDbClient } from '../shared/mock-db-client'

import { createCollectionsRepository } from './collections.repository'

describe('collections repository', () => {
  const cleanups: Array<() => void> = []

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.()
    }
  })

  it('lists owner-scoped collection items ordered by recent updates', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('collection_items')
          expect(query.cardinality).toBe('many')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'owner_profile_id',
              value: 'profile-1',
            },
          ])
          expect(query.orders).toEqual([
            {
              column: 'updated_at',
              ascending: false,
            },
            {
              column: 'id',
              ascending: true,
            },
          ])
        },
        response: {
          data: [
            {
              id: 'item-1',
              owner_profile_id: 'profile-1',
              card_printing_id: 'printing-1',
              quantity: 3,
              created_at: '2026-04-22T10:00:00.000Z',
              updated_at: '2026-04-22T11:00:00.000Z',
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCollectionsRepository(mock.client)
    const result = await repository.listCollectionItemsByOwner('profile-1')

    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: 'item-1',
          ownerProfileId: 'profile-1',
          cardPrintingId: 'printing-1',
          quantity: 3,
          createdAt: '2026-04-22T10:00:00.000Z',
          updatedAt: '2026-04-22T11:00:00.000Z',
        },
      ],
    })
  })

  it('loads one owner-owned collection item by printing id', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('collection_items')
          expect(query.cardinality).toBe('maybeSingle')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'owner_profile_id',
              value: 'profile-1',
            },
            {
              type: 'eq',
              column: 'card_printing_id',
              value: 'printing-1',
            },
          ])
        },
        response: {
          data: {
            id: 'item-1',
            owner_profile_id: 'profile-1',
            card_printing_id: 'printing-1',
            quantity: 2,
            created_at: '2026-04-22T10:00:00.000Z',
            updated_at: '2026-04-22T11:00:00.000Z',
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCollectionsRepository(mock.client)
    const result = await repository.getCollectionItemByOwnerAndPrinting(
      'profile-1',
      'printing-1',
    )

    expect(result).toEqual({
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
  })

  it('loads inventory read models with linked printing, card, and product summaries', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('collection_items')
          expect(query.cardinality).toBe('many')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'owner_profile_id',
              value: 'profile-1',
            },
          ])
          expect(query.orders).toEqual([
            {
              column: 'updated_at',
              ascending: false,
            },
            {
              column: 'id',
              ascending: true,
            },
          ])
        },
        response: {
          data: [
            {
              id: 'item-1',
              owner_profile_id: 'profile-1',
              card_printing_id: 'printing-1',
              quantity: 2,
              created_at: '2026-04-22T10:00:00.000Z',
              updated_at: '2026-04-22T11:00:00.000Z',
            },
            {
              id: 'item-2',
              owner_profile_id: 'profile-1',
              card_printing_id: 'printing-2',
              quantity: 1,
              created_at: '2026-04-22T09:00:00.000Z',
              updated_at: '2026-04-22T10:30:00.000Z',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('card_printings')
          expect(query.cardinality).toBe('many')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'id',
              value: ['printing-1', 'printing-2'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'printing-1',
              printing_key: 'printing.azure-vanguard-dragon.d-bt01.001.en',
              collector_number: '001',
              rarity: 'RRR',
              locale_code: 'en',
              region_code: 'en',
              printed_name: 'Azure Vanguard Dragon',
              art_variant: 'special-foil',
              is_alternate_art: true,
              is_promo_variant: false,
              product: {
                id: 'product-1',
                canonical_key: 'product.d-bt01.genesis-of-azure',
                official_code: 'D-BT01',
                name: 'Genesis of Azure',
                product_category: 'booster',
                product_kind: 'main',
                release_date: '2021-05-14',
                region_code: 'en',
              },
              card: {
                id: 'card-1',
                canonical_key: 'card.azure-vanguard-dragon',
                name: 'Azure Vanguard Dragon',
                grade: 3,
                card_type: 'normal-unit',
                nation: 'Dragon Empire',
                clan: null,
                trigger_type: null,
              },
            },
            {
              id: 'printing-2',
              printing_key: 'printing.azure-vanguard-dragon.pr-g01.010.en',
              collector_number: '010',
              rarity: 'PR',
              locale_code: 'en',
              region_code: 'en',
              printed_name: 'Azure Vanguard Dragon',
              art_variant: null,
              is_alternate_art: false,
              is_promo_variant: true,
              product: {
                id: 'product-2',
                canonical_key: 'product.pr-g01.anniversary-pack',
                official_code: 'PR-G01',
                name: 'Anniversary Pack',
                product_category: 'promo',
                product_kind: 'standalone',
                release_date: '2019-08-09',
                region_code: 'en',
              },
              card: {
                id: 'card-1',
                canonical_key: 'card.azure-vanguard-dragon',
                name: 'Azure Vanguard Dragon',
                grade: 3,
                card_type: 'normal-unit',
                nation: 'Dragon Empire',
                clan: null,
                trigger_type: null,
              },
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCollectionsRepository(mock.client)
    const result =
      await repository.listCollectionInventoryItemsByOwner('profile-1')

    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: 'item-1',
          ownerProfileId: 'profile-1',
          cardPrintingId: 'printing-1',
          quantity: 2,
          createdAt: '2026-04-22T10:00:00.000Z',
          updatedAt: '2026-04-22T11:00:00.000Z',
          catalogState: 'ready',
          printing: {
            id: 'printing-1',
            printingKey: 'printing.azure-vanguard-dragon.d-bt01.001.en',
            collectorNumber: '001',
            rarity: 'RRR',
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
        },
        {
          id: 'item-2',
          ownerProfileId: 'profile-1',
          cardPrintingId: 'printing-2',
          quantity: 1,
          createdAt: '2026-04-22T09:00:00.000Z',
          updatedAt: '2026-04-22T10:30:00.000Z',
          catalogState: 'ready',
          printing: {
            id: 'printing-2',
            printingKey: 'printing.azure-vanguard-dragon.pr-g01.010.en',
            collectorNumber: '010',
            rarity: 'PR',
            localeCode: 'en',
            regionCode: 'en',
            printedName: 'Azure Vanguard Dragon',
            artVariant: null,
            isAlternateArt: false,
            isPromoVariant: true,
            product: {
              id: 'product-2',
              canonicalKey: 'product.pr-g01.anniversary-pack',
              officialCode: 'PR-G01',
              name: 'Anniversary Pack',
              productCategory: 'promo',
              productKind: 'standalone',
              releaseDate: '2019-08-09',
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
        },
      ],
    })
  })

  it('keeps stale linked printing data from crashing the inventory read model', async () => {
    const mock = createSequentialMockDbClient([
      {
        response: {
          data: [
            {
              id: 'item-1',
              owner_profile_id: 'profile-1',
              card_printing_id: 'printing-stale',
              quantity: 4,
              created_at: '2026-04-22T10:00:00.000Z',
              updated_at: '2026-04-22T11:00:00.000Z',
              printing: null,
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('card_printings')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'id',
              value: ['printing-stale'],
            },
          ])
        },
        response: {
          data: [],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCollectionsRepository(mock.client)
    const result =
      await repository.listCollectionInventoryItemsByOwner('profile-1')

    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: 'item-1',
          ownerProfileId: 'profile-1',
          cardPrintingId: 'printing-stale',
          quantity: 4,
          createdAt: '2026-04-22T10:00:00.000Z',
          updatedAt: '2026-04-22T11:00:00.000Z',
          catalogState: 'stale',
          printing: null,
        },
      ],
    })
  })

  it('loads owner-scoped wishlist and favorite items as separate printing-aware preference entries', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('collection_printing_preferences')
          expect(query.cardinality).toBe('many')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'owner_profile_id',
              value: 'profile-1',
            },
          ])
          expect(query.orders).toEqual([
            {
              column: 'preference_kind',
              ascending: true,
            },
            {
              column: 'updated_at',
              ascending: false,
            },
            {
              column: 'id',
              ascending: true,
            },
          ])
        },
        response: {
          data: [
            {
              id: 'pref-favorite',
              owner_profile_id: 'profile-1',
              card_printing_id: 'printing-1',
              preference_kind: 'favorite',
              created_at: '2026-04-22T10:00:00.000Z',
              updated_at: '2026-04-22T11:00:00.000Z',
              printing: {
                id: 'printing-1',
                printing_key: 'printing.azure-vanguard-dragon.d-bt01.001.en',
                collector_number: '001',
                rarity: 'RRR',
                locale_code: 'en',
                region_code: 'en',
                printed_name: 'Azure Vanguard Dragon',
                art_variant: null,
                is_alternate_art: false,
                is_promo_variant: false,
                product: {
                  id: 'product-1',
                  canonical_key: 'product.d-bt01.genesis-of-azure',
                  official_code: 'D-BT01',
                  name: 'Genesis of Azure',
                  product_category: 'booster',
                  product_kind: 'main',
                  release_date: '2021-05-14',
                  region_code: 'en',
                },
                card: {
                  id: 'card-1',
                  canonical_key: 'card.azure-vanguard-dragon',
                  name: 'Azure Vanguard Dragon',
                  grade: 3,
                  card_type: 'normal-unit',
                  nation: 'Dragon Empire',
                  clan: null,
                  trigger_type: null,
                },
              },
            },
            {
              id: 'pref-wishlist',
              owner_profile_id: 'profile-1',
              card_printing_id: 'printing-2',
              preference_kind: 'wishlist',
              created_at: '2026-04-22T09:00:00.000Z',
              updated_at: '2026-04-22T10:30:00.000Z',
              printing: {
                id: 'printing-2',
                printing_key: 'printing.azure-vanguard-dragon.pr-g01.010.en',
                collector_number: '010',
                rarity: 'PR',
                locale_code: 'en',
                region_code: 'en',
                printed_name: 'Azure Vanguard Dragon',
                art_variant: 'special-foil',
                is_alternate_art: true,
                is_promo_variant: true,
                product: {
                  id: 'product-2',
                  canonical_key: 'product.pr-g01.anniversary-pack',
                  official_code: 'PR-G01',
                  name: 'Anniversary Pack',
                  product_category: 'promo',
                  product_kind: 'standalone',
                  release_date: '2019-08-09',
                  region_code: 'en',
                },
                card: {
                  id: 'card-1',
                  canonical_key: 'card.azure-vanguard-dragon',
                  name: 'Azure Vanguard Dragon',
                  grade: 3,
                  card_type: 'normal-unit',
                  nation: 'Dragon Empire',
                  clan: null,
                  trigger_type: null,
                },
              },
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('card_printings')
          expect(query.cardinality).toBe('many')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'id',
              value: ['printing-1', 'printing-2'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'printing-1',
              printing_key: 'printing.azure-vanguard-dragon.d-bt01.001.en',
              collector_number: '001',
              rarity: 'RRR',
              locale_code: 'en',
              region_code: 'en',
              printed_name: 'Azure Vanguard Dragon',
              art_variant: null,
              is_alternate_art: false,
              is_promo_variant: false,
              product: {
                id: 'product-1',
                canonical_key: 'product.d-bt01.genesis-of-azure',
                official_code: 'D-BT01',
                name: 'Genesis of Azure',
                product_category: 'booster',
                product_kind: 'main',
                release_date: '2021-05-14',
                region_code: 'en',
              },
              card: {
                id: 'card-1',
                canonical_key: 'card.azure-vanguard-dragon',
                name: 'Azure Vanguard Dragon',
                grade: 3,
                card_type: 'normal-unit',
                nation: 'Dragon Empire',
                clan: null,
                trigger_type: null,
              },
            },
            {
              id: 'printing-2',
              printing_key: 'printing.azure-vanguard-dragon.pr-g01.010.en',
              collector_number: '010',
              rarity: 'PR',
              locale_code: 'en',
              region_code: 'en',
              printed_name: 'Azure Vanguard Dragon',
              art_variant: 'special-foil',
              is_alternate_art: true,
              is_promo_variant: true,
              product: {
                id: 'product-2',
                canonical_key: 'product.pr-g01.anniversary-pack',
                official_code: 'PR-G01',
                name: 'Anniversary Pack',
                product_category: 'promo',
                product_kind: 'standalone',
                release_date: '2019-08-09',
                region_code: 'en',
              },
              card: {
                id: 'card-1',
                canonical_key: 'card.azure-vanguard-dragon',
                name: 'Azure Vanguard Dragon',
                grade: 3,
                card_type: 'normal-unit',
                nation: 'Dragon Empire',
                clan: null,
                trigger_type: null,
              },
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCollectionsRepository(mock.client)
    const result =
      await repository.listCollectionPrintingPreferenceItemsByOwner('profile-1')

    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error(
        'Expected preference items to load successfully from the repository.',
      )
    }

    expect(result.data).toHaveLength(2)
    expect(result.data[0]).toMatchObject({
      id: 'pref-favorite',
      ownerProfileId: 'profile-1',
      cardPrintingId: 'printing-1',
      preferenceKind: 'favorite',
      createdAt: '2026-04-22T10:00:00.000Z',
      updatedAt: '2026-04-22T11:00:00.000Z',
      catalogState: 'ready',
    })
    expect(result.data[0]?.printing).toMatchObject({
      id: 'printing-1',
      rarity: 'RRR',
      isAlternateArt: false,
    })
    expect(result.data[1]).toMatchObject({
      id: 'pref-wishlist',
      ownerProfileId: 'profile-1',
      cardPrintingId: 'printing-2',
      preferenceKind: 'wishlist',
      createdAt: '2026-04-22T09:00:00.000Z',
      updatedAt: '2026-04-22T10:30:00.000Z',
      catalogState: 'ready',
    })
    expect(result.data[1]?.printing).toMatchObject({
      id: 'printing-2',
      rarity: 'PR',
      isAlternateArt: true,
      isPromoVariant: true,
    })
  })

  it('loads the preference kinds currently attached to one printing without using entity lookups', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('collection_printing_preferences')
          expect(query.cardinality).toBe('many')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'owner_profile_id',
              value: 'profile-1',
            },
            {
              type: 'eq',
              column: 'card_printing_id',
              value: 'printing-1',
            },
          ])
          expect(query.orders).toEqual([
            {
              column: 'preference_kind',
              ascending: true,
            },
          ])
        },
        response: {
          data: [
            {
              id: 'pref-favorite',
              owner_profile_id: 'profile-1',
              card_printing_id: 'printing-1',
              preference_kind: 'favorite',
              created_at: '2026-04-22T10:00:00.000Z',
              updated_at: '2026-04-22T11:00:00.000Z',
            },
            {
              id: 'pref-wishlist',
              owner_profile_id: 'profile-1',
              card_printing_id: 'printing-1',
              preference_kind: 'wishlist',
              created_at: '2026-04-22T10:05:00.000Z',
              updated_at: '2026-04-22T11:05:00.000Z',
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCollectionsRepository(mock.client)
    const result =
      await repository.listCollectionPrintingPreferencesByOwnerAndPrinting(
        'profile-1',
        'printing-1',
      )

    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: 'pref-favorite',
          ownerProfileId: 'profile-1',
          cardPrintingId: 'printing-1',
          preferenceKind: 'favorite',
          createdAt: '2026-04-22T10:00:00.000Z',
          updatedAt: '2026-04-22T11:00:00.000Z',
        },
        {
          id: 'pref-wishlist',
          ownerProfileId: 'profile-1',
          cardPrintingId: 'printing-1',
          preferenceKind: 'wishlist',
          createdAt: '2026-04-22T10:05:00.000Z',
          updatedAt: '2026-04-22T11:05:00.000Z',
        },
      ],
    })
  })

  it('changes quantity through the atomic collection rpc', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('change_collection_item_quantity')
          expect(query.operation).toBe('rpc')
          expect(query.cardinality).toBe('maybeSingle')
          expect(query.values).toEqual({
            change_owner_profile_id: 'profile-1',
            change_card_printing_id: 'printing-1',
            change_quantity_delta: 1,
          })
        },
        response: {
          data: {
            id: 'item-1',
            owner_profile_id: 'profile-1',
            card_printing_id: 'printing-1',
            quantity: 4,
            created_at: '2026-04-22T10:00:00.000Z',
            updated_at: '2026-04-22T12:00:00.000Z',
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCollectionsRepository(mock.client)
    const result = await repository.changeCollectionPrintingQuantity({
      ownerProfileId: 'profile-1',
      cardPrintingId: 'printing-1',
      quantityDelta: 1,
    })

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'item-1',
        ownerProfileId: 'profile-1',
        cardPrintingId: 'printing-1',
        quantity: 4,
        createdAt: '2026-04-22T10:00:00.000Z',
        updatedAt: '2026-04-22T12:00:00.000Z',
      },
    })
  })

  it('returns null when exact quantity is set to zero and the row is deleted', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('set_collection_item_quantity')
          expect(query.operation).toBe('rpc')
          expect(query.cardinality).toBe('maybeSingle')
          expect(query.values).toEqual({
            set_owner_profile_id: 'profile-1',
            set_card_printing_id: 'printing-1',
            set_quantity: 0,
          })
        },
        response: {
          data: null,
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCollectionsRepository(mock.client)
    const result = await repository.setCollectionPrintingQuantity({
      ownerProfileId: 'profile-1',
      cardPrintingId: 'printing-1',
      quantity: 0,
    })

    expect(result).toEqual({
      ok: true,
      data: null,
    })
  })

  it('maps invalid printing references into an honest repository failure', async () => {
    const mock = createSequentialMockDbClient([
      {
        response: {
          data: null,
          error: {
            code: '23503',
            message:
              'insert or update on table "collection_items" violates foreign key constraint',
            details:
              'Key (card_printing_id)=(printing-missing) is not present in table "card_printings".',
          },
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCollectionsRepository(mock.client)
    const result = await repository.changeCollectionPrintingQuantity({
      ownerProfileId: 'profile-1',
      cardPrintingId: 'printing-missing',
      quantityDelta: 1,
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'query-failed',
        message:
          'Failed to update collection because the requested printing does not exist in the published catalog.',
        details:
          'Key (card_printing_id)=(printing-missing) is not present in table "card_printings".',
      },
    })
  })

  it('removes one printing completely from the owner inventory', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('collection_items')
          expect(query.operation).toBe('delete')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'owner_profile_id',
              value: 'profile-1',
            },
            {
              type: 'eq',
              column: 'card_printing_id',
              value: 'printing-1',
            },
          ])
        },
        response: {
          data: null,
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCollectionsRepository(mock.client)
    const result = await repository.removeCollectionPrinting({
      ownerProfileId: 'profile-1',
      cardPrintingId: 'printing-1',
    })

    expect(result).toEqual({
      ok: true,
      data: undefined,
    })
  })

  it('upserts one owner-owned printing preference with owner+printing+kind uniqueness', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('collection_printing_preferences')
          expect(query.operation).toBe('upsert')
          expect(query.cardinality).toBe('maybeSingle')
          expect(query.onConflict).toBe(
            'owner_profile_id,card_printing_id,preference_kind',
          )
          const values = query.values as {
            readonly owner_profile_id?: unknown
            readonly card_printing_id?: unknown
            readonly preference_kind?: unknown
            readonly updated_at?: unknown
          }

          expect(values.owner_profile_id).toBe('profile-1')
          expect(values.card_printing_id).toBe('printing-1')
          expect(values.preference_kind).toBe('wishlist')
          expect(typeof values.updated_at).toBe('string')
        },
        response: {
          data: {
            id: 'pref-wishlist',
            owner_profile_id: 'profile-1',
            card_printing_id: 'printing-1',
            preference_kind: 'wishlist',
            created_at: '2026-04-22T10:00:00.000Z',
            updated_at: '2026-04-22T11:00:00.000Z',
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCollectionsRepository(mock.client)
    const result = await repository.upsertCollectionPrintingPreference({
      ownerProfileId: 'profile-1',
      cardPrintingId: 'printing-1',
      preferenceKind: 'wishlist',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'pref-wishlist',
        ownerProfileId: 'profile-1',
        cardPrintingId: 'printing-1',
        preferenceKind: 'wishlist',
        createdAt: '2026-04-22T10:00:00.000Z',
        updatedAt: '2026-04-22T11:00:00.000Z',
      },
    })
  })

  it('removes one printing preference without touching any other preference row', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('collection_printing_preferences')
          expect(query.operation).toBe('delete')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'owner_profile_id',
              value: 'profile-1',
            },
            {
              type: 'eq',
              column: 'card_printing_id',
              value: 'printing-1',
            },
            {
              type: 'eq',
              column: 'preference_kind',
              value: 'favorite',
            },
          ])
        },
        response: {
          data: null,
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCollectionsRepository(mock.client)
    const result = await repository.removeCollectionPrintingPreference({
      ownerProfileId: 'profile-1',
      cardPrintingId: 'printing-1',
      preferenceKind: 'favorite',
    })

    expect(result).toEqual({
      ok: true,
      data: undefined,
    })
  })

  it('maps invalid printing references into an honest preference repository failure', async () => {
    const mock = createSequentialMockDbClient([
      {
        response: {
          data: null,
          error: {
            code: '23503',
            message:
              'insert or update on table "collection_printing_preferences" violates foreign key constraint',
            details:
              'Key (card_printing_id)=(printing-missing) is not present in table "card_printings".',
          },
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCollectionsRepository(mock.client)
    const result = await repository.upsertCollectionPrintingPreference({
      ownerProfileId: 'profile-1',
      cardPrintingId: 'printing-missing',
      preferenceKind: 'favorite',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'query-failed',
        message:
          'Failed to update collection preference because the requested printing does not exist in the published catalog.',
        details:
          'Key (card_printing_id)=(printing-missing) is not present in table "card_printings".',
      },
    })
  })
})
