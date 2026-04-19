'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useActionState } from 'react'
import type { IncomingFriendRequestRecord } from '@web-vg/db/repositories/social'

import { EmptyState, ErrorState, SuccessState } from '@/components/feedback'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  initialFriendRequestResponseFormState,
  type FriendRequestResponseFormState,
} from '@/features/social/server/friend-request-response-form-state'
import { respondToFriendRequestAction } from '@/features/social/server/friend-request-actions'

interface IncomingFriendRequestsCardProps {
  readonly requests: readonly IncomingFriendRequestRecord[]
}

export function IncomingFriendRequestsCard({
  requests,
}: IncomingFriendRequestsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Incoming friend requests</CardTitle>
        <CardDescription>
          Only the request recipient can accept or decline pending requests.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <EmptyState
            compact
            title="No pending requests"
            description="New incoming friend requests will appear here."
          />
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <IncomingFriendRequestItem
                key={request.requestId}
                request={request}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface IncomingFriendRequestItemProps {
  readonly request: IncomingFriendRequestRecord
}

function IncomingFriendRequestItem({
  request,
}: IncomingFriendRequestItemProps) {
  const [state, formAction, isPending] = useActionState<
    FriendRequestResponseFormState,
    FormData
  >(respondToFriendRequestAction, initialFriendRequestResponseFormState)

  const actionBlocked = isPending || isFriendRequestResponseBlocked(state)

  return (
    <div className="rounded-2xl border border-border/70 bg-background-elevated/60 p-4">
      <div className="flex items-start gap-3">
        {request.requesterAvatarUrl ? (
          <Image
            src={request.requesterAvatarUrl}
            alt={`${request.requesterDisplayName} avatar`}
            width={48}
            height={48}
            sizes="48px"
            className="size-12 rounded-xl border object-cover"
          />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-xl border bg-muted text-sm font-semibold text-muted-foreground">
            {getAvatarFallbackLabel(request.requesterDisplayName)}
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="font-medium">{request.requesterDisplayName}</p>
            <p className="text-sm text-muted-foreground">
              {getRequesterSummaryCopy(request)}
            </p>
          </div>

          <form action={formAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="requestId" value={request.requestId} />
            <Button
              type="submit"
              name="decision"
              value="accept"
              size="sm"
              disabled={actionBlocked}
            >
              Accept
            </Button>
            <Button
              type="submit"
              name="decision"
              value="decline"
              size="sm"
              variant="outline"
              disabled={actionBlocked}
            >
              Decline
            </Button>
            {request.requesterProfileVisible ? (
              <Link
                href={`/users/${encodeURIComponent(request.requesterProfileId)}`}
                className={buttonVariants({
                  variant: 'ghost',
                  size: 'sm',
                })}
              >
                View profile
              </Link>
            ) : null}
          </form>

          {state.message ? (
            state.status === 'success' ? (
              <SuccessState
                compact
                title={
                  state.code === 'accepted'
                    ? 'Friend request accepted'
                    : 'Friend request declined'
                }
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
        </div>
      </div>
    </div>
  )
}

function getAvatarFallbackLabel(displayName: string) {
  const normalizedName = displayName.trim()

  return normalizedName.length > 0
    ? (normalizedName[0]?.toUpperCase() ?? 'P')
    : 'P'
}

function isFriendRequestResponseBlocked(state: FriendRequestResponseFormState) {
  return (
    state.status === 'success' ||
    state.code === 'already-handled' ||
    state.code === 'forbidden' ||
    state.code === 'unavailable'
  )
}

function getRequesterSummaryCopy(request: IncomingFriendRequestRecord) {
  if (!request.requesterProfileVisible) {
    return 'This request is still pending, but the sender is not currently visible through the public profile surface.'
  }

  if (request.requesterBio) {
    return getPublicBioSnippet(request.requesterBio)
  }

  return 'Sent you a friend request.'
}

function getPublicBioSnippet(bio: string) {
  return bio.length > 140 ? `${bio.slice(0, 137)}...` : bio
}
