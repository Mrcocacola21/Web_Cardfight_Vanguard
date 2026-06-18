import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
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

    const { container } = render(
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
    expect(screen.getByRole('heading', { name: 'Table Surface' })).toBeVisible()
    expect(container.querySelector('[data-playmat="vanguard"]')).not.toBeNull()

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
    expect(within(currentBattlefield).getByText(/Starting Sage/i)).toBeVisible()
    expect(within(currentSupport).getByText(/Wayward Boost/i)).toBeVisible()
    expect(
      within(currentHand).getAllByText(/Main Grade 1 A/i).length,
    ).toBeGreaterThan(0)
    expect(within(opponentSide).getByText(/Starting Sage/i)).toBeVisible()
    expect(
      container.querySelectorAll('[data-playmat-circle="vanguard"]').length,
    ).toBeGreaterThan(0)
    expect(
      container.querySelector(
        '[data-card-identity="local-catalog:keter:starting-sage"]',
      ),
    ).not.toBeNull()
  })

  it('renders all main zone contents, empty areas, hidden private cards, and piece flags', () => {
    const room = createLocalPrototypeMatchRoom('match-board-contents')
    const projection = buildMatchBoardProjection(
      room.engineState,
      LOCAL_MATCH_PLAYER_ONE_ID,
    )

    const { container } = render(
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

    expect(within(currentSide).getByText(/Starting Sage/i)).toBeVisible()
    expect(within(currentSide).getByText(/Wayward Boost/i)).toBeVisible()
    expect(
      within(currentSide).getAllByText('Open circle').length,
    ).toBeGreaterThan(0)
    expect(
      within(currentSide).getAllByText('Empty stack').length,
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
    expect(
      container.querySelector(
        '[data-card-identity="local-catalog:keter:main-g1-a"]',
      ),
    ).not.toBeNull()
  })

  it('opens a pinned card inspect surface without leaking hidden cards', () => {
    const room = createLocalPrototypeMatchRoom('match-board-inspect')
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

    fireEvent.click(
      screen.getAllByRole('button', { name: /Starting Sage/i })[0]!,
    )

    const inspect = screen.getByRole('complementary', {
      name: 'Card inspect',
    })

    expect(inspect).toHaveAttribute('data-card-inspect', 'pinned')
    expect(
      within(inspect).getAllByText(/Starting Sage/i).length,
    ).toBeGreaterThan(0)
    expect(within(inspect).getByText('Grade')).toBeVisible()
    expect(within(inspect).getByText('Power')).toBeVisible()
    expect(within(inspect).getByText('Shield')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /Close/i }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Hidden card' })[0]!)

    const hiddenInspect = screen.getByRole('complementary', {
      name: 'Card inspect',
    })

    expect(
      within(hiddenInspect).getByText(
        /hidden by the participant-safe projection/i,
      ),
    ).toBeVisible()
    expect(within(hiddenInspect).queryByText(/Starting Sage/i)).toBeNull()
  })
})
