import type { Brand } from '@web-vg/shared'

export type CanonicalCardKey = Brand<string, 'CanonicalCardKey'>
export type CardPrintingKey = Brand<string, 'CardPrintingKey'>
export type ProductCanonicalKey = Brand<string, 'ProductCanonicalKey'>
export type CatalogEraKey = Brand<string, 'CatalogEraKey'>
export type CatalogSearchText = Brand<string, 'CatalogSearchText'>

function normalizeToken(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ')

  return normalized.length > 0 ? normalized : null
}

export function normalizeCanonicalCardKey(
  value: string,
): CanonicalCardKey | null {
  const normalized = normalizeToken(value)

  return normalized ? (normalized as CanonicalCardKey) : null
}

export function normalizeCardPrintingKey(
  value: string,
): CardPrintingKey | null {
  const normalized = normalizeToken(value)

  return normalized ? (normalized as CardPrintingKey) : null
}

export function normalizeProductCanonicalKey(
  value: string,
): ProductCanonicalKey | null {
  const normalized = normalizeToken(value)

  return normalized ? (normalized as ProductCanonicalKey) : null
}

export function normalizeCatalogEraKey(value: string): CatalogEraKey | null {
  const normalized = normalizeToken(value)

  return normalized ? (normalized as CatalogEraKey) : null
}

export function normalizeCatalogSearchText(
  value: string,
): CatalogSearchText | null {
  const normalized = value.trim().replace(/\s+/g, ' ')

  return normalized.length > 0 ? (normalized as CatalogSearchText) : null
}
