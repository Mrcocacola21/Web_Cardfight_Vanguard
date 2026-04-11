import { EmptyState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'

export default function CatalogProductNotFound() {
  return (
    <PageContainer
      as="main"
      size="default"
      className="flex min-h-screen items-center py-14"
    >
      <EmptyState
        title="Product not found"
        description="No published catalog product matches this release route."
        actionLabel="Back to catalog"
        actionHref="/catalog"
      />
    </PageContainer>
  )
}
