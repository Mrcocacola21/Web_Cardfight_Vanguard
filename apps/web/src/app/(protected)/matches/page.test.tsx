import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMatchHistoryListPageState: vi.fn(),
  matchHistoryListView: vi.fn(),
}))

vi.mock('@/features/matches/server/match-history-list-read', () => ({
  getMatchHistoryListPageState: mocks.getMatchHistoryListPageState,
}))

vi.mock('@/components/matches/match-history-list-view', () => ({
  MatchHistoryListView: ({
    viewerDisplayName,
    matches,
    totalMatchCount,
  }: {
    viewerDisplayName: string
    matches: readonly unknown[]
    totalMatchCount: number
  }) => {
    mocks.matchHistoryListView({
      viewerDisplayName,
      matches,
      totalMatchCount,
    })

    return (
      <div>
        <span data-testid="viewer-name">{viewerDisplayName}</span>
        <span data-testid="match-count">{matches.length}</span>
        <span data-testid="total-count">{totalMatchCount}</span>
      </div>
    )
  },
}))

import MatchesPage from './page'

describe('MatchesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMatchHistoryListPageState.mockResolvedValue({
      kind: 'ready',
      viewerDisplayName: 'Azure Pilot',
      query: {
        result: 'all',
        deckId: null,
        opponent: '',
        formatId: 'all',
        playedFrom: null,
        playedTo: null,
      },
      totalMatchCount: 2,
      matches: [{ id: 'match-1' }],
      availableDecks: [],
    })
  })

  it('loads the match-history read model before rendering the list view', async () => {
    render(await MatchesPage({}))

    expect(mocks.getMatchHistoryListPageState).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('viewer-name')).toHaveTextContent('Azure Pilot')
    expect(screen.getByTestId('match-count')).toHaveTextContent('1')
    expect(screen.getByTestId('total-count')).toHaveTextContent('2')
  })
})
