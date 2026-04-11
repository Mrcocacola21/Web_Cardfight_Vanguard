import { DeckListView } from '@/components/decks/deck-list-view'
import { EmptyState, ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import {
  filterDeckListItems,
  resolveDeckListQuery,
} from '@/features/decks/deck-list-query'
import { listDecksByOwnerProfileId } from '@/features/decks/server/deck-read'
import { getCurrentProfileState } from '@/features/profiles/server/profile-read'

interface DecksPageProps {
  readonly searchParams?: Promise<
    Record<string, string | readonly string[] | undefined>
  >
}

export default async function DecksPage({ searchParams }: DecksPageProps) {
  const profileState = await getCurrentProfileState()

  if (profileState.kind !== 'ready') {
    return (
      <PageContainer
        as="section"
        size="default"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <ErrorState
          title="Deck flow is unavailable"
          description={
            profileState.kind === 'error'
              ? profileState.message
              : 'The protected decks route could not resolve the authenticated session.'
          }
          actionLabel="Back home"
          actionHref="/"
        />
      </PageContainer>
    )
  }

  if (!profileState.profile) {
    return (
      <PageContainer
        as="section"
        size="default"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <EmptyState
          title="No profile row for deck ownership"
          description="The authenticated session exists, but no persisted profile row is available yet. Deck reads stay attached to profile-owned data, so create the profile record first."
          actionLabel="Open profile"
          actionHref="/profile"
        />
      </PageContainer>
    )
  }

  const query = resolveDeckListQuery((await searchParams) ?? {})
  const decksResult = await listDecksByOwnerProfileId(profileState.profile.id)

  if (!decksResult.ok) {
    return (
      <PageContainer
        as="section"
        size="default"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <ErrorState
          title="Deck list is unavailable"
          description="The server-side deck read flow failed. Persistence is still isolated behind repositories, but the deck list could not be loaded."
          actionLabel="Back home"
          actionHref="/"
        />
      </PageContainer>
    )
  }

  return (
    <DeckListView
      decks={filterDeckListItems(decksResult.data, query)}
      totalDeckCount={decksResult.data.length}
      query={query}
      profile={profileState.profile}
    />
  )
}
