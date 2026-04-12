import type { ProfileRecord } from '@web-vg/db/repositories/profiles'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface ProfileSummaryProps {
  readonly profile: ProfileRecord
  readonly title: string
  readonly description: string
}

export function ProfileSummary({
  profile,
  title,
  description,
}: ProfileSummaryProps) {
  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{profile.visibility}</Badge>
          {profile.username ? (
            <Badge variant="secondary">@{profile.username}</Badge>
          ) : null}
        </div>
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
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
            {profile.avatarUrl ?? 'No avatar URL configured yet.'}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Bio
          </p>
          <p className="mt-1 text-muted-foreground">
            {profile.bio ?? 'No bio published yet.'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
