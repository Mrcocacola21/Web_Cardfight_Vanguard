import type {
  CatalogProductDetailRecord,
  CatalogProductPrintingRecord,
} from '@web-vg/db/repositories/catalog'

export interface CatalogProductSummaryRecord {
  readonly printingCount: number
  readonly uniqueCardCount: number
  readonly promoPrintingCount: number
  readonly alternateArtPrintingCount: number
  readonly localeCodes: readonly string[]
  readonly rarities: readonly string[]
}

export interface CatalogProductDetailViewModel {
  readonly product: CatalogProductDetailRecord
  readonly printings: readonly CatalogProductPrintingRecord[]
  readonly summary: CatalogProductSummaryRecord
}
