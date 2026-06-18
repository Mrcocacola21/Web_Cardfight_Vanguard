import Link from 'next/link'
import { ArrowRight, Plus, Swords } from 'lucide-react'

import {
  FilterBar,
  FilterSelect,
  ItemCard,
  SearchBar,
} from '@/components/data-display'
import { EmptyState } from '@/components/feedback'
import { DashboardPageLayout, PageHeader } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deckListFormatOptions } from '@/features/decks/deck-format-options'
import type { MatchHistoryDeckFilterOption } from '@/features/matches/application/match-history-list-use-cases'
import type { StoredMatchHistoryListItem } from '@/features/matches/application/match-history-repository'
import {
  buildMatchHistoryListHref,
  hasActiveMatchHistoryListFilters,
  type MatchHistoryListQuery,
} from '@/features/matches/match-history-list-query'

interface MatchHistoryListViewProps {
  readonly viewerDisplayName: string
  readonly matches: readonly StoredMatchHistoryListItem[]
  readonly totalMatchCount: number
  readonly query: MatchHistoryListQuery
  readonly availableDecks: readonly MatchHistoryDeckFilterOption[]
}

const resultFilterOptions = [
  {
    value: 'all',
    label: 'All results',
  },
  {
    value: 'win',
    label: 'Wins',
  },
  {
    value: 'loss',
    label: 'Losses',
  },
  {
    value: 'draw',
    label: 'Draws',
  },
] as const

export function MatchHistoryListView({
  viewerDisplayName,
  matches,
  totalMatchCount,
  query,
  availableDecks,
}: MatchHistoryListViewProps) {
  const hasPersistedMatches = totalMatchCount > 0
  const hasFilteredMatches = matches.length > 0
  const hasActiveFilters = hasActiveMatchHistoryListFilters(query)
  const deckFilterOptions = [
    {
      value: '',
      label: 'All decks',
    },
    ...availableDecks.map((deck) => ({
      value: deck.deckId,
      label: deck.label,
    })),
  ]

  return (
    <DashboardPageLayout
      containerSize="wide"
      className="min-h-screen"
      contentClassName="space-y-4"
      header={
        <PageHeader
          eyebrow={
            <>
              <Badge variant="outline">Matches</Badge>
              <Badge variant="secondary">Owner history</Badge>
            </>
          }
          title="Match History"
          description="Personal match-history read surface for manual records. The page stays owner-only, pulls from persisted match records, and keeps filtering below the route boundary instead of in ad hoc UI state."
          meta={
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{viewerDisplayName}</span>
              <span aria-hidden="true">|</span>
              <span>{totalMatchCount} recorded matches</span>
              <span aria-hidden="true">|</span>
              <span>Newest first</span>
              <span aria-hidden="true">|</span>
              <span>Owner-only</span>
            </div>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/matches/stats"
                className={buttonVariants({
                  variant: 'outline',
                })}
              >
                View stats
              </Link>
              <Link
                href="/matches/lobby"
                className={buttonVariants({
                  variant: 'outline',
                })}
              >
                <Swords className="size-4" />
                Start live match
              </Link>
              <Link
                href="/matches/new"
                className={buttonVariants({
                  variant: 'default',
                })}
              >
                <Plus className="size-4" />
                Record match
              </Link>
            </div>
          }
        />
      }
    >
      <FilterBar className="items-end justify-between gap-4">
        <form
          action="/matches"
          method="get"
          className="grid flex-1 gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,11rem))_repeat(2,minmax(0,10rem))]"
        >
          <SearchBar
            label="Opponent"
            name="opponent"
            defaultValue={query.opponent}
            placeholder="Search by opponent display name"
            className="min-w-0"
          />
          <FilterSelect
            name="result"
            label="Result"
            defaultValue={query.result}
            options={resultFilterOptions}
            className="min-w-[10rem]"
          />
          <FilterSelect
            name="deck"
            label="Deck"
            defaultValue={query.deckId ?? ''}
            options={deckFilterOptions}
            className="min-w-[11rem]"
          />
          <FilterSelect
            name="format"
            label="Format"
            defaultValue={query.formatId}
            options={deckListFormatOptions}
            className="min-w-[10rem]"
          />
          <label className="grid gap-1 text-sm text-foreground-secondary">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              From
            </span>
            <Input
              name="from"
              type="date"
              defaultValue={query.playedFrom ?? ''}
            />
          </label>
          <label className="grid gap-1 text-sm text-foreground-secondary">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              To
            </span>
            <Input name="to" type="date" defaultValue={query.playedTo ?? ''} />
          </label>
          <div className="flex flex-wrap items-center gap-2 lg:col-span-2 xl:col-span-full">
            <Button type="submit" variant="outline" size="sm">
              Apply filters
            </Button>
            {hasActiveFilters ? (
              <Link
                href="/matches"
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                Reset
              </Link>
            ) : null}
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {hasActiveFilters ? (
            <Badge variant="secondary">Filtered</Badge>
          ) : null}
          <Badge variant="outline">
            {hasFilteredMatches ? matches.length : 0} of {totalMatchCount}
          </Badge>
        </div>
      </FilterBar>

      {!hasPersistedMatches ? (
        <EmptyState
          title="No matches recorded yet"
          description="Manual match entry exists, but your owner-owned history is still empty. Record the first match to turn this route into a usable history surface."
          actionLabel="Record your first match"
          actionHref="/matches/new"
        />
      ) : !hasFilteredMatches ? (
        <EmptyState
          title="No matches match these filters"
          description="Persisted match records exist, but the current result, deck, opponent, format, or date filters removed every item from this view."
          actionLabel="Clear filters"
          actionHref={buildMatchHistoryListHref({
            result: 'all',
            deckId: null,
            opponent: '',
            formatId: 'all',
            playedFrom: null,
            playedTo: null,
          })}
        />
      ) : (
        <div className="grid gap-4">
          {matches.map((match) => (
            <MatchHistoryListItemCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </DashboardPageLayout>
  )
}

function MatchHistoryListItemCard({
  match,
}: {
  readonly match: StoredMatchHistoryListItem
}) {
  const opponentLabel = getOpponentLabel(match)
  const opponentSummary = getOpponentSummary(match)
  const deckLabel = getDeckLabel(match)
  const notesPreview = getNotesPreview(match.notes)

  return (
    <ItemCard
      title={opponentLabel}
      subtitle={`Played ${formatDate(match.playedAt)} | ${formatFormatLabel(match.formatId)}`}
      badges={
        <>
          <Badge variant={getResultBadgeVariant(match.result)}>
            {formatResultLabel(match.result)}
          </Badge>
          {match.ownDeck.versionNumber ? (
            <Badge variant="outline">v{match.ownDeck.versionNumber}</Badge>
          ) : null}
        </>
      }
      contentClassName="text-sm text-muted-foreground"
      footer={
        <>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Recorded: {formatDate(match.createdAt)}</p>
            <p>Deck: {deckLabel}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {match.ownDeck.deckId ? (
              <Link
                href={`/decks/${encodeURIComponent(match.ownDeck.deckId)}`}
                className={buttonVariants({
                  variant: 'outline',
                  size: 'sm',
                })}
              >
                Open deck
                <ArrowRight className="size-4" />
              </Link>
            ) : null}
            {match.opponent.profileVisible && match.opponent.profileId ? (
              <Link
                href={`/users/${encodeURIComponent(match.opponent.profileId)}`}
                className={buttonVariants({
                  variant: 'ghost',
                  size: 'sm',
                })}
              >
                View profile
                <ArrowRight className="size-4" />
              </Link>
            ) : null}
          </div>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Opponent
          </p>
          <p className="leading-6 text-foreground">{opponentLabel}</p>
          <p className="text-sm text-muted-foreground">{opponentSummary}</p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Notes
          </p>
          <p className="leading-6 text-muted-foreground">
            {notesPreview ?? 'No notes were saved for this match.'}
          </p>
        </div>
      </div>
    </ItemCard>
  )
}

function formatDate(value: string) {
  return value.slice(0, 10)
}

function getResultBadgeVariant(result: StoredMatchHistoryListItem['result']) {
  switch (result) {
    case 'win':
      return 'success'
    case 'loss':
      return 'destructive'
    case 'draw':
      return 'outline'
    default:
      return 'secondary'
  }
}

function formatResultLabel(result: StoredMatchHistoryListItem['result']) {
  switch (result) {
    case 'win':
      return 'Win'
    case 'loss':
      return 'Loss'
    case 'draw':
      return 'Draw'
    default:
      return 'Recorded'
  }
}

function formatFormatLabel(formatId: string) {
  const option = deckListFormatOptions.find((item) => item.value === formatId)

  if (option) {
    return option.label
  }

  return formatId
    .split('-')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}

function getDeckLabel(match: StoredMatchHistoryListItem) {
  if (match.ownDeck.title && match.ownDeck.versionNumber) {
    return `${match.ownDeck.title} (v${match.ownDeck.versionNumber})`
  }

  if (match.ownDeck.title) {
    return match.ownDeck.title
  }

  if (match.ownDeck.versionNumber) {
    return `Unavailable deck (v${match.ownDeck.versionNumber})`
  }

  return 'Unavailable deck'
}

function getOpponentLabel(match: StoredMatchHistoryListItem) {
  return match.opponent.displayName ?? 'Unavailable opponent'
}

function getOpponentSummary(match: StoredMatchHistoryListItem) {
  if (!match.opponent.profileVisible) {
    return 'The linked opponent profile is no longer visible through the current profile surface.'
  }

  if (match.opponent.bio) {
    return match.opponent.bio.length > 120
      ? `${match.opponent.bio.slice(0, 117)}...`
      : match.opponent.bio
  }

  return 'No public-safe opponent summary is available for this match.'
}

function getNotesPreview(notes: string | null) {
  if (!notes) {
    return null
  }

  return notes.length > 160 ? `${notes.slice(0, 157)}...` : notes
}
