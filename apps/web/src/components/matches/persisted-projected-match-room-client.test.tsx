import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  projectMatchRoomForParticipant,
  submitMatchRoomCommand,
  type MatchRoomCommandSubmission,
  type MatchRoomParticipantId,
  type MatchRoomHistoryEntryId,
  type MatchRoomWithEngineState,
  type RealtimeProjectedStatePush,
} from '@web-vg/match-session'
import type { GameEvent, PlayerId } from '@web-vg/rules-core'

import {
  LOCAL_MATCH_PARTICIPANT_ONE_ID,
  LOCAL_MATCH_PARTICIPANT_TWO_ID,
  LOCAL_MATCH_PLAYER_ONE_ID,
  LOCAL_MATCH_PLAYER_TWO_ID,
  createBeginMulliganCommand,
  createConcedeCommand,
  createLocalActionId,
  createLocalPrototypeMatchRoom,
  createReadyCommand,
  createStartMatchCommand,
} from '@/features/matches/play/local-match-room'
import { buildProjectedMatchRoomClientStateFromPush } from '@/features/matches/play/projected-client-state'

import { PersistedProjectedMatchRoomClient } from './persisted-projected-match-room-client'

describe('PersistedProjectedMatchRoomClient', () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('polls authenticated participant snapshots and replaces projected client state without a page reload', async () => {
    const initialRoom = createLocalPrototypeMatchRoom('persisted-sync-poll')
    const accepted = acceptReadyCommand(
      initialRoom,
      LOCAL_MATCH_PLAYER_ONE_ID,
      'ready-aichi',
    )
    const initialClientRoom = createClientRoom(
      initialRoom,
      LOCAL_MATCH_PARTICIPANT_ONE_ID,
    )

    fetchMock.mockResolvedValue(
      jsonResponse(
        createSnapshotResponse({
          room: accepted.room,
          participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
          events: accepted.events,
        }),
      ),
    )

    render(
      <PersistedProjectedMatchRoomClient
        initialRoom={initialClientRoom}
        pollIntervalMs={10_000}
      />,
    )

    expectRoomRevisionVisible(initialRoom.revision)

    await waitFor(() => expectRoomRevisionVisible(accepted.room.revision))

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/matches/rooms/${encodeURIComponent(initialRoom.roomId)}/realtime`,
      expect.objectContaining({
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      }),
    )
  })

  it('shows bounded optimistic pending state before authoritative accepted projection replaces it', async () => {
    const initialRoom = createLocalPrototypeMatchRoom(
      'persisted-optimistic-accepted',
    )
    const accepted = acceptReadyCommand(
      initialRoom,
      LOCAL_MATCH_PLAYER_ONE_ID,
      'ready-aichi',
    )
    const initialClientRoom = createClientRoom(
      initialRoom,
      LOCAL_MATCH_PARTICIPANT_ONE_ID,
    )
    const postResponse = createDeferred<Response>()
    let postCount = 0
    let postedBody: Record<string, unknown> | null = null

    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === 'POST') {
        postCount += 1
        postedBody = readRequestBody(init)

        return postResponse.promise
      }

      return Promise.resolve(
        jsonResponse(
          createSnapshotResponse({
            room: initialRoom,
            participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
          }),
        ),
      )
    })

    render(
      <PersistedProjectedMatchRoomClient
        initialRoom={initialClientRoom}
        pollIntervalMs={10_000}
      />,
    )

    const readyButton = await screen.findByRole('button', {
      name: /Ready Aichi Sendou/,
    })

    fireEvent.click(readyButton)
    fireEvent.click(readyButton)

    await waitFor(() => expect(postCount).toBe(1))
    expect(await screen.findByText('Optimistic Pending')).toBeVisible()
    expect(
      screen.getByText(
        `Room r${initialClientRoom.roomRevision} / Engine r${initialClientRoom.engineRevision}`,
      ),
    ).toBeVisible()
    expect(readyButton).toBeDisabled()

    const opponentSide = screen.getByRole('region', { name: 'Opponent side' })

    expect(
      within(opponentSide).getAllByText('Hidden card').length,
    ).toBeGreaterThan(0)
    expect(
      within(opponentSide).queryByText('local-catalog:keter:main-g1-a'),
    ).toBeNull()

    const capturedPostedBody = requireCapturedPostBody(postedBody)

    postResponse.resolve(
      jsonResponse(
        createAcceptedCommandResponse({
          commandId: String(capturedPostedBody.commandId),
          room: accepted.room,
          participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
          events: accepted.events,
        }),
      ),
    )

    await waitFor(() =>
      expect(screen.getByText('Authoritative Update Applied')).toBeVisible(),
    )
    expectRoomRevisionVisible(accepted.room.revision)
    expect(screen.getByText('Accepted')).toBeVisible()
  })

  it('submits participant commands with the current room revision and applies the returned projected update', async () => {
    const initialRoom = createLocalPrototypeMatchRoom('persisted-sync-submit')
    const accepted = acceptReadyCommand(
      initialRoom,
      LOCAL_MATCH_PLAYER_ONE_ID,
      'ready-aichi',
    )
    const initialClientRoom = createClientRoom(
      initialRoom,
      LOCAL_MATCH_PARTICIPANT_ONE_ID,
    )
    const postedBodies: Record<string, unknown>[] = []

    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === 'POST') {
        const postedBody = readRequestBody(init)

        postedBodies.push(postedBody)

        return Promise.resolve(
          jsonResponse(
            createAcceptedCommandResponse({
              commandId: String(postedBody.commandId),
              room: accepted.room,
              participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
              events: accepted.events,
            }),
          ),
        )
      }

      return Promise.resolve(
        jsonResponse(
          createSnapshotResponse({
            room: initialRoom,
            participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
          }),
        ),
      )
    })

    render(
      <PersistedProjectedMatchRoomClient
        initialRoom={initialClientRoom}
        pollIntervalMs={10_000}
      />,
    )

    fireEvent.click(
      await screen.findByRole('button', { name: /Ready Aichi Sendou/ }),
    )

    await waitFor(() => expect(postedBodies).toHaveLength(1))

    const postedBody = postedBodies[0]

    expect(postedBody).toBeDefined()

    if (postedBody === undefined) {
      throw new Error('Expected POST body.')
    }

    expect(postedBody).toMatchObject({
      expectedRoomRevision: initialClientRoom.roomRevision,
    })

    const payload = requireRecord(postedBody.payload)
    const submission = requireRecord(payload.submission)
    const action = requireRecord(submission.action)
    const actor = requireRecord(action.actor)

    expect(submission.expectedRevision).toBe(initialClientRoom.engineRevision)
    expect(actor).toMatchObject({
      kind: 'player',
      playerId: LOCAL_MATCH_PLAYER_ONE_ID,
    })
    expect(JSON.stringify(postedBody)).not.toContain('engineState')

    await waitFor(() => expectRoomRevisionVisible(accepted.room.revision))
    expect(screen.getByText('Accepted')).toBeVisible()
  })

  it('does not roll back to an older projected snapshot after an authoritative update was applied', async () => {
    const initialRoom = createLocalPrototypeMatchRoom(
      'persisted-sync-ignore-stale-snapshot',
    )
    const accepted = acceptReadyCommand(
      initialRoom,
      LOCAL_MATCH_PLAYER_ONE_ID,
      'ready-aichi',
    )
    const initialClientRoom = createClientRoom(
      initialRoom,
      LOCAL_MATCH_PARTICIPANT_ONE_ID,
    )
    let getCount = 0

    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === 'POST') {
        const postedBody = readRequestBody(init)

        return Promise.resolve(
          jsonResponse(
            createAcceptedCommandResponse({
              commandId: String(postedBody.commandId),
              room: accepted.room,
              participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
              events: accepted.events,
            }),
          ),
        )
      }

      getCount += 1

      return Promise.resolve(
        jsonResponse(
          createSnapshotResponse({
            room: initialRoom,
            participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
          }),
        ),
      )
    })

    render(
      <PersistedProjectedMatchRoomClient
        initialRoom={initialClientRoom}
        pollIntervalMs={10_000}
      />,
    )

    fireEvent.click(
      await screen.findByRole('button', { name: /Ready Aichi Sendou/ }),
    )

    await waitFor(() => expectRoomRevisionVisible(accepted.room.revision))
    expect(screen.getByText('Authoritative Update Applied')).toBeVisible()

    fireEvent.focus(window)

    await waitFor(() => expect(getCount).toBeGreaterThanOrEqual(2))
    expectRoomRevisionVisible(accepted.room.revision)
    expect(screen.queryByText(`Room r${initialRoom.revision}`)).toBeNull()
  })

  it('applies stale-command projected snapshots so the client converges after concurrent room updates', async () => {
    const initialRoom = createLocalPrototypeMatchRoom('persisted-sync-stale')
    const concurrent = acceptReadyCommand(
      initialRoom,
      LOCAL_MATCH_PLAYER_TWO_ID,
      'ready-kai',
    )
    const initialClientRoom = createClientRoom(
      initialRoom,
      LOCAL_MATCH_PARTICIPANT_ONE_ID,
    )

    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === 'POST') {
        const postedBody = readRequestBody(init)

        return Promise.resolve(
          jsonResponse({
            transport: 'server_route_commands_with_projected_snapshots',
            status: 'invalid',
            commandId: String(postedBody.commandId),
            roomId: initialRoom.roomId,
            participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
            code: 'stale_room_revision',
            message: 'The client command targeted a stale room revision.',
            projectedUpdate: createProjectedPush({
              room: concurrent.room,
              participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
              reason: 'reconnect_snapshot',
              events: concurrent.events,
            }),
          }),
        )
      }

      return Promise.resolve(
        jsonResponse(
          createSnapshotResponse({
            room: initialRoom,
            participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
          }),
        ),
      )
    })

    render(
      <PersistedProjectedMatchRoomClient
        initialRoom={initialClientRoom}
        pollIntervalMs={10_000}
      />,
    )

    fireEvent.click(
      await screen.findByRole('button', { name: /Ready Aichi Sendou/ }),
    )

    await waitFor(() => expectRoomRevisionVisible(concurrent.room.revision))
    expectTextVisible('stale_room_revision')
    expect(screen.getByText('Stale / Conflicted')).toBeVisible()
  })

  it('clears optimistic state on blocked responses and applies the authoritative pending request projection', async () => {
    const initialRoom = createLocalPrototypeMatchRoom(
      'persisted-optimistic-blocked',
    )
    const pending = createMulliganPendingRoom(initialRoom)
    const initialClientRoom = createClientRoom(
      initialRoom,
      LOCAL_MATCH_PARTICIPANT_ONE_ID,
    )

    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === 'POST') {
        const postedBody = readRequestBody(init)

        return Promise.resolve(
          jsonResponse(
            createBlockedCommandResponse({
              commandId: String(postedBody.commandId),
              room: pending.room,
              participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
              events: pending.events,
            }),
          ),
        )
      }

      return Promise.resolve(
        jsonResponse(
          createSnapshotResponse({
            room: initialRoom,
            participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
          }),
        ),
      )
    })

    render(
      <PersistedProjectedMatchRoomClient
        initialRoom={initialClientRoom}
        pollIntervalMs={10_000}
      />,
    )

    fireEvent.click(
      await screen.findByRole('button', { name: /Ready Aichi Sendou/ }),
    )

    await waitFor(() =>
      expect(screen.getByText('Submission Failed')).toBeVisible(),
    )
    expectTextVisible('pending_request')
    expect(screen.getByText('Blocked')).toBeVisible()
    expect(
      screen.getByText(/mulligan\.select_cards for Aichi Sendou/),
    ).toBeVisible()
    expect(screen.queryByText('Optimistic Pending')).toBeNull()
  })

  it('invalidates an optimistic command when polling observes a newer authoritative room revision first', async () => {
    const initialRoom = createLocalPrototypeMatchRoom(
      'persisted-optimistic-concurrent-poll',
    )
    const concurrent = acceptReadyCommand(
      initialRoom,
      LOCAL_MATCH_PLAYER_TWO_ID,
      'ready-kai',
    )
    const initialClientRoom = createClientRoom(
      initialRoom,
      LOCAL_MATCH_PARTICIPANT_ONE_ID,
    )
    const postResponse = createDeferred<Response>()
    let getCount = 0
    let postedBody: Record<string, unknown> | null = null

    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === 'POST') {
        postedBody = readRequestBody(init)

        return postResponse.promise
      }

      getCount += 1

      return Promise.resolve(
        jsonResponse(
          createSnapshotResponse({
            room: getCount === 1 ? initialRoom : concurrent.room,
            participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
            events: getCount === 1 ? [] : concurrent.events,
          }),
        ),
      )
    })

    render(
      <PersistedProjectedMatchRoomClient
        initialRoom={initialClientRoom}
        pollIntervalMs={10_000}
      />,
    )

    fireEvent.click(
      await screen.findByRole('button', { name: /Ready Aichi Sendou/ }),
    )

    expect(await screen.findByText('Optimistic Pending')).toBeVisible()

    fireEvent.focus(window)

    await waitFor(() =>
      expect(screen.getByText('Stale / Conflicted')).toBeVisible(),
    )
    expectTextVisible('authoritative_revision_advanced')
    expectRoomRevisionVisible(concurrent.room.revision)

    const capturedPostedBody = requireCapturedPostBody(postedBody)

    postResponse.resolve(
      jsonResponse({
        transport: 'server_route_commands_with_projected_snapshots',
        status: 'invalid',
        commandId: String(capturedPostedBody.commandId),
        roomId: initialRoom.roomId,
        participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
        code: 'stale_room_revision',
        message: 'The client command targeted a stale room revision.',
        projectedUpdate: createProjectedPush({
          room: concurrent.room,
          participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
          reason: 'reconnect_snapshot',
          events: concurrent.events,
        }),
      }),
    )

    await waitFor(() => expectTextVisible('stale_room_revision'))
  })

  it('lets the second participant observe another participant accepted update through polling', async () => {
    const initialRoom = createLocalPrototypeMatchRoom(
      'persisted-sync-second-participant',
    )
    const accepted = acceptReadyCommand(
      initialRoom,
      LOCAL_MATCH_PLAYER_ONE_ID,
      'ready-aichi',
    )
    const participantTwoInitialClientRoom = createClientRoom(
      initialRoom,
      LOCAL_MATCH_PARTICIPANT_TWO_ID,
    )

    fetchMock.mockResolvedValue(
      jsonResponse(
        createSnapshotResponse({
          room: accepted.room,
          participantId: LOCAL_MATCH_PARTICIPANT_TWO_ID,
          events: accepted.events,
        }),
      ),
    )

    render(
      <PersistedProjectedMatchRoomClient
        initialRoom={participantTwoInitialClientRoom}
        pollIntervalMs={10_000}
      />,
    )

    await waitFor(() => expectRoomRevisionVisible(accepted.room.revision))
    expect(screen.getByText('Seat 0 | Ready')).toBeVisible()

    const opponentSide = screen.getByRole('region', { name: 'Opponent side' })

    expect(
      within(opponentSide).getAllByText('Hidden card').length,
    ).toBeGreaterThan(0)
  })

  it('marks recovery failure and reattaches the live sync loop when the browser comes online', async () => {
    const initialRoom = createLocalPrototypeMatchRoom(
      'persisted-recovery-online',
    )
    const accepted = acceptReadyCommand(
      initialRoom,
      LOCAL_MATCH_PLAYER_TWO_ID,
      'ready-kai',
    )
    const initialClientRoom = createClientRoom(
      initialRoom,
      LOCAL_MATCH_PARTICIPANT_ONE_ID,
    )

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          {
            status: 'error',
            code: 'storage_unavailable',
            message: 'Temporary storage outage.',
          },
          503,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          createSnapshotResponse({
            room: accepted.room,
            participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
            events: accepted.events,
          }),
        ),
      )

    render(
      <PersistedProjectedMatchRoomClient
        initialRoom={initialClientRoom}
        pollIntervalMs={10_000}
      />,
    )

    await waitFor(() =>
      expect(screen.getByText('Recovery failed')).toBeVisible(),
    )
    expect(screen.getByText('Temporary storage outage.')).toBeVisible()

    fireEvent(window, new Event('online'))

    await waitFor(() => expectRoomRevisionVisible(accepted.room.revision))
    expect(screen.getByText('Recovered')).toBeVisible()
  })

  it('replaces stale local projected state with the latest authoritative snapshot after browser resume', async () => {
    const initialRoom = createLocalPrototypeMatchRoom(
      'persisted-recovery-resume',
    )
    const firstAdvance = acceptReadyCommand(
      initialRoom,
      LOCAL_MATCH_PLAYER_ONE_ID,
      'ready-aichi',
    )
    const secondAdvance = acceptReadyCommand(
      firstAdvance.room,
      LOCAL_MATCH_PLAYER_TWO_ID,
      'ready-kai',
    )
    const initialClientRoom = createClientRoom(
      initialRoom,
      LOCAL_MATCH_PARTICIPANT_ONE_ID,
    )

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          createSnapshotResponse({
            room: initialRoom,
            participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          createSnapshotResponse({
            room: secondAdvance.room,
            participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
            events: [...firstAdvance.events, ...secondAdvance.events],
          }),
        ),
      )

    render(
      <PersistedProjectedMatchRoomClient
        initialRoom={initialClientRoom}
        pollIntervalMs={10_000}
      />,
    )

    await waitFor(() => expect(screen.getByText('Recovered')).toBeVisible())
    expectRoomRevisionVisible(initialRoom.revision)

    fireEvent.focus(window)

    await waitFor(() => expectRoomRevisionVisible(secondAdvance.room.revision))
    expect(screen.getByText('Seat 1 | Ready')).toBeVisible()
  })

  it('recovers pending request and deadline state from the persisted participant snapshot', async () => {
    const initialRoom = createLocalPrototypeMatchRoom(
      'persisted-recovery-pending',
    )
    const pending = createMulliganPendingRoom(initialRoom)
    const initialClientRoom = createClientRoom(
      initialRoom,
      LOCAL_MATCH_PARTICIPANT_ONE_ID,
    )
    const deadlineAt = pending.room.clock.activeRequest?.deadlineAt

    expect(deadlineAt).toBeDefined()

    fetchMock.mockResolvedValue(
      jsonResponse(
        createSnapshotResponse({
          room: pending.room,
          participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
          events: pending.events,
        }),
      ),
    )

    render(
      <PersistedProjectedMatchRoomClient
        initialRoom={initialClientRoom}
        pollIntervalMs={10_000}
      />,
    )

    await waitFor(() => expectRoomRevisionVisible(pending.room.revision))
    expect(
      screen.getByText(/mulligan\.select_cards for Aichi Sendou/),
    ).toBeVisible()
    expect(
      screen.getByText(new RegExp(deadlineAt ?? 'missing-deadline')),
    ).toBeVisible()
    expect(screen.getAllByText('Pending Request').length).toBeGreaterThan(0)
  })

  it('treats an in-flight command failure as unknown, recovers from server state, and does not replay it', async () => {
    const initialRoom = createLocalPrototypeMatchRoom(
      'persisted-recovery-command-unknown',
    )
    const accepted = acceptReadyCommand(
      initialRoom,
      LOCAL_MATCH_PLAYER_ONE_ID,
      'ready-aichi',
    )
    const initialClientRoom = createClientRoom(
      initialRoom,
      LOCAL_MATCH_PARTICIPANT_ONE_ID,
    )
    let getCount = 0
    let postCount = 0

    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === 'POST') {
        postCount += 1

        return Promise.reject(
          new Error('Network dropped after command submission.'),
        )
      }

      getCount += 1

      return Promise.resolve(
        jsonResponse(
          createSnapshotResponse({
            room: getCount === 1 ? initialRoom : accepted.room,
            participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
            events: getCount === 1 ? [] : accepted.events,
          }),
        ),
      )
    })

    render(
      <PersistedProjectedMatchRoomClient
        initialRoom={initialClientRoom}
        pollIntervalMs={10_000}
      />,
    )

    fireEvent.click(
      await screen.findByRole('button', { name: /Ready Aichi Sendou/ }),
    )

    await waitFor(() => expectTextVisible('command_status_unknown'))
    await waitFor(() => expectRoomRevisionVisible(accepted.room.revision))
    expect(postCount).toBe(1)
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('engineState')
  })

  it('lets authoritative completed state override an optimistic pending command during recovery', async () => {
    const initialRoom = createLocalPrototypeMatchRoom(
      'persisted-optimistic-completed-recovery',
    )
    const completed = acceptRoomCommand(
      initialRoom,
      createConcedeCommand(
        LOCAL_MATCH_PLAYER_TWO_ID,
        createLocalActionId(initialRoom.revision, 1, 'timeout-like-concede'),
        initialRoom.engineState.revision,
      ),
    )
    const initialClientRoom = createClientRoom(
      initialRoom,
      LOCAL_MATCH_PARTICIPANT_ONE_ID,
    )
    const postResponse = createDeferred<Response>()
    let getCount = 0

    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === 'POST') {
        return postResponse.promise
      }

      getCount += 1

      return Promise.resolve(
        jsonResponse(
          createSnapshotResponse({
            room: getCount === 1 ? initialRoom : completed.room,
            participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
            events: getCount === 1 ? [] : completed.events,
          }),
        ),
      )
    })

    render(
      <PersistedProjectedMatchRoomClient
        initialRoom={initialClientRoom}
        pollIntervalMs={10_000}
      />,
    )

    fireEvent.click(
      await screen.findByRole('button', { name: /Ready Aichi Sendou/ }),
    )

    expect(await screen.findByText('Optimistic Pending')).toBeVisible()

    fireEvent.focus(window)

    await waitFor(() =>
      expect(screen.getAllByText('Completed').length).toBeGreaterThan(0),
    )
    expect(screen.getByText('Closed')).toBeVisible()
    expect(screen.getByText('Stale / Conflicted')).toBeVisible()
    expect(screen.getByText('No available actions.')).toBeVisible()
  })

  it('recovers completed rooms as closed projected state without local prototype fallback', async () => {
    const initialRoom = createLocalPrototypeMatchRoom(
      'persisted-recovery-completed',
    )
    const completed = acceptRoomCommand(
      initialRoom,
      createConcedeCommand(
        LOCAL_MATCH_PLAYER_TWO_ID,
        createLocalActionId(initialRoom.revision, 1, 'concede-kai'),
        initialRoom.engineState.revision,
      ),
    )
    const initialClientRoom = createClientRoom(
      initialRoom,
      LOCAL_MATCH_PARTICIPANT_ONE_ID,
    )

    fetchMock.mockResolvedValue(
      jsonResponse(
        createSnapshotResponse({
          room: completed.room,
          participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
          events: completed.events,
        }),
      ),
    )

    render(
      <PersistedProjectedMatchRoomClient
        initialRoom={initialClientRoom}
        pollIntervalMs={10_000}
      />,
    )

    await waitFor(() =>
      expect(screen.getAllByText('Completed').length).toBeGreaterThan(0),
    )
    expect(screen.getByText('Closed')).toBeVisible()
    expect(screen.getByText('No available actions.')).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/matches/rooms/${encodeURIComponent(initialRoom.roomId)}/realtime`,
      expect.objectContaining({
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      }),
    )
  })
})

function createClientRoom(
  room: MatchRoomWithEngineState,
  participantId: MatchRoomParticipantId,
) {
  const state = buildProjectedMatchRoomClientStateFromPush(
    createProjectedPush({
      room,
      participantId,
      reason: 'reconnect_snapshot',
    }),
  )

  expect(state.ok).toBe(true)

  if (!state.ok) {
    throw new Error(state.message)
  }

  return state.state
}

function createAcceptedCommandResponse(input: {
  readonly commandId: string
  readonly room: MatchRoomWithEngineState
  readonly participantId: MatchRoomParticipantId
  readonly events: readonly GameEvent[]
}) {
  const historyEntryId =
    `${input.room.roomId}:history:${input.room.revision}` as MatchRoomHistoryEntryId
  const projectedUpdate = createProjectedPush({
    room: input.room,
    participantId: input.participantId,
    reason: 'command_accepted',
    events: input.events,
    acceptedHistoryEntryIds: [historyEntryId],
  })

  return {
    transport: 'server_route_commands_with_projected_snapshots',
    status: 'accepted',
    commandId: input.commandId,
    roomId: input.room.roomId,
    participantId: input.participantId,
    roomRevision: input.room.revision,
    engineRevision: input.room.engineState.revision,
    acceptedHistoryEntryIds: [historyEntryId],
    projectedUpdate,
  }
}

function createBlockedCommandResponse(input: {
  readonly commandId: string
  readonly room: MatchRoomWithEngineState
  readonly participantId: MatchRoomParticipantId
  readonly events: readonly GameEvent[]
}) {
  return {
    transport: 'server_route_commands_with_projected_snapshots',
    status: 'blocked',
    commandId: input.commandId,
    roomId: input.room.roomId,
    participantId: input.participantId,
    code: 'pending_request',
    message: 'Engine is waiting on a pending request.',
    projectedUpdate: createProjectedPush({
      room: input.room,
      participantId: input.participantId,
      reason: 'reconnect_snapshot',
      events: input.events,
    }),
  }
}

function createSnapshotResponse(input: {
  readonly room: MatchRoomWithEngineState
  readonly participantId: MatchRoomParticipantId
  readonly events?: readonly GameEvent[]
}) {
  const projectedUpdate = createProjectedPush({
    room: input.room,
    participantId: input.participantId,
    reason: 'reconnect_snapshot',
    events: input.events ?? [],
  })

  return {
    transport: 'server_route_commands_with_projected_snapshots',
    status: 'ok',
    roomId: input.room.roomId,
    participantId: input.participantId,
    roomRevision: input.room.revision,
    engineRevision: input.room.engineState.revision,
    projectedUpdate,
  }
}

function createProjectedPush(input: {
  readonly room: MatchRoomWithEngineState
  readonly participantId: MatchRoomParticipantId
  readonly reason: RealtimeProjectedStatePush['reason']
  readonly events?: readonly GameEvent[]
  readonly acceptedHistoryEntryIds?: readonly MatchRoomHistoryEntryId[]
}): RealtimeProjectedStatePush {
  const projection = projectMatchRoomForParticipant(
    input.room,
    input.participantId,
    {
      events: input.events ?? [],
      serverNow: '2026-06-07T12:00:00.000Z',
    },
  )

  expect(projection.ok).toBe(true)

  if (!projection.ok) {
    throw new Error(projection.message)
  }

  return {
    type: 'projected_state',
    reason: input.reason,
    roomId: input.room.roomId,
    participantId: input.participantId,
    roomRevision: input.room.revision,
    engineRevision: input.room.engineState.revision,
    acceptedHistoryEntryIds: input.acceptedHistoryEntryIds ?? [],
    projection: projection.projection,
  }
}

function acceptReadyCommand(
  room: MatchRoomWithEngineState,
  playerId: PlayerId,
  label: string,
) {
  return acceptRoomCommand(
    room,
    createReadyCommand(playerId, createLocalActionId(room.revision, 1, label)),
    {
      submittedAt: '2026-06-07T12:00:01.000Z',
    },
  )
}

function createMulliganPendingRoom(room: MatchRoomWithEngineState) {
  const readyOne = acceptReadyCommand(
    room,
    LOCAL_MATCH_PLAYER_ONE_ID,
    'ready-aichi',
  )
  const readyTwo = acceptReadyCommand(
    readyOne.room,
    LOCAL_MATCH_PLAYER_TWO_ID,
    'ready-kai',
  )
  const started = acceptRoomCommand(
    readyTwo.room,
    createStartMatchCommand(
      createLocalActionId(readyTwo.room.revision, 3, 'start-match'),
      readyTwo.room.engineState.revision,
    ),
    {
      submittedAt: '2026-06-07T12:00:03.000Z',
    },
  )

  return acceptRoomCommand(
    started.room,
    createBeginMulliganCommand(
      LOCAL_MATCH_PLAYER_ONE_ID,
      createLocalActionId(started.room.revision, 4, 'begin-mulligan'),
      started.room.engineState.revision,
    ),
    {
      submittedAt: '2026-06-07T12:00:04.000Z',
    },
  )
}

function acceptRoomCommand(
  room: MatchRoomWithEngineState,
  submission: MatchRoomCommandSubmission,
  options: {
    readonly submittedAt?: string
  } = {},
) {
  const result = submitMatchRoomCommand(room, submission, {
    submittedAt: options.submittedAt ?? '2026-06-07T12:00:01.000Z',
  })

  expect(result.status).toBe('accepted')

  if (result.status !== 'accepted') {
    throw new Error(`Expected accepted command, received ${result.status}.`)
  }

  return {
    room: result.room,
    events: result.engineResult.events,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

function readRequestBody(init: RequestInit): Record<string, unknown> {
  if (typeof init.body !== 'string') {
    throw new Error('Expected JSON string request body.')
  }

  const value = JSON.parse(init.body) as unknown

  return requireRecord(value)
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>
  }

  throw new Error('Expected record value.')
}

function requireCapturedPostBody(
  value: Record<string, unknown> | null,
): Record<string, unknown> {
  if (value === null) {
    throw new Error('Expected optimistic POST body.')
  }

  return value
}

function expectRoomRevisionVisible(revision: number) {
  expect(screen.getAllByText(`Room r${revision}`).length).toBeGreaterThan(0)
}

function expectTextVisible(text: string) {
  expect(screen.getAllByText(text).length).toBeGreaterThan(0)
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return {
    promise,
    resolve,
    reject,
  }
}
