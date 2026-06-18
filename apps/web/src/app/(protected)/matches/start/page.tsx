import { DeckToMatchRoomView } from '@/components/matches/deck-to-match-room-view'
import { EmptyState, ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { getDeckToMatchRoomPageState } from '@/features/matches/server/deck-to-match-room-read'

interface StartMatchRoomPageProps {
  readonly searchParams?: Promise<
    Record<string, string | readonly string[] | undefined>
  >
}

export default async function StartMatchRoomPage({
  searchParams,
}: StartMatchRoomPageProps) {
  const resolvedSearchParams:
    | Record<string, string | readonly string[] | undefined>
    | undefined = searchParams === undefined ? undefined : await searchParams
  const deckId = readSearchParam(resolvedSearchParams, 'deckId')
  const state = await getDeckToMatchRoomPageState({
    deckId: decodeURIComponent(deckId),
  })

  if (state.kind === 'error') {
    return (
      <PageContainer
        as="section"
        size="wide"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <ErrorState
          title="Match room setup is unavailable"
          description={state.message}
          actionLabel="Back to decks"
          actionHref="/decks"
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
          description="Deck-backed match rooms are attached to profile-owned participants. Finish profile setup before starting a room."
          actionLabel="Open profile"
          actionHref="/profile"
        />
      </PageContainer>
    )
  }

  if (state.kind === 'deck-unavailable') {
    return (
      <PageContainer
        as="section"
        size="wide"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <EmptyState
          title="Choose a playable Standard deck"
          description={state.message}
          actionLabel="Open decks"
          actionHref="/decks"
        />
      </PageContainer>
    )
  }

  return (
    <DeckToMatchRoomView
      viewerDisplayName={state.viewerDisplayName}
      deck={state.deck}
    />
  )
}

function readSearchParam(
  searchParams:
    | Record<string, string | readonly string[] | undefined>
    | undefined,
  key: string,
): string {
  const value = searchParams?.[key]

  if (typeof value === 'string') {
    return value
  }

  return value?.[0] ?? ''
}
