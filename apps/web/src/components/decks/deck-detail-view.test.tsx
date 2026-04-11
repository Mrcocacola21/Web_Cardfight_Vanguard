import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DeckDetailView } from './deck-detail-view'

describe('DeckDetailView', () => {
  it('renders format attachment and sectioned canonical deck composition', () => {
    render(
      <DeckDetailView
        deck={{
          id: 'deck-1',
          ownerProfileId: 'profile-1',
          title: 'Azure Standard Deck',
          description: 'Current persisted Standard list.',
          tags: [],
          isFavorite: false,
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
          currentVersion: {
            id: 'version-1',
            deckId: 'deck-1',
            versionNumber: 2,
            createdByProfileId: 'profile-1',
            versionNote: null,
            createdAt: '2026-04-08T01:00:00.000Z',
            totalCards: 50,
            sectionCounts: {
              main: 46,
              ride: 4,
              g: 0,
            },
            cards: [
              {
                sectionKey: 'ride',
                cardEntityId: 'card-0',
                canonicalKey: 'card.azure-vanguard-rookie',
                name: 'Azure Vanguard Rookie',
                grade: 0,
                cardType: 'normal-unit',
                triggerType: null,
                quantity: 1,
              },
              {
                sectionKey: 'main',
                cardEntityId: 'card-3',
                canonicalKey: 'card.azure-vanguard-dragon',
                name: 'Azure Vanguard Dragon',
                grade: 3,
                cardType: 'normal-unit',
                triggerType: null,
                quantity: 4,
              },
            ],
            sections: [
              {
                key: 'main',
                totalCards: 46,
                cards: [
                  {
                    sectionKey: 'main',
                    cardEntityId: 'card-3',
                    canonicalKey: 'card.azure-vanguard-dragon',
                    name: 'Azure Vanguard Dragon',
                    grade: 3,
                    cardType: 'normal-unit',
                    triggerType: null,
                    quantity: 4,
                  },
                ],
              },
              {
                key: 'ride',
                totalCards: 4,
                cards: [
                  {
                    sectionKey: 'ride',
                    cardEntityId: 'card-0',
                    canonicalKey: 'card.azure-vanguard-rookie',
                    name: 'Azure Vanguard Rookie',
                    grade: 0,
                    cardType: 'normal-unit',
                    triggerType: null,
                    quantity: 1,
                  },
                ],
              },
              {
                key: 'g',
                totalCards: 0,
                cards: [],
              },
            ],
          },
        }}
      />,
    )

    expect(
      screen.getByRole('heading', { name: /azure standard deck/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/^persisted deck metadata$/i)).toBeInTheDocument()
    expect(screen.getByText(/^ride deck$/i)).toBeInTheDocument()
    expect(screen.getByText(/card\.azure-vanguard-dragon/i)).toBeInTheDocument()
  })
})
