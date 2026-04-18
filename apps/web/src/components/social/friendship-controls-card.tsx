'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { UserMinus } from 'lucide-react'

import { ErrorState, SuccessState } from '@/components/feedback'
import { Button, buttonVariants } from '@/components/ui/button'
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
import {
  initialFriendRemovalFormState,
  type FriendRemovalFormState,
} from '@/features/social/server/friend-removal-form-state'
import { removeFriendAction } from '@/features/social/server/friendship-actions'

import { FriendRequestCard } from './friend-request-card'

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
              user&apos;s public profile.
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
                : `${recipientDisplayName} already sent you a friend request. Accept or decline it from your profile inbox.`}
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
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false)
  const [state, formAction, isPending] = useActionState<
    FriendRemovalFormState,
    FormData
  >(removeFriendAction, initialFriendRemovalFormState)

  const actionBlocked = isPending || state.status === 'success'

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
        {isConfirmingRemoval ? (
          <div className="space-y-3 rounded-2xl border border-border/70 bg-background-elevated/60 p-4">
            <p className="text-sm text-muted-foreground">
              Remove {recipientDisplayName} from your friends? This disconnects
              the active friendship for both sides.
            </p>
            <form action={formAction} className="flex flex-wrap gap-2">
              <input
                type="hidden"
                name="targetProfileId"
                value={recipientProfileId}
              />
              <Button
                type="submit"
                variant="destructive"
                disabled={actionBlocked}
              >
                <UserMinus className="size-4" />
                {isPending ? 'Removing...' : 'Confirm removal'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={actionBlocked}
                onClick={() => setIsConfirmingRemoval(false)}
              >
                Keep friend
              </Button>
            </form>
          </div>
        ) : (
          <Button
            type="button"
            variant="destructive"
            disabled={actionBlocked}
            onClick={() => setIsConfirmingRemoval(true)}
          >
            <UserMinus className="size-4" />
            Remove friend
          </Button>
        )}

        {state.message ? (
          state.status === 'success' ? (
            <SuccessState
              compact
              title="Friend removed"
              description={state.message}
            />
          ) : (
            <ErrorState
              compact
              title="Friend removal unavailable"
              description={state.message}
            />
          )
        ) : null}
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
