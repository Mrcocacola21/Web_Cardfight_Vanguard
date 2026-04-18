import type { FriendRelationshipRecord } from '@web-vg/db/repositories/social'

import {
  createFriendRequestApplicationError,
  mapFriendRequestRepositoryFailure,
  type FriendRequestApplicationResult,
  type FriendRequestApplicationServices,
} from './friend-request-application-support'

export interface SendFriendRequestCommand {
  readonly isAuthenticated: boolean
  readonly senderProfileId: string | null
  readonly recipientProfileId: string
}

export interface RespondToFriendRequestCommand {
  readonly isAuthenticated: boolean
  readonly recipientProfileId: string | null
  readonly requestId: string
}

export type SendFriendRequestResult = FriendRequestApplicationResult<{
  readonly friendRequestId: string
  readonly status: 'pending'
}>

export type AcceptFriendRequestResult = FriendRequestApplicationResult<{
  readonly friendRequestId: string
  readonly requesterProfileId: string
  readonly friendshipId: string
  readonly status: 'accepted'
}>

export type DeclineFriendRequestResult = FriendRequestApplicationResult<{
  readonly friendRequestId: string
  readonly requesterProfileId: string
  readonly status: 'declined'
}>

export async function sendFriendRequestUseCase(
  services: FriendRequestApplicationServices,
  command: SendFriendRequestCommand,
): Promise<SendFriendRequestResult> {
  if (!command.isAuthenticated) {
    return createFriendRequestApplicationError(
      'unauthorized',
      'You need to sign in before sending a friend request.',
    )
  }

  if (!command.senderProfileId) {
    return createFriendRequestApplicationError(
      'sender-unavailable',
      'Your profile is not ready for friend requests yet.',
    )
  }

  if (command.senderProfileId === command.recipientProfileId) {
    return createFriendRequestApplicationError(
      'self-request',
      'You cannot send a friend request to yourself.',
    )
  }

  const requestableRecipientResult =
    await services.profilesRepository.getPublicProfileById(
      command.recipientProfileId,
    )

  if (!requestableRecipientResult.ok) {
    return mapFriendRequestRepositoryFailure(
      requestableRecipientResult.error.message,
    )
  }

  if (!requestableRecipientResult.data) {
    return createFriendRequestApplicationError(
      'recipient-unavailable',
      'This user is not available for friend requests.',
    )
  }

  const activeFriendshipResult =
    await services.socialRepository.getFriendshipBetweenProfiles(
      command.senderProfileId,
      command.recipientProfileId,
    )

  if (!activeFriendshipResult.ok) {
    return mapFriendRequestRepositoryFailure(
      activeFriendshipResult.error.message,
    )
  }

  if (activeFriendshipResult.data) {
    return createFriendRequestApplicationError(
      'already-friends',
      'You are already connected as friends.',
    )
  }

  const existingRelationshipResult =
    await services.socialRepository.getFriendRelationshipBetweenProfiles(
      command.senderProfileId,
      command.recipientProfileId,
    )

  if (!existingRelationshipResult.ok) {
    return mapFriendRequestRepositoryFailure(
      existingRelationshipResult.error.message,
    )
  }

  if (existingRelationshipResult.data) {
    return mapExistingFriendRelationship(existingRelationshipResult.data)
  }

  const createResult = await services.socialRepository.createFriendRequest({
    requesterProfileId: command.senderProfileId,
    addresseeProfileId: command.recipientProfileId,
  })

  if (!createResult.ok) {
    if (createResult.error.code === 'conflict') {
      const conflictResult =
        await services.socialRepository.getFriendRelationshipBetweenProfiles(
          command.senderProfileId,
          command.recipientProfileId,
        )

      if (!conflictResult.ok) {
        return mapFriendRequestRepositoryFailure(conflictResult.error.message)
      }

      if (conflictResult.data) {
        return mapExistingFriendRelationship(conflictResult.data)
      }
    }

    return mapFriendRequestRepositoryFailure(createResult.error.message)
  }

  return {
    ok: true,
    data: {
      friendRequestId: createResult.data.id,
      status: 'pending',
    },
  }
}

export async function acceptFriendRequestUseCase(
  services: FriendRequestApplicationServices,
  command: RespondToFriendRequestCommand,
): Promise<AcceptFriendRequestResult> {
  const actionableRequest = await loadActionableFriendRequest(services, command)

  if (!actionableRequest.ok) {
    return actionableRequest
  }

  const acceptResult = await services.socialRepository.acceptFriendRequest({
    requestId: command.requestId,
    recipientProfileId: actionableRequest.data.addresseeProfileId,
  })

  if (!acceptResult.ok) {
    return mapFriendRequestRepositoryFailure(acceptResult.error.message)
  }

  if (!acceptResult.data) {
    return resolveTransitionRaceResult(
      services,
      command.requestId,
      actionableRequest.data.addresseeProfileId,
    )
  }

  const friendshipResult =
    await services.socialRepository.getFriendshipBetweenProfiles(
      acceptResult.data.requesterProfileId,
      acceptResult.data.addresseeProfileId,
    )

  if (!friendshipResult.ok) {
    return mapFriendRequestRepositoryFailure(friendshipResult.error.message)
  }

  if (!friendshipResult.data) {
    return createFriendRequestApplicationError(
      'friendship-unavailable',
      'The request was accepted, but the friendship edge could not be confirmed.',
    )
  }

  return {
    ok: true,
    data: {
      friendRequestId: acceptResult.data.id,
      requesterProfileId: acceptResult.data.requesterProfileId,
      friendshipId: friendshipResult.data.id,
      status: 'accepted',
    },
  }
}

export async function declineFriendRequestUseCase(
  services: FriendRequestApplicationServices,
  command: RespondToFriendRequestCommand,
): Promise<DeclineFriendRequestResult> {
  const actionableRequest = await loadActionableFriendRequest(services, command)

  if (!actionableRequest.ok) {
    return actionableRequest
  }

  const declineResult = await services.socialRepository.declineFriendRequest({
    requestId: command.requestId,
    recipientProfileId: actionableRequest.data.addresseeProfileId,
  })

  if (!declineResult.ok) {
    return mapFriendRequestRepositoryFailure(declineResult.error.message)
  }

  if (!declineResult.data) {
    return resolveTransitionRaceResult(
      services,
      command.requestId,
      actionableRequest.data.addresseeProfileId,
    )
  }

  return {
    ok: true,
    data: {
      friendRequestId: declineResult.data.id,
      requesterProfileId: declineResult.data.requesterProfileId,
      status: 'declined',
    },
  }
}

async function loadActionableFriendRequest(
  services: FriendRequestApplicationServices,
  command: RespondToFriendRequestCommand,
): Promise<FriendRequestApplicationResult<FriendRelationshipRecord>> {
  if (!command.isAuthenticated) {
    return createFriendRequestApplicationError(
      'unauthorized',
      'You need to sign in before managing friend requests.',
    )
  }

  if (!command.recipientProfileId) {
    return createFriendRequestApplicationError(
      'actor-profile-unavailable',
      'Your profile is not ready for friend requests yet.',
    )
  }

  const requestResult = await services.socialRepository.getFriendRequestById(
    command.requestId,
  )

  if (!requestResult.ok) {
    return mapFriendRequestRepositoryFailure(requestResult.error.message)
  }

  if (!requestResult.data) {
    return createFriendRequestApplicationError(
      'request-unavailable',
      'This friend request is no longer available.',
    )
  }

  if (requestResult.data.addresseeProfileId !== command.recipientProfileId) {
    return createFriendRequestApplicationError(
      'forbidden',
      'Only the request recipient can manage this friend request.',
    )
  }

  if (requestResult.data.status !== 'pending') {
    return createFriendRequestApplicationError(
      'already-handled',
      'This friend request has already been handled.',
    )
  }

  return {
    ok: true,
    data: requestResult.data,
  }
}

async function resolveTransitionRaceResult(
  services: FriendRequestApplicationServices,
  requestId: string,
  recipientProfileId: string,
): Promise<FriendRequestApplicationResult<never>> {
  const requestResult =
    await services.socialRepository.getFriendRequestById(requestId)

  if (!requestResult.ok) {
    return mapFriendRequestRepositoryFailure(requestResult.error.message)
  }

  if (!requestResult.data) {
    return createFriendRequestApplicationError(
      'request-unavailable',
      'This friend request is no longer available.',
    )
  }

  if (requestResult.data.addresseeProfileId !== recipientProfileId) {
    return createFriendRequestApplicationError(
      'forbidden',
      'Only the request recipient can manage this friend request.',
    )
  }

  if (requestResult.data.status !== 'pending') {
    return createFriendRequestApplicationError(
      'already-handled',
      'This friend request has already been handled.',
    )
  }

  return createFriendRequestApplicationError(
    'repository-failed',
    'The friend request could not be updated.',
  )
}

function mapExistingFriendRelationship(
  relationship: FriendRelationshipRecord,
): FriendRequestApplicationResult<never> {
  switch (relationship.status) {
    case 'accepted':
      return createFriendRequestApplicationError(
        'request-unavailable',
        'This profile pair already has historical friend-request state. Reconnection flows are not implemented yet.',
      )
    case 'declined':
    case 'cancelled':
      return createFriendRequestApplicationError(
        'request-unavailable',
        'A friend request already exists for this profile pair. Resend and response flows are not implemented yet.',
      )
    case 'pending':
    default:
      return createFriendRequestApplicationError(
        'already-pending',
        'A friend request is already pending for this profile pair.',
      )
  }
}
