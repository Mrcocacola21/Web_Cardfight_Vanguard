import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DeckListView } from './deck-list-view'

describe('DeckListView', () => {
  it('renders persisted deck summaries with explicit format attachment', () => {
    render(
      <DeckListView
        profile={{
          id: 'profile-1',
          username: 'azure_pilot',
          displayName: 'Azure Pilot',
          bio: null,
          avatarUrl: null,
          visibility: 'private',
          createdAt: '2026-04-08T00:00:00.000Z',
          updatedAt: '2026-04-08T00:00:00.000Z',
        }}
        decks={[
          {
            id: 'deck-1',
            ownerProfileId: 'profile-1',
            title: 'Azure Standard Deck',
            description: 'Current persisted Standard list.',
            visibility: 'private',
            archivedAt: null,
            createdAt: '2026-04-08T00:00:00.000Z',
            updatedAt: '2026-04-08T01:00:00.000Z',
            format: {
              id: 'standard',
              displayName: 'Standard',
              description: 'D-era baseline profile',
            },
            currentVersionId: 'version-1',
            currentVersionNumber: 2,
            totalCards: 50,
            sectionCounts: {
              main: 46,
              ride: 4,
              g: 0,
            },
          },
        ]}
      />,
    )

    expect(
      screen.getByRole('heading', { name: /my decks/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/azure standard deck/i)).toBeInTheDocument()
    expect(screen.getByText(/^standard$/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view deck/i })).toHaveAttribute(
      'href',
      '/decks/deck-1',
    )
  })
})
