import type {
  CollectionPageQuery,
  CollectionSortMode,
} from '@/features/collections/collection-page-query'

import type {
  CollectionInventoryRepository,
  StoredCollectionInventoryItem,
} from './collection-inventory-repository'

export interface CollectionInventoryApplicationServices {
  readonly repository: CollectionInventoryRepository
}

export type CollectionInventoryApplicationResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: {
        readonly code: 'repository-failed'
        readonly message: string
      }
    }

export interface CollectionInventoryListView {
  readonly totalOwnedPrintings: number
  readonly totalOwnedCopies: number
  readonly items: readonly StoredCollectionInventoryItem[]
}

export interface ListCollectionInventoryViewCommand {
  readonly ownerProfileId: string
  readonly query: CollectionPageQuery
}

export async function listCollectionInventoryViewUseCase(
  services: CollectionInventoryApplicationServices,
  command: ListCollectionInventoryViewCommand,
): Promise<CollectionInventoryApplicationResult<CollectionInventoryListView>> {
  const listResult =
    await services.repository.listCollectionInventoryItemsByOwner(
      command.ownerProfileId,
    )

  if (!listResult.ok) {
    return {
      ok: false,
      error: {
        code: 'repository-failed',
        message: listResult.error.message,
      },
    }
  }

  return {
    ok: true,
    data: {
      totalOwnedPrintings: listResult.data.length,
      totalOwnedCopies: listResult.data.reduce(
        (sum, item) => sum + item.quantity,
        0,
      ),
      items: sortCollectionInventoryItems(listResult.data, command.query.sort),
    },
  }
}

function sortCollectionInventoryItems(
  items: readonly StoredCollectionInventoryItem[],
  sortMode: CollectionSortMode,
): readonly StoredCollectionInventoryItem[] {
  return [...items].sort((left, right) => {
    switch (sortMode) {
      case 'name':
        return (
          compareText(
            getCollectionInventoryItemDisplayName(left),
            getCollectionInventoryItemDisplayName(right),
          ) ||
          compareText(
            getCollectionInventoryItemProductSortKey(left),
            getCollectionInventoryItemProductSortKey(right),
          ) ||
          compareText(left.cardPrintingId, right.cardPrintingId)
        )
      case 'product':
        return (
          compareText(
            getCollectionInventoryItemProductSortKey(left),
            getCollectionInventoryItemProductSortKey(right),
          ) ||
          compareText(
            getCollectionInventoryItemDisplayName(left),
            getCollectionInventoryItemDisplayName(right),
          ) ||
          compareText(left.cardPrintingId, right.cardPrintingId)
        )
      case 'quantity':
        return (
          right.quantity - left.quantity ||
          compareText(
            getCollectionInventoryItemDisplayName(left),
            getCollectionInventoryItemDisplayName(right),
          ) ||
          compareText(left.cardPrintingId, right.cardPrintingId)
        )
      case 'recent':
      default:
        return (
          right.updatedAt.localeCompare(left.updatedAt) ||
          right.createdAt.localeCompare(left.createdAt) ||
          compareText(left.cardPrintingId, right.cardPrintingId)
        )
    }
  })
}

function getCollectionInventoryItemDisplayName(
  item: StoredCollectionInventoryItem,
) {
  return (
    item.printing?.printedName ??
    item.printing?.card?.name ??
    item.cardPrintingId
  ).toLocaleLowerCase()
}

function getCollectionInventoryItemProductSortKey(
  item: StoredCollectionInventoryItem,
) {
  return [
    item.printing?.product?.releaseDate ?? '9999-99-99',
    item.printing?.product?.officialCode ?? 'zzzz',
    item.printing?.collectorNumber ?? 'zzzz',
    item.cardPrintingId,
  ].join('|')
}

function compareText(left: string, right: string) {
  return left.localeCompare(right)
}
