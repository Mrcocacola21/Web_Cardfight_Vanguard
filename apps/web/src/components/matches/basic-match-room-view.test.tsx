import { readFileSync } from 'node:fs'
import path from 'node:path'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as matchSession from '@web-vg/match-session'

import { BasicMatchRoomView } from './basic-match-room-view'

describe('BasicMatchRoomView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders live room and engine state from the match room aggregate', () => {
    render(<BasicMatchRoomView roomId="local-room-1" />)

    expect(screen.getByRole('heading', { name: 'Match Room' })).toBeVisible()
    expect(screen.getByText('local-room-1')).toBeVisible()
    expect(screen.getByText('Room r1')).toBeVisible()
    expect(screen.getByText('Engine r0')).toBeVisible()
    expect(screen.getAllByText('Aichi Sendou').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Toshiki Kai').length).toBeGreaterThan(0)
    expect(screen.getByRole('region', { name: 'Match board' })).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Current player side' }),
    ).toBeVisible()
    expect(screen.getByRole('region', { name: 'Opponent side' })).toBeVisible()
    expect(
      screen.getAllByText('local-catalog:keter:starting-sage').length,
    ).toBeGreaterThan(0)
    expect(screen.getByText('local-catalog:keter:wayward-boost')).toBeVisible()
    expect(
      screen.getAllByText('local-catalog:keter:main-g1-a').length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByRole('region', { name: 'Available actions' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: /ready aichi/i })).toBeVisible()
    expect(screen.getByText('Unavailable Now')).toBeVisible()
    expect(screen.getByText('Start match')).toBeVisible()
    expect(screen.getByRole('region', { name: 'Event log' })).toBeVisible()
    expect(screen.getByText('No engine events yet.')).toBeVisible()
    expect(screen.getByText('No engine request is pending.')).toBeVisible()
    expect(screen.getByText('No command submitted yet.')).toBeVisible()
  })

  it('submits available actions through the match room boundary', () => {
    render(<BasicMatchRoomView roomId="invalid-flow" />)

    const submitSpy = vi.spyOn(matchSession, 'submitMatchRoomCommand')
    const callCountBeforeClick = submitSpy.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: /ready aichi/i }))

    expect(submitSpy.mock.calls.length).toBeGreaterThan(callCountBeforeClick)
    expect(screen.getByText('Accepted')).toBeVisible()
    expect(screen.getByText('Engine r1')).toBeVisible()
  })

  it('renders structured invalid results returned by the room boundary', () => {
    render(<BasicMatchRoomView roomId="invalid-flow" />)

    vi.spyOn(matchSession, 'submitMatchRoomCommand').mockImplementationOnce(
      (room) =>
        ({
          status: 'invalid',
          room,
          code: 'invalid_action',
          message: 'Forced invalid result from the room boundary.',
        }) as matchSession.MatchRoomCommandResult,
    )

    fireEvent.click(screen.getByRole('button', { name: /ready aichi/i }))

    expect(screen.getByText('Invalid')).toBeVisible()
    expect(screen.getAllByText('invalid_action').length).toBeGreaterThan(0)
    expect(
      screen.getByText('Forced invalid result from the room boundary.'),
    ).toBeVisible()
    expect(screen.getByText('Engine r0')).toBeVisible()
  })

  it('keeps the session usable after an invalid room-boundary result', () => {
    render(<BasicMatchRoomView roomId="invalid-recovery-flow" />)

    vi.spyOn(matchSession, 'submitMatchRoomCommand').mockImplementationOnce(
      (room) =>
        ({
          status: 'invalid',
          room,
          code: 'invalid_action',
          message: 'Forced invalid result from the room boundary.',
        }) as matchSession.MatchRoomCommandResult,
    )

    fireEvent.click(screen.getByRole('button', { name: /ready aichi/i }))

    expect(screen.getByText('Invalid')).toBeVisible()
    expect(screen.getByText('Engine r0')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /ready aichi/i }))

    expect(screen.getByText('Accepted')).toBeVisible()
    expect(screen.getByText('Engine r1')).toBeVisible()
    expect(screen.getByRole('region', { name: 'Match board' })).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Available actions' }),
    ).toBeVisible()
  })

  it('renders accepted, pending, blocked, and choice-resolution states in the local session flow', () => {
    render(<BasicMatchRoomView roomId="pending-flow" />)

    fireEvent.click(screen.getByRole('button', { name: /ready aichi/i }))
    fireEvent.click(screen.getByRole('button', { name: /ready kai/i }))
    fireEvent.click(screen.getByRole('button', { name: /start match/i }))

    expect(screen.getByText('Accepted')).toBeVisible()
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0)
    expect(
      screen.getByText('Match started. Starting player: Aichi Sendou.'),
    ).toBeVisible()
    expect(screen.getByText('Turn 0 started for Aichi Sendou.')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /begin mulligan/i }))

    expect(
      screen.getAllByText(/mulligan\.select_cards/).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText('Eligible pieces')).toBeVisible()
    expect(
      screen.getByRole('button', { name: /keep current hand/i }),
    ).toBeEnabled()
    expect(
      screen.getByRole('region', { name: 'Blocked actions' }),
    ).toBeVisible()
    expect(screen.getAllByText('pending_request').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Blocking:/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /keep current hand/i }))

    expect(screen.getByText('Accepted')).toBeVisible()
    expect(screen.getAllByText(/mulligan.completed/).length).toBeGreaterThan(0)
    expect(screen.getByText('Aichi Sendou completed mulligan.')).toBeVisible()
    expect(
      screen.getByText(
        'Aichi Sendou resolved mulligan.select_cards with answer.mulligan.',
      ),
    ).toBeVisible()
    expect(screen.getByText('No engine request is pending.')).toBeVisible()
  })

  it('renders a closed no-action state after the match completes', () => {
    render(<BasicMatchRoomView roomId="completed-flow" />)

    fireEvent.click(screen.getByRole('button', { name: /concede kai/i }))

    expect(screen.getByText('Accepted')).toBeVisible()
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0)
    expect(screen.getByText('Closed')).toBeVisible()
    expect(screen.getByText('No available actions.')).toBeVisible()
    expect(
      screen.getByText('Match ended by concede; winner: Aichi Sendou.'),
    ).toBeVisible()
  })

  it('keeps direct reducer and transition internals out of the screen module', () => {
    const sourcePaths = [
      'src/components/matches/basic-match-room-view.tsx',
      'src/components/matches/available-actions-panel.tsx',
      'src/components/matches/event-log-panel.tsx',
      'src/components/matches/match-board.tsx',
      'src/features/matches/play/available-actions.ts',
      'src/features/matches/play/event-log.ts',
      'src/features/matches/play/zone-projection.ts',
    ]
    const source = sourcePaths
      .map((sourcePath) =>
        readFileSync(path.resolve(process.cwd(), sourcePath), 'utf8'),
      )
      .join('\n')

    expect(source).toContain('submitMatchRoomCommand')
    expect(source).not.toContain('applyGameAction')
    expect(source).not.toContain('applyGameChoiceResponse')
    expect(source).not.toContain('reduceGameState')
    expect(source).not.toContain('currentState:')
    expect(source).not.toContain('nextState:')
  })
})
