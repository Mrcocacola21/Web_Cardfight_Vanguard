'use client'

import { useActionState, useState } from 'react'
import { Crosshair, Swords, Trophy } from 'lucide-react'
import type { VisibleProfileRecord } from '@web-vg/db/repositories/profiles'

import { EmptyState, ErrorState, SuccessState } from '@/components/feedback'
import { DashboardPageLayout, PageHeader } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  createManualMatchEntryAction,
  searchMatchOpponentProfilesAction,
} from '@/features/matches/server/match-entry-actions'
import {
  initialManualMatchEntryFormState,
  type ManualMatchEntryFormState,
} from '@/features/matches/server/manual-match-entry-form-state'
import {
  initialMatchOpponentSearchFormState,
  type MatchOpponentSearchFormState,
} from '@/features/matches/server/match-opponent-search-form-state'
import type { MatchEntryDeckOption } from '@/features/matches/match-entry.types'

interface ManualMatchEntryViewProps {
  readonly viewerDisplayName: string
  readonly deckOptions: readonly MatchEntryDeckOption[]
  readonly defaultPlayedOn: string
}

export function ManualMatchEntryView({
  viewerDisplayName,
  deckOptions,
  defaultPlayedOn,
}: ManualMatchEntryViewProps) {
  const [matchState, createMatchAction, isSaving] = useActionState<
    ManualMatchEntryFormState,
    FormData
  >(createManualMatchEntryAction, initialManualMatchEntryFormState)
  const [searchState, searchAction, isSearching] = useActionState<
    MatchOpponentSearchFormState,
    FormData
  >(searchMatchOpponentProfilesAction, initialMatchOpponentSearchFormState)
  const [selectedOpponent, setSelectedOpponent] =
    useState<VisibleProfileRecord | null>(null)

  return (
    <DashboardPageLayout
      containerSize="wide"
      className="min-h-screen"
      contentClassName="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"
      header={
        <PageHeader
          eyebrow={
            <>
              <Badge variant="outline">Matches</Badge>
              <Badge variant="secondary">Manual entry</Badge>
            </>
          }
          title="Record Match"
          description="Log a real match without pretending that a gameplay engine exists yet. The flow stays owner-owned, deck-backed, opponent-linked, and ready for future history and stats reads."
          meta={
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{viewerDisplayName}</span>
              <span aria-hidden="true">|</span>
              <span>{deckOptions.length} selectable decks</span>
              <span aria-hidden="true">|</span>
              <span>Private by default</span>
            </div>
          }
        />
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="size-5" />
            Match facts
          </CardTitle>
          <CardDescription>
            Save one manual match record with your deck, one opponent profile, a
            stable result, played date, and optional notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form
            id="manual-match-entry-form"
            action={createMatchAction}
            noValidate
            className="space-y-5"
          >
            <input
              type="hidden"
              name="opponentProfileId"
              value={selectedOpponent?.id ?? ''}
            />

            <div className="space-y-2">
              <label htmlFor="deckId" className="text-sm font-medium">
                Deck
              </label>
              <select
                id="deckId"
                name="deckId"
                required
                aria-invalid={matchState.fieldErrors.deckId ? 'true' : 'false'}
                className="flex h-11 w-full rounded-xl border border-input bg-background-elevated/75 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
              >
                <option value="">Select one of your decks</option>
                {deckOptions.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.title} | {deck.formatDisplayName} | v
                    {deck.currentVersionNumber}
                  </option>
                ))}
              </select>
              {matchState.fieldErrors.deckId ? (
                <p className="text-sm text-destructive">
                  {matchState.fieldErrors.deckId}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  The current deck selection resolves to its latest persisted
                  deck version.
                </p>
              )}
            </div>

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
                  Search the protected visible-profile surface and select one
                  opponent before saving the match.
                </p>
              )}
              {matchState.fieldErrors.opponentProfileId ? (
                <p className="text-sm text-destructive">
                  {matchState.fieldErrors.opponentProfileId}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="result" className="text-sm font-medium">
                Result
              </label>
              <select
                id="result"
                name="result"
                required
                defaultValue="win"
                aria-invalid={matchState.fieldErrors.result ? 'true' : 'false'}
                className="flex h-11 w-full rounded-xl border border-input bg-background-elevated/75 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
              >
                <option value="win">Win</option>
                <option value="loss">Loss</option>
                <option value="draw">Draw</option>
              </select>
              {matchState.fieldErrors.result ? (
                <p className="text-sm text-destructive">
                  {matchState.fieldErrors.result}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="playedOn" className="text-sm font-medium">
                Played date
              </label>
              <Input
                id="playedOn"
                name="playedOn"
                type="date"
                required
                defaultValue={defaultPlayedOn}
                aria-invalid={
                  matchState.fieldErrors.playedOn ? 'true' : 'false'
                }
              />
              {matchState.fieldErrors.playedOn ? (
                <p className="text-sm text-destructive">
                  {matchState.fieldErrors.playedOn}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="notes" className="text-sm font-medium">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={5}
                aria-invalid={matchState.fieldErrors.notes ? 'true' : 'false'}
                placeholder="Optional context about the match"
                className="flex min-h-28 w-full rounded-xl border border-input bg-background-elevated/75 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
              />
              {matchState.fieldErrors.notes ? (
                <p className="text-sm text-destructive">
                  {matchState.fieldErrors.notes}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Keep notes short and practical. They are support context, not
                  the source of truth for result or participants.
                </p>
              )}
            </div>

            {matchState.message ? (
              matchState.status === 'success' ? (
                <SuccessState
                  compact
                  title="Match recorded"
                  description={matchState.message}
                />
              ) : (
                <ErrorState
                  compact
                  title="Match could not be recorded"
                  description={matchState.message}
                />
              )
            ) : null}

            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save match'}
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
              Opponent search uses the authenticated visible-profile surface.
              That means public profiles and already-visible friends can be
              selected, while hidden profiles stay unavailable.
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
            <CardTitle className="flex items-center gap-2 text-lg">
              <Swords className="size-5" />
              Flow boundaries
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The saved record stays owner-owned. Selecting an opponent profile
              does not create shared ownership or a two-sided authoritative
              match.
            </p>
            <p>
              Match visibility is private by default in this baseline flow. The
              focus here is honest history entry, not sharing or stats yet.
            </p>
            <p>
              Deck linkage uses your current persisted deck version. No gameplay
              runtime, deck snapshot system, or automated result generation is
              implied by this form.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardPageLayout>
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
        description="Start with a display name query and then select one visible profile for the match record."
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
