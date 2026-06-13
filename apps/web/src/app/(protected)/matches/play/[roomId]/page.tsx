import { notFound } from 'next/navigation'

import { ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { PersistedProjectedMatchRoomClient } from '@/components/matches/persisted-projected-match-room-client'
import { getProjectedPersistedMatchRoomPageState } from '@/features/matches/server/projected-persisted-room-read'

interface MatchPlayPageProps {
  readonly params: Promise<{
    roomId: string
  }>
}

export default async function MatchPlayPage({ params }: MatchPlayPageProps) {
  const { roomId } = await params
  const pageState = await getProjectedPersistedMatchRoomPageState({
    roomId: decodeURIComponent(roomId),
  })

  if (pageState.kind === 'not_found') {
    notFound()
  }

  if (pageState.kind === 'error') {
    return (
      <PageContainer
        as="main"
        size="default"
        className="flex min-h-screen items-center py-14"
      >
        <ErrorState
          title={pageState.title}
          description={pageState.message}
          actionLabel="Back to matches"
          actionHref="/matches"
        />
      </PageContainer>
    )
  }

  return <PersistedProjectedMatchRoomClient initialRoom={pageState.room} />
}
