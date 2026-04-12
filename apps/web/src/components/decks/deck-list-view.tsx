import Link from 'next/link'
import type { DeckListItemRecord } from '@web-vg/db/repositories/decks'
import type { ProfileRecord } from '@web-vg/db/repositories/profiles'
import { ArrowRight, Copy, Plus, Trash2 } from 'lucide-react'

import {
  FilterBar,
  FilterSelect,
  ItemCard,
  StatBlock,
  StatGrid,
} from '@/components/data-display'
import { EmptyState } from '@/components/feedback'
import { DashboardPageLayout, PageHeader } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { deckListFormatOptions } from '@/features/decks/deck-format-options'
import {
  buildDeckListHref,
  type DeckListQuery,
} from '@/features/decks/deck-list-query'
import {
  deleteDeckAction,
  duplicateDeckAction,
} from '@/features/decks/server/deck-actions'

import { DeckSubmitButton } from './deck-submit-button'

interface DeckListViewProps {
  readonly decks: readonly DeckListItemRecord[]
  readonly totalDeckCount: number
  readonly query: DeckListQuery
  readonly profile: ProfileRecord
}

function formatDate(value: string) {
  return value.slice(0, 10)
}

export function DeckListView({
  decks,
  totalDeckCount,
  query,
  profile,
}: DeckListViewProps) {
  const hasPersistedDecks = totalDeckCount > 0
  const hasFilteredDecks = decks.length > 0

  return (
    <DashboardPageLayout
      containerSize="wide"
      header={
        <PageHeader
          eyebrow={<Badge variant="outline">Deck Workspace</Badge>}
          title="My Decks"
          description={
            <>
              Persisted deck overview for{' '}
              <span className="font-medium text-foreground">
                {profile.displayName}
              </span>
              . The page stays profile-owned, repository-backed, and canonical
              card semantics remain inside deck data rather than leaking into
              UI-only state.
            </>
          }
          actions={
            <Link
              href="/decks/create"
              className={buttonVariants({
                variant: 'default',
                size: 'default',
              })}
              aria-label="Create deck"
            >
              <Plus className="size-4" />
              Create deck
            </Link>
          }
        />
      }
      contentClassName="space-y-4"
    >
      <FilterBar className="items-end justify-between gap-4">
        <form method="get" className="flex flex-1 flex-col gap-3 sm:flex-row">
          <FilterSelect
            name="format"
            label="Format"
            defaultValue={query.formatId}
            options={deckListFormatOptions}
            className="min-w-[12rem]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="outline" size="sm">
              Apply filters
            </Button>
            {query.formatId !== 'all' ? (
              <Link
                href={buildDeckListHref({ formatId: 'all' })}
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                Clear
              </Link>
            ) : null}
          </div>
        </form>
        <Badge variant="secondary">
          {hasFilteredDecks ? decks.length : 0} of {totalDeckCount} deck
          {totalDeckCount === 1 ? '' : 's'}
        </Badge>
      </FilterBar>

      {!hasPersistedDecks ? (
        <EmptyState
          title="No decks yet"
          description="Start with an empty deck shell, choose the target format, and use this page as the stable entry point into the rest of the deck workflow."
          actionLabel="Create your first deck"
          actionHref="/decks/create"
        />
      ) : !hasFilteredDecks ? (
        <EmptyState
          title="No decks match this filter"
          description="The current profile has persisted decks, but none of them belong to the selected format filter."
          actionLabel="Show all decks"
          actionHref={buildDeckListHref({ formatId: 'all' })}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {decks.map((deck) => (
            <ItemCard
              key={deck.id}
              title={deck.title}
              subtitle={
                deck.description ??
                'No deck description has been saved for this deck yet.'
              }
              badges={
                <>
                  <Badge variant="secondary">{deck.format.displayName}</Badge>
                  {deck.currentVersionNumber ? (
                    <Badge variant="outline">
                      v{deck.currentVersionNumber}
                    </Badge>
                  ) : null}
                  {deck.archivedAt ? (
                    <Badge variant="warning">Archived</Badge>
                  ) : null}
                </>
              }
              contentClassName="text-sm text-muted-foreground"
              footer={
                <>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>Updated: {formatDate(deck.updatedAt)}</p>
                    <p>Created: {formatDate(deck.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <form action={duplicateDeckAction}>
                      <input type="hidden" name="deckId" value={deck.id} />
                      <DeckSubmitButton
                        label="Duplicate"
                        pendingLabel="Duplicating..."
                        variant="outline"
                        size="sm"
                        aria-label={`Duplicate ${deck.title}`}
                      >
                        <Copy className="size-4" />
                        Duplicate
                      </DeckSubmitButton>
                    </form>
                    <form action={deleteDeckAction}>
                      <input type="hidden" name="deckId" value={deck.id} />
                      <DeckSubmitButton
                        label="Delete"
                        pendingLabel="Deleting..."
                        confirmMessage={`Delete "${deck.title}"?`}
                        variant="destructive"
                        size="sm"
                        aria-label={`Delete ${deck.title}`}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </DeckSubmitButton>
                    </form>
                    <Link
                      href={`/decks/${encodeURIComponent(deck.id)}`}
                      className={buttonVariants({
                        variant: 'default',
                        size: 'sm',
                      })}
                    >
                      Open
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </>
              }
            >
              <StatGrid columns={4}>
                <StatBlock label="Main" value={deck.sectionCounts.main} />
                <StatBlock label="Ride" value={deck.sectionCounts.ride} />
                <StatBlock label="G" value={deck.sectionCounts.g} />
                <StatBlock
                  label="Total"
                  value={deck.totalCards}
                  tone="accent"
                />
              </StatGrid>
            </ItemCard>
          ))}
        </div>
      )}
    </DashboardPageLayout>
  )
}
