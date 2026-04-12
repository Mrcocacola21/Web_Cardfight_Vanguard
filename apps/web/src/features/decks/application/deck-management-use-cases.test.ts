import { createDeck, type Deck } from '@web-vg/decks'
import { describe, expect, it, vi } from 'vitest'

import type { DeckApplicationServices } from './deck-application-support'
import {
  createDeckUseCase,
  deleteDeckUseCase,
  duplicateDeckUseCase,
} from './deck-management-use-cases'
import type {
  DeckWriteRepository,
  DeckWriteRepositoryResult,
  StoredDeck,
} from './deck-write-repository'

describe('deck management use cases', () => {
  it('creates a new empty deck through the application layer', async () => {
    const createDeckRecord = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'deck-new',
      },
    })
    const services = createServices({
      repository: {
        createDeck: createDeckRecord,
      },
    })

    const result = await createDeckUseCase(services, {
      authUserId: 'auth-user-1',
      formatId: 'standard',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        deckId: 'deck-new',
      },
    })
    expect(createDeckRecord).toHaveBeenCalledWith({
      ownerProfileId: 'profile-1',
      formatId: 'standard',
      name: 'Untitled Deck',
      description: null,
      tags: [],
      isFavorite: false,
      cards: [],
    })
  })

  it('duplicates the owned deck by reusing its domain composition and metadata', async () => {
    const createDeckRecord = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'deck-copy',
      },
    })
    const services = createServices({
      repository: {
        getDeckById: vi.fn().mockResolvedValue({
          ok: true,
          data: createStoredDeck({
            deck: createBaseDeck({
              description: 'Current list.',
              tags: ['tempo'],
              isFavorite: true,
              cards: [
                {
                  section: 'main',
                  cardEntityId: 'entity-bastion',
                  quantity: 4,
                },
              ],
            }),
            visibility: 'private',
          }),
        }),
        createDeck: createDeckRecord,
      },
    })

    const result = await duplicateDeckUseCase(services, {
      authUserId: 'auth-user-1',
      deckId: 'deck-1',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        deckId: 'deck-copy',
      },
    })
    expect(createDeckRecord).toHaveBeenCalledWith({
      ownerProfileId: 'profile-1',
      formatId: 'standard',
      name: 'Azure Bastion (copy)',
      description: 'Current list.',
      tags: ['tempo'],
      isFavorite: true,
      visibility: 'private',
      cards: [
        {
          section: 'main',
          cardEntityId: 'entity-bastion',
          quantity: 4,
        },
      ],
    })
  })

  it('rejects deck deletion when the current profile does not own the deck', async () => {
    const services = createServices({
      repository: {
        getDeckById: vi.fn().mockResolvedValue({
          ok: true,
          data: createStoredDeck({
            deck: createDeck({
              id: 'deck-1' as never,
              ownerId: 'profile-foreign' as never,
              formatId: 'standard' as never,
              name: 'Foreign Deck',
              description: null,
              tags: [],
              isFavorite: false,
              createdAt: '2026-04-08T00:00:00.000Z',
              updatedAt: '2026-04-08T01:00:00.000Z',
              currentVersionId: 'version-1' as never,
              revision: 1,
              cards: [],
            }),
            visibility: 'private',
          }),
        }),
      },
    })

    const result = await deleteDeckUseCase(services, {
      authUserId: 'auth-user-1',
      deckId: 'deck-1',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'forbidden',
        message: 'The current profile cannot delete this deck.',
      },
    })
  })
})

function createServices(overrides?: {
  readonly repository?: Partial<DeckWriteRepository>
}): DeckApplicationServices {
  return {
    repository: {
      getOwnerProfileIdByAuthUserId: vi.fn().mockResolvedValue({
        ok: true,
        data: 'profile-1',
      } satisfies DeckWriteRepositoryResult<string | null>),
      getDeckById: vi.fn().mockResolvedValue({
        ok: true,
        data: createStoredDeck(),
      } satisfies DeckWriteRepositoryResult<StoredDeck | null>),
      getDeckDetailById: vi.fn(),
      createDeck: vi.fn(),
      saveDeck: vi.fn(),
      deleteDeck: vi.fn(),
      ...overrides?.repository,
    },
  }
}

function createStoredDeck(input?: {
  readonly deck?: Deck
  readonly visibility?: 'private' | 'unlisted' | 'public'
}): StoredDeck {
  return {
    deck: input?.deck ?? createBaseDeck(),
    visibility: input?.visibility ?? 'private',
  }
}

function createBaseDeck(input?: {
  readonly description?: string | null
  readonly tags?: readonly string[]
  readonly isFavorite?: boolean
  readonly cards?: readonly {
    readonly section: 'main' | 'ride' | 'g'
    readonly cardEntityId: string
    readonly quantity: number
  }[]
}): Deck {
  return createDeck({
    id: 'deck-1' as never,
    ownerId: 'profile-1' as never,
    formatId: 'standard' as never,
    name: 'Azure Bastion',
    description: input?.description ?? null,
    tags: input?.tags ?? ['tempo'],
    isFavorite: input?.isFavorite ?? false,
    createdAt: '2026-04-08T00:00:00.000Z',
    updatedAt: '2026-04-08T01:00:00.000Z',
    currentVersionId: 'version-1' as never,
    revision: 1,
    cards:
      input?.cards?.map((card) => ({
        section: card.section,
        cardEntityId: card.cardEntityId as never,
        quantity: card.quantity,
      })) ?? [],
  })
}
