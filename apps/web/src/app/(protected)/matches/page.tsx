import { MatchHistoryListView } from '@/components/matches/match-history-list-view'
import { EmptyState, ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { resolveMatchHistoryListQuery } from '@/features/matches/match-history-list-query'
import { getMatchHistoryListPageState } from '@/features/matches/server/match-history-list-read'

interface MatchesPageProps {
  readonly searchParams?: Promise<
    Record<string, string | readonly string[] | undefined>
  >
}

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const query = resolveMatchHistoryListQuery((await searchParams) ?? {})
  const state = await getMatchHistoryListPageState(query)

  if (state.kind === 'error') {
    return (
      <PageContainer
        as="section"
        size="wide"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <ErrorState
          title="Match history is unavailable"
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
          description="Match history stays attached to your app-facing profile surface. Finish creating the profile before opening this owner-owned route."
          actionLabel="Open profile"
          actionHref="/profile"
        />
      </PageContainer>
    )
  }

  return (
    <MatchHistoryListView
      viewerDisplayName={state.viewerDisplayName}
      matches={state.matches}
      totalMatchCount={state.totalMatchCount}
      query={state.query}
      availableDecks={state.availableDecks}
    />
  )
}
