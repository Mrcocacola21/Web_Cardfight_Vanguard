import Link from 'next/link'
import { ArrowRight, BarChart3, Plus, Users } from 'lucide-react'

import { ItemCard, StatBlock, StatGrid } from '@/components/data-display'
import { EmptyState } from '@/components/feedback'
import { DashboardPageLayout, PageHeader } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import type { FriendOpponentStatsView as FriendOpponentStatsViewModel } from '@/features/matches/application/match-friend-opponent-stats-use-cases'
import {
  buildMatchFriendOpponentStatsHref,
  type MatchFriendOpponentStatsQuery,
} from '@/features/matches/match-friend-opponent-stats-query'

interface MatchFriendOpponentStatsViewProps {
  readonly viewerDisplayName: string
  readonly query: MatchFriendOpponentStatsQuery
  readonly stats: FriendOpponentStatsViewModel
}

export function MatchFriendOpponentStatsView({
  viewerDisplayName,
  query,
  stats,
}: MatchFriendOpponentStatsViewProps) {
  const hasCurrentFriends = stats.totalCurrentFriends > 0

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
              <Badge variant="secondary">Vs friends</Badge>
            </>
          }
          title="Friend Opponent Stats"
          description="Owner-only match aggregates filtered to opponents who are current active friends. This page stays a personal read surface over your own match records rather than a shared bilateral stats system."
          meta={
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{viewerDisplayName}</span>
              <span aria-hidden="true">|</span>
              <span>{stats.totalCurrentFriends} current friends</span>
              <span aria-hidden="true">|</span>
              <span>
                {stats.friendsWithTrackedMatches} with tracked matches
              </span>
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
                Personal stats
              </Link>
              <Link
                href="/matches"
                className={buttonVariants({
                  variant: 'outline',
                })}
              >
                Match history
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
      {!hasCurrentFriends ? (
        <EmptyState
          title="No active friends yet"
          description="Friend-opponent stats only appear once the current social graph contains accepted friendships. Add friends first, then recorded owner matches can be sliced against those current friend profiles."
          actionLabel="Open friends dashboard"
          actionHref="/friends"
        />
      ) : (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <ItemCard
            title="Current friend summaries"
            subtitle="Summaries stay scoped to current active friendships. Former friends do not appear in this route, even if historical match records still exist."
            badges={
              <>
                <Badge variant="outline">Current scope</Badge>
                <Badge variant="secondary">
                  {stats.friendSummaries.length} friends
                </Badge>
              </>
            }
          >
            <div className="space-y-3">
              {stats.friendSummaries.map((friend) => {
                const isSelected =
                  friend.friendProfileId === stats.selectedFriendProfileId

                return (
                  <div
                    key={friend.friendProfileId}
                    className="rounded-2xl border border-border/70 bg-background-elevated/68 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">
                            {friend.friendDisplayName}
                          </p>
                          {isSelected ? (
                            <Badge variant="secondary">Selected</Badge>
                          ) : null}
                          {!friend.friendProfileVisible ? (
                            <Badge variant="outline">Limited profile</Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatRecord(
                            friend.wins,
                            friend.losses,
                            friend.draws,
                          )}
                          <span aria-hidden="true"> | </span>
                          {friend.totalMatches} tracked match
                          {friend.totalMatches === 1 ? '' : 'es'}
                          <span aria-hidden="true"> | </span>
                          {formatWinRate(friend.winRate)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {friend.latestMatchAt
                            ? `Latest tracked match: ${formatDate(friend.latestMatchAt)}`
                            : 'No tracked matches vs this friend yet.'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {friend.friendProfileVisible ? (
                          <Link
                            href={`/users/${encodeURIComponent(friend.friendProfileId)}`}
                            className={buttonVariants({
                              variant: 'ghost',
                              size: 'sm',
                            })}
                          >
                            View profile
                            <ArrowRight className="size-4" />
                          </Link>
                        ) : null}
                        <Link
                          href={buildMatchFriendOpponentStatsHref({
                            friendProfileId: friend.friendProfileId,
                          })}
                          className={buttonVariants({
                            variant: isSelected ? 'secondary' : 'outline',
                            size: 'sm',
                          })}
                        >
                          {isSelected ? 'Selected' : 'View stats'}
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ItemCard>

          <FriendDetailCard query={query} stats={stats} />
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
              This page stays owner-only and current-friend-scoped. Pending
              requests, strangers, and former friends do not create visibility
              into your personal match records or stats summaries here.
            </p>
          </div>
          <Link
            href="/matches/stats"
            className={buttonVariants({
              variant: 'outline',
              size: 'sm',
            })}
          >
            Back to personal stats
          </Link>
        </div>
      </section>
    </DashboardPageLayout>
  )
}

function FriendDetailCard({
  query,
  stats,
}: {
  readonly query: MatchFriendOpponentStatsQuery
  readonly stats: FriendOpponentStatsViewModel
}) {
  const selectedFriend = stats.selectedFriend

  return (
    <ItemCard
      title={
        selectedFriend
          ? `${selectedFriend.friendDisplayName} detail`
          : 'Friend detail'
      }
      subtitle={
        selectedFriend
          ? 'Derived from owner-owned completed matches where the linked opponent is the selected current friend.'
          : 'Select a current friend to inspect the scoped summary.'
      }
      badges={
        selectedFriend ? (
          <>
            <Badge variant="outline">Selected friend</Badge>
            {query.friendProfileId ? (
              <Badge variant="secondary">Query scoped</Badge>
            ) : (
              <Badge variant="secondary">Default selection</Badge>
            )}
          </>
        ) : (
          <Badge variant="outline">No selection</Badge>
        )
      }
      actions={
        query.friendProfileId ? (
          <Link
            href={buildMatchFriendOpponentStatsHref({
              friendProfileId: null,
            })}
            className={buttonVariants({
              variant: 'ghost',
              size: 'sm',
            })}
          >
            Clear selection
          </Link>
        ) : null
      }
    >
      {!selectedFriend ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-background-elevated/45 p-5 text-sm text-muted-foreground">
          Friend-opponent detail appears once a current friend is selected.
        </div>
      ) : selectedFriend.totalMatches === 0 ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-border/70 bg-background-elevated/45 p-5">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                No tracked matches vs {selectedFriend.friendDisplayName} yet
              </p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              The friendship is active, but the current owner history does not
              contain completed tracked results against this friend yet.
            </p>
          </div>
          <StatGrid columns={4}>
            <StatBlock label="Total matches" value={0} tone="accent" />
            <StatBlock label="Wins" value={0} />
            <StatBlock label="Losses" value={0} />
            <StatBlock label="Draws" value={0} />
          </StatGrid>
        </div>
      ) : (
        <div className="space-y-4">
          <StatGrid columns={4}>
            <StatBlock
              label="Total matches"
              value={selectedFriend.totalMatches}
              tone="accent"
            />
            <StatBlock label="Wins" value={selectedFriend.wins} />
            <StatBlock label="Losses" value={selectedFriend.losses} />
            <StatBlock label="Draws" value={selectedFriend.draws} />
          </StatGrid>

          <div className="rounded-2xl border border-border/70 bg-background-elevated/72 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Win rate vs selected friend
                </p>
                <p className="text-3xl font-semibold tracking-tight">
                  {formatWinRate(selectedFriend.winRate)}
                </p>
              </div>
              <div className="space-y-1 text-right text-sm text-muted-foreground">
                <p>
                  Latest tracked match:{' '}
                  {selectedFriend.latestMatchAt
                    ? formatDate(selectedFriend.latestMatchAt)
                    : 'N/A'}
                </p>
                <p>
                  Based on{' '}
                  {formatRecord(
                    selectedFriend.wins,
                    selectedFriend.losses,
                    selectedFriend.draws,
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Top decks</Badge>
              <p className="text-sm text-muted-foreground">
                Most-used owner decks against this selected friend.
              </p>
            </div>
            <div className="space-y-3">
              {selectedFriend.topDecks.map((deck, index) => (
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
                      {deck.matchCount} tracked match
                      {deck.matchCount === 1 ? '' : 'es'} against this friend.
                    </p>
                  </div>
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
              ))}
            </div>
          </div>
        </div>
      )}
    </ItemCard>
  )
}

function formatDate(value: string) {
  return value.slice(0, 10)
}

function formatRecord(wins: number, losses: number, draws: number) {
  return `${wins}-${losses}-${draws}`
}

function formatWinRate(winRate: number | null) {
  if (winRate === null) {
    return 'N/A'
  }

  return `${(winRate * 100).toFixed(1)}%`
}
