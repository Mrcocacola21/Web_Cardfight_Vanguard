import { BasicMatchRoomView } from '@/components/matches/basic-match-room-view'

interface MatchPlayPageProps {
  readonly params: Promise<{
    roomId: string
  }>
}

export default async function MatchPlayPage({ params }: MatchPlayPageProps) {
  const { roomId } = await params

  return <BasicMatchRoomView roomId={decodeURIComponent(roomId)} />
}
