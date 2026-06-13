'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'

import type {
  RealtimeClientCommandId,
  RealtimeProjectedStatePush,
  ServerRouteRealtimeCommandResponse,
  ServerRouteRealtimeSnapshotResponse,
} from '@web-vg/match-session'

import {
  buildProjectedMatchBrowserCommandActions,
  buildProjectedMatchRoomClientStateFromPush,
  createProjectedMatchActionsProjection,
  type MatchClientActionView,
  type ProjectedMatchRoomClientState,
} from '@/features/matches/play/projected-client-state'

import {
  ProjectedMatchRoomView,
  type ProjectedMatchClientAuthorityState,
  type ProjectedMatchCommandFeedback,
  type ProjectedMatchRoomSyncStatus,
} from './projected-match-room-view'

const DEFAULT_POLL_INTERVAL_MS = 1_500
type SnapshotRecoveryReason =
  | 'initial_load'
  | 'poll'
  | 'browser_resume'
  | 'network_online'
  | 'command_status_unknown'

interface OptimisticCommandMarker {
  readonly commandId: RealtimeClientCommandId
  readonly actionId: string
  readonly actionLabel: string
  readonly expectedRoomRevision: number
  readonly expectedEngineRevision: number
}

interface PersistedProjectedMatchRoomClientProps {
  readonly initialRoom: ProjectedMatchRoomClientState
  readonly pollIntervalMs?: number
}

export function PersistedProjectedMatchRoomClient({
  initialRoom,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: PersistedProjectedMatchRoomClientProps) {
  const [room, setRoom] = useState(initialRoom)
  const [feedback, setFeedback] =
    useState<ProjectedMatchCommandFeedback | null>(null)
  const [syncStatus, setSyncStatus] = useState<ProjectedMatchRoomSyncStatus>({
    status: 'connected',
    label: 'Connected',
  })
  const [clientAuthorityState, setClientAuthorityState] =
    useState<ProjectedMatchClientAuthorityState>(
      createAuthoritativeClientState(initialRoom.roomRevision),
    )
  const [submittingActionId, setSubmittingActionId] = useState<string | null>(
    null,
  )
  const snapshotInFlightRef = useRef(false)
  const submitInFlightRef = useRef(false)
  const mountedRef = useRef(false)
  const needsRecoveryRef = useRef(false)
  const optimisticCommandRef = useRef<OptimisticCommandMarker | null>(null)
  const authoritativeRoomRef = useRef(initialRoom)
  const realtimeUrl = useMemo(
    () =>
      `/api/matches/rooms/${encodeURIComponent(initialRoom.roomId)}/realtime`,
    [initialRoom.roomId],
  )
  const actions = useMemo(
    () =>
      createProjectedMatchActionsProjection(
        room,
        buildProjectedMatchBrowserCommandActions(room),
      ),
    [room],
  )

  const applyProjectedUpdate = useCallback(
    (
      push: RealtimeProjectedStatePush,
      options: {
        readonly clientAuthorityState?: ProjectedMatchClientAuthorityState
      } = {},
    ) => {
      const nextState = buildProjectedMatchRoomClientStateFromPush(push)

      if (!nextState.ok) {
        setSyncStatus({
          status: 'recovery_failed',
          label: 'Recovery failed',
          message: nextState.message,
        })

        return false
      }

      if (
        nextState.state.roomRevision < authoritativeRoomRef.current.roomRevision
      ) {
        return false
      }

      authoritativeRoomRef.current = nextState.state
      setRoom(nextState.state)

      if (options.clientAuthorityState !== undefined) {
        setClientAuthorityState(options.clientAuthorityState)

        return true
      }

      reconcileOptimisticMarkerWithAuthoritativeSnapshot({
        optimisticCommandRef,
        setClientAuthorityState,
        roomRevision: nextState.state.roomRevision,
      })

      return true
    },
    [],
  )

  const recoverFromServer = useCallback(
    async (reason: SnapshotRecoveryReason) => {
      if (snapshotInFlightRef.current) {
        return false
      }

      snapshotInFlightRef.current = true
      const isRecoveryReason = reason !== 'poll'

      if (isRecoveryReason) {
        needsRecoveryRef.current = true
        const optimisticCommand = optimisticCommandRef.current

        if (optimisticCommand !== null) {
          setClientAuthorityState(
            createRecoveringClientState(
              'Recovery is replacing the optimistic command marker with authoritative projected state.',
              optimisticCommand,
            ),
          )
        } else if (needsRecoveryRef.current) {
          setClientAuthorityState(
            createRecoveringClientState(
              'Recovery is loading the latest authoritative projected state.',
            ),
          )
        }
      }

      setSyncStatus((current) =>
        current.status === 'submitting'
          ? current
          : {
              status:
                needsRecoveryRef.current || isRecoveryReason
                  ? 'reconnecting'
                  : 'syncing',
              label:
                needsRecoveryRef.current || isRecoveryReason
                  ? 'Reconnecting'
                  : 'Syncing',
            },
      )

      try {
        const response = await fetch(realtimeUrl, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        })
        const body = await readJsonRecord(response)

        if (!response.ok) {
          throw new Error(readRouteErrorMessage(body, response.status))
        }

        const snapshot = parseSnapshotResponse(body)

        if (snapshot.status === 'invalid') {
          throw new Error(snapshot.message)
        }

        if (!mountedRef.current) {
          return false
        }

        const shouldShowRecovered = needsRecoveryRef.current || isRecoveryReason
        const applied = applyProjectedUpdate(snapshot.projectedUpdate)

        if (applied) {
          needsRecoveryRef.current = false
          setSyncStatus({
            status: shouldShowRecovered ? 'recovered' : 'connected',
            label: shouldShowRecovered ? 'Recovered' : 'Connected',
          })
        }

        return applied
      } catch (error) {
        needsRecoveryRef.current = true

        if (mountedRef.current) {
          setSyncStatus({
            status: 'recovery_failed',
            label: 'Recovery failed',
            message: error instanceof Error ? error.message : 'Unknown error.',
          })
        }

        return false
      } finally {
        snapshotInFlightRef.current = false
      }
    },
    [applyProjectedUpdate, realtimeUrl],
  )

  useEffect(() => {
    mountedRef.current = true

    void recoverFromServer('initial_load')

    const intervalId = window.setInterval(
      () => void recoverFromServer('poll'),
      pollIntervalMs,
    )

    function recoverAfterBrowserResume() {
      void recoverFromServer('browser_resume')
    }

    function recoverAfterNetworkOnline() {
      void recoverFromServer('network_online')
    }

    function recoverAfterVisibleTab() {
      if (document.visibilityState === 'visible') {
        void recoverFromServer('browser_resume')
      }
    }

    window.addEventListener('focus', recoverAfterBrowserResume)
    window.addEventListener('online', recoverAfterNetworkOnline)
    document.addEventListener('visibilitychange', recoverAfterVisibleTab)

    return () => {
      mountedRef.current = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', recoverAfterBrowserResume)
      window.removeEventListener('online', recoverAfterNetworkOnline)
      document.removeEventListener('visibilitychange', recoverAfterVisibleTab)
    }
  }, [pollIntervalMs, recoverFromServer])

  async function submitAction(action: MatchClientActionView) {
    if (
      action.command === undefined ||
      submittingActionId !== null ||
      submitInFlightRef.current
    ) {
      return
    }

    const commandId = createCommandId(room, action)
    const optimisticCommand: OptimisticCommandMarker = {
      commandId,
      actionId: action.id,
      actionLabel: action.label,
      expectedRoomRevision: room.roomRevision,
      expectedEngineRevision: room.engineRevision,
    }

    submitInFlightRef.current = true
    optimisticCommandRef.current = optimisticCommand
    setSubmittingActionId(action.id)
    setClientAuthorityState(createOptimisticPendingState(optimisticCommand))
    setSyncStatus({
      status: 'submitting',
      label: 'Submitting',
    })

    try {
      const response = await fetch(realtimeUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          commandId,
          expectedRoomRevision: optimisticCommand.expectedRoomRevision,
          payload: action.command.payload,
        }),
      })
      const body = await readJsonRecord(response)

      if (!response.ok) {
        throw new Error(readRouteErrorMessage(body, response.status))
      }

      const commandResponse = parseCommandResponse(body)
      const responseAuthorityState = createClientAuthorityStateFromResponse(
        optimisticCommand,
        commandResponse,
      )

      setFeedback(createCommandFeedback(commandResponse))
      optimisticCommandRef.current = null

      const projectedUpdate = commandResponse.projectedUpdate

      if (projectedUpdate !== undefined) {
        if (
          applyProjectedUpdate(projectedUpdate, {
            clientAuthorityState: responseAuthorityState,
          })
        ) {
          setSyncStatus({
            status: 'connected',
            label: 'Connected',
          })
        }

        return
      }

      setSyncStatus({
        status: 'error',
        label: 'Sync error',
        message:
          commandResponse.status === 'accepted'
            ? 'Accepted realtime command did not include a projected update.'
            : commandResponse.message,
      })
      setClientAuthorityState(responseAuthorityState)
    } catch (error) {
      needsRecoveryRef.current = true
      optimisticCommandRef.current = null
      setFeedback(
        createUnknownCommandFeedback(
          error instanceof Error ? error.message : 'Unknown error.',
        ),
      )
      setClientAuthorityState(
        createSubmissionFailedClientState({
          optimisticCommand,
          code: 'command_status_unknown',
          message:
            'The command result is unknown after transport failure; recovery will reload authoritative state.',
        }),
      )
      setSyncStatus({
        status: 'reconnecting',
        label: 'Reconnecting',
      })
      await recoverFromServer('command_status_unknown')
    } finally {
      submitInFlightRef.current = false
      setSubmittingActionId(null)
    }
  }

  return (
    <ProjectedMatchRoomView
      room={room}
      actions={actions}
      feedback={feedback}
      syncStatus={syncStatus}
      clientAuthorityState={clientAuthorityState}
      actionsDisabled={submittingActionId !== null}
      onSubmitAction={(action) => void submitAction(action)}
    />
  )
}

function createAuthoritativeClientState(
  roomRevision: number,
): ProjectedMatchClientAuthorityState {
  return {
    status: 'authoritative',
    label: 'Authoritative',
    roomRevision,
    message: 'Server-projected room state is applied.',
  }
}

function createOptimisticPendingState(
  command: OptimisticCommandMarker,
): ProjectedMatchClientAuthorityState {
  return {
    status: 'optimistic_pending',
    label: 'Optimistic Pending',
    actionLabel: command.actionLabel,
    commandId: command.commandId,
    expectedRoomRevision: command.expectedRoomRevision,
    expectedEngineRevision: command.expectedEngineRevision,
    message:
      'The client marked this command as pending, but gameplay truth still belongs to the server projection.',
  }
}

function createRecoveringClientState(
  message: string,
  command?: OptimisticCommandMarker,
): ProjectedMatchClientAuthorityState {
  return {
    status: 'recovering',
    label: 'Recovering',
    message,
    ...(command === undefined
      ? {}
      : {
          actionLabel: command.actionLabel,
          expectedRoomRevision: command.expectedRoomRevision,
        }),
  }
}

function createClientAuthorityStateFromResponse(
  command: OptimisticCommandMarker,
  response: ServerRouteRealtimeCommandResponse,
): ProjectedMatchClientAuthorityState {
  if (response.status === 'accepted') {
    return {
      status: 'authoritative_applied',
      label: 'Authoritative Update Applied',
      actionLabel: command.actionLabel,
      commandId: command.commandId,
      expectedRoomRevision: command.expectedRoomRevision,
      authoritativeRoomRevision: response.roomRevision,
      authoritativeEngineRevision: response.engineRevision,
      message: 'The server accepted the command and returned projected truth.',
    }
  }

  if (
    response.status === 'invalid' &&
    response.code === 'stale_room_revision'
  ) {
    return createConflictedClientState({
      optimisticCommand: command,
      authoritativeRoomRevision:
        response.projectedUpdate?.roomRevision ?? command.expectedRoomRevision,
      code: response.code,
      message: response.message,
    })
  }

  return createSubmissionFailedClientState({
    optimisticCommand: command,
    code: response.code,
    message: response.message,
  })
}

function reconcileOptimisticMarkerWithAuthoritativeSnapshot(input: {
  readonly optimisticCommandRef: MutableRefObject<OptimisticCommandMarker | null>
  readonly setClientAuthorityState: (
    state: ProjectedMatchClientAuthorityState,
  ) => void
  readonly roomRevision: number
}) {
  const optimisticCommand = input.optimisticCommandRef.current

  if (optimisticCommand === null) {
    input.setClientAuthorityState(
      createAuthoritativeClientState(input.roomRevision),
    )

    return
  }

  if (input.roomRevision > optimisticCommand.expectedRoomRevision) {
    input.optimisticCommandRef.current = null
    input.setClientAuthorityState(
      createConflictedClientState({
        optimisticCommand,
        authoritativeRoomRevision: input.roomRevision,
        code: 'authoritative_revision_advanced',
        message:
          'An authoritative room update arrived before this optimistic command was confirmed.',
      }),
    )

    return
  }

  input.setClientAuthorityState(createOptimisticPendingState(optimisticCommand))
}

function createConflictedClientState(input: {
  readonly optimisticCommand: OptimisticCommandMarker
  readonly authoritativeRoomRevision: number
  readonly code: string
  readonly message: string
}): ProjectedMatchClientAuthorityState {
  return {
    status: 'stale_conflicted',
    label: 'Stale / Conflicted',
    actionLabel: input.optimisticCommand.actionLabel,
    commandId: input.optimisticCommand.commandId,
    expectedRoomRevision: input.optimisticCommand.expectedRoomRevision,
    authoritativeRoomRevision: input.authoritativeRoomRevision,
    code: input.code,
    message: input.message,
  }
}

function createSubmissionFailedClientState(input: {
  readonly optimisticCommand: OptimisticCommandMarker
  readonly code: string
  readonly message: string
}): ProjectedMatchClientAuthorityState {
  return {
    status: 'submission_failed',
    label: 'Submission Failed',
    actionLabel: input.optimisticCommand.actionLabel,
    commandId: input.optimisticCommand.commandId,
    expectedRoomRevision: input.optimisticCommand.expectedRoomRevision,
    code: input.code,
    message: input.message,
  }
}

function createUnknownCommandFeedback(
  message: string,
): ProjectedMatchCommandFeedback {
  return {
    status: 'unknown',
    code: 'command_status_unknown',
    message: `The command result is unknown after a transport failure. The client recovered from authoritative room state instead of replaying it. Cause: ${message}`,
  }
}

function createCommandId(
  room: ProjectedMatchRoomClientState,
  action: MatchClientActionView,
): RealtimeClientCommandId {
  const entropy =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  return `client-command:${room.roomId}:r${room.roomRevision}:${action.id}:${entropy}` as RealtimeClientCommandId
}

function createCommandFeedback(
  response: ServerRouteRealtimeCommandResponse,
): ProjectedMatchCommandFeedback {
  if (response.status === 'accepted') {
    return {
      status: 'accepted',
      transitionId: response.acceptedHistoryEntryIds[0] ?? response.commandId,
      engineRevision: response.engineRevision,
      eventTypes: response.projectedUpdate.projection.events.map(
        (event) => event.type,
      ),
    }
  }

  if (response.status === 'blocked') {
    return {
      status: 'blocked',
      code: response.code,
      message: response.message,
      blockingRequestIds:
        response.projectedUpdate?.projection.visibleState.pendingRequests.map(
          (request) => request.requestId,
        ) ?? [],
    }
  }

  return {
    status: 'invalid',
    code: response.code,
    message: response.message,
  }
}

async function readJsonRecord(
  response: Response,
): Promise<Record<string, unknown>> {
  const value = (await response.json()) as unknown

  if (!isRecord(value)) {
    throw new Error('Realtime route returned a non-object JSON payload.')
  }

  return value
}

function parseSnapshotResponse(
  value: Record<string, unknown>,
): ServerRouteRealtimeSnapshotResponse {
  if (value.status === 'ok' && isProjectedStatePush(value.projectedUpdate)) {
    return value as unknown as ServerRouteRealtimeSnapshotResponse
  }

  if (
    value.status === 'invalid' &&
    typeof value.code === 'string' &&
    typeof value.message === 'string'
  ) {
    return value as unknown as ServerRouteRealtimeSnapshotResponse
  }

  throw new Error(
    'Realtime snapshot response did not match the route contract.',
  )
}

function parseCommandResponse(
  value: Record<string, unknown>,
): ServerRouteRealtimeCommandResponse {
  if (
    value.status === 'accepted' &&
    isProjectedStatePush(value.projectedUpdate)
  ) {
    return value as unknown as ServerRouteRealtimeCommandResponse
  }

  if (
    (value.status === 'blocked' || value.status === 'invalid') &&
    typeof value.code === 'string' &&
    typeof value.message === 'string' &&
    (value.projectedUpdate === undefined ||
      isProjectedStatePush(value.projectedUpdate))
  ) {
    return value as unknown as ServerRouteRealtimeCommandResponse
  }

  throw new Error('Realtime command response did not match the route contract.')
}

function isProjectedStatePush(
  value: unknown,
): value is RealtimeProjectedStatePush {
  return (
    isRecord(value) &&
    value.type === 'projected_state' &&
    typeof value.roomRevision === 'number' &&
    typeof value.engineRevision === 'number' &&
    isRecord(value.projection)
  )
}

function readRouteErrorMessage(
  body: Record<string, unknown>,
  status: number,
): string {
  return typeof body.message === 'string'
    ? body.message
    : `Realtime route failed with HTTP ${status}.`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
