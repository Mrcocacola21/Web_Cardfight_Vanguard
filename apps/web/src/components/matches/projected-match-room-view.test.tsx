import { readFileSync } from 'node:fs'
import path from 'node:path'

import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { projectMatchRoomForParticipant } from '@web-vg/match-session'

import {
  LOCAL_MATCH_PARTICIPANT_ONE_ID,
  createLocalPrototypeMatchRoom,
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

    render(
      <ProjectedMatchRoomView
        room={room}
        actions={createProjectedMatchActionsProjection(room)}
      />,
    )

    const opponentSide = screen.getByRole('region', { name: 'Opponent side' })

    expect(screen.getByRole('heading', { name: 'Match Room' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Match board' })).toBeVisible()
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
