import { readFileSync } from 'node:fs'
import path from 'node:path'

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getProjectedPersistedMatchRoomPageState: vi.fn(),
  persistedProjectedMatchRoomClient: vi.fn(),
  errorState: vi.fn(),
  notFound: vi.fn(),
}))

vi.mock('@/features/matches/server/projected-persisted-room-read', () => ({
  getProjectedPersistedMatchRoomPageState:
    mocks.getProjectedPersistedMatchRoomPageState,
}))

vi.mock('@/components/matches/persisted-projected-match-room-client', () => ({
  PersistedProjectedMatchRoomClient: ({
    initialRoom,
  }: {
    readonly initialRoom: unknown
  }) => {
    mocks.persistedProjectedMatchRoomClient({ initialRoom })

    return (
      <div data-testid="persisted-projected-match-room-client">
        {roomIdOf(initialRoom)}
      </div>
    )
  },
}))

vi.mock('@/components/feedback', () => ({
  ErrorState: ({
    title,
    description,
    actionLabel,
    actionHref,
  }: {
    readonly title: string
    readonly description: string
    readonly actionLabel?: string
    readonly actionHref?: string
  }) => {
    mocks.errorState({ title, description, actionLabel, actionHref })

    return (
      <div role="alert">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    )
  },
}))

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}))

import MatchPlayPage from './page'

describe('MatchPlayPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.notFound.mockImplementation(() => {
      throw new Error('NEXT_NOT_FOUND')
    })
    mocks.getProjectedPersistedMatchRoomPageState.mockResolvedValue(
      createReadyPageState(),
    )
  })

  it('loads persisted projected room state before rendering the multiplayer view', async () => {
    render(
      await MatchPlayPage({
        params: Promise.resolve({
          roomId: 'room%2019-2',
        }),
      }),
    )

    expect(mocks.getProjectedPersistedMatchRoomPageState).toHaveBeenCalledWith({
      roomId: 'room 19-2',
    })
    const renderedClientProps = requireRecord(
      mocks.persistedProjectedMatchRoomClient.mock.calls[0]?.[0] as unknown,
    )

    expect(renderedClientProps.initialRoom).toMatchObject({
      source: 'participant_projection',
      roomId: 'room 19-2',
    })
    expect(
      screen.getByTestId('persisted-projected-match-room-client'),
    ).toHaveTextContent('room 19-2')
  })

  it('renders route access errors without falling back to a local room', async () => {
    mocks.getProjectedPersistedMatchRoomPageState.mockResolvedValueOnce({
      kind: 'error',
      code: 'room_access_denied',
      title: 'Match room access denied',
      message: 'Your profile is not a participant in this match room.',
    })

    render(
      await MatchPlayPage({
        params: Promise.resolve({
          roomId: 'persisted-room-denied',
        }),
      }),
    )

    expect(mocks.persistedProjectedMatchRoomClient).not.toHaveBeenCalled()
    expect(mocks.errorState).toHaveBeenCalledWith({
      title: 'Match room access denied',
      description: 'Your profile is not a participant in this match room.',
      actionLabel: 'Back to matches',
      actionHref: '/matches',
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Match room access denied',
    )
  })

  it('returns the route not-found boundary for missing persisted rooms', async () => {
    mocks.getProjectedPersistedMatchRoomPageState.mockResolvedValueOnce({
      kind: 'not_found',
    })

    await expect(
      MatchPlayPage({
        params: Promise.resolve({
          roomId: 'missing-room',
        }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')

    expect(mocks.notFound).toHaveBeenCalledTimes(1)
    expect(mocks.persistedProjectedMatchRoomClient).not.toHaveBeenCalled()
  })

  it('does not import the local prototype room path for multiplayer rendering', () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        'src/app/(protected)/matches/play/[roomId]/page.tsx',
      ),
      'utf8',
    )

    expect(source).not.toContain('BasicMatchRoomView')
    expect(source).not.toContain('createLocalPrototypeMatchRoom')
    expect(source).toContain('PersistedProjectedMatchRoomClient')
    expect(source).toContain('getProjectedPersistedMatchRoomPageState')
  })
})

function createReadyPageState() {
  const room = {
    source: 'participant_projection',
    roomId: 'room 19-2',
    status: 'in_progress',
    gameStatus: 'in_progress',
    roomRevision: 4,
    engineRevision: 8,
  }
  const actions = {
    mode: 'normal',
    actions: [],
    availableActions: [],
    blockedActions: [],
    unavailableActions: [],
  }

  return {
    kind: 'ready',
    room,
    actions,
  }
}

function roomIdOf(value: unknown): string {
  if (
    typeof value === 'object' &&
    value !== null &&
    'roomId' in value &&
    typeof value.roomId === 'string'
  ) {
    return value.roomId
  }

  return 'unknown-room'
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>
  }

  throw new Error('Expected a record value.')
}
