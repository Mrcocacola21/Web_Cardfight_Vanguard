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

export interface ActiveFriendRecord {
  readonly friendshipId: string
  readonly friendsSince: string
  readonly friendProfileId: string
  readonly friendDisplayName: string
  readonly friendAvatarUrl: string | null
  readonly friendBio: string | null
  readonly friendProfileVisible: boolean
}

export interface IncomingFriendRequestRecord {
  readonly requestId: string
  readonly requestedAt: string
  readonly requesterProfileId: string
  readonly recipientProfileId: string
  readonly requesterDisplayName: string
  readonly requesterAvatarUrl: string | null
  readonly requesterBio: string | null
  readonly requesterProfileVisible: boolean
}

export interface OutgoingFriendRequestRecord {
  readonly requestId: string
  readonly requestedAt: string
  readonly requesterProfileId: string
  readonly recipientProfileId: string
  readonly recipientDisplayName: string
  readonly recipientAvatarUrl: string | null
  readonly recipientBio: string | null
  readonly recipientProfileVisible: boolean
}

export interface RemoveFriendshipInput {
  readonly friendshipId: string
  readonly firstProfileId: string
  readonly secondProfileId: string
}
