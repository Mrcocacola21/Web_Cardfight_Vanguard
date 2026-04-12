import type {
  CatalogCardPrintingDetailRecord,
  CatalogCardPrintingRecord,
} from '@web-vg/db/repositories/catalog'

export interface CatalogPrintingDetailViewModel {
  readonly printing: CatalogCardPrintingDetailRecord
  readonly siblingPrintings: readonly CatalogCardPrintingRecord[]
}
