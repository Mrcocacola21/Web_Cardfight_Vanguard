import {
  createCollectionsRepository,
  createProfilesRepository,
} from '@web-vg/db'
import type { CollectionItemRecord } from '@web-vg/db/repositories/collections'

import { getCurrentAuthState } from '@/features/auth/server/auth-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type CurrentPrintingCollectionState =
  | {
      readonly kind: 'signed-out'
    }
  | {
      readonly kind: 'profile-required'
    }
  | {
      readonly kind: 'error'
      readonly message: string
    }
  | {
      readonly kind: 'ready'
      readonly ownerProfileId: string
      readonly item: CollectionItemRecord | null
    }

export async function getCurrentPrintingCollectionState(
  printingId: string,
): Promise<CurrentPrintingCollectionState> {
  const client = await createSupabaseServerClient()
  const authState = await getCurrentAuthState({ client })

  if (authState.kind === 'signed-out') {
    return {
      kind: 'signed-out',
    }
  }

  if (authState.kind === 'error') {
    return {
      kind: 'error',
      message: authState.message,
    }
  }

  const profilesRepository = createProfilesRepository(client)
  const profileResult = await profilesRepository.getProfileByAuthUserId(
    authState.user.id,
  )

  if (!profileResult.ok) {
    return {
      kind: 'error',
      message: profileResult.error.message,
    }
  }

  if (!profileResult.data) {
    return {
      kind: 'profile-required',
    }
  }

  const collectionsRepository = createCollectionsRepository(client)
  const collectionItemResult =
    await collectionsRepository.getCollectionItemByOwnerAndPrinting(
      profileResult.data.id,
      printingId,
    )

  if (!collectionItemResult.ok) {
    return {
      kind: 'error',
      message: collectionItemResult.error.message,
    }
  }

  return {
    kind: 'ready',
    ownerProfileId: profileResult.data.id,
    item: collectionItemResult.data,
  }
}
