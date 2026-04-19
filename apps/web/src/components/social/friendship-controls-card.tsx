'use client'

import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type {
  HistoricalRelationshipStatus,
  PublicProfileRelationshipState,
} from '@/features/social/relationship-state'

import { FriendRequestCard } from './friend-request-card'
import { FriendshipRemovalAction } from './friendship-removal-action'

interface FriendshipControlsCardProps {
  readonly recipientProfileId: string
  readonly recipientDisplayName: string
  readonly viewerProfileId: string | null
  readonly relationshipState: PublicProfileRelationshipState
}

export function FriendshipControlsCard({
  recipientProfileId,
  recipientDisplayName,
  viewerProfileId,
  relationshipState,
}: FriendshipControlsCardProps) {
  switch (relationshipState.kind) {
    case 'self':
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Friends</CardTitle>
            <CardDescription>
              Friendship actions are only available when viewing another
              user&apos;s visible profile route.
            </CardDescription>
          </CardHeader>
        </Card>
      )
    case 'guest':
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Friends</CardTitle>
            <CardDescription>
              Sign in before managing friendship with {recipientDisplayName}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/login"
              className={buttonVariants({
                variant: 'outline',
              })}
            >
              Sign in to add friend
            </Link>
          </CardContent>
        </Card>
      )
    case 'friend':
      return (
        <RemoveFriendCard
          recipientProfileId={recipientProfileId}
          recipientDisplayName={recipientDisplayName}
        />
      )
    case 'pending':
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Friends</CardTitle>
            <CardDescription>
              {relationshipState.direction === 'outgoing'
                ? `A friend request to ${recipientDisplayName} is still pending.`
                : `${recipientDisplayName} already sent you a friend request. Accept or decline it from your friends dashboard.`}
            </CardDescription>
          </CardHeader>
        </Card>
      )
    case 'history-locked':
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Friends</CardTitle>
            <CardDescription>
              {getHistoryLockedDescription(
                recipientDisplayName,
                relationshipState.requestStatus,
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      )
    case 'none':
    default:
      return (
        <FriendRequestCard
          recipientProfileId={recipientProfileId}
          recipientDisplayName={recipientDisplayName}
          viewerProfileId={viewerProfileId}
        />
      )
  }
}

interface RemoveFriendCardProps {
  readonly recipientProfileId: string
  readonly recipientDisplayName: string
}

function RemoveFriendCard({
  recipientProfileId,
  recipientDisplayName,
}: RemoveFriendCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Friends</CardTitle>
        <CardDescription>
          You are currently connected as friends with {recipientDisplayName}.
          Removing this friendship only affects the active friendship edge.
          Request history stays intact.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FriendshipRemovalAction
          targetProfileId={recipientProfileId}
          targetDisplayName={recipientDisplayName}
        />
      </CardContent>
    </Card>
  )
}

function getHistoryLockedDescription(
  recipientDisplayName: string,
  requestStatus: HistoricalRelationshipStatus,
) {
  switch (requestStatus) {
    case 'accepted':
      return `The active friendship with ${recipientDisplayName} has already been removed. Reconnecting the same profile pair is not implemented yet.`
    case 'declined':
    case 'cancelled':
    default:
      return `This profile pair already has historical friend-request state. Resending or reconnecting is not implemented yet.`
  }
}
