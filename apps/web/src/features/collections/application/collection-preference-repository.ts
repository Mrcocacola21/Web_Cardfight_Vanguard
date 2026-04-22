import type {
  CollectionPreferenceKind,
  CollectionPrintingPreferenceItemRecord,
  CollectionPrintingPreferenceRecord,
  RemoveCollectionPrintingPreferenceInput,
  UpsertCollectionPrintingPreferenceInput,
} from '@web-vg/db/repositories/collections'

export type { CollectionPreferenceKind }

export type StoredCollectionPrintingPreference =
  CollectionPrintingPreferenceRecord
export type StoredCollectionPrintingPreferenceItem =
  CollectionPrintingPreferenceItemRecord

export type CollectionPreferenceRepositoryResult<TData> =
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

export interface CollectionPreferenceRepository {
  listCollectionPrintingPreferenceItemsByOwner(
    ownerProfileId: string,
  ): Promise<
    CollectionPreferenceRepositoryResult<
      readonly StoredCollectionPrintingPreferenceItem[]
    >
  >
  listCollectionPrintingPreferencesByOwnerAndPrinting(
    ownerProfileId: string,
    cardPrintingId: string,
  ): Promise<
    CollectionPreferenceRepositoryResult<
      readonly StoredCollectionPrintingPreference[]
    >
  >
  upsertCollectionPrintingPreference(
    input: UpsertCollectionPrintingPreferenceInput,
  ): Promise<
    CollectionPreferenceRepositoryResult<StoredCollectionPrintingPreference>
  >
  removeCollectionPrintingPreference(
    input: RemoveCollectionPrintingPreferenceInput,
  ): Promise<CollectionPreferenceRepositoryResult<void>>
}

export const collectionPreferenceKinds = [
  'wishlist',
  'favorite',
] as const satisfies readonly CollectionPreferenceKind[]
