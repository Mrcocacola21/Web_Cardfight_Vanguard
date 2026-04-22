import { createCollectionsRepository, type DbClient } from '@web-vg/db'

import type {
  CollectionPreferenceRepository,
  CollectionPreferenceRepositoryResult,
  StoredCollectionPrintingPreference,
  StoredCollectionPrintingPreferenceItem,
} from '@/features/collections/application/collection-preference-repository'

export function createCollectionPreferenceRepository(
  client: DbClient,
): CollectionPreferenceRepository {
  const collectionsRepository = createCollectionsRepository(client)

  return {
    async listCollectionPrintingPreferenceItemsByOwner(
      ownerProfileId,
    ): Promise<
      CollectionPreferenceRepositoryResult<
        readonly StoredCollectionPrintingPreferenceItem[]
      >
    > {
      const result =
        await collectionsRepository.listCollectionPrintingPreferenceItemsByOwner(
          ownerProfileId,
        )

      if (!result.ok) {
        return {
          ok: false,
          error: {
            message: result.error.message,
          },
        }
      }

      return result
    },

    async listCollectionPrintingPreferencesByOwnerAndPrinting(
      ownerProfileId,
      cardPrintingId,
    ): Promise<
      CollectionPreferenceRepositoryResult<
        readonly StoredCollectionPrintingPreference[]
      >
    > {
      const result =
        await collectionsRepository.listCollectionPrintingPreferencesByOwnerAndPrinting(
          ownerProfileId,
          cardPrintingId,
        )

      if (!result.ok) {
        return {
          ok: false,
          error: {
            message: result.error.message,
          },
        }
      }

      return result
    },

    async upsertCollectionPrintingPreference(input) {
      const result =
        await collectionsRepository.upsertCollectionPrintingPreference(input)

      if (!result.ok) {
        return {
          ok: false,
          error: {
            message: result.error.message,
          },
        }
      }

      return result
    },

    async removeCollectionPrintingPreference(input) {
      const result =
        await collectionsRepository.removeCollectionPrintingPreference(input)

      if (!result.ok) {
        return {
          ok: false,
          error: {
            message: result.error.message,
          },
        }
      }

      return result
    },
  }
}
