import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  LOCAL_MATCH_PLAYER_ONE_ID,
  createLocalPrototypeMatchRoom,
} from '@/features/matches/play/local-match-room'
import { buildMatchBoardProjection } from '@/features/matches/play/zone-projection'

import { MatchBoard } from './match-board'

describe('MatchBoard', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders current and opponent board sides from a projected board state', () => {
    const room = createLocalPrototypeMatchRoom('match-board')
    const projection = buildMatchBoardProjection(
      room.engineState,
      LOCAL_MATCH_PLAYER_ONE_ID,
    )

    render(
      <MatchBoard
        projection={projection}
        turn={room.engineState.turn}
        zoneCount={room.engineState.zones.length}
        pieceCount={room.engineState.pieces.length}
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
      within(currentBattlefield).getByText('local-catalog:keter:starting-sage'),
    ).toBeVisible()
    expect(
      within(currentSupport).getByText('local-catalog:keter:wayward-boost'),
    ).toBeVisible()
    expect(
      within(currentHand).getAllByText('local-catalog:keter:main-g1-a').length,
    ).toBeGreaterThan(0)
    expect(
      within(opponentSide).getByText('local-catalog:keter:starting-sage'),
    ).toBeVisible()
  })

  it('renders all main zone contents, empty areas, hidden private cards, and piece flags', () => {
    const room = createLocalPrototypeMatchRoom('match-board-contents')
    const projection = buildMatchBoardProjection(
      room.engineState,
      LOCAL_MATCH_PLAYER_ONE_ID,
    )

    render(
      <MatchBoard
        projection={projection}
        turn={room.engineState.turn}
        zoneCount={room.engineState.zones.length}
        pieceCount={room.engineState.pieces.length}
      />,
    )

    const currentSide = screen.getByRole('region', {
      name: 'Current player side',
    })
    const opponentSide = screen.getByRole('region', { name: 'Opponent side' })

    expect(
      within(currentSide).getByText('local-catalog:keter:starting-sage'),
    ).toBeVisible()
    expect(
      within(currentSide).getByText('local-catalog:keter:wayward-boost'),
    ).toBeVisible()
    expect(
      within(currentSide).getAllByText('Empty slot').length,
    ).toBeGreaterThan(0)
    expect(
      within(currentSide).getAllByText('Empty zone').length,
    ).toBeGreaterThanOrEqual(2)
    expect(
      within(opponentSide).getAllByText('Hidden card').length,
    ).toBeGreaterThan(0)
    expect(
      within(opponentSide).queryByText('local-catalog:keter:main-g1-a'),
    ).toBeNull()
    expect(
      within(opponentSide).queryByText('local-catalog:keter:wayward-boost'),
    ).toBeNull()
  })
})
