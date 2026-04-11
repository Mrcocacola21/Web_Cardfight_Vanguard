import type {
  CatalogCardPrintingDetailRecord,
  CatalogCardPrintingRecord,
} from '@web-vg/db'

export interface CatalogPrintingDetailViewModel {
  readonly printing: CatalogCardPrintingDetailRecord
  readonly siblingPrintings: readonly CatalogCardPrintingRecord[]
}
