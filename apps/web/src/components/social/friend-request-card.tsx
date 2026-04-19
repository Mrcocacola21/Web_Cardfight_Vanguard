'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { UserPlus } from 'lucide-react'

import { ErrorState, SuccessState } from '@/components/feedback'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  initialFriendRequestFormState,
  type FriendRequestFormState,
} from '@/features/social/server/friend-request-form-state'
import { sendFriendRequestAction } from '@/features/social/server/friend-request-actions'

interface FriendRequestCardProps {
  readonly recipientProfileId: string
  readonly recipientDisplayName: string
  readonly viewerProfileId: string | null
  readonly isOwnerViewer?: boolean
}

export function FriendRequestCard({
  recipientProfileId,
  recipientDisplayName,
  viewerProfileId,
  isOwnerViewer = false,
}: FriendRequestCardProps) {
  const [state, formAction, isPending] = useActionState<
    FriendRequestFormState,
    FormData
  >(sendFriendRequestAction, initialFriendRequestFormState)

  if (isOwnerViewer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Friends</CardTitle>
          <CardDescription>
            Friend requests are only available when viewing another user&apos;s
            visible profile route.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!viewerProfileId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Friends</CardTitle>
          <CardDescription>
            Sign in before sending a friend request to {recipientDisplayName}.
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
  }

  const buttonLabel = getFriendRequestButtonLabel(state, isPending)
  const buttonDisabled = isPending || isFriendRequestActionBlocked(state)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Friends</CardTitle>
        <CardDescription>
          Send an explicit friend request through the social relationship
          foundation. The recipient can accept or decline it from their own
          friends dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction} className="flex flex-col gap-3">
          <input
            type="hidden"
            name="recipientProfileId"
            value={recipientProfileId}
          />
          <Button type="submit" disabled={buttonDisabled}>
            <UserPlus className="size-4" />
            {buttonLabel}
          </Button>
        </form>

        {state.message ? (
          state.status === 'success' ? (
            <SuccessState
              compact
              title="Friend request sent"
              description={state.message}
            />
          ) : (
            <ErrorState
              compact
              title="Friend request unavailable"
              description={state.message}
            />
          )
        ) : null}
      </CardContent>
    </Card>
  )
}

function getFriendRequestButtonLabel(
  state: FriendRequestFormState,
  isPending: boolean,
) {
  if (isPending) {
    return 'Sending...'
  }

  switch (state.code) {
    case 'request-sent':
      return 'Request sent'
    case 'already-pending':
      return 'Request pending'
    case 'already-friends':
      return 'Already friends'
    default:
      return 'Add friend'
  }
}

function isFriendRequestActionBlocked(state: FriendRequestFormState) {
  return (
    state.status === 'success' ||
    state.code === 'already-pending' ||
    state.code === 'already-friends'
  )
}
