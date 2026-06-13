import { EmptyState, ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { FriendsDashboardRealtimeClient } from '@/components/social/friends-dashboard-realtime-client'
import { createSocialFriendsDashboardSnapshot } from '@/features/social/realtime/friends-dashboard-realtime'
import { getFriendsDashboardPageState } from '@/features/social/server/friends-dashboard-read'

export default async function FriendsPage() {
  const state = await getFriendsDashboardPageState()

  if (state.kind === 'error') {
    return (
      <PageContainer
        as="section"
        size="wide"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <ErrorState
          title="Friends dashboard is unavailable"
          description={state.message}
          actionLabel="Back home"
          actionHref="/"
        />
      </PageContainer>
    )
  }

  if (state.kind === 'profile-unavailable') {
    return (
      <PageContainer
        as="section"
        size="wide"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <EmptyState
          title="Create your profile first"
          description="Friends and requests are anchored to your app-facing profile surface. Finish your profile before opening the social dashboard."
          actionLabel="Open profile"
          actionHref="/profile"
        />
      </PageContainer>
    )
  }

  return (
    <FriendsDashboardRealtimeClient
      initialSnapshot={createSocialFriendsDashboardSnapshot(
        state,
        new Date().toISOString(),
      )}
    />
  )
}
