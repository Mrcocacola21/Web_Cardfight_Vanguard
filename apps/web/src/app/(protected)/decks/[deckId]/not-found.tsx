import { EmptyState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'

export default function DeckDetailNotFound() {
  return (
    <PageContainer
      as="section"
      size="default"
      className="flex min-h-[calc(100vh-10rem)] items-center py-8"
    >
      <EmptyState
        title="Deck not found"
        description="No persisted deck owned by the current profile matches this route."
        actionLabel="Back to decks"
        actionHref="/decks"
      />
    </PageContainer>
  )
}
