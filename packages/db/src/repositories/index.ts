export type { DbClient } from './shared/client'
export type {
  RepositoryError,
  RepositoryErrorCode,
  RepositoryResult,
} from './shared/result'

export { createCatalogRepository, type CatalogRepository } from './catalog'
export type {
  CatalogCardEntityRecord,
  CatalogCardPrintingRecord,
  CatalogProductRecord,
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
} from './decks'

export { createProfilesRepository, type ProfilesRepository } from './profiles'
export type {
  EnsureProfileByAuthUserIdInput,
  ProfileRecord,
  ProfileVisibility,
  PublicProfileRecord,
  UpsertProfileByAuthUserIdInput,
} from './profiles'
