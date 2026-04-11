import { randomUUID } from 'node:crypto'

import {
  normalizeCardPrintingKey,
  normalizeProductCanonicalKey,
  type CardPrintingKey,
  type ProductCanonicalKey,
} from '../catalog-identifiers'
import {
  type CatalogPublicationError,
  isNormalizationResultPublishable,
  type CatalogPublicationCandidate,
  type CatalogPublicationRequest,
  type CatalogPublicationResult,
  type CatalogPublicationService,
  type CatalogPublicationSkipReason,
  type CatalogPublicationSummary,
  type CatalogPublicationTraceability,
} from '../publication'
import type { LocaleCode, Rarity, RegionCode } from '../products'

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

interface CatalogProductIdentity {
  readonly familyId: string
  readonly officialCode: string
  readonly regionCode: string | null
}

interface CatalogPreparedProductUnit extends CatalogProductIdentity {
  readonly rawProductId: string
  readonly id: string
  readonly canonicalKey: ProductCanonicalKey
  readonly name: string
  readonly productCategory: string
  readonly productKind: string
  readonly releaseDate: string
  readonly cycleKey: string | null
  readonly sourceImportJobId: string
}

interface CatalogPreparedPrintingUnit {
  readonly id: string
  readonly printingKey: CardPrintingKey
  readonly cardEntityId: string
  readonly productId: string
  readonly collectorNumber: string
  readonly rarity: Rarity
  readonly locale: LocaleCode
  readonly region: RegionCode | null
  readonly printedName: string | null
  readonly artVariant: string | null
  readonly isAlternateArt: boolean
  readonly isPromoVariant: boolean
  readonly traceability: CatalogPublicationTraceability
}

interface ParsedPrintingCode {
  readonly productCode: string
  readonly collectorNumber: string
  readonly localeCode: string | null
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

      const rawProducts = rawProductsResult.data
      const printingSources = printingSourcesResult.data

      const productUnits = prepareProductPublicationUnits(rawProducts)
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

      const productUpserts = productUnits.map((unit) => {
        const existingProduct = existingProductByIdentity.get(
          createProductIdentityKey(unit),
        )

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
        } satisfies UpsertCatalogPublishedProductInput
      })

      const publishedProductsResult =
        await store.upsertCatalogProducts(productUpserts)

      if (!publishedProductsResult.ok) {
        return mapStoreError(publishedProductsResult.error)
      }

      const publishedProductByIdentity = new Map(
        publishedProductsResult.data.map((product) => [
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

      const attemptedCount = printingSources.length
      const skippedResults: Array<{
        normalizationResultId: string
        reason: CatalogPublicationSkipReason
      }> = []
      const provisionalPrintingUnits: CatalogPreparedPrintingUnit[] = []

      for (const source of printingSources) {
        if (!isNormalizationResultPublishable(source)) {
          skippedResults.push({
            normalizationResultId: source.normalizationResultId,
            reason: 'non_publishable_status',
          })
          continue
        }

        if (!source.rawProduct) {
          skippedResults.push({
            normalizationResultId: source.normalizationResultId,
            reason: 'missing_catalog_product',
          })
          continue
        }

        const productId = publishedProductIdByRawProductId.get(
          source.rawProduct.rawProductId,
        )

        if (!productId) {
          skippedResults.push({
            normalizationResultId: source.normalizationResultId,
            reason: 'missing_catalog_product',
          })
          continue
        }

        const preparedPrinting = preparePrintingPublicationUnit(
          source,
          productId,
        )

        if (!preparedPrinting) {
          skippedResults.push({
            normalizationResultId: source.normalizationResultId,
            reason: 'missing_printing_identity',
          })
          continue
        }

        provisionalPrintingUnits.push(preparedPrinting)
      }

      const existingPrintingsResult = await store.listCatalogPrintingsByKeys(
        provisionalPrintingUnits.map((unit) => unit.printingKey),
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

      const printingUpserts = provisionalPrintingUnits.map((unit) => ({
        id: existingPrintingByKey.get(unit.printingKey)?.id ?? unit.id,
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
      }))

      const publishedPrintingsResult =
        await store.upsertCatalogPrintings(printingUpserts)

      if (!publishedPrintingsResult.ok) {
        return mapStoreError(publishedPrintingsResult.error)
      }

      return {
        ok: true,
        data: {
          importJobId,
          attemptedCount,
          publishableCount: provisionalPrintingUnits.length,
          publishedProductCount: publishedProductsResult.data.length,
          publishedPrintingCount: publishedPrintingsResult.data.length,
          skippedResults,
        } satisfies CatalogPublicationSummary,
      }
    },
  }
}

function prepareProductPublicationUnits(
  rawProducts: readonly CatalogPublicationRawProductSource[],
): readonly CatalogPreparedProductUnit[] {
  const seen = new Set<string>()
  const prepared: CatalogPreparedProductUnit[] = []

  for (const rawProduct of rawProducts) {
    const officialCode = normalizeNonEmptyString(rawProduct.rawCode)
    const name = normalizeNonEmptyString(rawProduct.rawName)
    const productCategory = normalizeNonEmptyString(
      rawProduct.rawProductCategory,
    )
    const productKind = normalizeNonEmptyString(rawProduct.rawProductKind)
    const releaseDate = normalizeDateOnly(rawProduct.rawReleaseDateText)

    if (
      officialCode === null ||
      name === null ||
      productCategory === null ||
      productKind === null ||
      releaseDate === null
    ) {
      continue
    }

    const familyId = resolveCatalogProductFamilyId(officialCode)

    if (familyId === null) {
      continue
    }

    const regionCode = normalizeNonEmptyString(rawProduct.rawRegionCode)
    const canonicalKey = buildProductCanonicalKey(officialCode, name)

    if (!canonicalKey) {
      continue
    }

    const identityKey = createProductIdentityKey({
      familyId,
      officialCode,
      regionCode,
    })

    if (seen.has(identityKey)) {
      continue
    }

    seen.add(identityKey)
    prepared.push({
      rawProductId: rawProduct.rawProductId,
      id: randomUUID(),
      canonicalKey,
      familyId,
      officialCode,
      name,
      productCategory,
      productKind,
      releaseDate,
      regionCode,
      cycleKey: null,
      sourceImportJobId: rawProduct.importJobId,
    })
  }

  return prepared
}

function preparePrintingPublicationUnit(
  source: CatalogPrintingPublicationSource & { readonly cardEntityId: string },
  productId: string,
): CatalogPreparedPrintingUnit | null {
  const parsedPrintingCode = parsePrintingCode(source.rawPrintingCode)
  const rawProductCode = normalizeNonEmptyString(source.rawProduct?.rawCode)
  const productCode = rawProductCode ?? parsedPrintingCode?.productCode ?? null
  const collectorNumber =
    parsedPrintingCode?.collectorNumber ??
    normalizeNonEmptyString(source.rawPrintingCode)
  const localeCode = normalizeLocaleCode(
    source.rawLocaleCode ?? parsedPrintingCode?.localeCode ?? null,
  )
  const rarity = normalizeRarity(source.rawRarity)

  if (
    productCode === null ||
    collectorNumber === null ||
    localeCode === null ||
    rarity === null
  ) {
    return null
  }

  const printingKey = buildPrintingKey(
    source.rawCardName,
    productCode,
    collectorNumber,
    localeCode,
  )

  if (!printingKey) {
    return null
  }

  return {
    id: randomUUID(),
    printingKey,
    cardEntityId: source.cardEntityId,
    productId,
    collectorNumber,
    rarity,
    locale: localeCode,
    region: normalizeRegionCode(
      source.rawRegionCode ?? source.rawProduct?.rawRegionCode ?? null,
    ),
    printedName: normalizeNonEmptyString(source.rawCardName),
    artVariant: null,
    isAlternateArt: false,
    isPromoVariant: false,
    traceability: {
      importJobId: source.importJobId,
      normalizationResultId: source.normalizationResultId,
      rawCardPrintingId: source.rawCardPrintingId,
      rawProductId: source.rawProductId,
    } satisfies CatalogPublicationTraceability,
  }
}

function buildProductCanonicalKey(
  officialCode: string,
  name: string,
): ProductCanonicalKey | null {
  return normalizeProductCanonicalKey(
    `product.${slugifySegment(officialCode)}.${slugifySegment(name)}`,
  )
}

function buildPrintingKey(
  printedName: string,
  productCode: string,
  collectorNumber: string,
  localeCode: string,
): CardPrintingKey | null {
  return normalizeCardPrintingKey(
    `printing.${slugifySegment(printedName)}.${slugifySegment(productCode)}.${slugifySegment(collectorNumber)}.${slugifySegment(localeCode)}`,
  )
}

function resolveCatalogProductFamilyId(officialCode: string): string | null {
  const normalizedCode = officialCode.trim().toUpperCase()

  if (normalizedCode.startsWith('D-') || normalizedCode.startsWith('DZ-')) {
    return 'family-standard'
  }

  if (normalizedCode.startsWith('V-')) {
    return 'family-v'
  }

  if (normalizedCode.startsWith('G-') || normalizedCode.startsWith('PR-')) {
    return 'family-premium'
  }

  return null
}

function createProductIdentityKey(input: CatalogProductIdentity): string {
  return `${input.familyId}::${input.officialCode.toUpperCase()}::${input.regionCode ?? ''}`
}

function parsePrintingCode(value: string | null): ParsedPrintingCode | null {
  const normalized = normalizeNonEmptyString(value)

  if (normalized === null) {
    return null
  }

  const [productCodePart, collectorPart] = normalized.split('/')

  if (!productCodePart || !collectorPart) {
    return null
  }

  const match = collectorPart.match(/^(.*?)([A-Za-z]{2})$/)

  if (!match) {
    return {
      productCode: productCodePart,
      collectorNumber: collectorPart,
      localeCode: null,
    }
  }

  const collectorNumber = normalizeNonEmptyString(match[1])
  const localeCode = normalizeNonEmptyString(match[2])

  if (collectorNumber === null || localeCode === null) {
    return null
  }

  return {
    productCode: productCodePart,
    collectorNumber,
    localeCode: localeCode.toLowerCase(),
  }
}

function normalizeNonEmptyString(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim() ?? ''

  return normalized.length > 0 ? normalized : null
}

function normalizeDateOnly(value: string | null | undefined): string | null {
  const normalized = normalizeNonEmptyString(value)

  if (normalized === null) {
    return null
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null
}

function normalizeLocaleCode(
  value: string | null | undefined,
): LocaleCode | null {
  const normalized = normalizeNonEmptyString(value)?.toLowerCase() ?? null

  return normalized ? (normalized as LocaleCode) : null
}

function normalizeRegionCode(
  value: string | null | undefined,
): RegionCode | null {
  const normalized = normalizeNonEmptyString(value)?.toLowerCase() ?? null

  return normalized ? (normalized as RegionCode) : null
}

function normalizeRarity(value: string | null | undefined): Rarity | null {
  const normalized = normalizeNonEmptyString(value)?.toUpperCase() ?? null

  return normalized ? (normalized as Rarity) : null
}

function slugifySegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function mapStoreError(error: {
  readonly message: string
  readonly details?: string
}): CatalogPublicationResult<CatalogPublicationSummary> {
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
