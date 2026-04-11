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

export type CatalogKeywordTagCategory =
  | 'keyword'
  | 'mechanic'
  | 'trigger'
  | 'marker'

export interface CatalogKeywordTagRecord {
  readonly id: string
  readonly displayName: string
  readonly category: CatalogKeywordTagCategory
  readonly description: string | null
  readonly sortOrder: number
}

export type CatalogCardEntityListSort = 'relevance' | 'name-asc' | 'grade-asc'

export interface CatalogCardEntityListQuery {
  readonly searchText: string | null
  readonly filters: {
    readonly formatIds: readonly string[]
    readonly eras: readonly string[]
    readonly nations: readonly string[]
    readonly clans: readonly string[]
    readonly cardTypes: readonly string[]
    readonly triggerTypes: readonly string[]
    readonly rarities: readonly string[]
    readonly productKeys: readonly string[]
  }
  readonly sort: CatalogCardEntityListSort
  readonly page: number
  readonly pageSize: number
}

export interface CatalogCardEntityListRecord {
  readonly items: readonly CatalogCardEntityRecord[]
  readonly totalCount: number
  readonly page: number
  readonly pageSize: number
  readonly pageCount: number
  readonly hasPreviousPage: boolean
  readonly hasNextPage: boolean
}

export type CatalogCardEligibilityState = 'allowed' | 'disallowed'

export interface CatalogCardEligibilityRecord {
  readonly formatId: string
  readonly formatName: string
  readonly ruleProfileId: string
  readonly ruleProfileName: string
  readonly eligibilityState: CatalogCardEligibilityState
  readonly rationale: string | null
}

export interface CatalogCardRestrictionRecord {
  readonly formatId: string
  readonly formatName: string
  readonly ruleProfileId: string
  readonly ruleProfileName: string
  readonly restrictionType: string
  readonly maxCopies: number | null
  readonly note: string | null
  readonly sourceReference: string | null
  readonly effectiveFrom: string
  readonly versionLabel: string
}

export interface CatalogCardChoiceRestrictionRecord {
  readonly formatId: string
  readonly formatName: string
  readonly ruleProfileId: string
  readonly ruleProfileName: string
  readonly allowedChoices: number
  readonly note: string | null
  readonly sourceReference: string | null
  readonly effectiveFrom: string
  readonly versionLabel: string
}

export interface CatalogCardLegalityRecord {
  readonly eligibilityOverrides: readonly CatalogCardEligibilityRecord[]
  readonly restrictions: readonly CatalogCardRestrictionRecord[]
  readonly choiceRestrictions: readonly CatalogCardChoiceRestrictionRecord[]
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

export interface CatalogProductFamilyRecord {
  readonly id: string
  readonly displayName: string
  readonly lineage: string
}

export interface CatalogProductDetailRecord extends CatalogProductRecord {
  readonly family: CatalogProductFamilyRecord
}

export interface CatalogProductPrintingCardRecord {
  readonly id: string
  readonly canonicalKey: string
  readonly name: string
  readonly grade: number
  readonly cardType: string
  readonly triggerType: string | null
  readonly nation: string
  readonly clan: string | null
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

export interface CatalogCardPrintingDetailRecord extends CatalogCardPrintingRecord {
  readonly card: CatalogCardEntityRecord
}

export interface CatalogProductPrintingRecord {
  readonly id: string
  readonly printingKey: string
  readonly collectorNumber: string
  readonly rarity: string
  readonly localeCode: string
  readonly regionCode: string | null
  readonly printedName: string | null
  readonly artVariant: string | null
  readonly isAlternateArt: boolean
  readonly isPromoVariant: boolean
  readonly card: CatalogProductPrintingCardRecord
}
