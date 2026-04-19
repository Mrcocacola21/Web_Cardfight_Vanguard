import Image from 'next/image'
import Link from 'next/link'
import type { VisibleProfileRecord } from '@web-vg/db/repositories/profiles'

import { DetailPageLayout, PageSection } from '@/components/layout'
import { FriendshipControlsCard } from '@/components/social/friendship-controls-card'
import type { ProfileViewerCategory } from '@/features/profiles/profile-privacy'
import type { PublicProfileRelationshipState } from '@/features/social/relationship-state'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface PublicProfileViewProps {
  readonly profile: VisibleProfileRecord
  readonly isOwnerViewer?: boolean
  readonly viewerProfileId?: string | null
  readonly viewerCategory?: ProfileViewerCategory
  readonly relationshipState?: PublicProfileRelationshipState
}

function getAvatarFallbackLabel(displayName: string) {
  const normalizedName = displayName.trim()

  return normalizedName.length > 0
    ? (normalizedName[0]?.toUpperCase() ?? 'P')
    : 'P'
}

export function PublicProfileView({
  profile,
  isOwnerViewer = false,
  viewerProfileId = null,
  viewerCategory = isOwnerViewer
    ? 'owner'
    : viewerProfileId
      ? 'authenticated-non-friend'
      : 'guest',
  relationshipState = isOwnerViewer
    ? {
        kind: 'self',
      }
    : viewerProfileId
      ? {
          kind: 'none',
        }
      : {
          kind: 'guest',
        },
}: PublicProfileViewProps) {
  return (
    <DetailPageLayout
      containerSize="default"
      variant="content-aside"
      className="min-h-screen"
      header={
        <PageSection as="header" spacing="compact" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Profile</Badge>
            <Badge variant="secondary">Surface: {profile.visibility}</Badge>
            <Badge variant="secondary">Bio: {profile.bioVisibility}</Badge>
            <Badge>{formatViewerCategory(viewerCategory)}</Badge>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt={`${profile.displayName} avatar`}
                width={80}
                height={80}
                sizes="80px"
                className="size-20 rounded-2xl border object-cover shadow-sm"
              />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-2xl border bg-muted text-2xl font-semibold text-muted-foreground">
                {getAvatarFallbackLabel(profile.displayName)}
              </div>
            )}

            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {profile.displayName}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                Profile surface resolved through the server-side privacy model.
                Public, friends-only, and owner-only visibility are enforced
                before this view renders.
              </p>
              {isOwnerViewer ? (
                <p className="text-sm text-muted-foreground">
                  This is your profile route view.{' '}
                  <Link
                    href="/profile"
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    Manage your profile and privacy settings
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          </div>
        </PageSection>
      }
      main={
        <Card>
          <CardHeader>
            <CardTitle>Profile details</CardTitle>
            <CardDescription>
              Profile route data after server-side privacy filtering.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Display name
              </p>
              <p className="mt-1 font-medium">{profile.displayName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Avatar URL
              </p>
              <p className="mt-1 break-all text-muted-foreground">
                {profile.avatarUrl ?? 'No public avatar URL configured.'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Bio
              </p>
              <p className="mt-1 text-muted-foreground">
                {getBioDisplayCopy(profile, viewerCategory)}
              </p>
            </div>
          </CardContent>
        </Card>
      }
      aside={
        <PageSection className="grid gap-4">
          <FriendshipControlsCard
            recipientProfileId={profile.id}
            recipientDisplayName={profile.displayName}
            viewerProfileId={viewerProfileId}
            relationshipState={relationshipState}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Decks</CardTitle>
              <CardDescription>
                Public deck visibility is not implemented yet. This layout area
                is reserved for future user deck surfaces.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity</CardTitle>
              <CardDescription>
                Match history and recent activity are intentionally postponed.
              </CardDescription>
            </CardHeader>
          </Card>
        </PageSection>
      }
    />
  )
}

function formatViewerCategory(viewerCategory: ProfileViewerCategory) {
  switch (viewerCategory) {
    case 'owner':
      return 'Owner view'
    case 'friend':
      return 'Friend view'
    case 'authenticated-non-friend':
      return 'Signed-in non-friend'
    case 'guest':
    default:
      return 'Guest view'
  }
}

function getBioDisplayCopy(
  profile: VisibleProfileRecord,
  viewerCategory: ProfileViewerCategory,
) {
  if (profile.bioVisible) {
    return profile.bio ?? 'No bio published yet.'
  }

  switch (profile.bioVisibility) {
    case 'friends':
      return viewerCategory === 'guest'
        ? 'Bio is visible to friends only.'
        : 'Bio is visible to friends only.'
    case 'private':
      return 'Bio is visible only to the profile owner.'
    case 'public':
    default:
      return 'No bio published yet.'
  }
}
