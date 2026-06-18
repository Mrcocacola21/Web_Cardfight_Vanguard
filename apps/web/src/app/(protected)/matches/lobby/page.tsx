import { MatchLobbyIndexView } from '@/components/matches/match-lobby-view'
import { EmptyState, ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { getMatchLobbyIndexPageState } from '@/features/matches/server/match-lobby-read'

export default async function MatchLobbyIndexPage() {
  const state = await getMatchLobbyIndexPageState()

  if (state.kind === 'error') {
    return (
      <PageContainer
        as="section"
        size="wide"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <ErrorState
          title="Match lobbies are unavailable"
          description={state.message}
          actionLabel="Back to matches"
          actionHref="/matches"
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
          description="Invites and lobby participants are attached to app profiles. Finish profile setup before starting a human match."
          actionLabel="Open profile"
          actionHref="/profile"
        />
      </PageContainer>
    )
  }

  return <MatchLobbyIndexView state={state} />
}
