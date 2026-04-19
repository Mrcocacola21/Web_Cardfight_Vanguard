import { EmptyState, ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { MatchFriendOpponentStatsView } from '@/components/matches/match-friend-opponent-stats-view'
import { resolveMatchFriendOpponentStatsQuery } from '@/features/matches/match-friend-opponent-stats-query'
import { getMatchFriendOpponentStatsPageState } from '@/features/matches/server/match-friend-opponent-stats-read'

interface MatchFriendOpponentStatsPageProps {
  readonly searchParams?: Promise<
    Record<string, string | readonly string[] | undefined>
  >
}

export default async function MatchFriendOpponentStatsPage({
  searchParams,
}: MatchFriendOpponentStatsPageProps) {
  const query = resolveMatchFriendOpponentStatsQuery((await searchParams) ?? {})
  const state = await getMatchFriendOpponentStatsPageState(query)

  if (state.kind === 'error') {
    return (
      <PageContainer
        as="section"
        size="wide"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <ErrorState
          title="Friend-opponent stats are unavailable"
          description={state.message}
          actionLabel="Back home"
          actionHref="/"
        />
      </PageContainer>
    )
  }

  if (state.kind === 'profile-unavailable') {
    return (
      <PageContainer
        as="section"
        size="wide"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <EmptyState
          title="Create your profile first"
          description="Friend-opponent stats stay attached to your app-facing profile row and current friendship graph. Finish profile setup before opening this owner-only route."
          actionLabel="Open profile"
          actionHref="/profile"
        />
      </PageContainer>
    )
  }

  return (
    <MatchFriendOpponentStatsView
      viewerDisplayName={state.viewerDisplayName}
      query={state.query}
      stats={state.stats}
    />
  )
}
