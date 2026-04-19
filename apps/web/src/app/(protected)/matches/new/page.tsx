import { EmptyState, ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { ManualMatchEntryView } from '@/components/matches/manual-match-entry-view'
import { getManualMatchEntryPageState } from '@/features/matches/server/manual-match-entry-read'

export default async function NewMatchPage() {
  const state = await getManualMatchEntryPageState()

  if (state.kind === 'error') {
    return (
      <PageContainer
        as="section"
        size="wide"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <ErrorState
          title="Manual match entry is unavailable"
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
          description="Manual match history is anchored to your app-facing profile row. Finish profile setup before recording matches."
          actionLabel="Open profile"
          actionHref="/profile"
        />
      </PageContainer>
    )
  }

  if (state.kind === 'decks-unavailable') {
    return (
      <PageContainer
        as="section"
        size="wide"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <EmptyState
          title="Create a deck first"
          description="Manual match entry requires one of your own persisted decks so the match can attach to a real deck version."
          actionLabel="Open decks"
          actionHref="/decks"
        />
      </PageContainer>
    )
  }

  return (
    <ManualMatchEntryView
      viewerDisplayName={state.viewerDisplayName}
      deckOptions={state.deckOptions}
      defaultPlayedOn={state.defaultPlayedOn}
    />
  )
}
