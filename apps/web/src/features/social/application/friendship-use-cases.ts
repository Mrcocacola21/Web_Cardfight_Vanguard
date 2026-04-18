import {
  createFriendshipApplicationError,
  mapFriendshipRepositoryFailure,
  type FriendshipApplicationResult,
  type FriendshipApplicationServices,
} from './friendship-application-support'

export interface RemoveFriendCommand {
  readonly isAuthenticated: boolean
  readonly actorProfileId: string | null
  readonly targetProfileId: string
}

export type RemoveFriendResult = FriendshipApplicationResult<{
  readonly removedFriendshipId: string
  readonly targetProfileId: string
}>

export async function removeFriendUseCase(
  services: FriendshipApplicationServices,
  command: RemoveFriendCommand,
): Promise<RemoveFriendResult> {
  if (!command.isAuthenticated) {
    return createFriendshipApplicationError(
      'unauthorized',
      'You need to sign in before removing a friend.',
    )
  }

  if (!command.actorProfileId) {
    return createFriendshipApplicationError(
      'actor-profile-unavailable',
      'Your profile is not ready for friendship changes yet.',
    )
  }

  if (command.actorProfileId === command.targetProfileId) {
    return createFriendshipApplicationError(
      'invalid-target',
      'You cannot remove yourself as a friend.',
    )
  }

  const friendshipResult =
    await services.socialRepository.getFriendshipBetweenProfiles(
      command.actorProfileId,
      command.targetProfileId,
    )

  if (!friendshipResult.ok) {
    return mapFriendshipRepositoryFailure(friendshipResult.error.message)
  }

  if (!friendshipResult.data) {
    return createFriendshipApplicationError(
      'friendship-not-found',
      'This friendship is no longer active.',
    )
  }

  const removeResult = await services.socialRepository.removeFriendship({
    friendshipId: friendshipResult.data.id,
    firstProfileId: friendshipResult.data.firstProfileId,
    secondProfileId: friendshipResult.data.secondProfileId,
  })

  if (!removeResult.ok) {
    return mapFriendshipRepositoryFailure(removeResult.error.message)
  }

  if (!removeResult.data) {
    return resolveMissingFriendshipAfterRemovalAttempt(services, command)
  }

  return {
    ok: true,
    data: {
      removedFriendshipId: removeResult.data.id,
      targetProfileId: command.targetProfileId,
    },
  }
}

async function resolveMissingFriendshipAfterRemovalAttempt(
  services: FriendshipApplicationServices,
  command: RemoveFriendCommand,
): Promise<FriendshipApplicationResult<never>> {
  const friendshipResult =
    await services.socialRepository.getFriendshipBetweenProfiles(
      command.actorProfileId ?? '',
      command.targetProfileId,
    )

  if (!friendshipResult.ok) {
    return mapFriendshipRepositoryFailure(friendshipResult.error.message)
  }

  if (!friendshipResult.data) {
    return createFriendshipApplicationError(
      'friendship-not-found',
      'This friendship is no longer active.',
    )
  }

  return createFriendshipApplicationError(
    'repository-failed',
    'The friendship could not be removed.',
  )
}
