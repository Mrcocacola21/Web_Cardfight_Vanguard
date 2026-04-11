import { EmptyState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'

export default function CatalogCardNotFound() {
  return (
    <PageContainer
      as="main"
      size="default"
      className="flex min-h-screen items-center py-14"
    >
      <EmptyState
        title="Card not found"
        description="No published canonical card matches this catalog route."
        actionLabel="Back to catalog"
        actionHref="/catalog"
      />
    </PageContainer>
  )
}
