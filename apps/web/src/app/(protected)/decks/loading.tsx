import { LoadingState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'

export default function DecksLoading() {
  return (
    <PageContainer
      as="section"
      size="default"
      className="flex min-h-[calc(100vh-10rem)] items-center py-8"
    >
      <LoadingState
        title="Loading decks"
        description="Preparing your persisted deck list and available deck actions."
      />
    </PageContainer>
  )
}
