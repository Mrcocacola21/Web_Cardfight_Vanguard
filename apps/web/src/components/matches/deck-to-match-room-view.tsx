'use client'

import Link from 'next/link'
import { useActionState, useMemo, useState } from 'react'
import { Crosshair, Play, Swords } from 'lucide-react'
import type { DeckDetailRecord } from '@web-vg/db/repositories/decks'
import type { VisibleProfileRecord } from '@web-vg/db/repositories/profiles'

import { EmptyState, ErrorState } from '@/components/feedback'
import { DashboardPageLayout, PageHeader } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createDeckToMatchRoomAction } from '@/features/matches/server/deck-to-match-room-actions'
import {
  initialDeckToMatchRoomFormState,
  type DeckToMatchRoomFormState,
} from '@/features/matches/server/deck-to-match-room-form-state'
import {
  initialMatchOpponentSearchFormState,
  type MatchOpponentSearchFormState,
} from '@/features/matches/server/match-opponent-search-form-state'
import { searchMatchOpponentProfilesAction } from '@/features/matches/server/match-entry-actions'

interface DeckToMatchRoomViewProps {
  readonly viewerDisplayName: string
  readonly deck: DeckDetailRecord
}

export function DeckToMatchRoomView({
  viewerDisplayName,
  deck,
}: DeckToMatchRoomViewProps) {
  const [roomState, createRoomAction, isStarting] = useActionState<
    DeckToMatchRoomFormState,
    FormData
  >(createDeckToMatchRoomAction, initialDeckToMatchRoomFormState)
  const [searchState, searchAction, isSearching] = useActionState<
    MatchOpponentSearchFormState,
    FormData
  >(searchMatchOpponentProfilesAction, initialMatchOpponentSearchFormState)
  const [selectedOpponent, setSelectedOpponent] =
    useState<VisibleProfileRecord | null>(null)
  const sectionCounts = useMemo(() => {
    const sections = deck.currentVersion?.sectionCounts

    return {
      main: sections?.main ?? 0,
      ride: sections?.ride ?? 0,
      g: sections?.g ?? 0,
      total: deck.currentVersion?.totalCards ?? 0,
    }
  }, [deck.currentVersion])

  return (
    <DashboardPageLayout
      containerSize="wide"
      className="min-h-screen"
      contentClassName="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
      header={
        <PageHeader
          eyebrow={
            <>
              <Badge variant="outline">Matches</Badge>
              <Badge variant="secondary">Deck to room</Badge>
              <Badge variant="outline">Standard</Badge>
            </>
          }
          title="Start Match Room"
          description="Create a persisted projected gameplay room from one owned, validated Standard deck and a visible opponent profile."
          meta={
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{viewerDisplayName}</span>
              <span aria-hidden="true">|</span>
              <span>{deck.title}</span>
              <span aria-hidden="true">|</span>
              <span>v{deck.currentVersion?.versionNumber ?? 1}</span>
            </div>
          }
          actions={
            <Link
              href={`/decks/${encodeURIComponent(deck.id)}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Back to deck
            </Link>
          }
        />
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Swords className="size-5" />
            Room setup
          </CardTitle>
          <CardDescription>
            This creates a real persisted match room and opens the projected
            multiplayer play route. No room id is typed by hand.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-border/70 bg-background-elevated/65 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-medium">{deck.title}</p>
                <p className="text-sm text-muted-foreground">
                  {deck.description ??
                    'Selected owned deck. The server will validate the latest saved version before room creation.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{deck.format.displayName}</Badge>
                <Badge variant="outline">
                  v{deck.currentVersion?.versionNumber ?? 1}
                </Badge>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-sm">
              <DeckCount label="Main" value={sectionCounts.main} />
              <DeckCount label="Ride" value={sectionCounts.ride} />
              <DeckCount label="G" value={sectionCounts.g} />
              <DeckCount label="Total" value={sectionCounts.total} />
            </div>
          </div>

          <form action={createRoomAction} noValidate className="space-y-5">
            <input type="hidden" name="deckId" value={deck.id} />
            <input
              type="hidden"
              name="opponentProfileId"
              value={selectedOpponent?.id ?? ''}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">Opponent</label>
              {selectedOpponent ? (
                <div className="rounded-2xl border border-border/70 bg-background-elevated/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {selectedOpponent.displayName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedOpponent.bio ?? 'Visible profile selected.'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedOpponent(null)}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-border/70 bg-background-elevated/40 p-4 text-sm text-muted-foreground">
                  Search and select a visible profile. That profile becomes the
                  second participant in the persisted room.
                </p>
              )}
              {roomState.fieldErrors.opponentProfileId ? (
                <p className="text-sm text-destructive">
                  {roomState.fieldErrors.opponentProfileId}
                </p>
              ) : null}
            </div>

            {roomState.message ? (
              <ErrorState
                compact
                title="Room could not be started"
                description={roomState.message}
              />
            ) : null}

            <Button type="submit" disabled={isStarting}>
              <Play className="size-4" />
              {isStarting ? 'Starting room...' : 'Start match room'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Crosshair className="size-5" />
              Find opponent
            </CardTitle>
            <CardDescription>
              Search the protected visible-profile surface. Hidden profiles
              cannot be added to the room.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              action={searchAction}
              className="grid gap-3 md:grid-cols-[1fr_auto]"
            >
              <Input
                name="query"
                placeholder="Search visible profiles by display name"
                defaultValue={searchState.query}
                aria-label="Search opponent profiles"
              />
              <Button type="submit" variant="outline" disabled={isSearching}>
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </form>

            {renderOpponentSearchState(
              searchState,
              selectedOpponent,
              (profile) => setSelectedOpponent(profile),
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Flow boundaries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The selected deck is the first participant deck. It is reloaded,
              validated, converted to a deck snapshot, and used to bootstrap the
              authoritative room server-side.
            </p>
            <p>
              The second participant currently receives a bounded Standard
              sparring deck so the room can open as a playable vertical slice.
              Full opponent deck submission remains outside this step.
            </p>
            <p>
              The created room opens through `/matches/play/[roomId]`, the same
              projected persisted multiplayer route used for reconnect and
              realtime polling.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardPageLayout>
  )
}

function DeckCount({
  label,
  value,
}: {
  readonly label: string
  readonly value: number
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/55 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

function renderOpponentSearchState(
  state: MatchOpponentSearchFormState,
  selectedOpponent: VisibleProfileRecord | null,
  onSelect: (profile: VisibleProfileRecord) => void,
) {
  if (state.kind === 'error') {
    return (
      <ErrorState
        compact
        title="Opponent search unavailable"
        description={state.message}
      />
    )
  }

  if (state.kind === 'idle') {
    return state.reason === 'too-short' ? (
      <EmptyState
        title="Enter at least two characters"
        description="Short noisy queries are ignored so this protected search does not degrade into a broad visible-profile scan."
      />
    ) : (
      <EmptyState
        title="Search for an opponent"
        description="Start with a display name query and then select one visible profile for the live room."
      />
    )
  }

  if (state.results.length === 0) {
    return (
      <EmptyState
        title="No visible profiles match this search"
        description={`No visible profile matched "${state.query}".`}
      />
    )
  }

  return (
    <div className="space-y-3">
      {state.results.map((profile) => {
        const isSelected = selectedOpponent?.id === profile.id

        return (
          <div
            key={profile.id}
            className="rounded-2xl border border-border/70 bg-background-elevated/65 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-medium">{profile.displayName}</p>
                <p className="text-sm text-muted-foreground">
                  {profile.bio ?? 'No visible bio for this profile.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{profile.visibility}</Badge>
                  <Badge variant="secondary">
                    {profile.bioVisible ? 'Bio visible' : 'Bio hidden'}
                  </Badge>
                </div>
              </div>
              <Button
                type="button"
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                onClick={() => onSelect(profile)}
              >
                {isSelected ? 'Selected' : 'Select'}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
