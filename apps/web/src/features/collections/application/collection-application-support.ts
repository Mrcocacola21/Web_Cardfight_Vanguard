import type { CollectionsRepository } from '@web-vg/db/repositories/collections'
import type { ProfilesRepository } from '@web-vg/db/repositories/profiles'

export type CollectionApplicationErrorCode =
  | 'profile-required'
  | 'collection-item-unavailable'
  | 'invalid-quantity'
  | 'repository-failed'
  | 'mutation-failed'

export interface CollectionApplicationError {
  readonly code: CollectionApplicationErrorCode
  readonly message: string
}

export type CollectionApplicationResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: CollectionApplicationError
    }

export type CollectionProfileRepository = Pick<
  ProfilesRepository,
  'getProfileByAuthUserId'
>

export type CollectionWriteRepository = Pick<
  CollectionsRepository,
  | 'changeCollectionPrintingQuantity'
  | 'getCollectionItemByOwnerAndPrinting'
  | 'removeCollectionPrinting'
  | 'setCollectionPrintingQuantity'
>

export interface CollectionApplicationServices {
  readonly profilesRepository: CollectionProfileRepository
  readonly collectionsRepository: CollectionWriteRepository
}

interface CollectionProfileResolutionServices {
  readonly profilesRepository: CollectionProfileRepository
}

export function createCollectionApplicationError(
  code: CollectionApplicationErrorCode,
  message: string,
): CollectionApplicationResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  }
}

export function mapCollectionRepositoryFailure(
  message: string,
): CollectionApplicationResult<never> {
  return createCollectionApplicationError('repository-failed', message)
}

export async function resolveCollectionOwnerProfileId(
  services: CollectionProfileResolutionServices,
  authUserId: string,
): Promise<CollectionApplicationResult<string>> {
  const profileResult =
    await services.profilesRepository.getProfileByAuthUserId(authUserId)

  if (!profileResult.ok) {
    return mapCollectionRepositoryFailure(profileResult.error.message)
  }

  if (!profileResult.data) {
    return createCollectionApplicationError(
      'profile-required',
      'A persisted profile row is required before collection actions can run.',
    )
  }

  return {
    ok: true,
    data: profileResult.data.id,
  }
}
