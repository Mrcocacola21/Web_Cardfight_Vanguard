import { MatchLobbyDetailView } from '@/components/matches/match-lobby-view'
import { EmptyState, ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { getMatchLobbyDetailPageState } from '@/features/matches/server/match-lobby-read'

interface MatchLobbyDetailPageProps {
  readonly params: Promise<{
    readonly inviteId: string
  }>
}

export default async function MatchLobbyDetailPage({
  params,
}: MatchLobbyDetailPageProps) {
  const { inviteId } = await params
  const state = await getMatchLobbyDetailPageState({
    inviteId: decodeURIComponent(inviteId),
  })

  if (state.kind === 'error') {
    return (
      <PageContainer
        as="section"
        size="wide"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <ErrorState
          title="Match lobby is unavailable"
          description={state.message}
          actionLabel="Back to lobbies"
          actionHref="/matches/lobby"
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
          description="Lobby access is profile-owned. Finish profile setup before opening this invite."
          actionLabel="Open profile"
          actionHref="/profile"
        />
      </PageContainer>
    )
  }

  if (state.kind === 'not-found' || state.kind === 'access-denied') {
    return (
      <PageContainer
        as="section"
        size="wide"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <EmptyState
          title={
            state.kind === 'not-found'
              ? 'Lobby invite not found'
              : 'Lobby access denied'
          }
          description={state.message}
          actionLabel="Back to lobbies"
          actionHref="/matches/lobby"
        />
      </PageContainer>
    )
  }

  return <MatchLobbyDetailView state={state} />
}
