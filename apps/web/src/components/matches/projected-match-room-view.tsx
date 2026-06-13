'use client'

import { RotateCcw } from 'lucide-react'

import type { PlayerId, VisibleGameChoiceRequest } from '@web-vg/rules-core'

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
import type {
  MatchClientActionView,
  MatchClientActionsProjection,
  ProjectedMatchPlayerSummary,
  ProjectedMatchRoomClientState,
} from '@/features/matches/play/projected-client-state'

import { AvailableActionsPanel } from './available-actions-panel'
import { EventLogPanel } from './event-log-panel'
import { MatchBoard } from './match-board'

export type ProjectedMatchCommandFeedback =
  | {
      readonly status: 'accepted'
      readonly transitionId: string
      readonly engineRevision: number
      readonly eventTypes: readonly string[]
    }
  | {
      readonly status: 'blocked'
      readonly code: string
      readonly message: string
      readonly blockingRequestIds: readonly string[]
    }
  | {
      readonly status: 'invalid'
      readonly code: string
      readonly message: string
    }
  | {
      readonly status: 'unknown'
      readonly code: string
      readonly message: string
    }

export type ProjectedMatchRoomSyncStatus =
  | {
      readonly status: 'connected' | 'synced' | 'recovered'
      readonly label: string
    }
  | {
      readonly status: 'syncing' | 'submitting' | 'reconnecting'
      readonly label: string
    }
  | {
      readonly status: 'error' | 'recovery_failed'
      readonly label: string
      readonly message: string
    }

export type ProjectedMatchClientAuthorityState =
  | {
      readonly status: 'authoritative'
      readonly label: string
      readonly roomRevision: number
      readonly message: string
    }
  | {
      readonly status: 'optimistic_pending'
      readonly label: string
      readonly actionLabel: string
      readonly commandId: string
      readonly expectedRoomRevision: number
      readonly expectedEngineRevision: number
      readonly message: string
    }
  | {
      readonly status: 'authoritative_applied'
      readonly label: string
      readonly actionLabel: string
      readonly commandId: string
      readonly expectedRoomRevision: number
      readonly authoritativeRoomRevision: number
      readonly authoritativeEngineRevision: number
      readonly message: string
    }
  | {
      readonly status: 'stale_conflicted'
      readonly label: string
      readonly actionLabel: string
      readonly commandId: string
      readonly expectedRoomRevision: number
      readonly authoritativeRoomRevision: number
      readonly code: string
      readonly message: string
    }
  | {
      readonly status: 'recovering'
      readonly label: string
      readonly actionLabel?: string
      readonly expectedRoomRevision?: number
      readonly message: string
    }
  | {
      readonly status: 'submission_failed'
      readonly label: string
      readonly actionLabel: string
      readonly commandId: string
      readonly expectedRoomRevision: number
      readonly code: string
      readonly message: string
    }

interface ProjectedMatchRoomViewProps {
  readonly room: ProjectedMatchRoomClientState
  readonly actions: MatchClientActionsProjection
  readonly feedback?: ProjectedMatchCommandFeedback | null
  readonly syncStatus?: ProjectedMatchRoomSyncStatus | null
  readonly clientAuthorityState?: ProjectedMatchClientAuthorityState | null
  readonly actionsDisabled?: boolean
  readonly resetLabel?: string
  readonly onResetRoom?: () => void
  readonly onSubmitAction?: (action: MatchClientActionView) => void
}

export function ProjectedMatchRoomView({
  room,
  actions,
  feedback = null,
  syncStatus = null,
  clientAuthorityState = null,
  actionsDisabled = false,
  resetLabel = 'Reset room',
  onResetRoom,
  onSubmitAction,
}: ProjectedMatchRoomViewProps) {
  const firstPendingRequest = room.pendingRequests[0]
  const activePlayerLabel = resolvePlayerLabel(room, room.turn.turnPlayerId)
  const activeDeadlineSummary = createActiveDeadlineSummary(room)

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
              <Badge variant="secondary">{room.formatId}</Badge>
              {syncStatus === null ? null : (
                <Badge variant={getSyncStatusBadgeVariant(syncStatus.status)}>
                  {syncStatus.label}
                </Badge>
              )}
            </>
          }
          title="Match Room"
          meta={
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{room.roomId}</span>
              <span aria-hidden="true">|</span>
              <span>Room r{room.roomRevision}</span>
              <span aria-hidden="true">|</span>
              <span>Engine r{room.engineRevision}</span>
              <span aria-hidden="true">|</span>
              <span>{activePlayerLabel}</span>
            </div>
          }
          actions={
            onResetRoom === undefined ? null : (
              <Button type="button" variant="outline" onClick={onResetRoom}>
                <RotateCcw className="size-4" />
                {resetLabel}
              </Button>
            )
          }
        />
      }
    >
      <div className="grid gap-4">
        <section className="grid gap-4 md:grid-cols-2">
          {room.playerSummaries.map((player) => (
            <PlayerSummaryCard key={player.playerId} player={player} />
          ))}
        </section>

        <MatchBoard
          projection={room.board}
          turn={room.turn}
          zoneCount={room.zoneCount}
          pieceCount={room.pieceCount}
          resolvePlayerLabel={(playerId) => resolvePlayerLabel(room, playerId)}
        />

        <section className="grid gap-4 lg:grid-cols-2">
          <PendingRequestPanel
            request={firstPendingRequest}
            playerLabel={
              firstPendingRequest
                ? resolvePlayerLabel(
                    room,
                    firstPendingRequest.responderPlayerId,
                  )
                : null
            }
          />
          <ResultFeedbackPanel feedback={feedback} />
        </section>

        <EventLogPanel entries={room.eventLogEntries} />
      </div>

      <aside className="grid content-start gap-4">
        <AvailableActionsPanel
          projection={actions}
          actionsDisabled={actionsDisabled}
          {...(onSubmitAction === undefined ? {} : { onSubmitAction })}
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
              label="Game status"
              value={formatStatusLabel(room.gameStatus)}
            />
            <SummaryRow
              label="Projection"
              value={room.source.replaceAll('_', ' ')}
            />
            <SummaryRow label="Server time" value={room.clock.serverNow} />
            {activeDeadlineSummary === null ? null : (
              <SummaryRow
                label="Active deadline"
                value={activeDeadlineSummary}
              />
            )}
            {clientAuthorityState === null ? null : (
              <ClientAuthorityRows state={clientAuthorityState} />
            )}
            <SummaryRow
              label="Pending"
              value={room.pendingRequests.length.toString()}
            />
            {syncStatus?.status === 'error' ||
            syncStatus?.status === 'recovery_failed' ? (
              <SummaryRow label="Sync issue" value={syncStatus.message} />
            ) : null}
          </CardContent>
        </Card>
      </aside>
    </DashboardPageLayout>
  )
}

function ClientAuthorityRows({
  state,
}: {
  readonly state: ProjectedMatchClientAuthorityState
}) {
  switch (state.status) {
    case 'authoritative':
      return (
        <>
          <SummaryRow label="Client state" value={state.label} />
          <SummaryRow
            label="Authoritative room"
            value={`Room r${state.roomRevision}`}
          />
        </>
      )
    case 'optimistic_pending':
      return (
        <>
          <SummaryRow label="Client state" value={state.label} />
          <SummaryRow label="Pending command" value={state.actionLabel} />
          <SummaryRow
            label="Expected revision"
            value={`Room r${state.expectedRoomRevision} / Engine r${state.expectedEngineRevision}`}
          />
        </>
      )
    case 'authoritative_applied':
      return (
        <>
          <SummaryRow label="Client state" value={state.label} />
          <SummaryRow label="Applied command" value={state.actionLabel} />
          <SummaryRow
            label="Authoritative update"
            value={`Room r${state.authoritativeRoomRevision} / Engine r${state.authoritativeEngineRevision}`}
          />
        </>
      )
    case 'stale_conflicted':
      return (
        <>
          <SummaryRow label="Client state" value={state.label} />
          <SummaryRow label="Conflicted command" value={state.actionLabel} />
          <SummaryRow label="Conflict code" value={state.code} />
          <SummaryRow
            label="Authoritative room"
            value={`Room r${state.authoritativeRoomRevision}`}
          />
        </>
      )
    case 'recovering':
      return (
        <>
          <SummaryRow label="Client state" value={state.label} />
          {state.actionLabel === undefined ? null : (
            <SummaryRow label="Pending command" value={state.actionLabel} />
          )}
          <SummaryRow label="Recovery" value={state.message} />
        </>
      )
    case 'submission_failed':
      return (
        <>
          <SummaryRow label="Client state" value={state.label} />
          <SummaryRow label="Failed command" value={state.actionLabel} />
          <SummaryRow label="Failure code" value={state.code} />
        </>
      )
  }
}

function PlayerSummaryCard({
  player,
}: {
  readonly player: ProjectedMatchPlayerSummary
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{player.label}</CardTitle>
        <CardDescription>
          Seat {player.seat} | {formatStatusLabel(player.status)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-3 text-sm">
        <SummaryMetric label="Zones" value={player.zoneCount.toString()} />
        <SummaryMetric label="Pieces" value={player.pieceCount.toString()} />
        <SummaryMetric label="Flags" value={player.flagCount.toString()} />
      </CardContent>
    </Card>
  )
}

function PendingRequestPanel({
  request,
  playerLabel,
}: {
  readonly request: VisibleGameChoiceRequest | undefined
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
        <SummaryRow
          label="Viewer"
          value={formatStatusLabel(request.visibilityToViewer)}
        />
        {'minSelections' in request ? (
          <SummaryRow
            label="Selection"
            value={`${request.minSelections}-${request.maxSelections}`}
          />
        ) : null}
        {'eligiblePieces' in request ? (
          <SummaryRow
            label="Eligible pieces"
            value={(request.eligiblePieces?.length ?? 0).toString()}
          />
        ) : null}
        {'eligibleZones' in request ? (
          <SummaryRow
            label="Eligible zones"
            value={(request.eligibleZones?.length ?? 0).toString()}
          />
        ) : null}
        {'options' in request ? (
          <SummaryRow
            label="Options"
            value={(request.options?.length ?? 0).toString()}
          />
        ) : null}
        {'currentDeckCount' in request ? (
          <SummaryRow
            label="Deck count"
            value={(request.currentDeckCount ?? 0).toString()}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function ResultFeedbackPanel({
  feedback,
}: {
  readonly feedback: ProjectedMatchCommandFeedback | null
}) {
  if (feedback === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Last Result</CardTitle>
          <CardDescription>No command submitted yet.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (feedback.status === 'accepted') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Last Result</CardTitle>
          <CardDescription>
            <Badge variant="success">Accepted</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <SummaryRow label="Transition" value={feedback.transitionId} />
          <SummaryRow
            label="Engine revision"
            value={feedback.engineRevision.toString()}
          />
          <SummaryRow
            label="Events"
            value={
              feedback.eventTypes.length === 0
                ? 'None'
                : feedback.eventTypes.join(', ')
            }
          />
        </CardContent>
      </Card>
    )
  }

  if (feedback.status === 'blocked') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Last Result</CardTitle>
          <CardDescription>
            <Badge variant="warning">Blocked</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <SummaryRow label="Code" value={feedback.code} />
          <SummaryRow label="Message" value={feedback.message} />
          <SummaryRow
            label="Blocking"
            value={feedback.blockingRequestIds.join(', ')}
          />
        </CardContent>
      </Card>
    )
  }

  if (feedback.status === 'unknown') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Last Result</CardTitle>
          <CardDescription>
            <Badge variant="warning">Unknown</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <SummaryRow label="Code" value={feedback.code} />
          <SummaryRow label="Message" value={feedback.message} />
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
        <SummaryRow label="Code" value={feedback.code} />
        <SummaryRow label="Message" value={feedback.message} />
      </CardContent>
    </Card>
  )
}

function createActiveDeadlineSummary(
  room: ProjectedMatchRoomClientState,
): string | null {
  const requestDeadline = room.clock.activeRequest

  if (requestDeadline !== undefined) {
    return `Request ${requestDeadline.requestId} until ${requestDeadline.deadlineAt} (${formatRemainingMs(requestDeadline.remainingMs)} remaining)`
  }

  const turnDeadline = room.clock.activeTurn

  if (turnDeadline !== undefined) {
    return `Turn ${turnDeadline.turnNumber} until ${turnDeadline.deadlineAt} (${formatRemainingMs(turnDeadline.remainingMs)} remaining)`
  }

  return null
}

function formatRemainingMs(remainingMs: number): string {
  if (remainingMs <= 0) {
    return 'expired'
  }

  const remainingSeconds = Math.ceil(remainingMs / 1_000)

  if (remainingSeconds < 60) {
    return `${remainingSeconds}s`
  }

  return `${Math.ceil(remainingSeconds / 60)}m`
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

function resolvePlayerLabel(
  room: ProjectedMatchRoomClientState,
  playerId: PlayerId,
) {
  return (
    room.playerSummaries.find((player) => player.playerId === playerId)
      ?.label ?? playerId
  )
}

function formatStatusLabel(status: string) {
  return status
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}

function getRoomStatusBadgeVariant(
  status: ProjectedMatchRoomClientState['status'],
) {
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

function getSyncStatusBadgeVariant(
  status: NonNullable<ProjectedMatchRoomSyncStatus>['status'],
) {
  switch (status) {
    case 'connected':
    case 'synced':
    case 'recovered':
      return 'success'
    case 'syncing':
    case 'submitting':
    case 'reconnecting':
      return 'secondary'
    case 'error':
    case 'recovery_failed':
      return 'destructive'
  }
}
