import { DeckStatusCard } from '@/components/decks/deck-status-card'

export default function DeckDetailNotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-14 md:px-10">
      <DeckStatusCard
        title="Deck not found"
        description="No persisted deck owned by the current profile matches this route."
        actionLabel="Back to decks"
        actionHref="/decks"
      />
    </main>
  )
}
