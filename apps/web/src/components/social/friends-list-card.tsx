import Image from 'next/image'
import Link from 'next/link'
import type { ActiveFriendRecord } from '@web-vg/db/repositories/social'

import { EmptyState } from '@/components/feedback'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import { FriendshipRemovalAction } from './friendship-removal-action'

interface FriendsListCardProps {
  readonly friends: readonly ActiveFriendRecord[]
}

export function FriendsListCard({ friends }: FriendsListCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Current friends</CardTitle>
        <CardDescription>
          Active friendship edges only. Request history stays separate from this
          list, and only privacy-safe friend summary fields render here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {friends.length === 0 ? (
          <EmptyState
            compact
            title="No friends yet"
            description="Accepted friendships will appear here. Use user search to find another player and start the social graph."
            actionLabel="Find users"
            actionHref="/users"
          />
        ) : (
          <div className="space-y-4">
            {friends.map((friend) => (
              <FriendRow key={friend.friendshipId} friend={friend} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FriendRow({ friend }: { readonly friend: ActiveFriendRecord }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background-elevated/60 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {friend.friendAvatarUrl ? (
            <Image
              src={friend.friendAvatarUrl}
              alt={`${friend.friendDisplayName} avatar`}
              width={48}
              height={48}
              sizes="48px"
              className="size-12 rounded-xl border object-cover"
            />
          ) : (
            <div className="flex size-12 items-center justify-center rounded-xl border bg-muted text-sm font-semibold text-muted-foreground">
              {getAvatarFallbackLabel(friend.friendDisplayName)}
            </div>
          )}

          <div className="min-w-0 space-y-2">
            <div>
              <p className="font-medium">{friend.friendDisplayName}</p>
              <p className="text-sm text-muted-foreground">
                {getFriendSummaryCopy(friend)}
              </p>
            </div>
            {friend.friendProfileVisible ? (
              <Link
                href={`/users/${encodeURIComponent(friend.friendProfileId)}`}
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

        <div className="w-full max-w-sm">
          <FriendshipRemovalAction
            targetProfileId={friend.friendProfileId}
            targetDisplayName={friend.friendDisplayName}
            compact
          />
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

function getFriendSummaryCopy(friend: ActiveFriendRecord) {
  if (!friend.friendProfileVisible) {
    return 'This friendship stays active, but the other player is not currently visible through the public profile surface.'
  }

  if (friend.friendBio) {
    return getPublicBioSnippet(friend.friendBio)
  }

  return 'Public profile available. Open it to view the current social surface.'
}

function getPublicBioSnippet(bio: string) {
  return bio.length > 140 ? `${bio.slice(0, 137)}...` : bio
}
