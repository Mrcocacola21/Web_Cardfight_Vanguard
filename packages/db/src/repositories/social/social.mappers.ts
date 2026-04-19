import type { Tables } from '../../generated/database.types'

import type {
  ActiveFriendRecord,
  FriendRelationshipRecord,
  FriendRelationshipStatus,
  FriendshipRecord,
  IncomingFriendRequestRecord,
  OutgoingFriendRequestRecord,
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

type ActiveFriendRow = Pick<
  Tables<{ schema: 'social' }, 'active_friendships_overview'>,
  | 'friendship_id'
  | 'friends_since'
  | 'friend_profile_id'
  | 'friend_display_name'
  | 'friend_avatar_url'
  | 'friend_bio'
  | 'friend_profile_visible'
>

type IncomingFriendRequestRow = Pick<
  Tables<{ schema: 'social' }, 'incoming_pending_friend_requests'>,
  | 'request_id'
  | 'requested_at'
  | 'requester_profile_id'
  | 'recipient_profile_id'
  | 'requester_display_name'
  | 'requester_avatar_url'
  | 'requester_bio'
  | 'requester_profile_visible'
>

type OutgoingFriendRequestRow = Pick<
  Tables<{ schema: 'social' }, 'outgoing_pending_friend_requests'>,
  | 'request_id'
  | 'requested_at'
  | 'requester_profile_id'
  | 'recipient_profile_id'
  | 'recipient_display_name'
  | 'recipient_avatar_url'
  | 'recipient_bio'
  | 'recipient_profile_visible'
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

export function mapActiveFriendRow(row: ActiveFriendRow): ActiveFriendRecord {
  return {
    friendshipId: row.friendship_id,
    friendsSince: row.friends_since,
    friendProfileId: row.friend_profile_id,
    friendDisplayName: row.friend_display_name,
    friendAvatarUrl: row.friend_avatar_url,
    friendBio: row.friend_bio,
    friendProfileVisible: row.friend_profile_visible,
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
    requesterBio: row.requester_bio,
    requesterProfileVisible: row.requester_profile_visible,
  }
}

export function mapOutgoingFriendRequestRow(
  row: OutgoingFriendRequestRow,
): OutgoingFriendRequestRecord {
  return {
    requestId: row.request_id,
    requestedAt: row.requested_at,
    requesterProfileId: row.requester_profile_id,
    recipientProfileId: row.recipient_profile_id,
    recipientDisplayName: row.recipient_display_name,
    recipientAvatarUrl: row.recipient_avatar_url,
    recipientBio: row.recipient_bio,
    recipientProfileVisible: row.recipient_profile_visible,
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
