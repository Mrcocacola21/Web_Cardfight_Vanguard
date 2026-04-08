import { SignOutButton } from '@/components/auth/sign-out-button'
import { ProfileEditor } from '@/components/profiles/profile-editor'
import { ProfileStatusCard } from '@/components/profiles/profile-status-card'
import { ProfileSummary } from '@/components/profiles/profile-summary'
import { getCurrentProfileState } from '@/features/profiles/server/profile-read'

export default async function ProfilePage() {
  const state = await getCurrentProfileState()

  if (state.kind !== 'ready') {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-14 md:px-10">
        <ProfileStatusCard
          title="Profile flow is unavailable"
          description={
            state.kind === 'error'
              ? state.message
              : 'The protected profile route could not resolve the authenticated session.'
          }
          actionLabel="Back home"
          actionHref="/"
        />
      </main>
    )
  }

  const initialValues = {
    displayName: state.profile?.displayName ?? '',
    avatarUrl: state.profile?.avatarUrl ?? '',
    bio: state.profile?.bio ?? '',
    visibility: state.profile?.visibility ?? 'private',
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-14 md:px-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            My Profile
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
            Minimal server-side profile foundation. Reads and writes stay in the
            repository layer; the app only orchestrates the flow.
          </p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Authenticated as {state.authUser.email ?? state.authUser.id}
          </p>
        </div>
        <SignOutButton />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {state.profile ? (
          <ProfileSummary
            profile={state.profile}
            title="Current persisted profile"
            description="Current user-facing profile data resolved from the server-side repository path."
          />
        ) : (
          <ProfileStatusCard
            title="No profile row yet"
            description={`The authenticated session exists for ${state.authUser.email ?? 'this user'}, but no persisted profile record exists yet. The first save below will create it.`}
          />
        )}
        <ProfileEditor initialValues={initialValues} />
      </div>
    </main>
  )
}
