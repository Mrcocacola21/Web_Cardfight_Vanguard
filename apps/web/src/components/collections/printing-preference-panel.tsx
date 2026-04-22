import Link from 'next/link'

import { buttonVariants, Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { setCollectionPrintingPreferenceAction } from '@/features/collections/server/collection-preference-actions'
import type { CurrentPrintingPreferenceState } from '@/features/collections/server/current-printing-preference-read'

interface PrintingPreferencePanelProps {
  readonly printingId: string
  readonly returnPath: string
  readonly state: CurrentPrintingPreferenceState
}

export function PrintingPreferencePanel({
  printingId,
  returnPath,
  state,
}: PrintingPreferencePanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wishlist and favorites</CardTitle>
        <CardDescription>
          Private collector preference state for this exact printing. Wishlist
          and favorites stay separate from owned quantity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.kind === 'signed-out' ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Sign in to wishlist or favorite this printing.</p>
            <Link
              href="/login"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Sign in
            </Link>
          </div>
        ) : null}

        {state.kind === 'profile-required' ? (
          <p className="text-sm text-muted-foreground">
            Create a persisted profile before saving collector preferences.
          </p>
        ) : null}

        {state.kind === 'error' ? (
          <p className="text-sm text-muted-foreground">{state.message}</p>
        ) : null}

        {state.kind === 'ready' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <PreferenceToggleCard
              title="Wishlist"
              description="Track this exact printing as something you still want to acquire."
              printingId={printingId}
              preferenceKind="wishlist"
              isPresent={state.wishlisted}
              returnPath={returnPath}
            />
            <PreferenceToggleCard
              title="Favorites"
              description="Bookmark this exact printing as a collector favorite without changing ownership."
              printingId={printingId}
              preferenceKind="favorite"
              isPresent={state.favorited}
              returnPath={returnPath}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

interface PreferenceToggleCardProps {
  readonly title: string
  readonly description: string
  readonly printingId: string
  readonly preferenceKind: 'wishlist' | 'favorite'
  readonly isPresent: boolean
  readonly returnPath: string
}

function PreferenceToggleCard({
  title,
  description,
  printingId,
  preferenceKind,
  isPresent,
  returnPath,
}: PreferenceToggleCardProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-background-elevated/45 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <Badge variant={isPresent ? 'secondary' : 'outline'}>
          {isPresent ? 'Active' : 'Not set'}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <form action={setCollectionPrintingPreferenceAction} className="mt-4">
        <input type="hidden" name="printingId" value={printingId} />
        <input type="hidden" name="preferenceKind" value={preferenceKind} />
        <input
          type="hidden"
          name="isPresent"
          value={isPresent ? 'false' : 'true'}
        />
        <input type="hidden" name="returnPath" value={returnPath} />
        <Button
          type="submit"
          variant={isPresent ? 'outline' : 'default'}
          size="sm"
        >
          {isPresent
            ? `Remove from ${title.toLowerCase()}`
            : `Add to ${title.toLowerCase()}`}
        </Button>
      </form>
    </div>
  )
}
