import { notFound } from 'next/navigation'

import { DeckDetailView } from '@/components/decks/deck-detail-view'
import { DeckStatusCard } from '@/components/decks/deck-status-card'
import { getDeckDetailById } from '@/features/decks/server/deck-read'
import { getCurrentProfileState } from '@/features/profiles/server/profile-read'

interface DeckDetailPageProps {
  readonly params: Promise<{
    deckId: string
  }>
}

export default async function DeckDetailPage({ params }: DeckDetailPageProps) {
  const profileState = await getCurrentProfileState()

  if (profileState.kind !== 'ready') {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-14 md:px-10">
        <DeckStatusCard
          title="Deck detail is unavailable"
          description={
            profileState.kind === 'error'
              ? profileState.message
              : 'The protected deck detail route could not resolve the authenticated session.'
          }
          actionLabel="Back home"
          actionHref="/"
        />
      </main>
    )
  }

  if (!profileState.profile) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-14 md:px-10">
        <DeckStatusCard
          title="No profile row for deck ownership"
          description="The authenticated session exists, but no persisted profile row is available yet, so this deck detail route cannot resolve profile-owned data."
          actionLabel="Open profile"
          actionHref="/profile"
        />
      </main>
    )
  }

  const { deckId } = await params
  const deckResult = await getDeckDetailById(decodeURIComponent(deckId))

  if (!deckResult.ok) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-14 md:px-10">
        <DeckStatusCard
          title="Deck detail is unavailable"
          description="The repository-backed deck detail flow failed before the page could compose the current deck record."
          actionLabel="Back to decks"
          actionHref="/decks"
        />
      </main>
    )
  }

  if (
    !deckResult.data ||
    deckResult.data.ownerProfileId !== profileState.profile.id
  ) {
    notFound()
  }

  return <DeckDetailView deck={deckResult.data} />
}
