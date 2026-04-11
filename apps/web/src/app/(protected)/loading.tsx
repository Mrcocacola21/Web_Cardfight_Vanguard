import { LoadingState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'

export default function ProtectedLoading() {
  return (
    <PageContainer
      as="main"
      size="default"
      className="flex min-h-[calc(100vh-10rem)] items-center py-8"
    >
      <LoadingState
        title="Loading protected area"
        description="Resolving your session and preparing the current page."
      />
    </PageContainer>
  )
}
