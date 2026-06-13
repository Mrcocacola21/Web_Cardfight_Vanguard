import Link from 'next/link'
import type {
  ActiveFriendRecord,
  IncomingFriendRequestRecord,
  OutgoingFriendRequestRecord,
} from '@web-vg/db/repositories/social'

import { DashboardPageLayout, PageHeader } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'

import { FriendsListCard } from './friends-list-card'
import { IncomingFriendRequestsCard } from './incoming-friend-requests-card'
import { OutgoingFriendRequestsCard } from './outgoing-friend-requests-card'

export type FriendsDashboardSyncStatus =
  | {
      readonly status: 'synced' | 'syncing'
      readonly label: string
    }
  | {
      readonly status: 'error'
      readonly label: string
      readonly message: string
    }

interface FriendsDashboardViewProps {
  readonly viewerDisplayName: string
  readonly friends: readonly ActiveFriendRecord[]
  readonly incomingRequests: readonly IncomingFriendRequestRecord[]
  readonly outgoingRequests: readonly OutgoingFriendRequestRecord[]
  readonly syncStatus?: FriendsDashboardSyncStatus | null
}

export function FriendsDashboardView({
  viewerDisplayName,
  friends,
  incomingRequests,
  outgoingRequests,
  syncStatus = null,
}: FriendsDashboardViewProps) {
  return (
    <DashboardPageLayout
      containerSize="wide"
      className="min-h-screen"
      contentClassName="flex flex-col gap-6"
      header={
        <PageHeader
          eyebrow={
            <>
              <Badge variant="outline">Social</Badge>
              <Badge variant="secondary">Protected dashboard</Badge>
              {syncStatus === null ? null : (
                <Badge variant={getSyncStatusBadgeVariant(syncStatus.status)}>
                  {syncStatus.label}
                </Badge>
              )}
            </>
          }
          title="Friends"
          description="Central owner-only social dashboard for the current friendship graph. Active friends, incoming requests, and outgoing requests stay separated so relationship state is never ambiguous."
          meta={
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{viewerDisplayName}</span>
              <span aria-hidden="true">|</span>
              <span>{friends.length} friends</span>
              <span aria-hidden="true">|</span>
              <span>{incomingRequests.length} incoming</span>
              <span aria-hidden="true">|</span>
              <span>{outgoingRequests.length} outgoing</span>
              {syncStatus?.status === 'error' ? (
                <>
                  <span aria-hidden="true">|</span>
                  <span>{syncStatus.message}</span>
                </>
              ) : null}
            </div>
          }
        />
      }
    >
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/95 p-5 shadow-[0_24px_60px_-32px_var(--shadow-color)]">
        <div className="space-y-1">
          <p className="text-sm font-medium">Social graph baseline</p>
          <p className="text-sm text-muted-foreground">
            Search for more users, review pending requests, and manage active
            friendships from this single route.
          </p>
        </div>
        <Link
          href="/users"
          className={buttonVariants({
            variant: 'outline',
          })}
        >
          Find users
        </Link>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <FriendsListCard friends={friends} />
        <div className="grid gap-6">
          <IncomingFriendRequestsCard requests={incomingRequests} />
          <OutgoingFriendRequestsCard requests={outgoingRequests} />
        </div>
      </section>
    </DashboardPageLayout>
  )
}

function getSyncStatusBadgeVariant(
  status: NonNullable<FriendsDashboardSyncStatus>['status'],
) {
  switch (status) {
    case 'synced':
      return 'success'
    case 'syncing':
      return 'secondary'
    case 'error':
      return 'destructive'
  }
}
