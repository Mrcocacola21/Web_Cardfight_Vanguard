import { readFileSync } from 'node:fs'
import path from 'node:path'

import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  projectMatchRoomForParticipant,
  submitMatchRoomCommand,
  type MatchRoomCommandSubmission,
  type MatchRoomWithEngineState,
} from '@web-vg/match-session'
import type { BattleId, GameState } from '@web-vg/rules-core'

import {
  LOCAL_MATCH_PARTICIPANT_ONE_ID,
  LOCAL_MATCH_PLAYER_ONE_ID,
  LOCAL_MATCH_PLAYER_TWO_ID,
  createBeginMulliganCommand,
  createLocalActionId,
  createLocalPrototypeMatchRoom,
  createReadyCommand,
  createStartMatchCommand,
} from '@/features/matches/play/local-match-room'
import {
  buildProjectedMatchRoomClientState,
  createProjectedMatchActionsProjection,
} from '@/features/matches/play/projected-client-state'

import { ProjectedMatchRoomView } from './projected-match-room-view'

describe('ProjectedMatchRoomView', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the multiplayer match screen from participant projection only', () => {
    const room = createProjectedClientRoom()

    const { container } = render(
      <ProjectedMatchRoomView
        room={room}
        actions={createProjectedMatchActionsProjection(room)}
      />,
    )

    const opponentSide = screen.getByRole('region', { name: 'Opponent side' })

    expect(
      screen.getByRole('heading', { name: 'Vanguard Playmat' }),
    ).toBeVisible()
    expect(screen.getByRole('region', { name: 'Match context' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Match board' })).toBeVisible()
    expect(container.querySelector('[data-playmat="vanguard"]')).not.toBeNull()
    expect(
      container.querySelectorAll('[data-playmat-circle="vanguard"]').length,
    ).toBeGreaterThan(0)
    expect(screen.getByLabelText('Battle lane')).toBeVisible()
    expect(screen.getByRole('region', { name: 'Battle context' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Choice request' })).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Action feedback' }),
    ).toBeVisible()
    expect(screen.getByRole('region', { name: 'Event log' })).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Available actions' }),
    ).toBeVisible()
    expect(
      within(opponentSide).getAllByText('Hidden card').length,
    ).toBeGreaterThan(0)
    expect(
      within(opponentSide).queryByText('local-catalog:keter:main-g1-a'),
    ).toBeNull()
  })

  it('shows a human request prompt and legal target highlights from projected request data', () => {
    const fullRequestRoom = createProjectedClientRoomWithMulliganRequest()
    const firstRequest = fullRequestRoom.pendingRequests[0]

    expect(firstRequest?.visibilityToViewer).toBe('full')

    if (
      firstRequest === undefined ||
      firstRequest.visibilityToViewer !== 'full'
    ) {
      throw new Error('Expected a full visible mulligan request.')
    }

    const room = {
      ...fullRequestRoom,
      pendingRequests: [
        {
          ...firstRequest,
          eligiblePieces: (firstRequest.eligiblePieces ?? []).slice(0, 1),
        },
      ],
    }

    const { container } = render(
      <ProjectedMatchRoomView
        room={room}
        actions={createProjectedMatchActionsProjection(room)}
      />,
    )

    expect(
      screen.getAllByText(/choose cards to return for mulligan/i).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText('Request id')).toBeNull()
    expect(screen.queryByText('Visibility')).toBeNull()
    expect(
      screen.getAllByRole('button', { name: /legal target/i }).length,
    ).toBeGreaterThan(0)
    expect(
      container.querySelectorAll('[data-target-state="available"]').length,
    ).toBeGreaterThan(0)
    expect(
      container.querySelectorAll('[data-target-state="unavailable"]').length,
    ).toBeGreaterThan(0)
  })

  it('renders battle context as a visible sequence instead of only log entries', () => {
    const room = createProjectedClientRoom()
    const currentSide = room.board.currentSide
    const attackerZone = currentSide?.battlefieldZones.find(
      (zone) => zone.role === 'vanguard',
    )
    const attacker = attackerZone?.pieces[0]

    expect(currentSide).toBeDefined()
    expect(attackerZone).toBeDefined()
    expect(attacker).toBeDefined()

    if (
      currentSide === undefined ||
      attackerZone === undefined ||
      attacker === undefined
    ) {
      throw new Error('Expected projected attacker fixture.')
    }

    const battleRoom = {
      ...room,
      turn: {
        ...room.turn,
        phase: 'battle' as GameState['turn']['phase'],
      },
      battle: {
        battleId: 'battle-ui-context' as BattleId,
        status: 'guard_requested' as const,
        attackingPlayerId: LOCAL_MATCH_PLAYER_ONE_ID,
        defendingPlayerId: LOCAL_MATCH_PLAYER_TWO_ID,
        attacker: {
          refId: attacker.refId,
          visibility: attacker.visibility,
          ...(attacker.pieceId === undefined
            ? {}
            : { pieceId: attacker.pieceId }),
        },
        attackerZoneId: attackerZone.zoneId,
        target: {
          kind: 'player' as const,
          playerId: LOCAL_MATCH_PLAYER_TWO_ID,
        },
        guardPieces: [],
      },
    }

    render(
      <ProjectedMatchRoomView
        room={battleRoom}
        actions={createProjectedMatchActionsProjection(battleRoom)}
      />,
    )

    const battle = screen.getByRole('region', { name: 'Battle context' })

    expect(within(battle).getByText('Waiting for guard')).toBeVisible()
    expect(within(battle).getByText('Attacker')).toBeVisible()
    expect(within(battle).getByText('Target')).toBeVisible()
    expect(within(battle).getByText('Guard step is open')).toBeVisible()
  })

  it('shows stale and recovery feedback in player-readable language', () => {
    const room = createProjectedClientRoom()

    render(
      <ProjectedMatchRoomView
        room={room}
        actions={createProjectedMatchActionsProjection(room)}
        feedback={{
          status: 'invalid',
          code: 'stale_room_revision',
          message: 'The client command targeted a stale room revision.',
        }}
        syncStatus={{
          status: 'recovered',
          label: 'Recovered',
        }}
      />,
    )

    expect(screen.getByText('Stale')).toBeVisible()
    expect(
      screen.getByText(/choose again from the refreshed state/i),
    ).toBeVisible()
    expect(screen.getAllByText('Recovered').length).toBeGreaterThan(0)
    expect(screen.getByText('stale_room_revision')).toBeVisible()
  })

  it('keeps canonical engine state out of multiplayer render components', () => {
    const sourcePaths = [
      'src/components/matches/projected-match-room-view.tsx',
      'src/components/matches/match-board.tsx',
      'src/components/matches/available-actions-panel.tsx',
      'src/components/matches/event-log-panel.tsx',
    ]
    const source = sourcePaths
      .map((sourcePath) =>
        readFileSync(path.resolve(process.cwd(), sourcePath), 'utf8'),
      )
      .join('\n')

    expect(source).not.toContain('engineState')
  })
})

function createProjectedClientRoom() {
  const canonicalRoom = createLocalPrototypeMatchRoom('projected-ui-render')
  const projection = projectMatchRoomForParticipant(
    canonicalRoom,
    LOCAL_MATCH_PARTICIPANT_ONE_ID,
  )

  expect(projection.ok).toBe(true)

  if (!projection.ok) {
    throw new Error(projection.message)
  }

  const clientState = buildProjectedMatchRoomClientState({
    projection: projection.projection,
  })

  expect(clientState.ok).toBe(true)

  if (!clientState.ok) {
    throw new Error(clientState.message)
  }

  return clientState.state
}

function createProjectedClientRoomWithMulliganRequest() {
  const room = createLocalPrototypeMatchRoom('projected-ui-mulligan')
  const readyOne = acceptCommand(
    room,
    createReadyCommand(
      LOCAL_MATCH_PLAYER_ONE_ID,
      createLocalActionId(room.revision, 1, 'ready-aichi'),
    ),
  )
  const readyTwo = acceptCommand(
    readyOne,
    createReadyCommand(
      LOCAL_MATCH_PLAYER_TWO_ID,
      createLocalActionId(readyOne.revision, 2, 'ready-kai'),
    ),
  )
  const started = acceptCommand(
    readyTwo,
    createStartMatchCommand(
      createLocalActionId(readyTwo.revision, 3, 'start'),
      readyTwo.engineState.revision,
    ),
  )
  const pending = acceptCommand(
    started,
    createBeginMulliganCommand(
      LOCAL_MATCH_PLAYER_ONE_ID,
      createLocalActionId(started.revision, 4, 'begin-mulligan'),
      started.engineState.revision,
    ),
  )

  return createProjectedClientRoomFromCanonical(pending)
}

function createProjectedClientRoomFromCanonical(
  canonicalRoom: MatchRoomWithEngineState,
) {
  const projection = projectMatchRoomForParticipant(
    canonicalRoom,
    LOCAL_MATCH_PARTICIPANT_ONE_ID,
  )

  expect(projection.ok).toBe(true)

  if (!projection.ok) {
    throw new Error(projection.message)
  }

  const clientState = buildProjectedMatchRoomClientState({
    projection: projection.projection,
  })

  expect(clientState.ok).toBe(true)

  if (!clientState.ok) {
    throw new Error(clientState.message)
  }

  return clientState.state
}

function acceptCommand(
  room: MatchRoomWithEngineState,
  submission: MatchRoomCommandSubmission,
): MatchRoomWithEngineState {
  const result = submitMatchRoomCommand(room, submission, {
    submittedAt: '2026-05-07T00:00:04.000Z',
  })

  expect(result.status).toBe('accepted')

  if (result.status !== 'accepted') {
    throw new Error(`Expected accepted command, received ${result.status}.`)
  }

  return result.room
}
