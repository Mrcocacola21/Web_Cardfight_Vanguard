import type { DbClient } from '../shared/client'
import { err, mapQueryError, ok, type RepositoryResult } from '../shared/result'
import {
  mapActiveFriendRow,
  mapFriendRelationshipRow,
  mapFriendshipRow,
  mapIncomingFriendRequestRow,
  mapOutgoingFriendRequestRow,
} from './social.mappers'
import type {
  ActiveFriendRecord,
  CreateFriendRequestInput,
  FriendRelationshipRecord,
  FriendshipRecord,
  IncomingFriendRequestRecord,
  OutgoingFriendRequestRecord,
  RemoveFriendshipInput,
  RespondToFriendRequestInput,
} from './social.types'

const friendRelationshipSelect =
  'id, requester_profile_id, addressee_profile_id, status, requested_at, responded_at'
const friendshipSelect =
  'id, first_profile_id, second_profile_id, friend_request_id, created_at'
const activeFriendshipSelect =
  'friendship_id, friends_since, friend_profile_id, friend_display_name, friend_avatar_url, friend_bio, friend_profile_visible'
const incomingFriendRequestSelect =
  'request_id, requested_at, requester_profile_id, recipient_profile_id, requester_display_name, requester_avatar_url, requester_bio, requester_profile_visible'
const outgoingFriendRequestSelect =
  'request_id, requested_at, requester_profile_id, recipient_profile_id, recipient_display_name, recipient_avatar_url, recipient_bio, recipient_profile_visible'
const socialProjectionMaxLimit = 50

export interface SocialRepository {
  getFriendRelationshipBetweenProfiles(
    firstProfileId: string,
    secondProfileId: string,
  ): Promise<RepositoryResult<FriendRelationshipRecord | null>>
  getFriendRequestById(
    requestId: string,
  ): Promise<RepositoryResult<FriendRelationshipRecord | null>>
  createFriendRequest(
    input: CreateFriendRequestInput,
  ): Promise<RepositoryResult<FriendRelationshipRecord>>
  acceptFriendRequest(
    input: RespondToFriendRequestInput,
  ): Promise<RepositoryResult<FriendRelationshipRecord | null>>
  declineFriendRequest(
    input: RespondToFriendRequestInput,
  ): Promise<RepositoryResult<FriendRelationshipRecord | null>>
  getFriendshipBetweenProfiles(
    firstProfileId: string,
    secondProfileId: string,
  ): Promise<RepositoryResult<FriendshipRecord | null>>
  removeFriendship(
    input: RemoveFriendshipInput,
  ): Promise<RepositoryResult<FriendshipRecord | null>>
  listActiveFriendships(
    ownerProfileId: string,
    limit: number,
    offset?: number,
  ): Promise<RepositoryResult<readonly ActiveFriendRecord[]>>
  listIncomingPendingFriendRequests(
    recipientProfileId: string,
    limit: number,
  ): Promise<RepositoryResult<readonly IncomingFriendRequestRecord[]>>
  listOutgoingPendingFriendRequests(
    requesterProfileId: string,
    limit: number,
  ): Promise<RepositoryResult<readonly OutgoingFriendRequestRecord[]>>
}

export function createSocialRepository(client: DbClient): SocialRepository {
  function normalizeSocialProjectionLimit(limit: number) {
    if (!Number.isFinite(limit)) {
      return 1
    }

    return Math.max(1, Math.min(Math.trunc(limit), socialProjectionMaxLimit))
  }

  function normalizeSocialProjectionOffset(offset: number | undefined) {
    if (typeof offset !== 'number' || !Number.isFinite(offset)) {
      return 0
    }

    return Math.max(0, Math.trunc(offset))
  }

  function normalizeFriendshipPair(
    firstProfileId: string,
    secondProfileId: string,
  ) {
    return firstProfileId < secondProfileId
      ? {
          firstProfileId,
          secondProfileId,
        }
      : {
          firstProfileId: secondProfileId,
          secondProfileId: firstProfileId,
        }
  }

  async function selectFriendRelationship(
    requesterProfileId: string,
    addresseeProfileId: string,
  ) {
    return client
      .schema('social')
      .from('friend_relationships')
      .select(friendRelationshipSelect)
      .eq('requester_profile_id', requesterProfileId)
      .eq('addressee_profile_id', addresseeProfileId)
      .maybeSingle()
  }

  async function updateFriendRequestStatus(
    input: RespondToFriendRequestInput,
    status: 'accepted' | 'declined',
  ) {
    return client
      .schema('social')
      .from('friend_relationships')
      .update({
        status,
        responded_at: new Date().toISOString(),
      })
      .eq('id', input.requestId)
      .eq('addressee_profile_id', input.recipientProfileId)
      .eq('status', 'pending')
      .select(friendRelationshipSelect)
      .maybeSingle()
  }

  return {
    async getFriendRelationshipBetweenProfiles(
      firstProfileId,
      secondProfileId,
    ) {
      const directResult = await selectFriendRelationship(
        firstProfileId,
        secondProfileId,
      )

      if (directResult.error) {
        return err(
          mapQueryError(
            directResult.error,
            'Failed to load friend relationship.',
          ),
        )
      }

      if (directResult.data) {
        return ok(mapFriendRelationshipRow(directResult.data))
      }

      const reverseResult = await selectFriendRelationship(
        secondProfileId,
        firstProfileId,
      )

      if (reverseResult.error) {
        return err(
          mapQueryError(
            reverseResult.error,
            'Failed to load friend relationship.',
          ),
        )
      }

      return ok(
        reverseResult.data
          ? mapFriendRelationshipRow(reverseResult.data)
          : null,
      )
    },

    async getFriendRequestById(requestId) {
      const { data, error } = await client
        .schema('social')
        .from('friend_relationships')
        .select(friendRelationshipSelect)
        .eq('id', requestId)
        .maybeSingle()

      if (error) {
        return err(mapQueryError(error, 'Failed to load friend request.'))
      }

      return ok(data ? mapFriendRelationshipRow(data) : null)
    },

    async createFriendRequest(input) {
      const { data, error } = await client
        .schema('social')
        .from('friend_relationships')
        .insert({
          requester_profile_id: input.requesterProfileId,
          addressee_profile_id: input.addresseeProfileId,
          status: 'pending',
        })
        .select(friendRelationshipSelect)
        .single()

      if (error) {
        return err(mapQueryError(error, 'Failed to create friend request.'))
      }

      return ok(mapFriendRelationshipRow(data))
    },

    async acceptFriendRequest(input) {
      const { data, error } = await updateFriendRequestStatus(input, 'accepted')

      if (error) {
        return err(mapQueryError(error, 'Failed to accept friend request.'))
      }

      return ok(data ? mapFriendRelationshipRow(data) : null)
    },

    async declineFriendRequest(input) {
      const { data, error } = await updateFriendRequestStatus(input, 'declined')

      if (error) {
        return err(mapQueryError(error, 'Failed to decline friend request.'))
      }

      return ok(data ? mapFriendRelationshipRow(data) : null)
    },

    async getFriendshipBetweenProfiles(firstProfileId, secondProfileId) {
      const normalizedPair = normalizeFriendshipPair(
        firstProfileId,
        secondProfileId,
      )
      const { data, error } = await client
        .schema('social')
        .from('friendships')
        .select(friendshipSelect)
        .eq('first_profile_id', normalizedPair.firstProfileId)
        .eq('second_profile_id', normalizedPair.secondProfileId)
        .maybeSingle()

      if (error) {
        return err(mapQueryError(error, 'Failed to load friendship.'))
      }

      return ok(data ? mapFriendshipRow(data) : null)
    },

    async removeFriendship(input) {
      const { data, error } = await client
        .schema('social')
        .from('friendships')
        .delete()
        .eq('id', input.friendshipId)
        .eq('first_profile_id', input.firstProfileId)
        .eq('second_profile_id', input.secondProfileId)
        .select(friendshipSelect)
        .maybeSingle()

      if (error) {
        return err(mapQueryError(error, 'Failed to remove friendship.'))
      }

      return ok(data ? mapFriendshipRow(data) : null)
    },

    async listActiveFriendships(ownerProfileId, limit, offset = 0) {
      const normalizedLimit = normalizeSocialProjectionLimit(limit)
      const normalizedOffset = normalizeSocialProjectionOffset(offset)
      const { data, error } = await client
        .schema('social')
        .from('active_friendships_overview')
        .select(activeFriendshipSelect)
        .eq('owner_profile_id', ownerProfileId)
        .order('friends_since', {
          ascending: false,
        })
        .range(normalizedOffset, normalizedOffset + normalizedLimit - 1)

      if (error) {
        return err(mapQueryError(error, 'Failed to load active friendships.'))
      }

      return ok((data ?? []).map(mapActiveFriendRow))
    },

    async listIncomingPendingFriendRequests(recipientProfileId, limit) {
      const normalizedLimit = normalizeSocialProjectionLimit(limit)
      const { data, error } = await client
        .schema('social')
        .from('incoming_pending_friend_requests')
        .select(incomingFriendRequestSelect)
        .eq('recipient_profile_id', recipientProfileId)
        .order('requested_at', {
          ascending: false,
        })
        .range(0, normalizedLimit - 1)

      if (error) {
        return err(
          mapQueryError(error, 'Failed to load incoming friend requests.'),
        )
      }

      return ok((data ?? []).map(mapIncomingFriendRequestRow))
    },

    async listOutgoingPendingFriendRequests(requesterProfileId, limit) {
      const normalizedLimit = normalizeSocialProjectionLimit(limit)
      const { data, error } = await client
        .schema('social')
        .from('outgoing_pending_friend_requests')
        .select(outgoingFriendRequestSelect)
        .eq('requester_profile_id', requesterProfileId)
        .order('requested_at', {
          ascending: false,
        })
        .range(0, normalizedLimit - 1)

      if (error) {
        return err(
          mapQueryError(error, 'Failed to load outgoing friend requests.'),
        )
      }

      return ok((data ?? []).map(mapOutgoingFriendRequestRow))
    },
  }
}
