import Link from 'next/link'
import { ArrowRight, BarChart3, Plus } from 'lucide-react'

import { ItemCard, StatBlock, StatGrid } from '@/components/data-display'
import { EmptyState } from '@/components/feedback'
import { DashboardPageLayout, PageHeader } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import type { MatchStatsView as MatchStatsViewModel } from '@/features/matches/application/match-stats-use-cases'

interface MatchStatsViewProps {
  readonly viewerDisplayName: string
  readonly stats: MatchStatsViewModel
}

export function MatchStatsView({
  viewerDisplayName,
  stats,
}: MatchStatsViewProps) {
  const hasTrackedMatches = stats.totalMatches > 0

  return (
    <DashboardPageLayout
      containerSize="wide"
      className="min-h-screen"
      contentClassName="space-y-6"
      header={
        <PageHeader
          eyebrow={
            <>
              <Badge variant="outline">Matches</Badge>
              <Badge variant="secondary">Owner stats</Badge>
            </>
          }
          title="Match Stats"
          description="Owner-only aggregate match stats derived from recorded match history. This route summarizes completed tracked matches without creating a second mutable source of truth."
          meta={
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{viewerDisplayName}</span>
              <span aria-hidden="true">|</span>
              <span>{stats.totalMatches} tracked matches</span>
              <span aria-hidden="true">|</span>
              <span>Winrate from completed results</span>
            </div>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/matches/friends"
                className={buttonVariants({
                  variant: 'outline',
                })}
              >
                Vs friends
              </Link>
              <Link
                href="/matches"
                className={buttonVariants({
                  variant: 'outline',
                })}
              >
                View history
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
      {!hasTrackedMatches ? (
        <EmptyState
          title="No tracked match stats yet"
          description="Stats only appear once you have completed matches with stable win, loss, or draw results. Record the first match to start building personal analytics."
          actionLabel="Record your first match"
          actionHref="/matches/new"
        />
      ) : (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <ItemCard
            title="Summary"
            subtitle="Derived from completed owner matches with tracked win, loss, or draw results."
            badges={<Badge variant="outline">Personal analytics</Badge>}
          >
            <StatGrid columns={4}>
              <StatBlock
                label="Total matches"
                value={stats.totalMatches}
                tone="accent"
              />
              <StatBlock label="Wins" value={stats.wins} />
              <StatBlock label="Losses" value={stats.losses} />
              <StatBlock label="Draws" value={stats.draws} />
            </StatGrid>
            <div className="rounded-2xl border border-border/70 bg-background-elevated/72 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Win rate
                  </p>
                  <p className="text-3xl font-semibold tracking-tight">
                    {formatWinRate(stats.winRate)}
                  </p>
                </div>
                <Badge variant="secondary">wins / tracked matches</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Baseline formula: wins divided by completed tracked matches.
                Pending, voided, or malformed result rows do not contribute.
              </p>
            </div>
          </ItemCard>

          <ItemCard
            title="Most used decks"
            subtitle="Top linked decks across completed tracked matches."
            badges={
              <>
                <Badge variant="outline">Top decks</Badge>
                <Badge variant="secondary">Top {stats.topDecks.length}</Badge>
              </>
            }
          >
            <div className="space-y-3">
              {stats.topDecks.map((deck, index) => (
                <div
                  key={`${deck.deckId ?? 'missing'}:${deck.label}:${index}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background-elevated/65 p-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <p className="font-medium text-foreground">
                        {deck.label}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {deck.deckId
                        ? 'Current deck link still available.'
                        : 'Historical match rows still count even when the original deck link is no longer available.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {deck.matchCount} match{deck.matchCount === 1 ? '' : 'es'}
                    </Badge>
                    {deck.deckId ? (
                      <Link
                        href={`/decks/${encodeURIComponent(deck.deckId)}`}
                        className={buttonVariants({
                          variant: 'ghost',
                          size: 'sm',
                        })}
                      >
                        Open deck
                        <ArrowRight className="size-4" />
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </ItemCard>
        </section>
      )}

      <section className="rounded-2xl border border-border/70 bg-card/95 p-5 shadow-[0_24px_60px_-32px_var(--shadow-color)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium">Scope boundaries</p>
            </div>
            <p className="text-sm text-muted-foreground">
              This route stays focused on personal aggregate stats. Friend-aware
              opponent slices now live on a separate route, while matchup and
              time-series analytics remain intentionally out of scope.
            </p>
          </div>
          <Link
            href="/matches/friends"
            className={buttonVariants({
              variant: 'outline',
              size: 'sm',
            })}
          >
            Open friend stats
          </Link>
        </div>
      </section>
    </DashboardPageLayout>
  )
}

function formatWinRate(winRate: number | null) {
  if (winRate === null) {
    return 'N/A'
  }

  return `${(winRate * 100).toFixed(1)}%`
}
