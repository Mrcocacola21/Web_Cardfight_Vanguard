import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMatchStatsPageState: vi.fn(),
  matchStatsView: vi.fn(),
}))

vi.mock('@/features/matches/server/match-stats-read', () => ({
  getMatchStatsPageState: mocks.getMatchStatsPageState,
}))

vi.mock('@/components/matches/match-stats-view', () => ({
  MatchStatsView: ({
    viewerDisplayName,
    stats,
  }: {
    viewerDisplayName: string
    stats: {
      totalMatches: number
      wins: number
    }
  }) => {
    mocks.matchStatsView({
      viewerDisplayName,
      stats,
    })

    return (
      <div>
        <span data-testid="viewer-name">{viewerDisplayName}</span>
        <span data-testid="total-matches">{stats.totalMatches}</span>
        <span data-testid="wins">{stats.wins}</span>
      </div>
    )
  },
}))

import MatchStatsPage from './page'

describe('MatchStatsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMatchStatsPageState.mockResolvedValue({
      kind: 'ready',
      viewerDisplayName: 'Azure Pilot',
      stats: {
        totalMatches: 4,
        wins: 2,
        losses: 1,
        draws: 1,
        winRate: 0.5,
        topDecks: [],
      },
    })
  })

  it('loads the stats read model before rendering the stats view', async () => {
    render(await MatchStatsPage())

    expect(mocks.getMatchStatsPageState).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('viewer-name')).toHaveTextContent('Azure Pilot')
    expect(screen.getByTestId('total-matches')).toHaveTextContent('4')
    expect(screen.getByTestId('wins')).toHaveTextContent('2')
  })
})
