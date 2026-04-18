import type { FriendRelationshipStatus } from '@web-vg/db/repositories/social'

export type HistoricalRelationshipStatus = Exclude<
  FriendRelationshipStatus,
  'pending'
>

export type PublicProfileRelationshipState =
  | {
      readonly kind: 'guest'
    }
  | {
      readonly kind: 'self'
    }
  | {
      readonly kind: 'friend'
      readonly friendshipId: string
    }
  | {
      readonly kind: 'pending'
      readonly requestId: string
      readonly direction: 'incoming' | 'outgoing'
    }
  | {
      readonly kind: 'history-locked'
      readonly requestStatus: HistoricalRelationshipStatus
    }
  | {
      readonly kind: 'none'
    }
