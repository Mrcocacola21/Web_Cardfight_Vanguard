import { EmptyState, ErrorState } from '@/components/feedback'
import { Badge } from '@/components/ui/badge'
import {
  DetailPageLayout,
  PageContainer,
  PageHeader,
} from '@/components/layout'
import { ProfileEditor } from '@/components/profiles/profile-editor'
import { ProfileSummary } from '@/components/profiles/profile-summary'
import { getCurrentProfileState } from '@/features/profiles/server/profile-read'

export default async function ProfilePage() {
  const state = await getCurrentProfileState()

  if (state.kind !== 'ready') {
    return (
      <PageContainer
        as="section"
        size="default"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <ErrorState
          title="Profile flow is unavailable"
          description={
            state.kind === 'error'
              ? state.message
              : 'The protected profile route could not resolve the authenticated session.'
          }
          actionLabel="Back home"
          actionHref="/"
        />
      </PageContainer>
    )
  }

  const initialValues = {
    displayName: state.profile?.displayName ?? '',
    avatarUrl: state.profile?.avatarUrl ?? '',
    bio: state.profile?.bio ?? '',
    visibility: state.profile?.visibility ?? 'private',
  }

  return (
    <DetailPageLayout
      containerSize="default"
      variant="split"
      header={
        <PageHeader
          eyebrow={<Badge variant="outline">Own Profile</Badge>}
          title="My Profile"
          description="Minimal server-side profile foundation. Reads and writes stay in the repository layer; the app only orchestrates the flow."
          meta={
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Authenticated as {state.authUser.email ?? state.authUser.id}
            </p>
          }
        />
      }
      main={
        state.profile ? (
          <ProfileSummary
            profile={state.profile}
            title="Current persisted profile"
            description="Current user-facing profile data resolved from the server-side repository path."
          />
        ) : (
          <EmptyState
            title="No profile row yet"
            description={`The authenticated session exists for ${state.authUser.email ?? 'this user'}, but no persisted profile record exists yet. The first save below will create it.`}
          />
        )
      }
      aside={<ProfileEditor initialValues={initialValues} />}
    />
  )
}
