import type {
  ActiveFriendRecord,
  IncomingFriendRequestRecord,
  OutgoingFriendRequestRecord,
} from '@web-vg/db/repositories/social'

import type { FriendsDashboardPageState } from '@/features/social/server/friends-dashboard-read'

export const SOCIAL_FRIENDS_REALTIME_TRANSPORT =
  'server_route_social_dashboard_polling' as const

export interface SocialFriendsDashboardSnapshot {
  readonly viewerProfileId: string
  readonly viewerDisplayName: string
  readonly friends: readonly ActiveFriendRecord[]
  readonly incomingRequests: readonly IncomingFriendRequestRecord[]
  readonly outgoingRequests: readonly OutgoingFriendRequestRecord[]
  readonly refreshedAt: string
}

export type SocialFriendsRealtimeErrorCode =
  | 'auth_required'
  | 'profile_required'
  | 'dashboard_unavailable'

export type SocialFriendsRealtimeResponse =
  | {
      readonly transport: typeof SOCIAL_FRIENDS_REALTIME_TRANSPORT
      readonly status: 'ok'
      readonly snapshot: SocialFriendsDashboardSnapshot
    }
  | {
      readonly transport: typeof SOCIAL_FRIENDS_REALTIME_TRANSPORT
      readonly status: 'error'
      readonly code: SocialFriendsRealtimeErrorCode
      readonly message: string
    }

export function createSocialFriendsDashboardSnapshot(
  state: Extract<FriendsDashboardPageState, { kind: 'ready' }>,
  refreshedAt: string,
): SocialFriendsDashboardSnapshot {
  return {
    viewerProfileId: state.viewerProfileId,
    viewerDisplayName: state.viewerDisplayName,
    friends: state.friends,
    incomingRequests: state.incomingRequests,
    outgoingRequests: state.outgoingRequests,
    refreshedAt,
  }
}

export function createSocialFriendsDashboardFingerprint(
  snapshot: SocialFriendsDashboardSnapshot,
): string {
  return JSON.stringify({
    viewerProfileId: snapshot.viewerProfileId,
    viewerDisplayName: snapshot.viewerDisplayName,
    friends: snapshot.friends.map((friend) => ({
      friendshipId: friend.friendshipId,
      friendsSince: friend.friendsSince,
      friendProfileId: friend.friendProfileId,
      friendDisplayName: friend.friendDisplayName,
      friendAvatarUrl: friend.friendAvatarUrl,
      friendBio: friend.friendBio,
      friendProfileVisible: friend.friendProfileVisible,
    })),
    incomingRequests: snapshot.incomingRequests.map((request) => ({
      requestId: request.requestId,
      requestedAt: request.requestedAt,
      requesterProfileId: request.requesterProfileId,
      recipientProfileId: request.recipientProfileId,
      requesterDisplayName: request.requesterDisplayName,
      requesterAvatarUrl: request.requesterAvatarUrl,
      requesterBio: request.requesterBio,
      requesterProfileVisible: request.requesterProfileVisible,
    })),
    outgoingRequests: snapshot.outgoingRequests.map((request) => ({
      requestId: request.requestId,
      requestedAt: request.requestedAt,
      requesterProfileId: request.requesterProfileId,
      recipientProfileId: request.recipientProfileId,
      recipientDisplayName: request.recipientDisplayName,
      recipientAvatarUrl: request.recipientAvatarUrl,
      recipientBio: request.recipientBio,
      recipientProfileVisible: request.recipientProfileVisible,
    })),
  })
}
