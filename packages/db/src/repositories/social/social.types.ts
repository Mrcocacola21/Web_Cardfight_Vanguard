export type FriendRelationshipStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled'

export interface FriendRelationshipRecord {
  readonly id: string
  readonly requesterProfileId: string
  readonly addresseeProfileId: string
  readonly status: FriendRelationshipStatus
  readonly requestedAt: string
  readonly respondedAt: string | null
}

export interface CreateFriendRequestInput {
  readonly requesterProfileId: string
  readonly addresseeProfileId: string
}

export interface RespondToFriendRequestInput {
  readonly requestId: string
  readonly recipientProfileId: string
}

export interface FriendshipRecord {
  readonly id: string
  readonly firstProfileId: string
  readonly secondProfileId: string
  readonly friendRequestId: string
  readonly createdAt: string
}

export interface IncomingFriendRequestRecord {
  readonly requestId: string
  readonly requestedAt: string
  readonly requesterProfileId: string
  readonly recipientProfileId: string
  readonly requesterDisplayName: string
  readonly requesterAvatarUrl: string | null
}

export interface RemoveFriendshipInput {
  readonly friendshipId: string
  readonly firstProfileId: string
  readonly secondProfileId: string
}
