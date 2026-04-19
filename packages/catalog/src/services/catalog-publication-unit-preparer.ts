import type {
  CardPrintingKey,
  ProductCanonicalKey,
} from '../catalog-identifiers'
import {
  type CatalogPublicationSkippedResult,
  type CatalogPublicationTraceability,
  isNormalizationResultPublishable,
} from '../publication'
import type { LocaleCode, Rarity, RegionCode } from '../products'

import {
  buildPrintingKey,
  buildProductCanonicalKey,
  parsePrintingCode,
} from './catalog-publication-key-builder'
import {
  createProductIdentityKey,
  resolveCatalogProductFamilyId,
  type CatalogProductIdentity,
} from './catalog-publication-identity'
import {
  normalizeDateOnly,
  normalizeLocaleCode,
  normalizeNonEmptyString,
  normalizeRegionCode,
  normalizeRarity,
} from './catalog-publication-normalization'
import type {
  CatalogPublicationRawProductSource,
  CatalogPrintingPublicationSource,
} from './catalog-publication.service'

export interface CatalogPreparedProductUnit extends CatalogProductIdentity {
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

export interface CatalogPreparedPrintingUnit {
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

export interface CatalogPreparedPrintingBatch {
  readonly attemptedCount: number
  readonly units: readonly CatalogPreparedPrintingUnit[]
  readonly skippedResults: readonly CatalogPublicationSkippedResult[]
}

interface PublicationPreparationOptions {
  readonly createId: () => string
}

interface InferredPrintingSemantics {
  readonly artVariant: string | null
  readonly isAlternateArt: boolean
  readonly isPromoVariant: boolean
}

type PublishableCatalogPrintingSource = CatalogPrintingPublicationSource & {
  readonly cardEntityId: string
  readonly rawProduct: CatalogPublicationRawProductSource
}

const alternateArtVariantPrefixes = new Set([
  'ASR',
  'DSR',
  'FFR',
  'FR',
  'GCR',
  'MSP',
  'SEC',
  'SNR',
  'SP',
])

export function prepareProductPublicationUnits(
  rawProducts: readonly CatalogPublicationRawProductSource[],
  options: PublicationPreparationOptions,
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
      id: options.createId(),
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

export function preparePrintingPublicationUnits(
  sources: readonly CatalogPrintingPublicationSource[],
  publishedProductIdByRawProductId: ReadonlyMap<string, string>,
  options: PublicationPreparationOptions,
): CatalogPreparedPrintingBatch {
  const skippedResults: CatalogPublicationSkippedResult[] = []
  const units: CatalogPreparedPrintingUnit[] = []

  for (const source of sources) {
    if (!isNormalizationResultPublishable(source)) {
      skippedResults.push({
        normalizationResultId: source.normalizationResultId,
        reason: 'non_publishable_status',
      })
      continue
    }

    if (!hasRawProduct(source)) {
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
      options,
    )

    if (!preparedPrinting) {
      skippedResults.push({
        normalizationResultId: source.normalizationResultId,
        reason: 'missing_printing_identity',
      })
      continue
    }

    units.push(preparedPrinting)
  }

  return {
    attemptedCount: sources.length,
    units,
    skippedResults,
  }
}

function preparePrintingPublicationUnit(
  source: PublishableCatalogPrintingSource,
  productId: string,
  options: PublicationPreparationOptions,
): CatalogPreparedPrintingUnit | null {
  const parsedPrintingCode = parsePrintingCode(source.rawPrintingCode)
  const rawProductCode = normalizeNonEmptyString(source.rawProduct.rawCode)
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

  const printingSemantics = inferPrintingSemantics({
    collectorNumber,
    rarity,
    productCode,
    rawProduct: source.rawProduct,
  })

  return {
    id: options.createId(),
    printingKey,
    cardEntityId: source.cardEntityId,
    productId,
    collectorNumber,
    rarity,
    locale: localeCode,
    region: normalizeRegionCode(
      source.rawRegionCode ?? source.rawProduct.rawRegionCode ?? null,
    ),
    printedName: normalizeNonEmptyString(source.rawCardName),
    artVariant: printingSemantics.artVariant,
    isAlternateArt: printingSemantics.isAlternateArt,
    isPromoVariant: printingSemantics.isPromoVariant,
    traceability: {
      importJobId: source.importJobId,
      normalizationResultId: source.normalizationResultId,
      rawCardPrintingId: source.rawCardPrintingId,
      rawProductId: source.rawProductId,
    } satisfies CatalogPublicationTraceability,
  }
}

function hasRawProduct(
  source: CatalogPrintingPublicationSource,
): source is CatalogPrintingPublicationSource & {
  readonly rawProduct: CatalogPublicationRawProductSource
} {
  return source.rawProduct !== null
}

function inferPrintingSemantics(input: {
  readonly collectorNumber: string
  readonly rarity: Rarity
  readonly productCode: string
  readonly rawProduct: CatalogPublicationRawProductSource
}): InferredPrintingSemantics {
  const collectorPrefix = extractCollectorPrefix(input.collectorNumber)
  const normalizedProductCategory = normalizeNonEmptyString(
    input.rawProduct.rawProductCategory,
  )?.toLowerCase()
  const normalizedProductCode = input.productCode.toUpperCase()
  const normalizedRarity = input.rarity.toUpperCase()
  const artVariant = collectorPrefix ? collectorPrefix.toLowerCase() : null

  return {
    artVariant,
    isAlternateArt:
      collectorPrefix !== null &&
      alternateArtVariantPrefixes.has(collectorPrefix),
    isPromoVariant:
      normalizedProductCategory === 'promo' ||
      normalizedProductCode.startsWith('PR-') ||
      normalizedRarity === 'PR',
  }
}

function extractCollectorPrefix(collectorNumber: string): string | null {
  const match = collectorNumber.match(/^([A-Za-z]+)\d+$/)

  return match?.[1]?.toUpperCase() ?? null
}
