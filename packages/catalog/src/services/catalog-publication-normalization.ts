import type { LocaleCode, Rarity, RegionCode } from '../products'

export function normalizeNonEmptyString(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim() ?? ''

  return normalized.length > 0 ? normalized : null
}

export function normalizeDateOnly(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeNonEmptyString(value)

  if (normalized === null) {
    return null
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null
}

export function normalizeLocaleCode(
  value: string | null | undefined,
): LocaleCode | null {
  const normalized = normalizeNonEmptyString(value)?.toLowerCase() ?? null

  return normalized ? (normalized as LocaleCode) : null
}

export function normalizeRegionCode(
  value: string | null | undefined,
): RegionCode | null {
  const normalized = normalizeNonEmptyString(value)?.toLowerCase() ?? null

  return normalized ? (normalized as RegionCode) : null
}

export function normalizeRarity(
  value: string | null | undefined,
): Rarity | null {
  const normalized = normalizeNonEmptyString(value)?.toUpperCase() ?? null

  return normalized ? (normalized as Rarity) : null
}
