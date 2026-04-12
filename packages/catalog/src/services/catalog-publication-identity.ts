export interface CatalogProductIdentity {
  readonly familyId: string
  readonly officialCode: string
  readonly regionCode: string | null
}

export function resolveCatalogProductFamilyId(
  officialCode: string,
): string | null {
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

export function createProductIdentityKey(
  input: CatalogProductIdentity,
): string {
  return `${input.familyId}::${input.officialCode.toUpperCase()}::${input.regionCode ?? ''}`
}
