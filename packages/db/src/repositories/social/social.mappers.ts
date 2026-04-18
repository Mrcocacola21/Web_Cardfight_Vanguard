import type { Tables } from '../../generated/database.types'

import type {
  FriendRelationshipRecord,
  FriendRelationshipStatus,
  FriendshipRecord,
  IncomingFriendRequestRecord,
} from './social.types'

type FriendRelationshipRow = Pick<
  Tables<{ schema: 'social' }, 'friend_relationships'>,
  | 'id'
  | 'requester_profile_id'
  | 'addressee_profile_id'
  | 'status'
  | 'requested_at'
  | 'responded_at'
>

type FriendshipRow = Pick<
  Tables<{ schema: 'social' }, 'friendships'>,
  | 'id'
  | 'first_profile_id'
  | 'second_profile_id'
  | 'friend_request_id'
  | 'created_at'
>

type IncomingFriendRequestRow = Pick<
  Tables<{ schema: 'social' }, 'incoming_pending_friend_requests'>,
  | 'request_id'
  | 'requested_at'
  | 'requester_profile_id'
  | 'recipient_profile_id'
  | 'requester_display_name'
  | 'requester_avatar_url'
>

export function mapFriendRelationshipRow(
  row: FriendRelationshipRow,
): FriendRelationshipRecord {
  return {
    id: row.id,
    requesterProfileId: row.requester_profile_id,
    addresseeProfileId: row.addressee_profile_id,
    status: normalizeFriendRelationshipStatus(row.status),
    requestedAt: row.requested_at,
    respondedAt: row.responded_at,
  }
}

export function mapFriendshipRow(row: FriendshipRow): FriendshipRecord {
  return {
    id: row.id,
    firstProfileId: row.first_profile_id,
    secondProfileId: row.second_profile_id,
    friendRequestId: row.friend_request_id,
    createdAt: row.created_at,
  }
}

export function mapIncomingFriendRequestRow(
  row: IncomingFriendRequestRow,
): IncomingFriendRequestRecord {
  return {
    requestId: row.request_id,
    requestedAt: row.requested_at,
    requesterProfileId: row.requester_profile_id,
    recipientProfileId: row.recipient_profile_id,
    requesterDisplayName: row.requester_display_name,
    requesterAvatarUrl: row.requester_avatar_url,
  }
}

function normalizeFriendRelationshipStatus(
  value: string,
): FriendRelationshipStatus {
  switch (value) {
    case 'accepted':
    case 'declined':
    case 'cancelled':
      return value
    default:
      return 'pending'
  }
}
