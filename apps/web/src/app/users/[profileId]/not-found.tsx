import { EmptyState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'

export default function PublicProfileNotFound() {
  return (
    <PageContainer
      as="main"
      size="default"
      className="flex min-h-screen items-center py-14"
    >
      <EmptyState
        title="Public profile not found"
        description="No public user profile matches this route."
        actionLabel="Back home"
        actionHref="/"
      />
    </PageContainer>
  )
}
