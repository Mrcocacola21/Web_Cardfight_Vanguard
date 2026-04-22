import { createCollectionsRepository, type DbClient } from '@web-vg/db'

import type {
  CollectionInventoryRepository,
  CollectionInventoryRepositoryResult,
  StoredCollectionInventoryItem,
} from '@/features/collections/application/collection-inventory-repository'

export function createCollectionInventoryRepository(
  client: DbClient,
): CollectionInventoryRepository {
  const collectionsRepository = createCollectionsRepository(client)

  return {
    async listCollectionInventoryItemsByOwner(
      ownerProfileId,
    ): Promise<
      CollectionInventoryRepositoryResult<
        readonly StoredCollectionInventoryItem[]
      >
    > {
      const result =
        await collectionsRepository.listCollectionInventoryItemsByOwner(
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
  }
}
