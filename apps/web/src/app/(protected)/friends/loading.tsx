import { LoadingState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'

export default function FriendsLoading() {
  return (
    <PageContainer
      as="section"
      size="wide"
      className="flex min-h-[calc(100vh-10rem)] items-center py-8"
    >
      <LoadingState
        title="Loading friends dashboard"
        description="Resolving active friendships and pending requests."
      />
    </PageContainer>
  )
}
