import { EmptyState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'

export default function CatalogPrintingNotFound() {
  return (
    <PageContainer
      as="main"
      size="default"
      className="flex min-h-screen items-center py-14"
    >
      <EmptyState
        title="Printing not found"
        description="No published catalog printing matches this route."
        actionLabel="Back to catalog"
        actionHref="/catalog"
      />
    </PageContainer>
  )
}
