import {
  normalizeCardPrintingKey,
  normalizeProductCanonicalKey,
  type CardPrintingKey,
  type ProductCanonicalKey,
} from '../catalog-identifiers'

import { normalizeNonEmptyString } from './catalog-publication-normalization'

export interface ParsedPrintingCode {
  readonly productCode: string
  readonly collectorNumber: string
  readonly localeCode: string | null
}

export function buildProductCanonicalKey(
  officialCode: string,
  name: string,
): ProductCanonicalKey | null {
  return normalizeProductCanonicalKey(
    `product.${slugifySegment(officialCode)}.${slugifySegment(name)}`,
  )
}

export function buildPrintingKey(
  printedName: string,
  productCode: string,
  collectorNumber: string,
  localeCode: string,
): CardPrintingKey | null {
  return normalizeCardPrintingKey(
    `printing.${slugifySegment(printedName)}.${slugifySegment(productCode)}.${slugifySegment(collectorNumber)}.${slugifySegment(localeCode)}`,
  )
}

export function parsePrintingCode(
  value: string | null,
): ParsedPrintingCode | null {
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

function slugifySegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
