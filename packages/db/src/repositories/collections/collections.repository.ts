import type { Database } from '../../generated/database.types'
import type { DbClient } from '../shared/client'
import { err, mapQueryError, ok, type RepositoryResult } from '../shared/result'

import {
  type CollectionInventoryWithRelationsRow,
  type CollectionPrintingPreferenceWithRelationsRow,
  mapCollectionInventoryItemRow,
  mapCollectionItemRow,
  mapCollectionPrintingPreferenceItemRow,
  mapCollectionPrintingPreferenceRow,
} from './collections.mappers'
import type {
  ChangeCollectionItemQuantityInput,
  CollectionInventoryItemRecord,
  CollectionItemRecord,
  CollectionPrintingPreferenceItemRecord,
  CollectionPrintingPreferenceRecord,
  RemoveCollectionPrintingPreferenceInput,
  RemoveCollectionItemInput,
  SetCollectionItemQuantityInput,
  UpsertCollectionPrintingPreferenceInput,
} from './collections.types'

type ChangeCollectionItemQuantityArgs =
  Database['user_data']['Functions']['change_collection_item_quantity']['Args']
type SetCollectionItemQuantityArgs =
  Database['user_data']['Functions']['set_collection_item_quantity']['Args']

const collectionItemSelect =
  'id, owner_profile_id, card_printing_id, quantity, created_at, updated_at'
const collectionPrintingPreferenceSelect =
  'id, owner_profile_id, card_printing_id, preference_kind, created_at, updated_at'
const collectionPrintingRelationSelect =
  'id, printing_key, collector_number, rarity, locale_code, region_code, printed_name, art_variant, is_alternate_art, is_promo_variant, product:products(id, canonical_key, official_code, name, product_category, product_kind, release_date, region_code), card:card_entities(id, canonical_key, name, grade, card_type, nation, clan, trigger_type)'

export interface CollectionsRepository {
  listCollectionItemsByOwner(
    ownerProfileId: string,
  ): Promise<RepositoryResult<readonly CollectionItemRecord[]>>
  listCollectionInventoryItemsByOwner(
    ownerProfileId: string,
  ): Promise<RepositoryResult<readonly CollectionInventoryItemRecord[]>>
  listCollectionPrintingPreferenceItemsByOwner(
    ownerProfileId: string,
  ): Promise<
    RepositoryResult<readonly CollectionPrintingPreferenceItemRecord[]>
  >
  listCollectionPrintingPreferencesByOwnerAndPrinting(
    ownerProfileId: string,
    cardPrintingId: string,
  ): Promise<RepositoryResult<readonly CollectionPrintingPreferenceRecord[]>>
  getCollectionItemByOwnerAndPrinting(
    ownerProfileId: string,
    cardPrintingId: string,
  ): Promise<RepositoryResult<CollectionItemRecord | null>>
  changeCollectionPrintingQuantity(
    input: ChangeCollectionItemQuantityInput,
  ): Promise<RepositoryResult<CollectionItemRecord | null>>
  setCollectionPrintingQuantity(
    input: SetCollectionItemQuantityInput,
  ): Promise<RepositoryResult<CollectionItemRecord | null>>
  removeCollectionPrinting(
    input: RemoveCollectionItemInput,
  ): Promise<RepositoryResult<void>>
  upsertCollectionPrintingPreference(
    input: UpsertCollectionPrintingPreferenceInput,
  ): Promise<RepositoryResult<CollectionPrintingPreferenceRecord>>
  removeCollectionPrintingPreference(
    input: RemoveCollectionPrintingPreferenceInput,
  ): Promise<RepositoryResult<void>>
}

export function createCollectionsRepository(
  client: DbClient,
): CollectionsRepository {
  return {
    async listCollectionItemsByOwner(ownerProfileId) {
      const { data, error } = await client
        .schema('user_data')
        .from('collection_items')
        .select(collectionItemSelect)
        .eq('owner_profile_id', ownerProfileId)
        .order('updated_at', { ascending: false })
        .order('id', { ascending: true })

      if (error) {
        return err(mapQueryError(error, 'Failed to load collection items.'))
      }

      return ok((data ?? []).map(mapCollectionItemRow))
    },

    async listCollectionInventoryItemsByOwner(ownerProfileId) {
      const query = client
        .schema('user_data')
        .from('collection_items')
        .select(collectionItemSelect)
        .eq('owner_profile_id', ownerProfileId)
        .order('updated_at', { ascending: false })
        .order('id', { ascending: true })

      const { data, error } = await query

      if (error) {
        return err(
          mapQueryError(error, 'Failed to load collection inventory items.'),
        )
      }

      const rows = (data ?? []) as unknown as readonly Omit<
        CollectionInventoryWithRelationsRow,
        'printing'
      >[]
      const rowsWithPrintings = await attachCollectionPrintingRelations(
        client,
        rows,
        'Failed to load collection inventory items.',
      )

      if (!rowsWithPrintings.ok) {
        return rowsWithPrintings
      }

      return ok(rowsWithPrintings.data.map(mapCollectionInventoryItemRow))
    },

    async listCollectionPrintingPreferenceItemsByOwner(ownerProfileId) {
      const query = client
        .schema('user_data')
        .from('collection_printing_preferences')
        .select(collectionPrintingPreferenceSelect)
        .eq('owner_profile_id', ownerProfileId)
        .order('preference_kind', { ascending: true })
        .order('updated_at', { ascending: false })
        .order('id', { ascending: true })

      const { data, error } = await query

      if (error) {
        return err(
          mapQueryError(
            error,
            'Failed to load collection printing preferences.',
          ),
        )
      }

      const rows = (data ?? []) as unknown as readonly Omit<
        CollectionPrintingPreferenceWithRelationsRow,
        'printing'
      >[]
      const rowsWithPrintings = await attachCollectionPrintingRelations(
        client,
        rows,
        'Failed to load collection printing preferences.',
      )

      if (!rowsWithPrintings.ok) {
        return rowsWithPrintings
      }

      return ok(
        rowsWithPrintings.data.map(mapCollectionPrintingPreferenceItemRow),
      )
    },

    async listCollectionPrintingPreferencesByOwnerAndPrinting(
      ownerProfileId,
      cardPrintingId,
    ) {
      const { data, error } = await client
        .schema('user_data')
        .from('collection_printing_preferences')
        .select(collectionPrintingPreferenceSelect)
        .eq('owner_profile_id', ownerProfileId)
        .eq('card_printing_id', cardPrintingId)
        .order('preference_kind', { ascending: true })

      if (error) {
        return err(
          mapQueryError(
            error,
            'Failed to load collection printing preferences for this printing.',
          ),
        )
      }

      return ok((data ?? []).map(mapCollectionPrintingPreferenceRow))
    },

    async getCollectionItemByOwnerAndPrinting(ownerProfileId, cardPrintingId) {
      const { data, error } = await client
        .schema('user_data')
        .from('collection_items')
        .select(collectionItemSelect)
        .eq('owner_profile_id', ownerProfileId)
        .eq('card_printing_id', cardPrintingId)
        .maybeSingle()

      if (error) {
        return err(mapQueryError(error, 'Failed to load collection item.'))
      }

      return ok(data ? mapCollectionItemRow(data) : null)
    },

    async changeCollectionPrintingQuantity(input) {
      const { data, error } = await client
        .schema('user_data')
        .rpc(
          'change_collection_item_quantity',
          buildChangeCollectionItemQuantityArgs(input),
        )
        .maybeSingle()

      if (error) {
        return err(
          mapCollectionMutationError(
            error,
            'Failed to update collection item quantity.',
          ),
        )
      }

      return ok(data ? mapCollectionItemRow(data) : null)
    },

    async setCollectionPrintingQuantity(input) {
      const { data, error } = await client
        .schema('user_data')
        .rpc(
          'set_collection_item_quantity',
          buildSetCollectionItemQuantityArgs(input),
        )
        .maybeSingle()

      if (error) {
        return err(
          mapCollectionMutationError(
            error,
            'Failed to set collection item quantity.',
          ),
        )
      }

      return ok(data ? mapCollectionItemRow(data) : null)
    },

    async removeCollectionPrinting(input) {
      const { error } = await client
        .schema('user_data')
        .from('collection_items')
        .delete()
        .eq('owner_profile_id', input.ownerProfileId)
        .eq('card_printing_id', input.cardPrintingId)

      if (error) {
        return err(mapQueryError(error, 'Failed to remove collection item.'))
      }

      return ok(undefined)
    },

    async upsertCollectionPrintingPreference(input) {
      const { data, error } = await client
        .schema('user_data')
        .from('collection_printing_preferences')
        .upsert(
          {
            owner_profile_id: input.ownerProfileId,
            card_printing_id: input.cardPrintingId,
            preference_kind: input.preferenceKind,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'owner_profile_id,card_printing_id,preference_kind',
          },
        )
        .select(collectionPrintingPreferenceSelect)
        .maybeSingle()

      if (error) {
        return err(
          mapCollectionPreferenceMutationError(
            error,
            'Failed to save collection printing preference.',
          ),
        )
      }

      if (!data) {
        return err(
          mapQueryError(
            {
              message:
                'Saving the collection printing preference did not return a row.',
            },
            'Failed to save collection printing preference.',
          ),
        )
      }

      return ok(mapCollectionPrintingPreferenceRow(data))
    },

    async removeCollectionPrintingPreference(input) {
      const { error } = await client
        .schema('user_data')
        .from('collection_printing_preferences')
        .delete()
        .eq('owner_profile_id', input.ownerProfileId)
        .eq('card_printing_id', input.cardPrintingId)
        .eq('preference_kind', input.preferenceKind)

      if (error) {
        return err(
          mapQueryError(
            error,
            'Failed to remove collection printing preference.',
          ),
        )
      }

      return ok(undefined)
    },
  }
}

async function attachCollectionPrintingRelations<
  Row extends { readonly card_printing_id: string },
>(
  client: DbClient,
  rows: readonly Row[],
  errorMessage: string,
): Promise<
  RepositoryResult<
    readonly (Row & {
      readonly printing: CollectionInventoryWithRelationsRow['printing']
    })[]
  >
> {
  const printingIds = Array.from(
    new Set(rows.map((row) => row.card_printing_id)),
  )

  if (printingIds.length === 0) {
    return ok(rows.map((row) => ({ ...row, printing: null })))
  }

  const { data, error } = await client
    .schema('catalog')
    .from('card_printings')
    .select(collectionPrintingRelationSelect)
    .in('id', printingIds)

  if (error) {
    return err(mapQueryError(error, errorMessage))
  }

  const printingsById = new Map(
    (
      (data ?? []) as unknown as readonly NonNullable<
        CollectionInventoryWithRelationsRow['printing']
      >[]
    ).map((printing) => [printing.id, printing]),
  )

  return ok(
    rows.map((row) => ({
      ...row,
      printing: printingsById.get(row.card_printing_id) ?? null,
    })),
  )
}

function buildChangeCollectionItemQuantityArgs(
  input: ChangeCollectionItemQuantityInput,
): ChangeCollectionItemQuantityArgs {
  return {
    change_owner_profile_id: input.ownerProfileId,
    change_card_printing_id: input.cardPrintingId,
    change_quantity_delta: input.quantityDelta,
  }
}

function buildSetCollectionItemQuantityArgs(
  input: SetCollectionItemQuantityInput,
): SetCollectionItemQuantityArgs {
  return {
    set_owner_profile_id: input.ownerProfileId,
    set_card_printing_id: input.cardPrintingId,
    set_quantity: input.quantity,
  }
}

function mapCollectionMutationError(
  error: {
    readonly code?: string | null
    readonly message: string
    readonly details?: string | null
  },
  fallbackMessage: string,
) {
  if (error.code === '23503') {
    return {
      code: 'query-failed' as const,
      message:
        'Failed to update collection because the requested printing does not exist in the published catalog.',
      details: error.details ?? error.message,
    }
  }

  if (error.code === 'P0002') {
    return {
      code: 'query-failed' as const,
      message:
        'Failed to update collection because this printing is not currently owned.',
      details: error.details ?? error.message,
    }
  }

  if (error.code === '22023' || error.code === '23514') {
    return {
      code: 'query-failed' as const,
      message:
        'Failed to update collection because the requested quantity is invalid.',
      details: error.details ?? error.message,
    }
  }

  if (error.code === '42501') {
    return {
      code: 'query-failed' as const,
      message:
        'Failed to update collection because ownership does not match the current profile.',
      details: error.details ?? error.message,
    }
  }

  return mapQueryError(error, fallbackMessage)
}

function mapCollectionPreferenceMutationError(
  error: {
    readonly code?: string | null
    readonly message: string
    readonly details?: string | null
  },
  fallbackMessage: string,
) {
  if (error.code === '23503') {
    return {
      code: 'query-failed' as const,
      message:
        'Failed to update collection preference because the requested printing does not exist in the published catalog.',
      details: error.details ?? error.message,
    }
  }

  if (error.code === '42501') {
    return {
      code: 'query-failed' as const,
      message:
        'Failed to update collection preference because ownership does not match the current profile.',
      details: error.details ?? error.message,
    }
  }

  if (error.code === '23514') {
    return {
      code: 'query-failed' as const,
      message:
        'Failed to update collection preference because the requested preference kind is invalid.',
      details: error.details ?? error.message,
    }
  }

  return mapQueryError(error, fallbackMessage)
}
