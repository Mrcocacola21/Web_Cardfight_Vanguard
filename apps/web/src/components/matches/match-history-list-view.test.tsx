import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MatchHistoryListView } from './match-history-list-view'

describe('MatchHistoryListView', () => {
  it('renders filter controls for result, deck, opponent, format, and dates', () => {
    render(
      <MatchHistoryListView
        viewerDisplayName="Azure Pilot"
        matches={[]}
        totalMatchCount={0}
        query={{
          result: 'all',
          deckId: null,
          opponent: '',
          formatId: 'all',
          playedFrom: null,
          playedTo: null,
        }}
        availableDecks={[]}
      />,
    )

    expect(screen.getByLabelText(/opponent/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/result/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/deck/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/format/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^from$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^to$/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view stats/i })).toHaveAttribute(
      'href',
      '/matches/stats',
    )
  })

  it('renders an empty-history state when the owner has no matches yet', () => {
    render(
      <MatchHistoryListView
        viewerDisplayName="Azure Pilot"
        matches={[]}
        totalMatchCount={0}
        query={{
          result: 'all',
          deckId: null,
          opponent: '',
          formatId: 'all',
          playedFrom: null,
          playedTo: null,
        }}
        availableDecks={[]}
      />,
    )

    expect(
      screen.getAllByText(/no matches recorded yet/i).length,
    ).toBeGreaterThan(0)
    expect(
      screen
        .getAllByRole('link', { name: /record your first match/i })
        .every((link) => link.getAttribute('href') === '/matches/new'),
    ).toBe(true)
  })

  it('renders a no-results state when filters remove every match', () => {
    render(
      <MatchHistoryListView
        viewerDisplayName="Azure Pilot"
        matches={[]}
        totalMatchCount={3}
        query={{
          result: 'win',
          deckId: 'deck-1',
          opponent: 'Azure',
          formatId: 'standard',
          playedFrom: '2026-04-01',
          playedTo: '2026-04-30',
        }}
        availableDecks={[
          {
            deckId: 'deck-1',
            label: 'Keter Balance',
          },
        ]}
      />,
    )

    expect(
      screen.getByText(/no matches match these filters/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /clear filters/i }),
    ).toHaveAttribute('href', '/matches')
  })

  it('renders match summary items with deck and opponent profile links', () => {
    render(
      <MatchHistoryListView
        viewerDisplayName="Azure Pilot"
        matches={[
          {
            id: 'match-1',
            formatId: 'standard',
            status: 'completed',
            playedAt: '2026-04-18T00:00:00.000Z',
            createdAt: '2026-04-18T01:00:00.000Z',
            result: 'win',
            notes: 'Round 2 at locals.',
            ownDeck: {
              deckId: 'deck-1',
              title: 'Keter Balance',
              versionNumber: 3,
            },
            opponent: {
              profileId: 'profile-rival',
              displayName: 'Azure Rival',
              avatarUrl: null,
              bio: 'Public-safe summary.',
              profileVisible: true,
            },
          },
        ]}
        totalMatchCount={1}
        query={{
          result: 'all',
          deckId: null,
          opponent: '',
          formatId: 'all',
          playedFrom: null,
          playedTo: null,
        }}
        availableDecks={[
          {
            deckId: 'deck-1',
            label: 'Keter Balance',
          },
        ]}
      />,
    )

    expect(screen.getAllByText(/azure rival/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/played 2026-04-18/i)).toBeInTheDocument()
    expect(screen.getByText(/round 2 at locals/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open deck/i })).toHaveAttribute(
      'href',
      '/decks/deck-1',
    )
    expect(screen.getByRole('link', { name: /view profile/i })).toHaveAttribute(
      'href',
      '/users/profile-rival',
    )
  })
})
