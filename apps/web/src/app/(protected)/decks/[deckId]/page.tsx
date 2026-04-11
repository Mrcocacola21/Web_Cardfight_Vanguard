import { notFound } from 'next/navigation'

import { DeckBuilderView } from '@/components/decks/deck-builder-view'
import { EmptyState, ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { resolveDeckBuilderQuery } from '@/features/decks/deck-builder-query'
import { listDeckBuilderCatalogCards } from '@/features/decks/server/deck-builder-read'
import { getDeckDetailById } from '@/features/decks/server/deck-read'
import { getCurrentProfileState } from '@/features/profiles/server/profile-read'

interface DeckDetailPageProps {
  readonly params: Promise<{
    deckId: string
  }>
  readonly searchParams?: Promise<
    Record<string, string | readonly string[] | undefined>
  >
}

export default async function DeckDetailPage({
  params,
  searchParams,
}: DeckDetailPageProps) {
  const profileState = await getCurrentProfileState()

  if (profileState.kind !== 'ready') {
    return (
      <PageContainer
        as="section"
        size="default"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <ErrorState
          title="Deck detail is unavailable"
          description={
            profileState.kind === 'error'
              ? profileState.message
              : 'The protected deck detail route could not resolve the authenticated session.'
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
          description="The authenticated session exists, but no persisted profile row is available yet, so this deck detail route cannot resolve profile-owned data."
          actionLabel="Open profile"
          actionHref="/profile"
        />
      </PageContainer>
    )
  }

  const { deckId } = await params
  const deckResult = await getDeckDetailById(decodeURIComponent(deckId))

  if (!deckResult.ok) {
    return (
      <PageContainer
        as="section"
        size="default"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <ErrorState
          title="Deck detail is unavailable"
          description="The repository-backed deck detail flow failed before the page could compose the current deck record."
          actionLabel="Back to decks"
          actionHref="/decks"
        />
      </PageContainer>
    )
  }

  if (
    !deckResult.data ||
    deckResult.data.ownerProfileId !== profileState.profile.id
  ) {
    notFound()
  }

  const query = resolveDeckBuilderQuery((await searchParams) ?? {})
  const catalogResult = await listDeckBuilderCatalogCards({
    formatId: deckResult.data.format.id,
    searchText: query.searchText,
  })

  return (
    <DeckBuilderView
      initialDeck={deckResult.data}
      catalogCards={catalogResult.ok ? catalogResult.data.items : []}
      catalogErrorMessage={
        catalogResult.ok
          ? null
          : 'The published catalog cards could not be loaded for this builder session.'
      }
      query={query}
    />
  )
}
