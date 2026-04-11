// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeCatalogQuery } from '@web-vg/catalog'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  createCatalogRepository: vi.fn(),
  listCardEntities: vi.fn(),
  getCardEntityByCanonicalKey: vi.fn(),
  listCardPrintings: vi.fn(),
  getCardLegalityFacts: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@web-vg/db', () => ({
  createCatalogRepository: mocks.createCatalogRepository,
}))

import { getCatalogCardDetail, listCatalogCards } from './catalog-read'

describe('catalog read helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({})
    mocks.createCatalogRepository.mockReturnValue({
      listCardEntities: mocks.listCardEntities,
      getCardEntityById: vi.fn(),
      getCardEntityByCanonicalKey: mocks.getCardEntityByCanonicalKey,
      getCardLegalityFacts: mocks.getCardLegalityFacts,
      listCardPrintings: mocks.listCardPrintings,
    })
  })

  it('forwards normalized filter groups into the repository list query', async () => {
    mocks.listCardEntities.mockResolvedValueOnce({
      ok: true,
      data: {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 24,
        pageCount: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    })

    await listCatalogCards(
      normalizeCatalogQuery({
        searchText: 'Azure',
        perspective: 'card-entity',
        filters: {
          formatIds: ['standard'],
          eras: ['d'],
          nations: ['dragon empire'],
          clans: [],
          cardTypes: ['normal-unit'],
          triggerTypes: [],
          rarities: ['rrr'],
          productKeys: ['product.d-bt01.genesis-of-azure'],
        },
        sort: 'grade-asc',
        window: {
          page: 2,
          pageSize: 24,
        },
      }),
    )

    expect(mocks.listCardEntities).toHaveBeenCalledWith({
      searchText: 'Azure',
      filters: {
        formatIds: ['standard'],
        eras: ['d'],
        nations: ['dragon empire'],
        clans: [],
        cardTypes: ['normal-unit'],
        triggerTypes: [],
        rarities: ['rrr'],
        productKeys: ['product.d-bt01.genesis-of-azure'],
      },
      sort: 'grade-asc',
      page: 2,
      pageSize: 24,
    })
  })

  it('returns null for invalid canonical card keys before hitting persistence', async () => {
    const result = await getCatalogCardDetail('   ')

    expect(result).toEqual({
      ok: true,
      data: null,
    })
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled()
  })

  it('assembles a page-ready detail model from repository reads', async () => {
    mocks.getCardEntityByCanonicalKey.mockResolvedValueOnce({
      ok: true,
      data: {
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
    })
    mocks.listCardPrintings.mockResolvedValueOnce({
      ok: true,
      data: [
        {
          id: 'printing-1',
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
            id: 'product-1',
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
        {
          id: 'printing-2',
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
            id: 'product-2',
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
      ],
    })
    mocks.getCardLegalityFacts.mockResolvedValueOnce({
      ok: true,
      data: {
        eligibilityOverrides: [
          {
            formatId: 'standard',
            formatName: 'Standard',
            ruleProfileId: 'standard-baseline-v1',
            ruleProfileName: 'Standard Baseline',
            eligibilityState: 'allowed',
            rationale:
              'Published printings exist in product families supported by this format profile.',
          },
        ],
        restrictions: [],
        choiceRestrictions: [],
      },
    })

    const result = await getCatalogCardDetail('card.azure-vanguard-dragon')

    expect(mocks.getCardEntityByCanonicalKey).toHaveBeenCalledWith(
      'card.azure-vanguard-dragon',
    )
    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error('Expected successful detail lookup.')
    }

    expect(result.data).not.toBeNull()

    if (!result.data) {
      throw new Error('Expected detail payload.')
    }

    expect(result.data.card.canonicalKey).toBe('card.azure-vanguard-dragon')
    expect(result.data.card.name).toBe('Azure Vanguard Dragon')
    expect(result.data.rules).toEqual({
      effectReferences: ['effect.ref.dev.dragon'],
      hasPublishedOracleText: false,
    })
    expect(result.data.printings).toHaveLength(2)
    expect(result.data.printings[0]?.printingKey).toBe(
      'printing.azure-vanguard-dragon.d-bt01.001.en',
    )
    expect(result.data.legality.eligibilityOverrides).toHaveLength(1)
    expect(result.data.legality.eligibilityOverrides[0]?.eligibilityState).toBe(
      'allowed',
    )
    expect(result.data.relatedProducts).toHaveLength(2)
    expect(
      result.data.relatedProducts.map((product) => product.officialCode),
    ).toEqual(['D-SD01', 'D-BT01'])
    expect(result.data.relatedProducts[0]?.printingCount).toBe(1)
  })
})
