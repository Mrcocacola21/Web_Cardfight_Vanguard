import { MatchStatsView } from '@/components/matches/match-stats-view'
import { EmptyState, ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { getMatchStatsPageState } from '@/features/matches/server/match-stats-read'

export default async function MatchStatsPage() {
  const state = await getMatchStatsPageState()

  if (state.kind === 'error') {
    return (
      <PageContainer
        as="section"
        size="wide"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <ErrorState
          title="Match stats are unavailable"
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
          description="Match stats stay attached to your app-facing profile surface. Finish creating the profile before opening this owner-only analytics route."
          actionLabel="Open profile"
          actionHref="/profile"
        />
      </PageContainer>
    )
  }

  return (
    <MatchStatsView
      viewerDisplayName={state.viewerDisplayName}
      stats={state.stats}
    />
  )
}
