import type { PlayerId, RequestId, GameState } from '@web-vg/rules-core'

export type MatchRoomClockAuthority = 'match-session'
export type MatchRoomDeadlineKind = 'request' | 'turn'
export type MatchRoomTimeoutReason = 'request_timeout' | 'turn_timeout'

export interface MatchRoomClockSettings {
  readonly requestTimeoutMs: number
  readonly turnTimeoutMs: number
}

export interface MatchRoomRequestDeadlineState {
  readonly requestId: RequestId
  readonly responderPlayerId: PlayerId
  readonly startedAt: string
  readonly deadlineAt: string
}

export interface MatchRoomTurnDeadlineState {
  readonly turnNumber: number
  readonly turnPlayerId: PlayerId
  readonly startedAt: string
  readonly deadlineAt: string
}

export interface MatchRoomClockState {
  readonly authority: MatchRoomClockAuthority
  readonly serverNow: string
  readonly settings: MatchRoomClockSettings
  readonly activeRequest?: MatchRoomRequestDeadlineState
  readonly activeTurn?: MatchRoomTurnDeadlineState
}

export interface ProjectedMatchRoomDeadline {
  readonly kind: MatchRoomDeadlineKind
  readonly startedAt: string
  readonly deadlineAt: string
  readonly remainingMs: number
}

export interface ProjectedMatchRoomRequestDeadline extends ProjectedMatchRoomDeadline {
  readonly kind: 'request'
  readonly requestId: RequestId
  readonly responderPlayerId: PlayerId
}

export interface ProjectedMatchRoomTurnDeadline extends ProjectedMatchRoomDeadline {
  readonly kind: 'turn'
  readonly turnNumber: number
  readonly turnPlayerId: PlayerId
}

export interface ProjectedMatchRoomClock {
  readonly authority: MatchRoomClockAuthority
  readonly serverNow: string
  readonly activeRequest?: ProjectedMatchRoomRequestDeadline
  readonly activeTurn?: ProjectedMatchRoomTurnDeadline
}

export type ExpiredMatchRoomDeadline =
  | (ProjectedMatchRoomRequestDeadline & {
      readonly timeoutReason: 'request_timeout'
    })
  | (ProjectedMatchRoomTurnDeadline & {
      readonly timeoutReason: 'turn_timeout'
    })

export interface MatchRoomClockSource {
  now(): string
}

export const DEFAULT_MATCH_ROOM_CLOCK_SETTINGS: MatchRoomClockSettings = {
  requestTimeoutMs: 120_000,
  turnTimeoutMs: 600_000,
}

export const systemMatchRoomClock: MatchRoomClockSource = {
  now() {
    return new Date().toISOString()
  },
}

export function createFixedMatchRoomClock(now: string): MatchRoomClockSource {
  return {
    now: () => now,
  }
}

export function createInitialMatchRoomClockState(input: {
  readonly serverNow: string
  readonly settings?: Partial<MatchRoomClockSettings>
}): MatchRoomClockState {
  return {
    authority: 'match-session',
    serverNow: input.serverNow,
    settings: normalizeClockSettings(input.settings),
  }
}

export function advanceMatchRoomClockState(input: {
  readonly clock: MatchRoomClockState
  readonly nextState: GameState
  readonly serverNow: string
}): MatchRoomClockState {
  const settings = normalizeClockSettings(input.clock.settings)
  const activeRequest = resolveActiveRequestDeadline(
    input.clock.activeRequest,
    input.nextState,
    input.serverNow,
    settings.requestTimeoutMs,
  )
  const activeTurn = resolveActiveTurnDeadline(
    input.clock.activeTurn,
    input.nextState,
    input.serverNow,
    settings.turnTimeoutMs,
  )

  return {
    authority: 'match-session',
    serverNow: input.serverNow,
    settings,
    ...(activeRequest === undefined ? {} : { activeRequest }),
    ...(activeTurn === undefined ? {} : { activeTurn }),
  }
}

export function closeMatchRoomClockState(
  clock: MatchRoomClockState,
  serverNow: string,
): MatchRoomClockState {
  return {
    authority: 'match-session',
    serverNow,
    settings: normalizeClockSettings(clock.settings),
  }
}

export function projectMatchRoomClock(
  clock: MatchRoomClockState,
  options: {
    readonly serverNow?: string
  } = {},
): ProjectedMatchRoomClock {
  const serverNow = options.serverNow ?? clock.serverNow

  return {
    authority: clock.authority,
    serverNow,
    ...(clock.activeRequest === undefined
      ? {}
      : {
          activeRequest: {
            kind: 'request',
            requestId: clock.activeRequest.requestId,
            responderPlayerId: clock.activeRequest.responderPlayerId,
            startedAt: clock.activeRequest.startedAt,
            deadlineAt: clock.activeRequest.deadlineAt,
            remainingMs: resolveRemainingMs(
              serverNow,
              clock.activeRequest.deadlineAt,
            ),
          },
        }),
    ...(clock.activeTurn === undefined
      ? {}
      : {
          activeTurn: {
            kind: 'turn',
            turnNumber: clock.activeTurn.turnNumber,
            turnPlayerId: clock.activeTurn.turnPlayerId,
            startedAt: clock.activeTurn.startedAt,
            deadlineAt: clock.activeTurn.deadlineAt,
            remainingMs: resolveRemainingMs(
              serverNow,
              clock.activeTurn.deadlineAt,
            ),
          },
        }),
  }
}

export function resolveExpiredMatchRoomDeadline(input: {
  readonly clock: MatchRoomClockState
  readonly serverNow: string
}): ExpiredMatchRoomDeadline | undefined {
  const projection = projectMatchRoomClock(input.clock, {
    serverNow: input.serverNow,
  })

  if (
    projection.activeRequest !== undefined &&
    projection.activeRequest.remainingMs <= 0
  ) {
    return {
      ...projection.activeRequest,
      timeoutReason: 'request_timeout',
    }
  }

  if (
    projection.activeTurn !== undefined &&
    projection.activeTurn.remainingMs <= 0
  ) {
    return {
      ...projection.activeTurn,
      timeoutReason: 'turn_timeout',
    }
  }

  return undefined
}

export function isMatchRoomClockStateLike(
  value: unknown,
): value is MatchRoomClockState {
  const settings = isRecord(value) ? value.settings : undefined

  return (
    isRecord(value) &&
    value.authority === 'match-session' &&
    typeof value.serverNow === 'string' &&
    isRecord(settings) &&
    typeof settings.requestTimeoutMs === 'number' &&
    Number.isSafeInteger(settings.requestTimeoutMs) &&
    settings.requestTimeoutMs > 0 &&
    typeof settings.turnTimeoutMs === 'number' &&
    Number.isSafeInteger(settings.turnTimeoutMs) &&
    settings.turnTimeoutMs > 0 &&
    isOptionalRequestDeadlineLike(value.activeRequest) &&
    isOptionalTurnDeadlineLike(value.activeTurn)
  )
}

function resolveActiveRequestDeadline(
  previous: MatchRoomRequestDeadlineState | undefined,
  state: GameState,
  serverNow: string,
  requestTimeoutMs: number,
): MatchRoomRequestDeadlineState | undefined {
  const activeRequest = state.pendingRequests[0]

  if (
    activeRequest === undefined ||
    (state.status !== 'awaiting_choice' && state.status !== 'in_progress')
  ) {
    return undefined
  }

  if (previous?.requestId === activeRequest.requestId) {
    return previous
  }

  return {
    requestId: activeRequest.requestId,
    responderPlayerId: activeRequest.responderPlayerId,
    startedAt: serverNow,
    deadlineAt: addMilliseconds(serverNow, requestTimeoutMs),
  }
}

function resolveActiveTurnDeadline(
  previous: MatchRoomTurnDeadlineState | undefined,
  state: GameState,
  serverNow: string,
  turnTimeoutMs: number,
): MatchRoomTurnDeadlineState | undefined {
  if (state.status !== 'in_progress' && state.status !== 'awaiting_choice') {
    return undefined
  }

  if (
    previous?.turnNumber === state.turn.turnNumber &&
    previous.turnPlayerId === state.turn.turnPlayerId
  ) {
    return previous
  }

  return {
    turnNumber: state.turn.turnNumber,
    turnPlayerId: state.turn.turnPlayerId,
    startedAt: serverNow,
    deadlineAt: addMilliseconds(serverNow, turnTimeoutMs),
  }
}

function normalizeClockSettings(
  settings: Partial<MatchRoomClockSettings> | undefined,
): MatchRoomClockSettings {
  const requestTimeoutMs =
    settings?.requestTimeoutMs ??
    DEFAULT_MATCH_ROOM_CLOCK_SETTINGS.requestTimeoutMs
  const turnTimeoutMs =
    settings?.turnTimeoutMs ?? DEFAULT_MATCH_ROOM_CLOCK_SETTINGS.turnTimeoutMs

  return {
    requestTimeoutMs: assertPositiveSafeInteger(
      requestTimeoutMs,
      'requestTimeoutMs',
    ),
    turnTimeoutMs: assertPositiveSafeInteger(turnTimeoutMs, 'turnTimeoutMs'),
  }
}

function assertPositiveSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Match room clock setting ${label} must be positive.`)
  }

  return value
}

function resolveRemainingMs(serverNow: string, deadlineAt: string): number {
  return Math.max(0, Date.parse(deadlineAt) - Date.parse(serverNow))
}

function addMilliseconds(isoTimestamp: string, milliseconds: number): string {
  return new Date(Date.parse(isoTimestamp) + milliseconds).toISOString()
}

function isOptionalRequestDeadlineLike(value: unknown): boolean {
  return (
    value === undefined ||
    (isRecord(value) &&
      typeof value.requestId === 'string' &&
      typeof value.responderPlayerId === 'string' &&
      typeof value.startedAt === 'string' &&
      typeof value.deadlineAt === 'string')
  )
}

function isOptionalTurnDeadlineLike(value: unknown): boolean {
  return (
    value === undefined ||
    (isRecord(value) &&
      Number.isSafeInteger(value.turnNumber) &&
      typeof value.turnPlayerId === 'string' &&
      typeof value.startedAt === 'string' &&
      typeof value.deadlineAt === 'string')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
