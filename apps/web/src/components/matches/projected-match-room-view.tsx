'use client'

import { useState, type ReactNode } from 'react'
import { Clock3, RotateCcw, Shield, Swords, Wifi } from 'lucide-react'

import type {
  GameChoiceResponse,
  PieceId,
  PlayerId,
  RequestOptionId,
  VisibleGameChoiceRequest,
  VisibleFullGameChoiceRequest,
  VisibleGameState,
  ZoneId,
  ZoneSlotId,
} from '@web-vg/rules-core'

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
  ProjectedMatchRoomClientState,
} from '@/features/matches/play/projected-client-state'
import type {
  ProjectedMatchBoardPiece,
  ProjectedMatchBoardZone,
} from '@/features/matches/play/zone-projection'

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

export interface ProjectedMatchChoiceSubmission {
  readonly label: string
  readonly response: GameChoiceResponse
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
  readonly onSubmitChoiceResponse?: (
    submission: ProjectedMatchChoiceSubmission,
  ) => void
}

interface RequestSelectionState {
  readonly pieceRefIds: readonly string[]
  readonly zoneIds: readonly string[]
  readonly optionIds: readonly string[]
  readonly playerIds: readonly string[]
}

interface TrackedRequestSelectionState extends RequestSelectionState {
  readonly requestKey: string
}

type RequestSelectionUpdate =
  | RequestSelectionState
  | ((current: RequestSelectionState) => RequestSelectionState)

type FullChoiceRequest = VisibleFullGameChoiceRequest

function createEmptyRequestSelection(
  requestKey: string,
): TrackedRequestSelectionState {
  return {
    requestKey,
    pieceRefIds: [],
    zoneIds: [],
    optionIds: [],
    playerIds: [],
  }
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
  onSubmitChoiceResponse,
}: ProjectedMatchRoomViewProps) {
  const firstPendingRequest = room.pendingRequests[0]
  const activePlayerLabel = resolvePlayerLabel(room, room.turn.turnPlayerId)
  const activeRequestKey = firstPendingRequest?.requestId ?? 'none'
  const [trackedSelection, setTrackedSelection] =
    useState<TrackedRequestSelectionState>(() =>
      createEmptyRequestSelection(activeRequestKey),
    )
  const selection =
    trackedSelection.requestKey === activeRequestKey
      ? trackedSelection
      : createEmptyRequestSelection(activeRequestKey)
  const setSelection = (selectionUpdate: RequestSelectionUpdate) => {
    setTrackedSelection((current) => {
      const currentSelection =
        current.requestKey === activeRequestKey
          ? current
          : createEmptyRequestSelection(activeRequestKey)
      const nextSelection =
        typeof selectionUpdate === 'function'
          ? selectionUpdate(currentSelection)
          : selectionUpdate

      return {
        ...nextSelection,
        requestKey: activeRequestKey,
      }
    })
  }

  const requestPrompt = firstPendingRequest
    ? formatRequestPrompt(firstPendingRequest, {
        responderLabel: resolvePlayerLabel(
          room,
          firstPendingRequest.responderPlayerId,
        ),
      })
    : null

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 opacity-80" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(14,165,233,0.22),transparent_34%),radial-gradient(circle_at_50%_78%,rgba(244,63,94,0.14),transparent_32%),linear-gradient(180deg,#020617,#0f172a_48%,#020617)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:56px_56px]" />
      </div>

      <div className="relative mx-auto grid w-full max-w-[95rem] gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <div className="flex flex-wrap gap-2">
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
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-normal text-white">
                Vanguard Playmat
              </h1>
              <p className="text-sm text-slate-300">
                {`${activePlayerLabel}'s turn in ${formatStatusLabel(room.turn.phase)}.`}
              </p>
            </div>
          </div>

          {onResetRoom === undefined ? null : (
            <Button type="button" variant="outline" onClick={onResetRoom}>
              <RotateCcw className="size-4" />
              {resetLabel}
            </Button>
          )}
        </header>

        <MatchContextPanel
          room={room}
          requestPrompt={requestPrompt}
          syncStatus={syncStatus}
          clientAuthorityState={clientAuthorityState}
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22.5rem]">
          <div className="grid gap-4">
            <MatchBoard
              projection={room.board}
              turn={room.turn}
              zoneCount={room.zoneCount}
              pieceCount={room.pieceCount}
              selectedPieceRefIds={selection.pieceRefIds}
              selectedZoneIds={selection.zoneIds}
              {...(firstPendingRequest === undefined
                ? {}
                : { activeRequest: firstPendingRequest })}
              {...(room.battle === undefined ? {} : { battle: room.battle })}
              onTogglePieceTarget={(piece) =>
                setSelection((current) =>
                  togglePieceSelection(current, firstPendingRequest, piece),
                )
              }
              onToggleZoneTarget={(zone) =>
                setSelection((current) =>
                  toggleZoneSelection(current, firstPendingRequest, zone),
                )
              }
              resolvePlayerLabel={(playerId) =>
                resolvePlayerLabel(room, playerId)
              }
            />

            <section className="grid gap-4 lg:grid-cols-2">
              <RequestChoicePanel
                room={room}
                request={firstPendingRequest}
                selection={selection}
                actionsDisabled={actionsDisabled}
                onSelectionChange={setSelection}
                {...(onSubmitChoiceResponse === undefined
                  ? {}
                  : { onSubmitChoiceResponse })}
              />
              <ResultFeedbackPanel feedback={feedback} room={room} />
            </section>

            <EventLogPanel entries={room.eventLogEntries} />
          </div>

          <aside className="grid content-start gap-4">
            <BattleContextPanel room={room} />

            <AvailableActionsPanel
              projection={actions}
              actionsDisabled={actionsDisabled}
              {...(onSubmitAction === undefined ? {} : { onSubmitAction })}
            />

            <SyncDetailsPanel
              room={room}
              syncStatus={syncStatus}
              clientAuthorityState={clientAuthorityState}
            />
          </aside>
        </div>
      </div>
    </main>
  )
}

function MatchContextPanel({
  room,
  requestPrompt,
  syncStatus,
  clientAuthorityState,
}: {
  readonly room: ProjectedMatchRoomClientState
  readonly requestPrompt: string | null
  readonly syncStatus: ProjectedMatchRoomSyncStatus | null
  readonly clientAuthorityState: ProjectedMatchClientAuthorityState | null
}) {
  const waitingText =
    requestPrompt ??
    (room.status === 'completed'
      ? 'The room is complete.'
      : room.turn.turnPlayerId === room.viewer.playerId
        ? 'Choose one of your available actions.'
        : `Waiting for ${resolvePlayerLabel(room, room.turn.turnPlayerId)}.`)
  const deadline = createActiveDeadlineSummary(room)
  const timeoutNotice = createTimeoutNotice(room)

  return (
    <section
      role="region"
      aria-label="Match context"
      className="rounded-2xl border border-cyan-200/20 bg-black/35 p-3 shadow-[0_18px_60px_-38px_rgba(34,211,238,0.8)] backdrop-blur"
    >
      <div className="grid gap-3 md:grid-cols-4">
        <ContextTile
          icon={<Swords className="size-4" />}
          label="Turn"
          value={resolvePlayerLabel(room, room.turn.turnPlayerId)}
          detail={`Turn ${room.turn.turnNumber} | ${formatStatusLabel(room.turn.phase)}`}
        />
        <ContextTile
          icon={<Shield className="size-4" />}
          label="Game is waiting for"
          value={waitingText}
          detail={
            room.battle
              ? formatBattleStatus(room.battle.status)
              : 'No active battle'
          }
        />
        <ContextTile
          icon={<Clock3 className="size-4" />}
          label="Timer"
          value={timeoutNotice ?? deadline ?? 'No active deadline'}
          detail={room.clock.authority}
        />
        <ContextTile
          icon={<Wifi className="size-4" />}
          label="Connection"
          value={formatSyncContextValue(syncStatus)}
          detail={
            clientAuthorityState === null
              ? 'Server authoritative'
              : 'Authoritative projection'
          }
        />
      </div>
    </section>
  )
}

function ContextTile({
  icon,
  label,
  value,
  detail,
}: {
  readonly icon: ReactNode
  readonly label: string
  readonly value: string
  readonly detail: string
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-white/10 bg-slate-950/55 p-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm font-semibold leading-snug text-white">
        {value}
      </div>
      <div className="text-xs text-slate-400">{detail}</div>
    </div>
  )
}

function BattleContextPanel({
  room,
}: {
  readonly room: ProjectedMatchRoomClientState
}) {
  const battle = room.battle

  if (battle === undefined) {
    return (
      <section
        role="region"
        aria-label="Battle context"
        className="rounded-2xl border border-white/10 bg-black/35 p-4"
      >
        <div className="text-xs font-semibold uppercase text-slate-400">
          Battle
        </div>
        <div className="mt-1 text-sm font-semibold text-white">
          No battle is active.
        </div>
      </section>
    )
  }

  return (
    <section
      role="region"
      aria-label="Battle context"
      className="rounded-2xl border border-amber-200/35 bg-amber-300/10 p-4 shadow-[0_0_34px_rgba(251,191,36,0.14)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-amber-200">
            Battle
          </div>
          <div className="mt-1 text-base font-semibold text-white">
            {formatBattleStatus(battle.status)}
          </div>
        </div>
        <Badge variant="warning">Attack lane</Badge>
      </div>
      <div className="mt-3 grid gap-3 text-sm">
        <SummaryRow
          label="Attacker"
          value={`${resolvePlayerLabel(room, battle.attackingPlayerId)}: ${resolvePieceLabel(room, battle.attacker)}`}
        />
        <SummaryRow label="Target" value={formatBattleTarget(room, battle)} />
        <SummaryRow
          label="Boost"
          value={
            battle.boostingPiece === undefined
              ? 'No booster committed'
              : resolvePieceLabel(room, battle.boostingPiece)
          }
        />
        <SummaryRow
          label="Guard"
          value={
            battle.guardPieces.length === 0
              ? battle.status === 'guard_requested'
                ? 'Guard step is open'
                : 'No guardians'
              : `${battle.guardPieces.length} guardian(s)`
          }
        />
        {battle.combat === undefined ? null : (
          <>
            <SummaryRow
              label="Attack"
              value={`${battle.combat.attackPower} power / ${battle.combat.attackCritical} critical`}
            />
            <SummaryRow
              label="Defense"
              value={`${battle.combat.totalDefensePower} total defense`}
            />
            <SummaryRow
              label="Outcome"
              value={formatStatusLabel(battle.combat.result)}
            />
          </>
        )}
        {battle.lastCheck === undefined ? null : (
          <SummaryRow
            label="Check"
            value={`${formatStatusLabel(battle.lastCheck.kind)} check: ${formatStatusLabel(
              battle.lastCheck.triggerResolutionState,
            )}`}
          />
        )}
      </div>
    </section>
  )
}

function SyncDetailsPanel({
  room,
  syncStatus,
  clientAuthorityState,
}: {
  readonly room: ProjectedMatchRoomClientState
  readonly syncStatus: ProjectedMatchRoomSyncStatus | null
  readonly clientAuthorityState: ProjectedMatchClientAuthorityState | null
}) {
  const activeDeadlineSummary = createActiveDeadlineSummary(room, {
    includeDeadlineAt: true,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection</CardTitle>
        <CardDescription>
          Server state is authoritative; this screen renders the participant
          projection.
        </CardDescription>
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
        <SummaryRow
          label="Room revision"
          value={`Room r${room.roomRevision}`}
        />
        <SummaryRow
          label="Engine revision"
          value={`Engine r${room.engineRevision}`}
        />
        {activeDeadlineSummary === null ? null : (
          <SummaryRow label="Active deadline" value={activeDeadlineSummary} />
        )}
        {clientAuthorityState === null ? null : (
          <ClientAuthorityRows state={clientAuthorityState} />
        )}
        <SummaryRow
          label="Pending choices"
          value={room.pendingRequests.length.toString()}
        />
        {syncStatus?.status === 'error' ||
        syncStatus?.status === 'recovery_failed' ? (
          <SummaryRow label="Sync issue" value={syncStatus.message} />
        ) : null}
      </CardContent>
    </Card>
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

function RequestChoicePanel({
  room,
  request,
  selection,
  actionsDisabled,
  onSelectionChange,
  onSubmitChoiceResponse,
}: {
  readonly room: ProjectedMatchRoomClientState
  readonly request: VisibleGameChoiceRequest | undefined
  readonly selection: RequestSelectionState
  readonly actionsDisabled: boolean
  readonly onSelectionChange: (selection: RequestSelectionState) => void
  readonly onSubmitChoiceResponse?: (
    submission: ProjectedMatchChoiceSubmission,
  ) => void
}) {
  if (request === undefined) {
    return (
      <Card
        role="region"
        aria-label="Choice request"
        className="border-white/10 bg-black/35 text-slate-50"
      >
        <CardHeader>
          <CardTitle>Current Choice</CardTitle>
          <CardDescription className="text-slate-400">
            No choice is waiting.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const responderLabel = resolvePlayerLabel(room, request.responderPlayerId)
  const prompt = formatRequestPrompt(request, { responderLabel })
  const selectedCount =
    selection.pieceRefIds.length +
    selection.zoneIds.length +
    selection.optionIds.length +
    selection.playerIds.length
  const submission = createChoiceSubmission(room, request, selection)

  return (
    <Card
      role="region"
      aria-label="Choice request"
      className="border-amber-200/35 bg-amber-300/10 text-slate-50 shadow-[0_0_30px_rgba(251,191,36,0.12)]"
    >
      <CardHeader>
        <CardTitle>Current Choice</CardTitle>
        <CardDescription className="text-amber-100/85">
          {prompt}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <Badge variant="warning">{formatRequestType(request.type)}</Badge>
          <Badge variant="outline">{formatSelectionRange(request)}</Badge>
          {request.visibilityToViewer === 'redacted' ? (
            <Badge variant="secondary">Waiting on opponent</Badge>
          ) : null}
        </div>

        {request.visibilityToViewer === 'redacted' ? (
          <p className="rounded-xl border border-white/10 bg-black/25 p-3 text-slate-300">
            This choice is private to {responderLabel}. The table will update
            when they answer.
          </p>
        ) : (
          <>
            {request.prompt === undefined ? null : (
              <p className="rounded-xl border border-white/10 bg-black/25 p-3 text-slate-200">
                {request.prompt}
              </p>
            )}
            <RequestOptionControls
              request={request}
              selection={selection}
              onSelectionChange={onSelectionChange}
            />
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="font-medium">
                {selectedCount === 0
                  ? 'No targets selected'
                  : `${selectedCount} target(s) selected`}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Legal cards are highlighted on the table. Use Clear to cancel
                the current selection.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {request.type === 'confirm.boolean' ? (
                <>
                  <Button
                    type="button"
                    disabled={
                      actionsDisabled || onSubmitChoiceResponse === undefined
                    }
                    onClick={() =>
                      onSubmitChoiceResponse?.({
                        label: 'Accept choice',
                        response: {
                          requestId: request.requestId,
                          responderPlayerId: request.responderPlayerId,
                          type: 'answer.boolean',
                          accepted: true,
                        },
                      })
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      actionsDisabled || onSubmitChoiceResponse === undefined
                    }
                    onClick={() =>
                      onSubmitChoiceResponse?.({
                        label: 'Decline choice',
                        response: {
                          requestId: request.requestId,
                          responderPlayerId: request.responderPlayerId,
                          type: 'answer.boolean',
                          accepted: false,
                        },
                      })
                    }
                  >
                    Decline
                  </Button>
                </>
              ) : null}
              {request.allowPass === true ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    actionsDisabled || onSubmitChoiceResponse === undefined
                  }
                  onClick={() =>
                    onSubmitChoiceResponse?.({
                      label: `Pass ${formatRequestType(request.type)}`,
                      response: {
                        requestId: request.requestId,
                        responderPlayerId: request.responderPlayerId,
                        type: 'answer.pass',
                        reason: 'pass',
                      },
                    })
                  }
                >
                  Pass
                </Button>
              ) : null}
              {request.type === 'confirm.boolean' ? null : (
                <Button
                  type="button"
                  disabled={
                    actionsDisabled ||
                    onSubmitChoiceResponse === undefined ||
                    !submission.ok
                  }
                  onClick={() => {
                    if (submission.ok) {
                      onSubmitChoiceResponse?.(submission.submission)
                    }
                  }}
                >
                  Confirm choice
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  onSelectionChange({
                    pieceRefIds: [],
                    zoneIds: [],
                    optionIds: [],
                    playerIds: [],
                  })
                }
              >
                Clear
              </Button>
            </div>
            {submission.ok ? null : (
              <p className="text-xs text-slate-400">{submission.message}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function RequestOptionControls({
  request,
  selection,
  onSelectionChange,
}: {
  readonly request: FullChoiceRequest
  readonly selection: RequestSelectionState
  readonly onSelectionChange: (selection: RequestSelectionState) => void
}) {
  const playerTargets = (request.eligibleTargets ?? []).filter(
    (target) => target.kind === 'player',
  )

  return (
    <div className="grid gap-2">
      {request.options === undefined || request.options.length === 0 ? null : (
        <div className="flex flex-wrap gap-2">
          {request.options.map((option) => (
            <Button
              key={option.optionId}
              type="button"
              variant={
                selection.optionIds.includes(option.optionId)
                  ? 'default'
                  : 'outline'
              }
              onClick={() =>
                onSelectionChange(
                  toggleOptionSelection(selection, request, option.optionId),
                )
              }
            >
              {option.label ?? formatStatusLabel(option.key)}
            </Button>
          ))}
        </div>
      )}
      {request.eligibleZones === undefined ||
      request.eligibleZones.length === 0 ? null : (
        <div className="flex flex-wrap gap-2">
          {request.eligibleZones
            .flatMap((zone) =>
              zone.availableSlotIds === undefined ||
              zone.availableSlotIds.length === 0
                ? [{ value: zone.zoneId, label: zone.zoneId }]
                : zone.availableSlotIds.map((slotId) => ({
                    value: encodeZoneSlotSelection(zone.zoneId, slotId),
                    label: formatSlotLabel(slotId),
                  })),
            )
            .map((choice) => (
              <Button
                key={choice.value}
                type="button"
                variant={
                  selection.zoneIds.includes(choice.value)
                    ? 'default'
                    : 'outline'
                }
                onClick={() =>
                  onSelectionChange(
                    toggleZoneSelectionById(selection, request, choice.value),
                  )
                }
              >
                {choice.label}
              </Button>
            ))}
        </div>
      )}
      {playerTargets.length === 0 ? null : (
        <div className="flex flex-wrap gap-2">
          {playerTargets.map((target) => (
            <Button
              key={target.playerId}
              type="button"
              variant={
                selection.playerIds.includes(target.playerId)
                  ? 'default'
                  : 'outline'
              }
              onClick={() =>
                onSelectionChange(
                  togglePlayerSelection(selection, request, target.playerId),
                )
              }
            >
              {target.playerId}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

function ResultFeedbackPanel({
  feedback,
  room,
}: {
  readonly feedback: ProjectedMatchCommandFeedback | null
  readonly room: ProjectedMatchRoomClientState
}) {
  const timeoutNotice = createTimeoutNotice(room)

  if (feedback === null && timeoutNotice === null) {
    return (
      <Card
        role="region"
        aria-label="Action feedback"
        className="border-white/10 bg-black/35 text-slate-50"
      >
        <CardHeader>
          <CardTitle>Action Feedback</CardTitle>
          <CardDescription className="text-slate-400">
            No action result yet.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (timeoutNotice !== null && feedback === null) {
    return (
      <Card
        role="region"
        aria-label="Action feedback"
        className="border-amber-200/35 bg-amber-300/10 text-slate-50"
      >
        <CardHeader>
          <CardTitle>Action Feedback</CardTitle>
          <CardDescription>
            <Badge variant="warning">Timeout</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-200">
          {timeoutNotice}
        </CardContent>
      </Card>
    )
  }

  if (feedback?.status === 'accepted') {
    return (
      <Card
        role="region"
        aria-label="Action feedback"
        className="border-emerald-200/35 bg-emerald-300/10 text-slate-50"
      >
        <CardHeader>
          <CardTitle>Action Feedback</CardTitle>
          <CardDescription>
            <Badge variant="success">Accepted</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p>The server accepted the action and updated the table.</p>
          <SummaryRow
            label="Events"
            value={
              feedback.eventTypes.length === 0
                ? 'No visible events'
                : feedback.eventTypes.join(', ')
            }
          />
        </CardContent>
      </Card>
    )
  }

  if (feedback?.status === 'blocked') {
    return (
      <Card
        role="region"
        aria-label="Action feedback"
        className="border-amber-200/35 bg-amber-300/10 text-slate-50"
      >
        <CardHeader>
          <CardTitle>Action Feedback</CardTitle>
          <CardDescription>
            <Badge variant="warning">Blocked</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p>{feedback.message}</p>
          {feedback.blockingRequestIds.length === 0 ? null : (
            <p className="text-slate-300">
              Finish the active choice before taking another action.
            </p>
          )}
          <SummaryRow label="Reason" value={feedback.code} />
        </CardContent>
      </Card>
    )
  }

  if (feedback?.status === 'unknown') {
    return (
      <Card
        role="region"
        aria-label="Action feedback"
        className="border-cyan-200/35 bg-cyan-300/10 text-slate-50"
      >
        <CardHeader>
          <CardTitle>Action Feedback</CardTitle>
          <CardDescription>
            <Badge variant="warning">Recovery</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p>
            The action result was unclear, so the client reloaded the latest
            server table instead of replaying the command.
          </p>
          <SummaryRow label="Reason" value={feedback.code} />
          <SummaryRow label="Detail" value={feedback.message} />
        </CardContent>
      </Card>
    )
  }

  if (
    feedback?.status === 'invalid' &&
    feedback.code === 'stale_room_revision'
  ) {
    return (
      <Card
        role="region"
        aria-label="Action feedback"
        className="border-amber-200/35 bg-amber-300/10 text-slate-50"
      >
        <CardHeader>
          <CardTitle>Action Feedback</CardTitle>
          <CardDescription>
            <Badge variant="warning">Stale</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p>
            The table changed before that action resolved. Choose again from the
            refreshed state.
          </p>
          <SummaryRow label="Reason" value={feedback.code} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      role="region"
      aria-label="Action feedback"
      className="border-rose-200/35 bg-rose-300/10 text-slate-50"
    >
      <CardHeader>
        <CardTitle>Action Feedback</CardTitle>
        <CardDescription>
          <Badge variant="destructive">Invalid</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <p>{feedback?.message}</p>
        <SummaryRow label="Reason" value={feedback?.code ?? 'unknown'} />
      </CardContent>
    </Card>
  )
}

function createChoiceSubmission(
  room: ProjectedMatchRoomClientState,
  request: VisibleGameChoiceRequest,
  selection: RequestSelectionState,
):
  | {
      readonly ok: true
      readonly submission: ProjectedMatchChoiceSubmission
    }
  | {
      readonly ok: false
      readonly message: string
    } {
  if (request.visibilityToViewer !== 'full') {
    return {
      ok: false,
      message: 'This choice is private to another player.',
    }
  }

  const selectedPieceIds: PieceId[] = selection.pieceRefIds
    .map((refId) => resolveRequestPieceId(request, refId))
    .filter((pieceId): pieceId is NonNullable<typeof pieceId> => {
      return pieceId !== undefined
    })
  const range = readSelectionRange(request)

  switch (request.type) {
    case 'choose.pieces': {
      const countCheck = validateSelectionCount(selectedPieceIds.length, range)

      if (countCheck !== null) {
        return countCheck
      }

      return createChoiceSubmissionResult(request, {
        requestId: request.requestId,
        responderPlayerId: request.responderPlayerId,
        type: 'answer.pieces',
        selectedPieceIds,
      })
    }
    case 'choose.target': {
      const selectedTargets = [
        ...selectedPieceIds.map((pieceId) => ({
          kind: 'piece' as const,
          pieceId,
        })),
        ...selection.playerIds.map((playerId) => ({
          kind: 'player' as const,
          playerId: playerId as PlayerId,
        })),
      ]
      const countCheck = validateSelectionCount(selectedTargets.length, range)

      if (countCheck !== null) {
        return countCheck
      }

      return createChoiceSubmissionResult(request, {
        requestId: request.requestId,
        responderPlayerId: request.responderPlayerId,
        type: 'answer.target',
        selectedTargets,
      })
    }
    case 'choose.zone': {
      const selectedLocations = selection.zoneIds.map(decodeZoneSlotSelection)
      const countCheck = validateSelectionCount(selectedLocations.length, range)

      if (countCheck !== null) {
        return countCheck
      }

      return createChoiceSubmissionResult(request, {
        requestId: request.requestId,
        responderPlayerId: request.responderPlayerId,
        type: 'answer.zone',
        selectedLocations,
      })
    }
    case 'choose.option': {
      const countCheck = validateSelectionCount(
        selection.optionIds.length,
        range,
      )

      if (countCheck !== null) {
        return countCheck
      }

      return createChoiceSubmissionResult(request, {
        requestId: request.requestId,
        responderPlayerId: request.responderPlayerId,
        type: 'answer.option',
        selectedOptionIds: selection.optionIds.map(
          (optionId) => optionId as RequestOptionId,
        ),
      })
    }
    case 'battle.guard_select': {
      const countCheck = validateSelectionCount(selectedPieceIds.length, {
        min: Math.max(request.minSelections ?? 0, 1),
        max: request.maxSelections ?? Number.POSITIVE_INFINITY,
      })

      if (countCheck !== null) {
        return countCheck
      }

      return createChoiceSubmissionResult(request, {
        requestId: request.requestId,
        responderPlayerId: request.responderPlayerId,
        type: 'answer.guard',
        selectedPieceIds,
      })
    }
    case 'trigger.resolve':
      return createTriggerChoiceSubmission(request, selectedPieceIds)
    case 'confirm.boolean':
      return {
        ok: false,
        message: 'Use Accept or Decline for this confirmation.',
      }
    case 'mulligan.select_cards':
      return {
        ok: false,
        message:
          'Mulligan submission still requires server-owned deck order; use the available mulligan action when it is offered.',
      }
  }
}

function createTriggerChoiceSubmission(
  request: FullChoiceRequest,
  selectedPieceIds: readonly PieceId[],
) {
  const powerRequired = request.powerEligiblePieces !== undefined
  const criticalRequired = request.criticalEligiblePieces !== undefined
  const standRequired = request.standEligiblePieces !== undefined
  const healRequired = request.healEligiblePieces !== undefined
  const requiredBuckets = [
    powerRequired,
    criticalRequired,
    standRequired,
    healRequired,
  ].filter(Boolean).length

  if (requiredBuckets !== 1) {
    return {
      ok: false as const,
      message:
        'This trigger asks for multiple target groups; grouped trigger target controls are not polished in this UI slice yet.',
    }
  }

  if (selectedPieceIds.length !== 1) {
    return {
      ok: false as const,
      message: 'Select exactly one trigger target.',
    }
  }

  const selectedPieceId = selectedPieceIds[0]

  if (selectedPieceId === undefined) {
    return {
      ok: false as const,
      message: 'Select exactly one trigger target.',
    }
  }

  return createChoiceSubmissionResult(request, {
    requestId: request.requestId,
    responderPlayerId: request.responderPlayerId,
    type: 'answer.trigger',
    ...(powerRequired ? { powerTargetPieceIds: [selectedPieceId] } : {}),
    ...(criticalRequired ? { criticalTargetPieceId: selectedPieceId } : {}),
    ...(standRequired ? { standTargetPieceId: selectedPieceId } : {}),
    ...(healRequired ? { healTargetPieceId: selectedPieceId } : {}),
  })
}

function createChoiceSubmissionResult(
  request: FullChoiceRequest,
  response: GameChoiceResponse,
) {
  return {
    ok: true as const,
    submission: {
      label: `Resolve ${formatRequestType(request.type)}`,
      response,
    },
  }
}

function resolveRequestPieceId(request: FullChoiceRequest, refId: string) {
  const pieces = [
    ...(request.eligiblePieces ?? []),
    ...(request.powerEligiblePieces ?? []),
    ...(request.criticalEligiblePieces ?? []),
    ...(request.standEligiblePieces ?? []),
    ...(request.healEligiblePieces ?? []),
    ...(request.handPieces ?? []),
    ...(request.interceptPieces ?? []),
  ]

  return pieces.find((piece) => piece.refId === refId)?.pieceId
}

function togglePieceSelection(
  current: RequestSelectionState,
  request: VisibleGameChoiceRequest | undefined,
  piece: ProjectedMatchBoardPiece,
): RequestSelectionState {
  if (request === undefined || request.visibilityToViewer !== 'full') {
    return current
  }

  return {
    ...current,
    pieceRefIds: toggleBoundedValue(
      current.pieceRefIds,
      piece.refId,
      readSelectionRange(request).max,
    ),
  }
}

function toggleZoneSelection(
  current: RequestSelectionState,
  request: VisibleGameChoiceRequest | undefined,
  zone: ProjectedMatchBoardZone,
): RequestSelectionState {
  if (request === undefined || request.visibilityToViewer !== 'full') {
    return current
  }

  return toggleZoneSelectionById(current, request, zone.zoneId)
}

const ZONE_SLOT_SEPARATOR = '#slot:'

/** Zone choices that name a circle carry the slot in the selection value. */
function encodeZoneSlotSelection(zoneId: string, slotId: string): string {
  return `${zoneId}${ZONE_SLOT_SEPARATOR}${slotId}`
}

function decodeZoneSlotSelection(value: string): {
  readonly zoneId: ZoneId
  readonly slotId?: ZoneSlotId
} {
  const index = value.indexOf(ZONE_SLOT_SEPARATOR)

  return index < 0
    ? { zoneId: value as ZoneId }
    : {
        zoneId: value.slice(0, index) as ZoneId,
        slotId: value.slice(index + ZONE_SLOT_SEPARATOR.length) as ZoneSlotId,
      }
}

function formatSlotLabel(slotId: string): string {
  const parts = slotId.split(/[-_:.]/).filter((part) => part.length > 0)
  return formatStatusLabel(parts.slice(-2).join(' ') || slotId)
}

function toggleZoneSelectionById(
  current: RequestSelectionState,
  request: FullChoiceRequest,
  zoneId: string,
): RequestSelectionState {
  return {
    ...current,
    zoneIds: toggleBoundedValue(
      current.zoneIds,
      zoneId,
      readSelectionRange(request).max,
    ),
  }
}

function toggleOptionSelection(
  current: RequestSelectionState,
  request: FullChoiceRequest,
  optionId: string,
): RequestSelectionState {
  return {
    ...current,
    optionIds: toggleBoundedValue(
      current.optionIds,
      optionId,
      readSelectionRange(request).max,
    ),
  }
}

function togglePlayerSelection(
  current: RequestSelectionState,
  request: FullChoiceRequest,
  playerId: string,
): RequestSelectionState {
  return {
    ...current,
    playerIds: toggleBoundedValue(
      current.playerIds,
      playerId,
      readSelectionRange(request).max,
    ),
  }
}

function toggleBoundedValue(
  values: readonly string[],
  value: string,
  max: number,
): readonly string[] {
  if (values.includes(value)) {
    return values.filter((candidate) => candidate !== value)
  }

  if (max <= 1) {
    return [value]
  }

  return [...values, value].slice(0, max)
}

function validateSelectionCount(
  count: number,
  range: { readonly min: number; readonly max: number },
) {
  if (count < range.min) {
    return {
      ok: false as const,
      message: `Select at least ${range.min} target(s).`,
    }
  }

  if (count > range.max) {
    return {
      ok: false as const,
      message: `Select no more than ${range.max} target(s).`,
    }
  }

  return null
}

function readSelectionRange(request: VisibleGameChoiceRequest) {
  if (request.visibilityToViewer !== 'full') {
    return { min: 0, max: 0 }
  }

  return {
    min: request.minSelections ?? 0,
    max: request.maxSelections ?? Number.POSITIVE_INFINITY,
  }
}

function formatSelectionRange(request: VisibleGameChoiceRequest) {
  const range = readSelectionRange(request)

  if (range.max === Number.POSITIVE_INFINITY) {
    return `Choose ${range.min}+`
  }

  if (range.min === range.max) {
    return `Choose ${range.min}`
  }

  return `Choose ${range.min}-${range.max}`
}

function createActiveDeadlineSummary(
  room: ProjectedMatchRoomClientState,
  options?: {
    readonly includeDeadlineAt?: boolean
  },
): string | null {
  const requestDeadline = room.clock.activeRequest

  if (requestDeadline !== undefined) {
    const summary = `Choice timer: ${formatRemainingMs(
      requestDeadline.remainingMs,
    )} remaining`

    return options?.includeDeadlineAt === true
      ? `${summary} until ${requestDeadline.deadlineAt}`
      : summary
  }

  const turnDeadline = room.clock.activeTurn

  if (turnDeadline !== undefined) {
    const summary = `Turn timer: ${formatRemainingMs(
      turnDeadline.remainingMs,
    )} remaining`

    return options?.includeDeadlineAt === true
      ? `${summary} until ${turnDeadline.deadlineAt}`
      : summary
  }

  return null
}

function createTimeoutNotice(
  room: ProjectedMatchRoomClientState,
): string | null {
  if (
    room.eventLogEntries.some((entry) =>
      `${entry.summary} ${entry.type}`.toLowerCase().includes('timeout'),
    )
  ) {
    return 'Timeout resolved. The server applied the timer result.'
  }

  const activeRequest = room.clock.activeRequest
  const activeTurn = room.clock.activeTurn

  if (activeRequest !== undefined && activeRequest.remainingMs <= 0) {
    return 'Choice timer expired. Waiting for the server timeout result.'
  }

  if (activeTurn !== undefined && activeTurn.remainingMs <= 0) {
    return 'Turn timer expired. Waiting for the server timeout result.'
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

function resolvePieceLabel(
  room: ProjectedMatchRoomClientState,
  piece: { readonly refId: string; readonly pieceId?: string },
) {
  for (const side of [
    ...(room.board.currentSide === undefined ? [] : [room.board.currentSide]),
    ...room.board.opponentSides,
  ]) {
    for (const zone of side.zones) {
      const foundPiece = zone.pieces.find((candidate) => {
        return (
          candidate.refId === piece.refId ||
          (piece.pieceId !== undefined && candidate.pieceId === piece.pieceId)
        )
      })

      if (foundPiece !== undefined) {
        return (
          foundPiece.cardDefinitionId ?? foundPiece.pieceId ?? foundPiece.refId
        )
      }
    }
  }

  return piece.pieceId ?? piece.refId
}

function formatBattleTarget(
  room: ProjectedMatchRoomClientState,
  battle: NonNullable<VisibleGameState['battle']>,
) {
  return battle.target.kind === 'player'
    ? resolvePlayerLabel(room, battle.target.playerId)
    : resolvePieceLabel(room, {
        refId: battle.target.pieceId,
        pieceId: battle.target.pieceId,
      })
}

function formatBattleStatus(status: string) {
  switch (status) {
    case 'attack_declared':
      return 'Attack declared'
    case 'boost_declared':
      return 'Boost committed'
    case 'guard_requested':
      return 'Waiting for guard'
    case 'guard_resolved':
      return 'Guard resolved'
    case 'drive_checked':
      return 'Drive check'
    case 'combat_resolved':
      return 'Combat resolved'
    case 'damage_checked':
      return 'Damage check'
    default:
      return formatStatusLabel(status)
  }
}

function formatSyncContextValue(
  syncStatus: ProjectedMatchRoomSyncStatus | null,
) {
  switch (syncStatus?.status) {
    case 'recovered':
      return 'Server state restored'
    case 'recovery_failed':
      return 'Recovery needs retry'
    case 'reconnecting':
      return 'Reconnecting to server'
    case 'submitting':
      return 'Submitting action'
    case 'syncing':
      return 'Syncing table'
    case 'connected':
    case 'synced':
      return 'Connected to server'
    case 'error':
      return 'Sync issue'
    case undefined:
      return 'Projected state'
  }
}

function formatRequestPrompt(
  request: VisibleGameChoiceRequest,
  options: { readonly responderLabel: string },
) {
  if (request.visibilityToViewer === 'redacted') {
    return `Waiting for ${options.responderLabel} to answer a private choice.`
  }

  switch (request.type) {
    case 'mulligan.select_cards':
      return `${options.responderLabel}: choose cards to return for mulligan, or keep the hand.`
    case 'battle.guard_select':
      return `${options.responderLabel}: choose guardians or pass guard.`
    case 'trigger.resolve':
      return `${options.responderLabel}: choose the trigger target.`
    case 'choose.pieces':
      return `${options.responderLabel}: choose highlighted card(s).`
    case 'choose.target':
      return `${options.responderLabel}: choose highlighted target(s).`
    case 'choose.zone':
      return `${options.responderLabel}: choose a highlighted zone.`
    case 'choose.option':
      return `${options.responderLabel}: choose one of the options.`
    case 'confirm.boolean':
      return `${options.responderLabel}: confirm or decline.`
  }
}

function formatRequestType(type: string) {
  switch (type) {
    case 'mulligan.select_cards':
      return 'Mulligan'
    case 'battle.guard_select':
      return 'Guard'
    case 'trigger.resolve':
      return 'Trigger'
    case 'confirm.boolean':
      return 'Confirm'
    case 'choose.pieces':
      return 'Choose cards'
    case 'choose.target':
      return 'Choose targets'
    case 'choose.zone':
      return 'Choose zone'
    case 'choose.option':
      return 'Choose option'
    default:
      return formatStatusLabel(type)
  }
}

function formatStatusLabel(status: string) {
  return status
    .split(/[_:.]/)
    .filter((part) => part.length > 0)
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
