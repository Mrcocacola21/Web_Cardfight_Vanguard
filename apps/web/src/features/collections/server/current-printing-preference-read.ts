import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentProfileState } from '@/features/profiles/server/profile-read'
import { createCollectionPreferenceRepository } from '@/features/collections/infrastructure/collection-preference-repository'
import { getCollectionPrintingPreferenceStateUseCase } from '@/features/collections/application/collection-preference-use-cases'

export type CurrentPrintingPreferenceState =
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
      readonly wishlisted: boolean
      readonly favorited: boolean
    }

export async function getCurrentPrintingPreferenceState(
  printingId: string,
): Promise<CurrentPrintingPreferenceState> {
  const currentProfileState = await getCurrentProfileState()

  if (currentProfileState.kind === 'signed-out') {
    return {
      kind: 'signed-out',
    }
  }

  if (currentProfileState.kind === 'error') {
    return {
      kind: 'error',
      message: currentProfileState.message,
    }
  }

  if (!currentProfileState.profile) {
    return {
      kind: 'profile-required',
    }
  }

  const client = await createSupabaseServerClient()
  const result = await getCollectionPrintingPreferenceStateUseCase(
    {
      collectionsRepository: createCollectionPreferenceRepository(client),
    },
    {
      ownerProfileId: currentProfileState.profile.id,
      printingId,
    },
  )

  if (!result.ok) {
    return {
      kind: 'error',
      message: result.error.message,
    }
  }

  return {
    kind: 'ready',
    ownerProfileId: currentProfileState.profile.id,
    wishlisted: result.data.wishlisted,
    favorited: result.data.favorited,
  }
}
