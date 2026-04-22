import type { CollectionProfileRepository } from './collection-application-support'
import {
  mapCollectionRepositoryFailure,
  resolveCollectionOwnerProfileId,
  type CollectionApplicationResult,
} from './collection-application-support'
import type {
  CollectionPreferenceKind,
  CollectionPreferenceRepository,
  StoredCollectionPrintingPreferenceItem,
} from './collection-preference-repository'

export interface CollectionPreferenceApplicationServices {
  readonly profilesRepository: CollectionProfileRepository
  readonly collectionsRepository: CollectionPreferenceRepository
}

export interface SetCollectionPrintingPreferenceCommand {
  readonly authUserId: string
  readonly printingId: string
  readonly preferenceKind: CollectionPreferenceKind
  readonly isPresent: boolean
}

export interface CollectionPreferenceMutationResultData {
  readonly printingId: string
  readonly preferenceKind: CollectionPreferenceKind
  readonly isPresent: boolean
}

export interface GetCollectionPrintingPreferenceStateCommand {
  readonly ownerProfileId: string
  readonly printingId: string
}

export interface CollectionPrintingPreferenceState {
  readonly wishlisted: boolean
  readonly favorited: boolean
}

export interface ListCollectionPreferenceOverviewCommand {
  readonly ownerProfileId: string
}

export interface CollectionPreferenceOverview {
  readonly wishlistItems: readonly StoredCollectionPrintingPreferenceItem[]
  readonly favoriteItems: readonly StoredCollectionPrintingPreferenceItem[]
  readonly totalWishlistItems: number
  readonly totalFavoriteItems: number
}

export async function setCollectionPrintingPreferenceUseCase(
  services: CollectionPreferenceApplicationServices,
  command: SetCollectionPrintingPreferenceCommand,
): Promise<
  CollectionApplicationResult<CollectionPreferenceMutationResultData>
> {
  const ownerProfileResult = await resolveCollectionOwnerProfileId(
    services,
    command.authUserId,
  )

  if (!ownerProfileResult.ok) {
    return ownerProfileResult
  }

  if (command.isPresent) {
    const upsertResult =
      await services.collectionsRepository.upsertCollectionPrintingPreference({
        ownerProfileId: ownerProfileResult.data,
        cardPrintingId: command.printingId,
        preferenceKind: command.preferenceKind,
      })

    if (!upsertResult.ok) {
      return mapCollectionRepositoryFailure(upsertResult.error.message)
    }
  } else {
    const removeResult =
      await services.collectionsRepository.removeCollectionPrintingPreference({
        ownerProfileId: ownerProfileResult.data,
        cardPrintingId: command.printingId,
        preferenceKind: command.preferenceKind,
      })

    if (!removeResult.ok) {
      return mapCollectionRepositoryFailure(removeResult.error.message)
    }
  }

  return {
    ok: true,
    data: {
      printingId: command.printingId,
      preferenceKind: command.preferenceKind,
      isPresent: command.isPresent,
    },
  }
}

export async function getCollectionPrintingPreferenceStateUseCase(
  services: Pick<
    CollectionPreferenceApplicationServices,
    'collectionsRepository'
  >,
  command: GetCollectionPrintingPreferenceStateCommand,
): Promise<CollectionApplicationResult<CollectionPrintingPreferenceState>> {
  const listResult =
    await services.collectionsRepository.listCollectionPrintingPreferencesByOwnerAndPrinting(
      command.ownerProfileId,
      command.printingId,
    )

  if (!listResult.ok) {
    return mapCollectionRepositoryFailure(listResult.error.message)
  }

  const kinds = new Set(listResult.data.map((item) => item.preferenceKind))

  return {
    ok: true,
    data: {
      wishlisted: kinds.has('wishlist'),
      favorited: kinds.has('favorite'),
    },
  }
}

export async function listCollectionPreferenceOverviewUseCase(
  services: Pick<
    CollectionPreferenceApplicationServices,
    'collectionsRepository'
  >,
  command: ListCollectionPreferenceOverviewCommand,
): Promise<CollectionApplicationResult<CollectionPreferenceOverview>> {
  const listResult =
    await services.collectionsRepository.listCollectionPrintingPreferenceItemsByOwner(
      command.ownerProfileId,
    )

  if (!listResult.ok) {
    return mapCollectionRepositoryFailure(listResult.error.message)
  }

  const wishlistItems = sortCollectionPreferenceItems(
    listResult.data.filter((item) => item.preferenceKind === 'wishlist'),
  )
  const favoriteItems = sortCollectionPreferenceItems(
    listResult.data.filter((item) => item.preferenceKind === 'favorite'),
  )

  return {
    ok: true,
    data: {
      wishlistItems,
      favoriteItems,
      totalWishlistItems: wishlistItems.length,
      totalFavoriteItems: favoriteItems.length,
    },
  }
}

function sortCollectionPreferenceItems(
  items: readonly StoredCollectionPrintingPreferenceItem[],
): readonly StoredCollectionPrintingPreferenceItem[] {
  return [...items].sort((left, right) => {
    return (
      right.updatedAt.localeCompare(left.updatedAt) ||
      right.createdAt.localeCompare(left.createdAt) ||
      left.cardPrintingId.localeCompare(right.cardPrintingId)
    )
  })
}
