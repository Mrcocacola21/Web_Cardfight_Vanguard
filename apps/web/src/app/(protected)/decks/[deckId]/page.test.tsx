import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const notFoundError = new Error('NEXT_NOT_FOUND')

const mocks = vi.hoisted(() => ({
  getCurrentProfileState: vi.fn(),
  getDeckDetailById: vi.fn(),
  listDeckBuilderCatalogCards: vi.fn(),
  getDeckBuilderValidationData: vi.fn(),
  notFound: vi.fn(() => {
    throw notFoundError
  }),
}))

vi.mock('@/features/profiles/server/profile-read', () => ({
  getCurrentProfileState: mocks.getCurrentProfileState,
}))

vi.mock('@/features/decks/server/deck-read', () => ({
  getDeckDetailById: mocks.getDeckDetailById,
}))

vi.mock('@/features/decks/server/deck-builder-read', () => ({
  listDeckBuilderCatalogCards: mocks.listDeckBuilderCatalogCards,
}))

vi.mock('@/features/decks/server/deck-builder-validation-read', () => ({
  getDeckBuilderValidationData: mocks.getDeckBuilderValidationData,
}))

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}))

vi.mock('@/components/decks/deck-builder-view', () => ({
  DeckBuilderView: ({
    initialDeck,
    catalogCards,
    catalogErrorMessage,
    validationData,
    query,
  }: {
    initialDeck: {
      title: string
    }
    catalogCards: readonly unknown[]
    catalogErrorMessage: string | null
    validationData: {
      cards: readonly unknown[]
      restrictionLists: readonly unknown[]
    }
    query: {
      searchText: string | null
    }
  }) => (
    <div data-testid="deck-builder">
      <span>{initialDeck.title}</span>
      <span>{catalogCards.length}</span>
      <span>{catalogErrorMessage ?? 'catalog-ok'}</span>
      <span>{validationData.cards.length}</span>
      <span>{query.searchText ?? 'no-search'}</span>
    </div>
  ),
}))

import DeckDetailPage from './page'

describe('DeckDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentProfileState.mockResolvedValue({
      kind: 'ready',
      profile: {
        id: 'profile-1',
      },
    })
    mocks.getDeckBuilderValidationData.mockResolvedValue({
      cards: [],
      restrictionLists: [],
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the builder for an owned deck and loads catalog cards from the published read layer', async () => {
    mocks.getDeckDetailById.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'deck-1',
        ownerProfileId: 'profile-1',
        title: 'Azure Bastion',
        format: {
          id: 'standard',
        },
      },
    })
    mocks.listDeckBuilderCatalogCards.mockResolvedValueOnce({
      ok: true,
      data: {
        items: [
          {
            id: 'entity-bastion',
          },
        ],
      },
    })

    render(
      await DeckDetailPage({
        params: Promise.resolve({
          deckId: 'deck-1',
        }),
        searchParams: Promise.resolve({
          q: 'bastion',
        }),
      }),
    )

    expect(mocks.getDeckDetailById).toHaveBeenCalledWith('deck-1')
    expect(mocks.listDeckBuilderCatalogCards).toHaveBeenCalledWith({
      formatId: 'standard',
      searchText: 'bastion',
    })
    const validationInput = mocks.getDeckBuilderValidationData.mock
      .calls[0]?.[0] as
      | {
          initialDeck: {
            id: string
            ownerProfileId: string
            title: string
            format: {
              id: string
            }
          }
          catalogCards: readonly {
            id: string
          }[]
        }
      | undefined

    expect(validationInput).toBeDefined()
    expect(validationInput?.initialDeck.id).toBe('deck-1')
    expect(validationInput?.initialDeck.ownerProfileId).toBe('profile-1')
    expect(validationInput?.initialDeck.title).toBe('Azure Bastion')
    expect(validationInput?.initialDeck.format.id).toBe('standard')
    expect(validationInput?.catalogCards[0]?.id).toBe('entity-bastion')
    expect(screen.getByTestId('deck-builder')).toHaveTextContent(
      'Azure Bastion',
    )
    expect(screen.getByTestId('deck-builder')).toHaveTextContent('1')
    expect(screen.getByTestId('deck-builder')).toHaveTextContent('catalog-ok')
  })

  it('routes non-owned decks into Next.js not-found handling', async () => {
    mocks.getDeckDetailById.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'deck-1',
        ownerProfileId: 'profile-2',
        title: 'Other Deck',
        format: {
          id: 'standard',
        },
      },
    })

    await expect(
      DeckDetailPage({
        params: Promise.resolve({
          deckId: 'deck-1',
        }),
      }),
    ).rejects.toBe(notFoundError)

    expect(mocks.notFound).toHaveBeenCalledTimes(1)
  })

  it('keeps the builder available with an explicit catalog error when the catalog read fails', async () => {
    mocks.getDeckDetailById.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'deck-1',
        ownerProfileId: 'profile-1',
        title: 'Azure Bastion',
        format: {
          id: 'standard',
        },
      },
    })
    mocks.listDeckBuilderCatalogCards.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'query-failed',
        message: 'Failed to load builder catalog cards.',
      },
    })

    render(
      await DeckDetailPage({
        params: Promise.resolve({
          deckId: 'deck-1',
        }),
      }),
    )

    expect(screen.getByTestId('deck-builder')).toHaveTextContent(
      'The published catalog cards could not be loaded for this builder session.',
    )
    expect(screen.getByTestId('deck-builder')).toHaveTextContent('0')
  })
})
