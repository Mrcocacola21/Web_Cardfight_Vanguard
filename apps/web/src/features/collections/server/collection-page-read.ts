import type { CollectionPageQuery } from '@/features/collections/collection-page-query'
import { listCollectionInventoryViewUseCase } from '@/features/collections/application/collection-inventory-use-cases'
import { listCollectionPreferenceOverviewUseCase } from '@/features/collections/application/collection-preference-use-cases'
import { createCollectionInventoryRepository } from '@/features/collections/infrastructure/collection-inventory-repository'
import { createCollectionPreferenceRepository } from '@/features/collections/infrastructure/collection-preference-repository'
import { getCurrentProfileState } from '@/features/profiles/server/profile-read'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { StoredCollectionInventoryItem } from '@/features/collections/application/collection-inventory-repository'
import type { StoredCollectionPrintingPreferenceItem } from '@/features/collections/application/collection-preference-repository'

export type CollectionPageState =
  | {
      readonly kind: 'ready'
      readonly viewerDisplayName: string
      readonly query: CollectionPageQuery
      readonly totalOwnedPrintings: number
      readonly totalOwnedCopies: number
      readonly items: readonly StoredCollectionInventoryItem[]
      readonly totalWishlistItems: number
      readonly totalFavoriteItems: number
      readonly wishlistItems: readonly StoredCollectionPrintingPreferenceItem[]
      readonly favoriteItems: readonly StoredCollectionPrintingPreferenceItem[]
    }
  | {
      readonly kind: 'profile-unavailable'
    }
  | {
      readonly kind: 'error'
      readonly message: string
    }

export async function getCollectionPageState(
  query: CollectionPageQuery,
): Promise<CollectionPageState> {
  const currentProfileState = await getCurrentProfileState()

  if (currentProfileState.kind === 'error') {
    return {
      kind: 'error',
      message: currentProfileState.message,
    }
  }

  if (currentProfileState.kind === 'signed-out') {
    return {
      kind: 'error',
      message: 'Collection inventory requires an authenticated session.',
    }
  }

  if (!currentProfileState.profile) {
    return {
      kind: 'profile-unavailable',
    }
  }

  const client = await createSupabaseServerClient()
  const [inventoryResult, preferenceResult] = await Promise.all([
    listCollectionInventoryViewUseCase(
      {
        repository: createCollectionInventoryRepository(client),
      },
      {
        ownerProfileId: currentProfileState.profile.id,
        query,
      },
    ),
    listCollectionPreferenceOverviewUseCase(
      {
        collectionsRepository: createCollectionPreferenceRepository(client),
      },
      {
        ownerProfileId: currentProfileState.profile.id,
      },
    ),
  ])

  if (!inventoryResult.ok) {
    return {
      kind: 'error',
      message: inventoryResult.error.message,
    }
  }

  if (!preferenceResult.ok) {
    return {
      kind: 'error',
      message: preferenceResult.error.message,
    }
  }

  return {
    kind: 'ready',
    viewerDisplayName: currentProfileState.profile.displayName,
    query,
    totalOwnedPrintings: inventoryResult.data.totalOwnedPrintings,
    totalOwnedCopies: inventoryResult.data.totalOwnedCopies,
    items: inventoryResult.data.items,
    totalWishlistItems: preferenceResult.data.totalWishlistItems,
    totalFavoriteItems: preferenceResult.data.totalFavoriteItems,
    wishlistItems: preferenceResult.data.wishlistItems,
    favoriteItems: preferenceResult.data.favoriteItems,
  }
}
