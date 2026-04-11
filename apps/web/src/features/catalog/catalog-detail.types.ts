import type {
  CatalogCardEntityRecord,
  CatalogCardLegalityRecord,
  CatalogCardPrintingRecord,
} from '@web-vg/db'

export interface CatalogCardRulesRecord {
  readonly effectReferences: readonly string[]
  readonly hasPublishedOracleText: boolean
}

export interface CatalogRelatedProductRecord {
  readonly id: string
  readonly canonicalKey: string
  readonly officialCode: string
  readonly name: string
  readonly productCategory: string
  readonly productKind: string
  readonly releaseDate: string
  readonly regionCode: string | null
  readonly printingCount: number
  readonly rarities: readonly string[]
  readonly localeCodes: readonly string[]
}

export interface CatalogCardDetailViewModel {
  readonly card: CatalogCardEntityRecord
  readonly rules: CatalogCardRulesRecord
  readonly printings: readonly CatalogCardPrintingRecord[]
  readonly legality: CatalogCardLegalityRecord
  readonly relatedProducts: readonly CatalogRelatedProductRecord[]
}
