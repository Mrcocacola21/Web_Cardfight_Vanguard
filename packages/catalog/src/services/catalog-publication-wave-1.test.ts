import { describe, expect, it } from 'vitest'

import { createCatalogPublicationService } from './catalog-publication.service'
import type {
  CatalogPublicationRawProductSource,
  CatalogPrintingPublicationSource,
  CatalogPublishedPrintingRecord,
  CatalogPublishedProductRecord,
  CatalogPublicationStore,
  UpsertCatalogPublishedPrintingInput,
  UpsertCatalogPublishedProductInput,
} from './catalog-publication.service'

describe('catalog publication wave 1', () => {
  it('publishes only resolved printings, preserves Rezael as two printings on one entity, and stays idempotent', async () => {
    const store = createPublicationStore()
    const service = createCatalogPublicationService(store)

    const firstRun = await service.publishImportJob('job-1')
    const secondRun = await service.publishImportJob('job-1')

    expect(firstRun).toEqual({
      ok: true,
      data: {
        importJobId: 'job-1',
        attemptedCount: 4,
        publishableCount: 3,
        publishedProductCount: 3,
        publishedPrintingCount: 3,
        skippedResults: [
          {
            normalizationResultId: 'normalization-liael',
            reason: 'non_publishable_status',
          },
        ],
      },
    })

    expect(secondRun).toEqual({
      ok: true,
      data: {
        importJobId: 'job-1',
        attemptedCount: 4,
        publishableCount: 3,
        publishedProductCount: 3,
        publishedPrintingCount: 3,
        skippedResults: [
          {
            normalizationResultId: 'normalization-liael',
            reason: 'non_publishable_status',
          },
        ],
      },
    })

    expect(store.products).toHaveLength(3)
    expect(store.printings).toHaveLength(3)

    const bastionPrinting = expectPublishedPrinting(
      store.printings,
      'normalization-bastion',
    )
    expect(bastionPrinting.cardEntityId).toBe('entity-bastion')

    const rezaelPrintings = store.printings.filter(
      (printing) => printing.cardEntityId === 'entity-rezael',
    )
    expect(rezaelPrintings).toHaveLength(2)
    expect(
      new Set(rezaelPrintings.map((printing) => printing.printingKey)).size,
    ).toBe(2)
    expect(new Set(rezaelPrintings.map((printing) => printing.id)).size).toBe(2)

    expect(
      store.printings.some(
        (printing) =>
          printing.sourceNormalizationResultId === 'normalization-liael',
      ),
    ).toBe(false)

    expect(bastionPrinting.sourceRawCardPrintingRecordId).toBe(
      'raw-printing-bastion',
    )
    expect(bastionPrinting.sourceNormalizationResultId).toBe(
      'normalization-bastion',
    )
  })
})

function createPublicationStore(): CatalogPublicationStore & {
  readonly products: CatalogPublishedProductRecord[]
  readonly printings: CatalogPublishedPrintingRecord[]
} {
  const rawProducts: CatalogPublicationRawProductSource[] = [
    {
      rawProductId: 'raw-product-d-bt01',
      importJobId: 'job-1',
      sourceProductId: 'product-d-bt01',
      rawName: 'Genesis of the Five Greats',
      rawCode: 'D-BT01',
      rawProductCategory: 'booster',
      rawProductKind: 'main',
      rawReleaseDateText: '2021-05-14',
      rawRegionCode: 'en',
    },
    {
      rawProductId: 'raw-product-dz-bt01',
      importJobId: 'job-1',
      sourceProductId: 'product-dz-bt01',
      rawName: 'Fated Clash',
      rawCode: 'DZ-BT01',
      rawProductCategory: 'booster',
      rawProductKind: 'main',
      rawReleaseDateText: '2024-05-03',
      rawRegionCode: 'en',
    },
    {
      rawProductId: 'raw-product-dz-bt02',
      importJobId: 'job-1',
      sourceProductId: 'product-dz-bt02',
      rawName: 'Illusionless Strife',
      rawCode: 'DZ-BT02',
      rawProductCategory: 'booster',
      rawProductKind: 'main',
      rawReleaseDateText: '2024-06-07',
      rawRegionCode: 'en',
    },
  ]

  const printingSources: CatalogPrintingPublicationSource[] = [
    {
      importJobId: 'job-1',
      normalizationResultId: 'normalization-bastion',
      rawCardPrintingId: 'raw-printing-bastion',
      rawProductId: 'raw-product-d-bt01',
      normalizationStatus: 'auto_resolved',
      cardEntityId: 'entity-bastion',
      sourcePrintingId: 'printing-bastion-d-bt01-main',
      rawCardName: 'Apex Ruler, Bastion',
      rawPrintingCode: 'D-BT01/001EN',
      rawRarity: 'RRR',
      rawLocaleCode: 'en',
      rawRegionCode: 'en',
      rawProduct: rawProducts[0]!,
    },
    {
      importJobId: 'job-1',
      normalizationResultId: 'normalization-rezael-main',
      rawCardPrintingId: 'raw-printing-rezael-main',
      rawProductId: 'raw-product-dz-bt01',
      normalizationStatus: 'auto_resolved',
      cardEntityId: 'entity-rezael',
      sourcePrintingId: 'printing-rezael-dz-bt01-rrr',
      rawCardName: 'Fated One of Miracles, Rezael',
      rawPrintingCode: 'DZ-BT01/010EN',
      rawRarity: 'RRR',
      rawLocaleCode: 'en',
      rawRegionCode: 'en',
      rawProduct: rawProducts[1]!,
    },
    {
      importJobId: 'job-1',
      normalizationResultId: 'normalization-rezael-dsr',
      rawCardPrintingId: 'raw-printing-rezael-dsr',
      rawProductId: 'raw-product-dz-bt01',
      normalizationStatus: 'auto_resolved',
      cardEntityId: 'entity-rezael',
      sourcePrintingId: 'printing-rezael-dz-bt01-dsr',
      rawCardName: 'Fated One of Miracles, Rezael',
      rawPrintingCode: 'DZ-BT01/DSR01EN',
      rawRarity: 'DSR',
      rawLocaleCode: 'en',
      rawRegionCode: 'en',
      rawProduct: rawProducts[1]!,
    },
    {
      importJobId: 'job-1',
      normalizationResultId: 'normalization-liael',
      rawCardPrintingId: 'raw-printing-liael',
      rawProductId: 'raw-product-dz-bt02',
      normalizationStatus: 'unresolved',
      cardEntityId: null,
      sourcePrintingId: 'printing-liael-amorta-dz-bt02-main',
      rawCardName: 'Fated One of Time, Liael=Amorta',
      rawPrintingCode: 'DZ-BT02/010EN',
      rawRarity: 'RRR',
      rawLocaleCode: 'en',
      rawRegionCode: 'en',
      rawProduct: rawProducts[2]!,
    },
  ]

  const products: CatalogPublishedProductRecord[] = []
  const printings: CatalogPublishedPrintingRecord[] = []

  return {
    products,
    printings,
    listRawProductsByImportJob(importJobId) {
      return Promise.resolve({
        ok: true,
        data: rawProducts.filter(
          (product) => product.importJobId === importJobId,
        ),
      })
    },
    listPrintingPublicationSourcesByImportJob({ importJobId }) {
      return Promise.resolve({
        ok: true,
        data: printingSources.filter(
          (source) => source.importJobId === importJobId,
        ),
      })
    },
    listCatalogProductsByIdentity(identities) {
      const identityKeys = new Set(
        identities.map(
          (identity) =>
            `${identity.familyId}::${identity.officialCode.toUpperCase()}::${identity.regionCode ?? ''}`,
        ),
      )

      return Promise.resolve({
        ok: true,
        data: products.filter((product) =>
          identityKeys.has(
            `${product.familyId}::${product.officialCode.toUpperCase()}::${product.regionCode ?? ''}`,
          ),
        ),
      })
    },
    listCatalogPrintingsByKeys(printingKeys) {
      return Promise.resolve({
        ok: true,
        data: printings.filter((printing) =>
          printingKeys.includes(printing.printingKey),
        ),
      })
    },
    upsertCatalogProducts(input) {
      for (const product of input) {
        upsertProduct(products, product)
      }

      return Promise.resolve({
        ok: true,
        data: [...products],
      })
    },
    upsertCatalogPrintings(input) {
      for (const printing of input) {
        upsertPrinting(printings, printing)
      }

      return Promise.resolve({
        ok: true,
        data: [...printings],
      })
    },
  }
}

function upsertProduct(
  products: CatalogPublishedProductRecord[],
  input: UpsertCatalogPublishedProductInput,
) {
  const existingIndex = products.findIndex((product) => product.id === input.id)
  const nextProduct: CatalogPublishedProductRecord = {
    id: input.id,
    canonicalKey: input.canonicalKey,
    familyId: input.familyId,
    officialCode: input.officialCode,
    name: input.name,
    regionCode: input.regionCode,
    sourceImportJobId: input.sourceImportJobId,
    sourceRawProductRecordId: input.sourceRawProductRecordId,
  }

  if (existingIndex >= 0) {
    products[existingIndex] = nextProduct
    return
  }

  products.push(nextProduct)
}

function upsertPrinting(
  printings: CatalogPublishedPrintingRecord[],
  input: UpsertCatalogPublishedPrintingInput,
) {
  const existingIndex = printings.findIndex(
    (printing) => printing.printingKey === input.printingKey,
  )
  const nextPrinting: CatalogPublishedPrintingRecord = {
    id: existingIndex >= 0 ? printings[existingIndex]!.id : input.id,
    printingKey: input.printingKey,
    cardEntityId: input.cardEntityId,
    productId: input.productId,
    sourceNormalizationResultId: input.sourceNormalizationResultId,
    sourceRawCardPrintingRecordId: input.sourceRawCardPrintingRecordId,
  }

  if (existingIndex >= 0) {
    printings[existingIndex] = nextPrinting
    return
  }

  printings.push(nextPrinting)
}

function expectPublishedPrinting(
  printings: readonly CatalogPublishedPrintingRecord[],
  normalizationResultId: string,
) {
  const printing = printings.find(
    (candidate) =>
      candidate.sourceNormalizationResultId === normalizationResultId,
  )

  if (!printing) {
    throw new Error(
      `Expected published printing for normalization result ${normalizationResultId}.`,
    )
  }

  return printing
}
