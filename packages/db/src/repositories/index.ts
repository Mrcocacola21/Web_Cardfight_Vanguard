export type { DbClient } from './shared/client'
export type {
  RepositoryError,
  RepositoryErrorCode,
  RepositoryResult,
} from './shared/result'

export { createImporterRepository, type ImporterRepository } from './importer'
export type {
  CreateImportJobInput,
  CardPrintingNormalizationResultRecord,
  CardPrintingNormalizationStatus,
  CatalogCardEntityNormalizationRecord,
  FinalizeImportJobInput,
  ImportJobRecord,
  ImportJobStage,
  ImportJobStatus,
  ImportSourceRecord,
  ManualReviewItemRecord,
  ManualReviewReason,
  ManualReviewResolutionKind,
  ManualReviewStatus,
  MarkImportJobFailedInput,
  MarkImportJobRunningInput,
  RawCardPrintingRecord,
  RawProductRecord,
  UpsertImportSourceInput,
  UpdateManualReviewItemStatusInput,
  UpdateImportJobNormalizationStateInput,
  UpdateImportJobRawRecordCountInput,
  UpsertManualReviewItemInput,
  UpsertCardPrintingNormalizationResultInput,
  UpsertRawCardPrintingRecordInput,
  UpsertRawProductRecordInput,
} from './importer'

export { createCatalogRepository, type CatalogRepository } from './catalog'
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
  CatalogProductIdentityLookup,
  CatalogPublicationRawProductSourceRecord,
  CatalogPrintingPublicationSourceRecord,
  CatalogPublishedProductRecord,
  CatalogPublishedPrintingRecord,
  CatalogProductPrintingCardRecord,
  CatalogProductPrintingRecord,
  CatalogProductRecord,
  UpsertCatalogPublishedProductInput,
  UpsertCatalogPublishedPrintingInput,
} from './catalog'
export {
  createCatalogPublicationRepository,
  type CatalogPublicationRepository,
} from './catalog'

export { createDecksRepository, type DecksRepository } from './decks'
export type {
  CreateDeckCardInput,
  CreateDeckInput,
  DeckCardRecord,
  DeckDetailCardRecord,
  DeckDetailRecord,
  DeckDetailSectionRecord,
  DeckDetailVersionRecord,
  DeckFormatRecord,
  DeckListItemRecord,
  DeckRecord,
  DeckSectionCountsRecord,
  DeckSectionKey,
  DeckVersionRecord,
  SaveDeckInput,
} from './decks'

export { createProfilesRepository, type ProfilesRepository } from './profiles'
export type {
  EnsureProfileByAuthUserIdInput,
  ProfileRecord,
  ProfileVisibility,
  PublicProfileRecord,
  UpsertProfileByAuthUserIdInput,
} from './profiles'
