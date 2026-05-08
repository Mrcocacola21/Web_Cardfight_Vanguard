import { readFileSync } from 'node:fs'
import path from 'node:path'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { BasicMatchRoomView } from './basic-match-room-view'

describe('Local gameplay prototype flow', () => {
  afterEach(() => {
    cleanup()
  })

  it('lets a local session progress through setup, request resolution, board actions, and log updates', () => {
    render(<BasicMatchRoomView roomId="local-prototype-flow" />)

    expect(screen.getByRole('region', { name: 'Match board' })).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Available actions' }),
    ).toBeVisible()
    expect(screen.getByRole('region', { name: 'Event log' })).toBeVisible()
    expect(screen.getByText('No engine events yet.')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /ready aichi/i }))
    fireEvent.click(screen.getByRole('button', { name: /ready kai/i }))
    fireEvent.click(screen.getByRole('button', { name: /start match/i }))

    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0)
    expect(
      screen.getByText('Match started. Starting player: Aichi Sendou.'),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /begin mulligan/i }))

    expect(
      screen.getByRole('button', { name: /mulligan first hand card/i }),
    ).toBeEnabled()
    expect(
      screen.getByRole('region', { name: 'Blocked actions' }),
    ).toBeVisible()
    expect(screen.getAllByText('pending_request').length).toBeGreaterThan(0)

    fireEvent.click(
      screen.getByRole('button', { name: /mulligan first hand card/i }),
    )

    expect(screen.getByText('No engine request is pending.')).toBeVisible()
    expect(screen.getByText('Aichi Sendou drew 1 cards.')).toBeVisible()
    expect(screen.getByText('Aichi Sendou completed mulligan.')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /advance phase/i }))
    fireEvent.click(
      screen.getByRole('button', { name: /ride first ride deck card/i }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /call first hand card/i }),
    )

    expect(
      screen.getByText('Phase advanced from pregame to draw.'),
    ).toBeVisible()
    expect(
      screen.getByText('p1:piece:ride-deck-0 rode onto the vanguard circle.'),
    ).toBeVisible()
    expect(
      screen.getByText('p1:piece:hand-2 was called to rear-guard.'),
    ).toBeVisible()
    expect(screen.getAllByText('p1:card:ride-deck-0').length).toBeGreaterThan(0)
    expect(screen.getAllByText('p1:card:hand-2').length).toBeGreaterThan(0)
    expect(screen.getByText('Accepted')).toBeVisible()
  })

  it('keeps the local prototype wired to room and engine boundaries', () => {
    const sourcePaths = [
      'src/app/(protected)/matches/play/local/page.tsx',
      'src/components/matches/basic-match-room-view.tsx',
      'src/components/matches/available-actions-panel.tsx',
      'src/components/matches/event-log-panel.tsx',
      'src/components/matches/match-board.tsx',
      'src/features/matches/play/local-match-room.ts',
      'src/features/matches/play/available-actions.ts',
      'src/features/matches/play/event-log.ts',
      'src/features/matches/play/zone-projection.ts',
    ]
    const source = sourcePaths
      .map((sourcePath) =>
        readFileSync(path.resolve(process.cwd(), sourcePath), 'utf8'),
      )
      .join('\n')

    expect(source).toContain('createLocalPrototypeMatchRoom')
    expect(source).toContain('submitMatchRoomCommand')
    expect(source).not.toContain('applyGameAction')
    expect(source).not.toContain('applyGameChoiceResponse')
    expect(source).not.toContain('reduceGameState')
  })
})
