import { notFound } from 'next/navigation'

import { ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
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
      <PageContainer
        as="main"
        size="default"
        className="flex min-h-screen items-center py-14"
      >
        <ErrorState
          title="Public profile is unavailable"
          description={state.message}
          actionLabel="Back home"
          actionHref="/"
        />
      </PageContainer>
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
