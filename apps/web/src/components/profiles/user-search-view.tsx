import Image from 'next/image'
import Link from 'next/link'
import type { PublicProfileRecord } from '@web-vg/db/repositories/profiles'
import { ArrowRight, UsersRound } from 'lucide-react'

import { SearchBar } from '@/components/data-display'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback'
import { DashboardPageLayout, PageHeader } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { ItemCard } from '@/components/data-display/item-card'

export type UserSearchViewState =
  | {
      readonly kind: 'idle'
      readonly reason: 'empty' | 'too-short'
    }
  | {
      readonly kind: 'loading'
    }
  | {
      readonly kind: 'ready'
      readonly results: readonly PublicProfileRecord[]
    }
  | {
      readonly kind: 'error'
      readonly message: string
    }

interface UserSearchViewProps {
  readonly inputValue: string
  readonly state: UserSearchViewState
}

export function UserSearchView({ inputValue, state }: UserSearchViewProps) {
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
              <Badge variant="secondary">Public profiles</Badge>
            </>
          }
          title="Find Users"
          description="Search the public profile surface by display name. Search results never bypass profile visibility rules and always link back into the existing public profile route."
          meta={
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Display-name search</span>
              <span aria-hidden="true">|</span>
              <span>Public-safe results only</span>
              <span aria-hidden="true">|</span>
              <span>Search-first social surface</span>
            </div>
          }
        />
      }
    >
      <section className="rounded-2xl border border-border/70 bg-card/95 p-5 shadow-[0_24px_60px_-32px_var(--shadow-color)]">
        <form action="/users" className="grid gap-4 md:grid-cols-[1fr_auto]">
          <SearchBar
            label="Search users"
            name="q"
            defaultValue={inputValue}
            placeholder="Search by display name"
            className="min-w-0"
          />
          <div className="flex items-end gap-2 md:justify-end">
            <Button type="submit">
              Search
              <UsersRound className="size-4" />
            </Button>
            {inputValue ? (
              <Link
                href="/users"
                className={buttonVariants({
                  variant: 'ghost',
                })}
              >
                Reset
              </Link>
            ) : null}
          </div>
        </form>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Only public profiles participate in search. Empty queries return no
          directory listing, and private profiles stay undiscoverable here.
        </p>
      </section>

      {renderSearchState(state, inputValue)}
    </DashboardPageLayout>
  )
}

function renderSearchState(state: UserSearchViewState, inputValue: string) {
  if (state.kind === 'loading') {
    return (
      <LoadingState
        title="Loading public profiles"
        description="Resolving the public profile search surface."
      />
    )
  }

  if (state.kind === 'error') {
    return (
      <ErrorState
        title="User search is unavailable"
        description={state.message}
        actionLabel="Back home"
        actionHref="/"
      />
    )
  }

  if (state.kind === 'idle') {
    return state.reason === 'too-short' ? (
      <EmptyState
        title="Enter at least two characters"
        description="Short, noisy queries are ignored so this route does not degrade into a broad public-profile scan."
      />
    ) : (
      <EmptyState
        title="Search public profiles"
        description="Start with a display name query to find another user and open their public profile page."
      />
    )
  }

  if (state.results.length === 0) {
    return (
      <EmptyState
        title="No users match this query"
        description={`No public profiles matched "${inputValue}". Try a different display name search.`}
        actionLabel="Clear search"
        actionHref="/users"
      />
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{state.results.length} public profile matches</span>
        <span aria-hidden="true">|</span>
        <span>Query: {inputValue}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {state.results.map((profile) => (
          <UserSearchResultCard key={profile.id} profile={profile} />
        ))}
      </div>
    </section>
  )
}

function UserSearchResultCard({
  profile,
}: {
  readonly profile: PublicProfileRecord
}) {
  return (
    <ItemCard
      title={profile.displayName}
      subtitle="Public profile"
      badges={<Badge variant="outline">Search result</Badge>}
      contentClassName="text-sm text-muted-foreground"
      footer={
        <Link
          href={`/users/${encodeURIComponent(profile.id)}`}
          className={buttonVariants({
            variant: 'outline',
            size: 'sm',
          })}
        >
          View profile
          <ArrowRight className="size-4" />
        </Link>
      }
    >
      <div className="flex items-start gap-4">
        {profile.avatarUrl ? (
          <Image
            src={profile.avatarUrl}
            alt={`${profile.displayName} avatar`}
            width={56}
            height={56}
            sizes="56px"
            className="size-14 shrink-0 rounded-2xl border object-cover shadow-sm"
          />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border bg-muted text-lg font-semibold text-muted-foreground">
            {getAvatarFallbackLabel(profile.displayName)}
          </div>
        )}
        <div className="min-w-0 space-y-2">
          <p className="leading-6 text-muted-foreground">
            {getPublicBioSnippet(profile.bio)}
          </p>
        </div>
      </div>
    </ItemCard>
  )
}

function getAvatarFallbackLabel(displayName: string) {
  const normalizedName = displayName.trim()

  return normalizedName.length > 0
    ? (normalizedName[0]?.toUpperCase() ?? 'P')
    : 'P'
}

function getPublicBioSnippet(bio: string | null) {
  if (!bio) {
    return 'No public bio published yet.'
  }

  return bio.length > 160 ? `${bio.slice(0, 157)}...` : bio
}
