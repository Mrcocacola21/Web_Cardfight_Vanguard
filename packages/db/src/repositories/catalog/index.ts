// Catalog read-side and publication write-side stay adjacent here for discoverability,
// but they serve different boundaries and should not be interchanged in app/importer flows.
export {
  createCatalogPublicationRepository,
  type CatalogPublicationRepository,
} from './catalog.publication.repository'
export type {
  CatalogProductIdentityLookup,
  CatalogPublicationRawProductSourceRecord,
  CatalogPrintingPublicationSourceRecord,
  CatalogPublishedProductRecord,
  CatalogPublishedPrintingRecord,
  UpsertCatalogPublishedProductInput,
  UpsertCatalogPublishedPrintingInput,
} from './catalog.publication.repository'
export {
  createCatalogRepository,
  type CatalogRepository,
} from './catalog.repository'
export type {
  CatalogCardChoiceRestrictionRecord,
  CatalogCardEntityRecord,
  CatalogCardEntityListQuery,
  CatalogCardEntityListRecord,
  CatalogCardEligibilityRecord,
  CatalogCardLegalityRecord,
  CatalogCardPrintingDetailRecord,
  CatalogCardPrintingRecord,
  CatalogKeywordTagCategory,
  CatalogKeywordTagRecord,
  CatalogCardRestrictionRecord,
  CatalogProductDetailRecord,
  CatalogProductFamilyRecord,
  CatalogProductPrintingCardRecord,
  CatalogProductPrintingRecord,
  CatalogProductRecord,
} from './catalog.types'
