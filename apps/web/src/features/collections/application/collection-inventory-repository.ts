import type { CollectionInventoryItemRecord } from '@web-vg/db/repositories/collections'

export type StoredCollectionInventoryItem = CollectionInventoryItemRecord

export type CollectionInventoryRepositoryResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: {
        readonly message: string
      }
    }

export interface CollectionInventoryRepository {
  listCollectionInventoryItemsByOwner(
    ownerProfileId: string,
  ): Promise<
    CollectionInventoryRepositoryResult<
      readonly StoredCollectionInventoryItem[]
    >
  >
}
