import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  LOCAL_MATCH_PLAYER_ONE_ID,
  createLocalPrototypeMatchRoom,
} from '@/features/matches/play/local-match-room'

import { MatchBoard } from './match-board'

describe('MatchBoard', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders current and opponent board sides from the room engine state', () => {
    const room = createLocalPrototypeMatchRoom('match-board')

    render(
      <MatchBoard
        engineState={room.engineState}
        perspectivePlayerId={LOCAL_MATCH_PLAYER_ONE_ID}
        resolvePlayerLabel={(playerId) =>
          playerId === LOCAL_MATCH_PLAYER_ONE_ID
            ? 'Aichi Sendou'
            : 'Toshiki Kai'
        }
      />,
    )

    expect(screen.getByRole('region', { name: 'Match board' })).toBeVisible()

    const currentSide = screen.getByRole('region', {
      name: 'Current player side',
    })
    const opponentSide = screen.getByRole('region', { name: 'Opponent side' })
    const currentBattlefield = within(currentSide).getByRole('region', {
      name: 'Current player side battlefield zones',
    })
    const currentSupport = within(currentSide).getByRole('region', {
      name: 'Current player side support zones',
    })
    const currentHand = within(currentSide).getByRole('region', {
      name: 'Current player side hand zones',
    })

    expect(within(currentSide).getByText('Aichi Sendou')).toBeVisible()
    expect(within(opponentSide).getByText('Toshiki Kai')).toBeVisible()
    expect(
      within(currentBattlefield).getByText('p1:card:starter'),
    ).toBeVisible()
    expect(within(currentSupport).getByText('p1:card:soul-1')).toBeVisible()
    expect(
      within(currentSupport).getByText('p1:card:ride-deck-0'),
    ).toBeVisible()
    expect(within(currentSupport).getByText('p1:card:g-deck-1')).toBeVisible()
    expect(within(currentHand).getByText('p1:card:hand-1')).toBeVisible()
    expect(within(opponentSide).getByText('p2:card:starter')).toBeVisible()
  })

  it('renders all main zone contents, empty areas, hidden private cards, and piece flags', () => {
    const room = createLocalPrototypeMatchRoom('match-board-contents')

    render(
      <MatchBoard
        engineState={room.engineState}
        perspectivePlayerId={LOCAL_MATCH_PLAYER_ONE_ID}
      />,
    )

    const currentSide = screen.getByRole('region', {
      name: 'Current player side',
    })
    const opponentSide = screen.getByRole('region', { name: 'Opponent side' })

    expect(within(currentSide).getByText('p1:card:rear-guard-1')).toBeVisible()
    expect(within(currentSide).getByText('p1:card:damage-1')).toBeVisible()
    expect(within(currentSide).getByText('p1:card:soul-1')).toBeVisible()
    expect(within(currentSide).getByText('p1:card:ride-deck-1')).toBeVisible()
    expect(within(currentSide).getByText('p1:card:g-deck-1')).toBeVisible()
    expect(within(currentSide).getByText('Empty slot')).toBeVisible()
    expect(
      within(currentSide).getAllByText('Empty zone').length,
    ).toBeGreaterThanOrEqual(2)
    expect(within(currentSide).getByText('Rest')).toBeVisible()
    expect(within(currentSide).getByText('Locked')).toBeVisible()
    expect(within(opponentSide).getAllByText('Hidden card').length).toBe(8)
    expect(within(opponentSide).queryByText('p2:card:hand-1')).toBeNull()
    expect(within(opponentSide).queryByText('p2:card:deck-1')).toBeNull()
    expect(within(opponentSide).queryByText('p2:card:ride-deck-0')).toBeNull()
    expect(within(opponentSide).queryByText('p2:card:g-deck-1')).toBeNull()
  })
})
