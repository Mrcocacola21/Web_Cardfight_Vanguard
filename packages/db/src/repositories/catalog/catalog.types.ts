export interface CatalogCardEntityRecord {
  readonly id: string
  readonly canonicalKey: string
  readonly name: string
  readonly normalizedName: string
  readonly grade: number
  readonly cardType: string
  readonly nation: string
  readonly clan: string | null
  readonly race: string | null
  readonly triggerType: string | null
  readonly basePower: number | null
  readonly baseCritical: number | null
  readonly baseShield: number | null
  readonly keywords: readonly string[]
  readonly effectRefs: readonly string[]
}

export interface CatalogProductRecord {
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
}

export interface CatalogCardPrintingRecord {
  readonly id: string
  readonly printingKey: string
  readonly cardEntityId: string
  readonly collectorNumber: string
  readonly rarity: string
  readonly localeCode: string
  readonly regionCode: string | null
  readonly printedName: string | null
  readonly artVariant: string | null
  readonly isAlternateArt: boolean
  readonly isPromoVariant: boolean
  readonly product: CatalogProductRecord
}
