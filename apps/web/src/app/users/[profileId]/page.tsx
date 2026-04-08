import { notFound } from 'next/navigation'

import { ProfileStatusCard } from '@/components/profiles/profile-status-card'
import { PublicProfileView } from '@/components/profiles/public-profile-view'
import { getPublicProfilePageState } from '@/features/profiles/server/public-profile-read'

interface PublicProfilePageProps {
  readonly params: Promise<{
    profileId: string
  }>
}

export default async function PublicProfilePage({
  params,
}: PublicProfilePageProps) {
  const { profileId } = await params
  const resolvedProfileId = decodeURIComponent(profileId).trim()

  if (!resolvedProfileId) {
    notFound()
  }

  const state = await getPublicProfilePageState(resolvedProfileId)

  if (state.kind === 'error') {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-14 md:px-10">
        <ProfileStatusCard
          title="Public profile is unavailable"
          description={state.message}
          actionLabel="Back home"
          actionHref="/"
        />
      </main>
    )
  }

  if (state.kind === 'not-found') {
    notFound()
  }

  return (
    <PublicProfileView
      profile={state.profile}
      isOwnerViewer={state.isOwnerViewer}
    />
  )
}
