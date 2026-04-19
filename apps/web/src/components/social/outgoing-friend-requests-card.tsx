import Image from 'next/image'
import Link from 'next/link'
import type { OutgoingFriendRequestRecord } from '@web-vg/db/repositories/social'

import { EmptyState } from '@/components/feedback'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface OutgoingFriendRequestsCardProps {
  readonly requests: readonly OutgoingFriendRequestRecord[]
}

export function OutgoingFriendRequestsCard({
  requests,
}: OutgoingFriendRequestsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Outgoing requests</CardTitle>
        <CardDescription>
          Pending requests you already sent. Cancel/resend flows are
          intentionally not implemented yet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <EmptyState
            compact
            title="No outgoing requests"
            description="Pending requests you send from a public profile will appear here until they are accepted or declined."
            actionLabel="Find users"
            actionHref="/users"
          />
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <OutgoingRequestRow key={request.requestId} request={request} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function OutgoingRequestRow({
  request,
}: {
  readonly request: OutgoingFriendRequestRecord
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background-elevated/60 p-4">
      <div className="flex items-start gap-3">
        {request.recipientAvatarUrl ? (
          <Image
            src={request.recipientAvatarUrl}
            alt={`${request.recipientDisplayName} avatar`}
            width={48}
            height={48}
            sizes="48px"
            className="size-12 rounded-xl border object-cover"
          />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-xl border bg-muted text-sm font-semibold text-muted-foreground">
            {getAvatarFallbackLabel(request.recipientDisplayName)}
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{request.recipientDisplayName}</p>
            <Badge variant="outline">Pending</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {getRecipientSummaryCopy(request)}
          </p>
          {request.recipientProfileVisible ? (
            <Link
              href={`/users/${encodeURIComponent(request.recipientProfileId)}`}
              className={buttonVariants({
                variant: 'ghost',
                size: 'sm',
              })}
            >
              View profile
            </Link>
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

function getRecipientSummaryCopy(request: OutgoingFriendRequestRecord) {
  if (!request.recipientProfileVisible) {
    return 'The request is still pending, but the recipient is not currently visible through the public profile surface.'
  }

  if (request.recipientBio) {
    return getPublicBioSnippet(request.recipientBio)
  }

  return 'Waiting for the recipient to accept or decline this request.'
}

function getPublicBioSnippet(bio: string) {
  return bio.length > 140 ? `${bio.slice(0, 137)}...` : bio
}
