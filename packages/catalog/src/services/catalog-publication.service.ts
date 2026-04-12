import { randomUUID } from 'node:crypto'

import type {
  CatalogPublicationCandidate,
  CatalogPublicationError,
  CatalogPublicationRequest,
  CatalogPublicationResult,
  CatalogPublicationService,
  CatalogPublicationSummary,
} from '../publication'

import {
  createProductIdentityKey,
  type CatalogProductIdentity,
} from './catalog-publication-identity'
import {
  type CatalogPreparedPrintingUnit,
  type CatalogPreparedProductUnit,
  preparePrintingPublicationUnits,
  prepareProductPublicationUnits,
} from './catalog-publication-unit-preparer'

type CatalogPublicationStoreResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: {
        readonly code: string
        readonly message: string
        readonly details?: string
      }
    }

export interface CatalogPublicationRawProductSource {
  readonly rawProductId: string
  readonly importJobId: string
  readonly sourceProductId: string
  readonly rawName: string
  readonly rawCode: string | null
  readonly rawProductCategory: string | null
  readonly rawProductKind: string | null
  readonly rawReleaseDateText: string | null
  readonly rawRegionCode: string | null
}

export interface CatalogPrintingPublicationSource extends CatalogPublicationCandidate {
  readonly sourcePrintingId: string
  readonly rawCardName: string
  readonly rawPrintingCode: string | null
  readonly rawRarity: string | null
  readonly rawLocaleCode: string | null
  readonly rawRegionCode: string | null
  readonly rawProduct: CatalogPublicationRawProductSource | null
}

export interface CatalogPublishedProductRecord {
  readonly id: string
  readonly canonicalKey: string
  readonly familyId: string
  readonly officialCode: string
  readonly name: string
  readonly regionCode: string | null
  readonly sourceImportJobId: string | null
  readonly sourceRawProductRecordId: string | null
}

export interface CatalogPublishedPrintingRecord {
  readonly id: string
  readonly printingKey: string
  readonly cardEntityId: string
  readonly productId: string
  readonly sourceNormalizationResultId: string | null
  readonly sourceRawCardPrintingRecordId: string | null
}

export interface UpsertCatalogPublishedProductInput {
  readonly id: string
  readonly canonicalKey: string
  readonly familyId: string
  readonly officialCode: string
  readonly name: string
  readonly productCategory: string
  readonly productKind: string
  readonly releaseDate: string
  readonly regionCode: string | null
  readonly cycleKey: string | null
  readonly sourceImportJobId: string
  readonly sourceRawProductRecordId: string
}

export interface UpsertCatalogPublishedPrintingInput {
  readonly id: string
  readonly printingKey: string
  readonly cardEntityId: string
  readonly productId: string
  readonly collectorNumber: string
  readonly rarity: string
  readonly localeCode: string
  readonly regionCode: string | null
  readonly printedName: string | null
  readonly artVariant: string | null
  readonly isAlternateArt: boolean
  readonly isPromoVariant: boolean
  readonly sourceImportJobId: string
  readonly sourceNormalizationResultId: string
  readonly sourceRawCardPrintingRecordId: string
  readonly sourceRawProductRecordId: string | null
}

export interface CatalogPublicationStore {
  listRawProductsByImportJob(
    importJobId: string,
  ): Promise<
    CatalogPublicationStoreResult<readonly CatalogPublicationRawProductSource[]>
  >
  listPrintingPublicationSourcesByImportJob(
    request: CatalogPublicationRequest,
  ): Promise<
    CatalogPublicationStoreResult<readonly CatalogPrintingPublicationSource[]>
  >
  listCatalogProductsByIdentity(
    identities: readonly CatalogProductIdentity[],
  ): Promise<
    CatalogPublicationStoreResult<readonly CatalogPublishedProductRecord[]>
  >
  listCatalogPrintingsByKeys(
    printingKeys: readonly string[],
  ): Promise<
    CatalogPublicationStoreResult<readonly CatalogPublishedPrintingRecord[]>
  >
  upsertCatalogProducts(
    input: readonly UpsertCatalogPublishedProductInput[],
  ): Promise<
    CatalogPublicationStoreResult<readonly CatalogPublishedProductRecord[]>
  >
  upsertCatalogPrintings(
    input: readonly UpsertCatalogPublishedPrintingInput[],
  ): Promise<
    CatalogPublicationStoreResult<readonly CatalogPublishedPrintingRecord[]>
  >
}

interface PublishedProductsStepData {
  readonly publishedProducts: readonly CatalogPublishedProductRecord[]
  readonly publishedProductIdByRawProductId: ReadonlyMap<string, string>
}

interface PublishedPrintingsStepData {
  readonly publishedPrintings: readonly CatalogPublishedPrintingRecord[]
}

export function createCatalogPublicationService(
  store: CatalogPublicationStore,
): CatalogPublicationService {
  return {
    async publishImportJob(importJobId) {
      const rawProductsResult =
        await store.listRawProductsByImportJob(importJobId)

      if (!rawProductsResult.ok) {
        return mapStoreError(rawProductsResult.error)
      }

      const printingSourcesResult =
        await store.listPrintingPublicationSourcesByImportJob({
          importJobId,
        })

      if (!printingSourcesResult.ok) {
        return mapStoreError(printingSourcesResult.error)
      }

      const productPublicationResult = await publishProducts(
        store,
        rawProductsResult.data,
      )

      if (!productPublicationResult.ok) {
        return productPublicationResult
      }

      const printingPreparation = preparePrintingPublicationUnits(
        printingSourcesResult.data,
        productPublicationResult.data.publishedProductIdByRawProductId,
        {
          createId: randomUUID,
        },
      )
      const printingPublicationResult = await publishPrintings(
        store,
        printingPreparation.units,
      )

      if (!printingPublicationResult.ok) {
        return printingPublicationResult
      }

      return {
        ok: true,
        data: {
          importJobId,
          attemptedCount: printingPreparation.attemptedCount,
          publishableCount: printingPreparation.units.length,
          publishedProductCount:
            productPublicationResult.data.publishedProducts.length,
          publishedPrintingCount:
            printingPublicationResult.data.publishedPrintings.length,
          skippedResults: printingPreparation.skippedResults,
        } satisfies CatalogPublicationSummary,
      }
    },
  }
}

async function publishProducts(
  store: CatalogPublicationStore,
  rawProducts: readonly CatalogPublicationRawProductSource[],
): Promise<CatalogPublicationResult<PublishedProductsStepData>> {
  const productUnits = prepareProductPublicationUnits(rawProducts, {
    createId: randomUUID,
  })
  const existingProductsResult = await store.listCatalogProductsByIdentity(
    productUnits.map((unit) => ({
      familyId: unit.familyId,
      officialCode: unit.officialCode,
      regionCode: unit.regionCode,
    })),
  )

  if (!existingProductsResult.ok) {
    return mapStoreError(existingProductsResult.error)
  }

  const existingProductByIdentity = new Map(
    existingProductsResult.data.map((product) => [
      createProductIdentityKey(product),
      product,
    ]),
  )
  const productUpserts = productUnits.map((unit) =>
    createProductUpsertInput(
      unit,
      existingProductByIdentity.get(createProductIdentityKey(unit)),
    ),
  )
  const publishedProductsResult =
    await store.upsertCatalogProducts(productUpserts)

  if (!publishedProductsResult.ok) {
    return mapStoreError(publishedProductsResult.error)
  }

  return {
    ok: true,
    data: {
      publishedProducts: publishedProductsResult.data,
      publishedProductIdByRawProductId: mapPublishedProductIdsByRawProductId(
        productUnits,
        publishedProductsResult.data,
      ),
    },
  }
}

async function publishPrintings(
  store: CatalogPublicationStore,
  printingUnits: readonly CatalogPreparedPrintingUnit[],
): Promise<CatalogPublicationResult<PublishedPrintingsStepData>> {
  const existingPrintingsResult = await store.listCatalogPrintingsByKeys(
    printingUnits.map((unit) => unit.printingKey),
  )

  if (!existingPrintingsResult.ok) {
    return mapStoreError(existingPrintingsResult.error)
  }

  const existingPrintingByKey = new Map(
    existingPrintingsResult.data.map((printing) => [
      printing.printingKey,
      printing,
    ]),
  )
  const printingUpserts = printingUnits.map((unit) =>
    createPrintingUpsertInput(
      unit,
      existingPrintingByKey.get(unit.printingKey),
    ),
  )
  const publishedPrintingsResult =
    await store.upsertCatalogPrintings(printingUpserts)

  if (!publishedPrintingsResult.ok) {
    return mapStoreError(publishedPrintingsResult.error)
  }

  return {
    ok: true,
    data: {
      publishedPrintings: publishedPrintingsResult.data,
    },
  }
}

function createProductUpsertInput(
  unit: CatalogPreparedProductUnit,
  existingProduct: CatalogPublishedProductRecord | undefined,
): UpsertCatalogPublishedProductInput {
  return {
    id: existingProduct?.id ?? unit.id,
    canonicalKey: unit.canonicalKey,
    familyId: unit.familyId,
    officialCode: unit.officialCode,
    name: unit.name,
    productCategory: unit.productCategory,
    productKind: unit.productKind,
    releaseDate: unit.releaseDate,
    regionCode: unit.regionCode,
    cycleKey: unit.cycleKey,
    sourceImportJobId: unit.sourceImportJobId,
    sourceRawProductRecordId: unit.rawProductId,
  }
}

function createPrintingUpsertInput(
  unit: CatalogPreparedPrintingUnit,
  existingPrinting: CatalogPublishedPrintingRecord | undefined,
): UpsertCatalogPublishedPrintingInput {
  return {
    id: existingPrinting?.id ?? unit.id,
    printingKey: unit.printingKey,
    cardEntityId: unit.cardEntityId,
    productId: unit.productId,
    collectorNumber: unit.collectorNumber,
    rarity: unit.rarity,
    localeCode: unit.locale,
    regionCode: unit.region,
    printedName: unit.printedName,
    artVariant: unit.artVariant,
    isAlternateArt: unit.isAlternateArt,
    isPromoVariant: unit.isPromoVariant,
    sourceImportJobId: unit.traceability.importJobId,
    sourceNormalizationResultId: unit.traceability.normalizationResultId,
    sourceRawCardPrintingRecordId: unit.traceability.rawCardPrintingId,
    sourceRawProductRecordId: unit.traceability.rawProductId,
  }
}

function mapPublishedProductIdsByRawProductId(
  productUnits: readonly CatalogPreparedProductUnit[],
  publishedProducts: readonly CatalogPublishedProductRecord[],
): ReadonlyMap<string, string> {
  const publishedProductByIdentity = new Map(
    publishedProducts.map((product) => [
      createProductIdentityKey(product),
      product,
    ]),
  )
  const publishedProductIdByRawProductId = new Map<string, string>()

  for (const unit of productUnits) {
    const publishedProduct = publishedProductByIdentity.get(
      createProductIdentityKey(unit),
    )

    if (publishedProduct) {
      publishedProductIdByRawProductId.set(
        unit.rawProductId,
        publishedProduct.id,
      )
    }
  }

  return publishedProductIdByRawProductId
}

function mapStoreError<TData>(error: {
  readonly message: string
  readonly details?: string
}): CatalogPublicationResult<TData> {
  const publicationError: CatalogPublicationError = {
    code: 'publication-failed',
    message: error.message,
  }

  if (error.details) {
    return {
      ok: false,
      error: {
        ...publicationError,
        details: error.details,
      },
    }
  }

  return {
    ok: false,
    error: publicationError,
  }
}
