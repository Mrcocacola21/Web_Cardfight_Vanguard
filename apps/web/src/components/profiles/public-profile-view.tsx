import Image from 'next/image'
import Link from 'next/link'
import type { PublicProfileRecord } from '@web-vg/db'

import { DetailPageLayout, PageSection } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface PublicProfileViewProps {
  readonly profile: PublicProfileRecord
  readonly isOwnerViewer?: boolean
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
}: PublicProfileViewProps) {
  return (
    <DetailPageLayout
      containerSize="default"
      variant="content-aside"
      className="min-h-screen"
      header={
        <PageSection as="header" spacing="compact" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Public Profile</Badge>
            {isOwnerViewer ? <Badge>Viewer is owner</Badge> : null}
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
                Public user-facing profile surface. Only public profile fields
                are rendered here.
              </p>
              {isOwnerViewer ? (
                <p className="text-sm text-muted-foreground">
                  This is your public profile surface.{' '}
                  <Link
                    href="/profile"
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    Manage your profile
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
            <CardTitle>Public details</CardTitle>
            <CardDescription>
              Public profile baseline for future social and community features.
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
                {profile.bio ?? 'No public bio published yet.'}
              </p>
            </div>
          </CardContent>
        </Card>
      }
      aside={
        <PageSection className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Friends</CardTitle>
              <CardDescription>
                Social graph is not implemented yet. This slot is reserved for
                future friend and relationship views.
              </CardDescription>
            </CardHeader>
          </Card>
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
