import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MatchStatsView } from './match-stats-view'

describe('MatchStatsView', () => {
  it('renders an empty state when there are no tracked matches yet', () => {
    render(
      <MatchStatsView
        viewerDisplayName="Azure Pilot"
        stats={{
          totalMatches: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winRate: null,
          topDecks: [],
        }}
      />,
    )

    expect(screen.getByText(/no tracked match stats yet/i)).toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: /record your first match/i }).length,
    ).toBeGreaterThan(0)
  })

  it('renders summary values and top decks for tracked matches', () => {
    render(
      <MatchStatsView
        viewerDisplayName="Azure Pilot"
        stats={{
          totalMatches: 12,
          wins: 7,
          losses: 3,
          draws: 2,
          winRate: 7 / 12,
          topDecks: [
            {
              deckId: 'deck-1',
              label: 'Keter Balance',
              matchCount: 6,
            },
            {
              deckId: null,
              label: 'Unavailable deck',
              matchCount: 2,
            },
          ],
        }}
      />,
    )

    expect(screen.getAllByText(/^12$/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/^7$/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/^3$/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/^2$/).length).toBeGreaterThan(0)
    expect(screen.getByText('58.3%')).toBeInTheDocument()
    expect(screen.getByText(/keter balance/i)).toBeInTheDocument()
    expect(screen.getByText(/unavailable deck/i)).toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: /vs friends/i })[0],
    ).toHaveAttribute('href', '/matches/friends')
    expect(screen.getByRole('link', { name: /open deck/i })).toHaveAttribute(
      'href',
      '/decks/deck-1',
    )
  })
})
