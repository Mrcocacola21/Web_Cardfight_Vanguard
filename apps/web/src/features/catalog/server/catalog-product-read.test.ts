// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  createCatalogRepository: vi.fn(),
  getProductDetailByCanonicalKey: vi.fn(),
  listProductPrintings: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@web-vg/db', () => ({
  createCatalogRepository: mocks.createCatalogRepository,
}))

import { getCatalogProductDetail } from './catalog-product-read'

describe('getCatalogProductDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({})
    mocks.createCatalogRepository.mockReturnValue({
      getProductDetailByCanonicalKey: mocks.getProductDetailByCanonicalKey,
      listProductPrintings: mocks.listProductPrintings,
    })
  })

  it('returns null for invalid canonical product keys before hitting persistence', async () => {
    const result = await getCatalogProductDetail('   ')

    expect(result).toEqual({
      ok: true,
      data: null,
    })
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled()
  })

  it('assembles a product-centric detail model and summary from repository reads', async () => {
    mocks.getProductDetailByCanonicalKey.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'product-dz-bt01',
        canonicalKey: 'product.dz-bt01.fated-clash',
        familyId: 'family-standard',
        officialCode: 'DZ-BT01',
        name: 'Fated Clash',
        productCategory: 'booster',
        productKind: 'main',
        releaseDate: '2024-05-03',
        regionCode: 'en',
        cycleKey: 'content-wave-1',
        family: {
          id: 'family-standard',
          displayName: 'Standard Lineage',
          lineage: 'standard-lineage',
        },
      },
    })
    mocks.listProductPrintings.mockResolvedValueOnce({
      ok: true,
      data: [
        {
          id: 'printing-rezael-main',
          printingKey: 'printing.fated-one-of-miracles-rezael.dz-bt01.010.en',
          collectorNumber: '010',
          rarity: 'RRR',
          localeCode: 'en',
          regionCode: 'en',
          printedName: 'Fated One of Miracles, Rezael',
          artVariant: null,
          isAlternateArt: false,
          isPromoVariant: false,
          card: {
            id: 'entity-rezael',
            canonicalKey: 'card.fated-one-of-miracles-rezael',
            name: 'Fated One of Miracles, Rezael',
            grade: 3,
            cardType: 'normal-unit',
            triggerType: null,
            nation: 'Keter Sanctuary',
            clan: null,
          },
        },
        {
          id: 'printing-rezael-dsr',
          printingKey: 'printing.fated-one-of-miracles-rezael.dz-bt01.dsr01.en',
          collectorNumber: 'DSR01',
          rarity: 'DSR',
          localeCode: 'en',
          regionCode: 'en',
          printedName: 'Fated One of Miracles, Rezael',
          artVariant: null,
          isAlternateArt: false,
          isPromoVariant: false,
          card: {
            id: 'entity-rezael',
            canonicalKey: 'card.fated-one-of-miracles-rezael',
            name: 'Fated One of Miracles, Rezael',
            grade: 3,
            cardType: 'normal-unit',
            triggerType: null,
            nation: 'Keter Sanctuary',
            clan: null,
          },
        },
      ],
    })

    const result = await getCatalogProductDetail('product.dz-bt01.fated-clash')

    expect(mocks.createCatalogRepository).toHaveBeenCalledTimes(1)
    expect(mocks.getProductDetailByCanonicalKey).toHaveBeenCalledWith(
      'product.dz-bt01.fated-clash',
    )
    expect(mocks.listProductPrintings).toHaveBeenCalledWith('product-dz-bt01')
    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error('Expected successful product detail lookup.')
    }

    expect(result.data).not.toBeNull()

    if (!result.data) {
      throw new Error('Expected product detail payload.')
    }

    expect(result.data.product.officialCode).toBe('DZ-BT01')
    expect(result.data.printings).toHaveLength(2)
    expect(result.data.summary).toEqual({
      printingCount: 2,
      uniqueCardCount: 1,
      promoPrintingCount: 0,
      alternateArtPrintingCount: 0,
      localeCodes: ['en'],
      rarities: ['DSR', 'RRR'],
    })
  })

  it('returns an honest published product detail when a product has no published printings yet', async () => {
    mocks.getProductDetailByCanonicalKey.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'product-dz-bt02',
        canonicalKey: 'product.dz-bt02.illusionless-strife',
        familyId: 'family-standard',
        officialCode: 'DZ-BT02',
        name: 'Illusionless Strife',
        productCategory: 'booster',
        productKind: 'main',
        releaseDate: '2024-06-28',
        regionCode: 'en',
        cycleKey: 'content-wave-1',
        family: {
          id: 'family-standard',
          displayName: 'Standard Lineage',
          lineage: 'standard-lineage',
        },
      },
    })
    mocks.listProductPrintings.mockResolvedValueOnce({
      ok: true,
      data: [],
    })

    const result = await getCatalogProductDetail(
      'product.dz-bt02.illusionless-strife',
    )

    expect(result).toEqual({
      ok: true,
      data: {
        product: {
          id: 'product-dz-bt02',
          canonicalKey: 'product.dz-bt02.illusionless-strife',
          familyId: 'family-standard',
          officialCode: 'DZ-BT02',
          name: 'Illusionless Strife',
          productCategory: 'booster',
          productKind: 'main',
          releaseDate: '2024-06-28',
          regionCode: 'en',
          cycleKey: 'content-wave-1',
          family: {
            id: 'family-standard',
            displayName: 'Standard Lineage',
            lineage: 'standard-lineage',
          },
        },
        printings: [],
        summary: {
          printingCount: 0,
          uniqueCardCount: 0,
          promoPrintingCount: 0,
          alternateArtPrintingCount: 0,
          localeCodes: [],
          rarities: [],
        },
      },
    })
  })
})
