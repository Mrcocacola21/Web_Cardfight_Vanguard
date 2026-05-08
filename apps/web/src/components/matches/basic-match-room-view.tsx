'use client'

import { useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'

import type { GameChoiceRequest, GameState, PlayerId } from '@web-vg/rules-core'
import * as matchSession from '@web-vg/match-session'
import type { MatchRoomCommandResult } from '@web-vg/match-session'

import { DashboardPageLayout, PageHeader } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  LOCAL_MATCH_PLAYER_ONE_ID,
  createLocalActionId,
  createLocalPrototypeMatchRoom,
} from '@/features/matches/play/local-match-room'
import {
  buildLocalMatchAvailableActions,
  type LocalAvailableActionIntent,
} from '@/features/matches/play/available-actions'
import {
  appendAcceptedEngineEvents,
  buildLocalMatchEventLogEntries,
  type LocalMatchEventRecord,
} from '@/features/matches/play/event-log'

import { AvailableActionsPanel } from './available-actions-panel'
import { EventLogPanel } from './event-log-panel'
import { MatchBoard } from './match-board'

interface BasicMatchRoomViewProps {
  readonly roomId: string
}

type BasicMatchRoomState =
  | matchSession.InitializedMatchRoom
  | matchSession.InProgressMatchRoom
  | matchSession.CompletedMatchRoom

export function BasicMatchRoomView({ roomId }: BasicMatchRoomViewProps) {
  return <BasicMatchRoomSession key={roomId} roomId={roomId} />
}

function BasicMatchRoomSession({ roomId }: BasicMatchRoomViewProps) {
  const [room, setRoom] = useState<BasicMatchRoomState>(() =>
    createLocalPrototypeMatchRoom(roomId),
  )
  const [lastResult, setLastResult] = useState<MatchRoomCommandResult | null>(
    null,
  )
  const [eventRecords, setEventRecords] = useState<
    readonly LocalMatchEventRecord[]
  >([])
  const actionSequenceRef = useRef(0)

  const engineState = room.engineState
  const firstPendingRequest = engineState.pendingRequests[0]
  const availableActionsProjection = useMemo(
    () => buildLocalMatchAvailableActions(room, LOCAL_MATCH_PLAYER_ONE_ID),
    [room],
  )
  const activePlayer = findPlayer(engineState, engineState.turn.turnPlayerId)
  const participantByPlayerId = useMemo(
    () =>
      new Map(
        room.participants
          .filter((participant) => participant.enginePlayerId !== undefined)
          .map((participant) => [
            participant.enginePlayerId as PlayerId,
            participant,
          ]),
      ),
    [room.participants],
  )
  const activePlayerLabel = activePlayer
    ? formatPlayerLabel(activePlayer.playerId, participantByPlayerId)
    : 'Unknown player'
  const eventLogEntries = useMemo(
    () =>
      buildLocalMatchEventLogEntries(eventRecords, {
        resolvePlayerLabel: (playerId) =>
          formatPlayerLabel(playerId, participantByPlayerId),
      }),
    [eventRecords, participantByPlayerId],
  )

  function nextActionId(label: string) {
    actionSequenceRef.current += 1

    return createLocalActionId(room.revision, actionSequenceRef.current, label)
  }

  function submitCommand(submission: matchSession.MatchRoomCommandSubmission) {
    const result = matchSession.submitMatchRoomCommand(room, submission)

    setLastResult(result)

    if (result.status === 'accepted') {
      setRoom(result.room)
      setEventRecords((records) => appendAcceptedEngineEvents(records, result))
    }
  }

  function submitAvailableAction(action: LocalAvailableActionIntent) {
    const submission = action.createSubmission(nextActionId(action.id))

    if (submission === null) {
      return
    }

    submitCommand(submission)
  }

  function resetRoom() {
    actionSequenceRef.current = 0
    setRoom(createLocalPrototypeMatchRoom(roomId))
    setLastResult(null)
    setEventRecords([])
  }

  return (
    <DashboardPageLayout
      containerSize="wide"
      className="min-h-screen"
      contentClassName="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]"
      header={
        <PageHeader
          eyebrow={
            <>
              <Badge variant="outline">Live match</Badge>
              <Badge variant={getRoomStatusBadgeVariant(room.status)}>
                {formatStatusLabel(room.status)}
              </Badge>
              <Badge variant="secondary">{engineState.formatId}</Badge>
            </>
          }
          title="Match Room"
          meta={
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{room.roomId}</span>
              <span aria-hidden="true">|</span>
              <span>Room r{room.revision}</span>
              <span aria-hidden="true">|</span>
              <span>Engine r{engineState.revision}</span>
              <span aria-hidden="true">|</span>
              <span>{activePlayerLabel}</span>
            </div>
          }
          actions={
            <Button type="button" variant="outline" onClick={resetRoom}>
              <RotateCcw className="size-4" />
              Reset local room
            </Button>
          }
        />
      }
    >
      <div className="grid gap-4">
        <section className="grid gap-4 md:grid-cols-2">
          {engineState.players.map((player) => (
            <PlayerSummaryCard
              key={player.playerId}
              player={player}
              engineState={engineState}
              label={formatPlayerLabel(player.playerId, participantByPlayerId)}
            />
          ))}
        </section>

        <MatchBoard
          engineState={engineState}
          perspectivePlayerId={LOCAL_MATCH_PLAYER_ONE_ID}
          resolvePlayerLabel={(playerId) =>
            formatPlayerLabel(playerId, participantByPlayerId)
          }
        />

        <section className="grid gap-4 lg:grid-cols-2">
          <PendingRequestPanel
            request={firstPendingRequest}
            playerLabel={
              firstPendingRequest
                ? formatPlayerLabel(
                    firstPendingRequest.responderPlayerId,
                    participantByPlayerId,
                  )
                : null
            }
          />
          <ResultFeedbackPanel result={lastResult} />
        </section>

        <EventLogPanel entries={eventLogEntries} />
      </div>

      <aside className="grid content-start gap-4">
        <AvailableActionsPanel
          projection={availableActionsProjection}
          onSubmitAction={submitAvailableAction}
        />

        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <SummaryRow
              label="Room status"
              value={formatStatusLabel(room.status)}
            />
            <SummaryRow
              label="Engine status"
              value={formatStatusLabel(engineState.status)}
            />
            <SummaryRow label="Adapter" value={room.engineAdapterId} />
            <SummaryRow
              label="Pending"
              value={engineState.pendingRequests.length.toString()}
            />
          </CardContent>
        </Card>
      </aside>
    </DashboardPageLayout>
  )
}

function PlayerSummaryCard({
  player,
  label,
  engineState,
}: {
  readonly player: GameState['players'][number]
  readonly label: string
  readonly engineState: GameState
}) {
  const ownedZones = engineState.zones.filter(
    (zone) => zone.ownerPlayerId === player.playerId,
  )
  const pieceCount = ownedZones.reduce(
    (total, zone) => total + zone.occupants.length,
    0,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <CardDescription>
          Seat {player.seat} | {formatStatusLabel(player.status)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-3 text-sm">
        <SummaryMetric label="Zones" value={ownedZones.length.toString()} />
        <SummaryMetric label="Pieces" value={pieceCount.toString()} />
        <SummaryMetric label="Flags" value={player.flags.length.toString()} />
      </CardContent>
    </Card>
  )
}

function PendingRequestPanel({
  request,
  playerLabel,
}: {
  readonly request: GameChoiceRequest | undefined
  readonly playerLabel: string | null
}) {
  if (request === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Request</CardTitle>
          <CardDescription>No engine request is pending.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Request</CardTitle>
        <CardDescription>
          {request.type} for {playerLabel ?? request.responderPlayerId}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <SummaryRow label="Request id" value={request.requestId} />
        <SummaryRow label="Purpose" value={request.purpose} />
        <SummaryRow label="Visibility" value={request.visibility} />
        {'minSelections' in request ? (
          <SummaryRow
            label="Selection"
            value={`${request.minSelections}-${request.maxSelections}`}
          />
        ) : null}
        {'eligiblePieceIds' in request ? (
          <SummaryRow
            label="Eligible pieces"
            value={request.eligiblePieceIds.length.toString()}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function ResultFeedbackPanel({
  result,
}: {
  readonly result: MatchRoomCommandResult | null
}) {
  if (result === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Last Result</CardTitle>
          <CardDescription>No command submitted yet.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (result.status === 'accepted') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Last Result</CardTitle>
          <CardDescription>
            <Badge variant="success">Accepted</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <SummaryRow
            label="Transition"
            value={result.engineResult.transitionId}
          />
          <SummaryRow
            label="Engine revision"
            value={result.room.engineState.revision.toString()}
          />
          <SummaryRow
            label="Events"
            value={
              result.engineResult.events.length === 0
                ? 'None'
                : result.engineResult.events
                    .map((event) => event.type)
                    .join(', ')
            }
          />
        </CardContent>
      </Card>
    )
  }

  if (result.status === 'blocked') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Last Result</CardTitle>
          <CardDescription>
            <Badge variant="warning">Blocked</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <SummaryRow label="Code" value={result.code} />
          <SummaryRow label="Message" value={result.message} />
          <SummaryRow
            label="Blocking"
            value={result.blockingRequests
              .map((request) => request.requestId)
              .join(', ')}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Last Result</CardTitle>
        <CardDescription>
          <Badge variant="destructive">Invalid</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <SummaryRow label="Code" value={result.code} />
        <SummaryRow label="Message" value={result.message} />
      </CardContent>
    </Card>
  )
}

function SummaryMetric({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background-elevated/60 p-3">
      <div className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  )
}

function SummaryRow({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="grid gap-1 rounded-md border border-border/50 bg-background-elevated/45 p-2">
      <span className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </span>
      <span className="break-words text-foreground">{value}</span>
    </div>
  )
}

function findPlayer(engineState: GameState, playerId: PlayerId) {
  return engineState.players.find((player) => player.playerId === playerId)
}

function formatPlayerLabel(
  playerId: PlayerId,
  participantByPlayerId: ReadonlyMap<PlayerId, GameRoomParticipantView>,
) {
  return participantByPlayerId.get(playerId)?.displayName ?? playerId
}

type GameRoomParticipantView = {
  readonly displayName?: string
}

function formatStatusLabel(status: string) {
  return status
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}

function getRoomStatusBadgeVariant(status: matchSession.MatchRoom['status']) {
  switch (status) {
    case 'completed':
      return 'success'
    case 'aborted':
      return 'destructive'
    case 'in_progress':
      return 'default'
    case 'initialized':
      return 'secondary'
    case 'created':
      return 'outline'
  }
}
