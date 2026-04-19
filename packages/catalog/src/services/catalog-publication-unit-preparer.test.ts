import { describe, expect, it } from 'vitest'

import {
  preparePrintingPublicationUnits,
  prepareProductPublicationUnits,
} from './catalog-publication-unit-preparer'
import type {
  CatalogPublicationRawProductSource,
  CatalogPrintingPublicationSource,
} from './catalog-publication.service'

describe('catalog publication unit preparer', () => {
  it('prepares unique publishable product units and drops invalid raw products', () => {
    const rawProducts: CatalogPublicationRawProductSource[] = [
      {
        rawProductId: 'raw-product-dz-bt01',
        importJobId: 'job-1',
        sourceProductId: 'source-1',
        rawName: 'Fated Clash',
        rawCode: 'DZ-BT01',
        rawProductCategory: 'booster',
        rawProductKind: 'main',
        rawReleaseDateText: '2024-05-03',
        rawRegionCode: 'en',
      },
      {
        rawProductId: 'raw-product-dz-bt01-duplicate',
        importJobId: 'job-1',
        sourceProductId: 'source-2',
        rawName: 'Fated Clash',
        rawCode: 'dz-bt01',
        rawProductCategory: 'booster',
        rawProductKind: 'main',
        rawReleaseDateText: '2024-05-03',
        rawRegionCode: 'en',
      },
      {
        rawProductId: 'raw-product-invalid-date',
        importJobId: 'job-1',
        sourceProductId: 'source-3',
        rawName: 'Festival Collection',
        rawCode: 'DZ-SS01',
        rawProductCategory: 'special-set',
        rawProductKind: 'festival',
        rawReleaseDateText: '2024/05/03',
        rawRegionCode: 'en',
      },
      {
        rawProductId: 'raw-product-unsupported-family',
        importJobId: 'job-1',
        sourceProductId: 'source-4',
        rawName: 'Extra Booster',
        rawCode: 'EB-01',
        rawProductCategory: 'booster',
        rawProductKind: 'extra',
        rawReleaseDateText: '2024-05-03',
        rawRegionCode: 'en',
      },
    ]

    const units = prepareProductPublicationUnits(rawProducts, {
      createId: createIdSequence(['product-unit-1', 'product-unit-2']),
    })

    expect(units).toEqual([
      {
        rawProductId: 'raw-product-dz-bt01',
        id: 'product-unit-1',
        canonicalKey: 'product.dz-bt01.fated-clash',
        familyId: 'family-standard',
        officialCode: 'DZ-BT01',
        name: 'Fated Clash',
        productCategory: 'booster',
        productKind: 'main',
        releaseDate: '2024-05-03',
        regionCode: 'en',
        cycleKey: null,
        sourceImportJobId: 'job-1',
      },
    ])
  })

  it('prepares printing units from publishable sources and reports skipped cases explicitly', () => {
    const rawProduct: CatalogPublicationRawProductSource = {
      rawProductId: 'raw-product-dz-bt01',
      importJobId: 'job-1',
      sourceProductId: 'source-1',
      rawName: 'Fated Clash',
      rawCode: 'DZ-BT01',
      rawProductCategory: 'booster',
      rawProductKind: 'main',
      rawReleaseDateText: '2024-05-03',
      rawRegionCode: 'en',
    }

    const sources: CatalogPrintingPublicationSource[] = [
      {
        importJobId: 'job-1',
        normalizationResultId: 'normalization-rezael',
        rawCardPrintingId: 'raw-printing-rezael',
        rawProductId: rawProduct.rawProductId,
        normalizationStatus: 'auto_resolved',
        cardEntityId: 'entity-rezael',
        sourcePrintingId: 'source-printing-1',
        rawCardName: 'Fated One of Miracles, Rezael',
        rawPrintingCode: 'DZ-BT01/010EN',
        rawRarity: 'rrr',
        rawLocaleCode: null,
        rawRegionCode: null,
        rawProduct,
      },
      {
        importJobId: 'job-1',
        normalizationResultId: 'normalization-review',
        rawCardPrintingId: 'raw-printing-review',
        rawProductId: rawProduct.rawProductId,
        normalizationStatus: 'blocked_for_review',
        cardEntityId: null,
        sourcePrintingId: 'source-printing-2',
        rawCardName: 'Blocked Card',
        rawPrintingCode: 'DZ-BT01/011EN',
        rawRarity: 'RR',
        rawLocaleCode: 'en',
        rawRegionCode: 'en',
        rawProduct,
      },
      {
        importJobId: 'job-1',
        normalizationResultId: 'normalization-missing-product',
        rawCardPrintingId: 'raw-printing-missing-product',
        rawProductId: 'raw-product-missing',
        normalizationStatus: 'auto_resolved',
        cardEntityId: 'entity-missing-product',
        sourcePrintingId: 'source-printing-3',
        rawCardName: 'Missing Product',
        rawPrintingCode: 'DZ-BT99/001EN',
        rawRarity: 'RR',
        rawLocaleCode: 'en',
        rawRegionCode: 'en',
        rawProduct: {
          ...rawProduct,
          rawProductId: 'raw-product-missing',
          rawCode: 'DZ-BT99',
        },
      },
      {
        importJobId: 'job-1',
        normalizationResultId: 'normalization-missing-identity',
        rawCardPrintingId: 'raw-printing-missing-identity',
        rawProductId: rawProduct.rawProductId,
        normalizationStatus: 'auto_resolved',
        cardEntityId: 'entity-missing-identity',
        sourcePrintingId: 'source-printing-4',
        rawCardName: 'Identityless Card',
        rawPrintingCode: null,
        rawRarity: 'RR',
        rawLocaleCode: null,
        rawRegionCode: 'en',
        rawProduct,
      },
    ]

    const result = preparePrintingPublicationUnits(
      sources,
      new Map([[rawProduct.rawProductId, 'catalog-product-1']]),
      {
        createId: createIdSequence(['printing-unit-1', 'printing-unit-2']),
      },
    )

    expect(result).toEqual({
      attemptedCount: 4,
      units: [
        {
          id: 'printing-unit-1',
          printingKey: 'printing.fated-one-of-miracles-rezael.dz-bt01.010.en',
          cardEntityId: 'entity-rezael',
          productId: 'catalog-product-1',
          collectorNumber: '010',
          rarity: 'RRR',
          locale: 'en',
          region: 'en',
          printedName: 'Fated One of Miracles, Rezael',
          artVariant: null,
          isAlternateArt: false,
          isPromoVariant: false,
          traceability: {
            importJobId: 'job-1',
            normalizationResultId: 'normalization-rezael',
            rawCardPrintingId: 'raw-printing-rezael',
            rawProductId: 'raw-product-dz-bt01',
          },
        },
      ],
      skippedResults: [
        {
          normalizationResultId: 'normalization-review',
          reason: 'non_publishable_status',
        },
        {
          normalizationResultId: 'normalization-missing-product',
          reason: 'missing_catalog_product',
        },
        {
          normalizationResultId: 'normalization-missing-identity',
          reason: 'missing_printing_identity',
        },
      ],
    })
  })

  it('preserves printing-level variant semantics for alternate-art and promo printings', () => {
    const boosterProduct: CatalogPublicationRawProductSource = {
      rawProductId: 'raw-product-dz-bt01',
      importJobId: 'job-1',
      sourceProductId: 'source-1',
      rawName: 'Fated Clash',
      rawCode: 'DZ-BT01',
      rawProductCategory: 'booster',
      rawProductKind: 'main',
      rawReleaseDateText: '2024-05-03',
      rawRegionCode: 'en',
    }
    const promoProduct: CatalogPublicationRawProductSource = {
      rawProductId: 'raw-product-pr-g01',
      importJobId: 'job-1',
      sourceProductId: 'source-2',
      rawName: 'Premium Anniversary Promo Pack',
      rawCode: 'PR-G01',
      rawProductCategory: 'promo',
      rawProductKind: 'standalone',
      rawReleaseDateText: '2019-08-09',
      rawRegionCode: 'en',
    }

    const result = preparePrintingPublicationUnits(
      [
        {
          importJobId: 'job-1',
          normalizationResultId: 'normalization-rezael-dsr',
          rawCardPrintingId: 'raw-printing-rezael-dsr',
          rawProductId: boosterProduct.rawProductId,
          normalizationStatus: 'auto_resolved',
          cardEntityId: 'entity-rezael',
          sourcePrintingId: 'source-printing-1',
          rawCardName: 'Fated One of Miracles, Rezael',
          rawPrintingCode: 'DZ-BT01/DSR01EN',
          rawRarity: 'DSR',
          rawLocaleCode: 'en',
          rawRegionCode: 'en',
          rawProduct: boosterProduct,
        },
        {
          importJobId: 'job-1',
          normalizationResultId: 'normalization-promo',
          rawCardPrintingId: 'raw-printing-promo',
          rawProductId: promoProduct.rawProductId,
          normalizationStatus: 'auto_resolved',
          cardEntityId: 'entity-promo',
          sourcePrintingId: 'source-printing-2',
          rawCardName: 'Anniversary Promo Vanguard',
          rawPrintingCode: 'PR-G01/001EN',
          rawRarity: 'PR',
          rawLocaleCode: 'en',
          rawRegionCode: 'en',
          rawProduct: promoProduct,
        },
      ],
      new Map([
        [boosterProduct.rawProductId, 'catalog-product-booster'],
        [promoProduct.rawProductId, 'catalog-product-promo'],
      ]),
      {
        createId: createIdSequence(['printing-unit-1', 'printing-unit-2']),
      },
    )

    expect(result).toEqual({
      attemptedCount: 2,
      units: [
        {
          id: 'printing-unit-1',
          printingKey: 'printing.fated-one-of-miracles-rezael.dz-bt01.dsr01.en',
          cardEntityId: 'entity-rezael',
          productId: 'catalog-product-booster',
          collectorNumber: 'DSR01',
          rarity: 'DSR',
          locale: 'en',
          region: 'en',
          printedName: 'Fated One of Miracles, Rezael',
          artVariant: 'dsr',
          isAlternateArt: true,
          isPromoVariant: false,
          traceability: {
            importJobId: 'job-1',
            normalizationResultId: 'normalization-rezael-dsr',
            rawCardPrintingId: 'raw-printing-rezael-dsr',
            rawProductId: 'raw-product-dz-bt01',
          },
        },
        {
          id: 'printing-unit-2',
          printingKey: 'printing.anniversary-promo-vanguard.pr-g01.001.en',
          cardEntityId: 'entity-promo',
          productId: 'catalog-product-promo',
          collectorNumber: '001',
          rarity: 'PR',
          locale: 'en',
          region: 'en',
          printedName: 'Anniversary Promo Vanguard',
          artVariant: null,
          isAlternateArt: false,
          isPromoVariant: true,
          traceability: {
            importJobId: 'job-1',
            normalizationResultId: 'normalization-promo',
            rawCardPrintingId: 'raw-printing-promo',
            rawProductId: 'raw-product-pr-g01',
          },
        },
      ],
      skippedResults: [],
    })
  })
})

function createIdSequence(ids: readonly string[]): () => string {
  let index = 0

  return () => {
    const id = ids[index]

    if (!id) {
      throw new Error('Unexpected id sequence exhaustion.')
    }

    index += 1
    return id
  }
}
