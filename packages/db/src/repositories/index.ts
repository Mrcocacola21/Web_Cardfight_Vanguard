export type { DbClient } from './shared/client'
export type {
  RepositoryError,
  RepositoryErrorCode,
  RepositoryResult,
} from './shared/result'

export {
  createCatalogRepository,
  createCatalogPublicationRepository,
} from './catalog'
export { createCollectionsRepository } from './collections'
export { createDecksRepository } from './decks'
export { createDbPersistedMatchSessionStorage } from './gameplay'
export { createImporterRepository } from './importer'
export {
  createMatchesRepository,
  createMatchLobbyRepository,
  type MatchLobbyRepository,
} from './matches'
export { createProfilesRepository } from './profiles'
export { createSocialRepository } from './social'
