// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  createCatalogRepository: vi.fn(),
  getCardPrintingByPrintingKey: vi.fn(),
  listCardPrintings: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@web-vg/db', () => ({
  createCatalogRepository: mocks.createCatalogRepository,
}))

import { getCatalogPrintingDetail } from './catalog-printing-read'

describe('getCatalogPrintingDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({})
    mocks.createCatalogRepository.mockReturnValue({
      listCardEntities: vi.fn(),
      getCardEntityById: vi.fn(),
      getCardEntityByCanonicalKey: vi.fn(),
      getCardPrintingByPrintingKey: mocks.getCardPrintingByPrintingKey,
      getCardLegalityFacts: vi.fn(),
      getProductDetailByCanonicalKey: vi.fn(),
      listCardPrintings: mocks.listCardPrintings,
      listProductPrintings: vi.fn(),
    })
  })

  it('returns null for invalid printing keys before hitting persistence', async () => {
    const result = await getCatalogPrintingDetail('   ')

    expect(result).toEqual({
      ok: true,
      data: null,
    })
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled()
  })

  it('assembles a printing-centric detail model with sibling printings', async () => {
    mocks.getCardPrintingByPrintingKey.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'printing-1',
        printingKey: 'printing.azure-vanguard-dragon.d-sd01.004.en',
        cardEntityId: 'card-1',
        collectorNumber: '004',
        rarity: 'RRR',
        localeCode: 'en',
        regionCode: 'en',
        printedName: 'Azure Vanguard Dragon',
        artVariant: 'starter-art',
        isAlternateArt: false,
        isPromoVariant: false,
        product: {
          id: 'product-1',
          canonicalKey: 'product.d-sd01.azure-vanguard-start-deck',
          familyId: 'family-standard',
          officialCode: 'D-SD01',
          name: 'Azure Vanguard Start Deck',
          productCategory: 'deck',
          productKind: 'start',
          releaseDate: '2021-05-28',
          regionCode: 'en',
          cycleKey: 'dev-standard-wave-1',
        },
        card: {
          id: 'card-1',
          canonicalKey: 'card.azure-vanguard-dragon',
          name: 'Azure Vanguard Dragon',
          normalizedName: 'azure vanguard dragon',
          grade: 3,
          cardType: 'normal-unit',
          nation: 'Dragon Empire',
          clan: null,
          race: 'Cosmo Dragon',
          triggerType: null,
          basePower: 13000,
          baseCritical: 1,
          baseShield: 0,
          keywords: ['twin-drive'],
          effectRefs: ['effect.ref.dev.dragon'],
        },
      },
    })
    mocks.listCardPrintings.mockResolvedValueOnce({
      ok: true,
      data: [
        {
          id: 'printing-1',
          printingKey: 'printing.azure-vanguard-dragon.d-sd01.004.en',
          cardEntityId: 'card-1',
          collectorNumber: '004',
          rarity: 'RRR',
          localeCode: 'en',
          regionCode: 'en',
          printedName: 'Azure Vanguard Dragon',
          artVariant: 'starter-art',
          isAlternateArt: false,
          isPromoVariant: false,
          product: {
            id: 'product-1',
            canonicalKey: 'product.d-sd01.azure-vanguard-start-deck',
            familyId: 'family-standard',
            officialCode: 'D-SD01',
            name: 'Azure Vanguard Start Deck',
            productCategory: 'deck',
            productKind: 'start',
            releaseDate: '2021-05-28',
            regionCode: 'en',
            cycleKey: 'dev-standard-wave-1',
          },
        },
        {
          id: 'printing-2',
          printingKey: 'printing.azure-vanguard-dragon.d-bt01.001.en',
          cardEntityId: 'card-1',
          collectorNumber: '001',
          rarity: 'RRR',
          localeCode: 'en',
          regionCode: 'en',
          printedName: 'Azure Vanguard Dragon',
          artVariant: null,
          isAlternateArt: false,
          isPromoVariant: false,
          product: {
            id: 'product-2',
            canonicalKey: 'product.d-bt01.genesis-of-azure',
            familyId: 'family-standard',
            officialCode: 'D-BT01',
            name: 'Genesis of Azure',
            productCategory: 'booster',
            productKind: 'main',
            releaseDate: '2021-05-14',
            regionCode: 'en',
            cycleKey: 'dev-standard-wave-1',
          },
        },
      ],
    })

    const result = await getCatalogPrintingDetail(
      'printing.azure-vanguard-dragon.d-sd01.004.en',
    )

    expect(mocks.getCardPrintingByPrintingKey).toHaveBeenCalledWith(
      'printing.azure-vanguard-dragon.d-sd01.004.en',
    )
    expect(mocks.listCardPrintings).toHaveBeenCalledWith('card-1')
    expect(result.ok).toBe(true)

    if (!result.ok || !result.data) {
      throw new Error('Expected successful printing detail payload.')
    }

    expect(result.data.printing.printingKey).toBe(
      'printing.azure-vanguard-dragon.d-sd01.004.en',
    )
    expect(result.data.printing.card.canonicalKey).toBe(
      'card.azure-vanguard-dragon',
    )
    expect(result.data.siblingPrintings).toHaveLength(1)
    expect(result.data.siblingPrintings[0]?.printingKey).toBe(
      'printing.azure-vanguard-dragon.d-bt01.001.en',
    )
  })
})
