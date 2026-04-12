import { createDeck, type Deck } from '@web-vg/decks'
import type { DeckDetailRecord } from '@web-vg/db/repositories/decks'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getCurrentAuthState: vi.fn(),
  createDeckWriteRepository: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/auth/server/auth-session', () => ({
  getCurrentAuthState: mocks.getCurrentAuthState,
}))

vi.mock('@/features/decks/infrastructure/deck-write-repository', () => ({
  createDeckWriteRepository: mocks.createDeckWriteRepository,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import {
  mutateDeckCompositionAction,
  saveDeckDraftAction,
} from './deck-builder-actions'

describe('deck-builder-actions', () => {
  const client = { auth: {} }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue(client)
    mocks.getCurrentAuthState.mockResolvedValue({
      kind: 'ready',
      user: {
        id: 'auth-user-1',
        email: 'azure@example.com',
      },
    })
    mocks.createDeckWriteRepository.mockReturnValue(createRepository())
  })

  it('adds a canonical card into the owned deck through the domain mutation path', async () => {
    const saveDeck = vi.fn().mockResolvedValue({
      ok: true,
      data: undefined,
    })
    const getDeckDetailById = vi.fn().mockResolvedValue({
      ok: true,
      data: createDeckDetail({
        totalCards: 1,
        cards: [
          { sectionKey: 'main', cardEntityId: 'entity-bastion', quantity: 1 },
        ],
      }),
    })

    mocks.createDeckWriteRepository.mockReturnValue(
      createRepository({
        getDeckById: vi.fn().mockResolvedValue({
          ok: true,
          data: createStoredDeck({
            deck: createBaseDeck({ cards: [] }),
            visibility: 'private',
          }),
        }),
        saveDeck,
        getDeckDetailById,
      }),
    )

    const result = await mutateDeckCompositionAction({
      deckId: 'deck-1',
      cardEntityId: 'entity-bastion',
      mutation: 'add',
    })

    expect(result).toEqual({
      ok: true,
      data: createDeckDetail({
        totalCards: 1,
        cards: [
          { sectionKey: 'main', cardEntityId: 'entity-bastion', quantity: 1 },
        ],
      }),
    })
    expect(saveDeck).toHaveBeenCalledWith(
      createStoredDeck({
        deck: createBaseDeck({ cards: [] }),
        visibility: 'private',
      }),
      expect.objectContaining({
        id: 'deck-1',
        ownerId: 'profile-1',
        formatId: 'standard',
        name: 'Azure Bastion',
      }),
    )
    const savedDeck = saveDeck.mock.calls[0]?.[1] as Deck | undefined
    expect(savedDeck?.currentVersion.cards).toEqual([
      {
        section: 'main',
        cardEntityId: 'entity-bastion',
        quantity: 1,
      },
    ])
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/decks')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/decks/deck-1')
  })

  it('increments the quantity instead of duplicating deck entries', async () => {
    const saveDeck = vi.fn().mockResolvedValue({
      ok: true,
      data: undefined,
    })

    mocks.createDeckWriteRepository.mockReturnValue(
      createRepository({
        getDeckById: vi.fn().mockResolvedValue({
          ok: true,
          data: createStoredDeck({
            deck: createBaseDeck({
              cards: [
                {
                  section: 'main',
                  cardEntityId: 'entity-bastion',
                  quantity: 1,
                },
              ],
            }),
            visibility: 'private',
          }),
        }),
        saveDeck,
      }),
    )

    await mutateDeckCompositionAction({
      deckId: 'deck-1',
      cardEntityId: 'entity-bastion',
      mutation: 'increment',
      sectionKey: 'main',
    })

    const savedDeck = saveDeck.mock.calls[0]?.[1] as Deck | undefined
    expect(savedDeck?.currentVersion.cards).toEqual([
      {
        section: 'main',
        cardEntityId: 'entity-bastion',
        quantity: 2,
      },
    ])
  })

  it('reuses the add mutation path to increase quantity without duplicate rows', async () => {
    const saveDeck = vi.fn().mockResolvedValue({
      ok: true,
      data: undefined,
    })

    mocks.createDeckWriteRepository.mockReturnValue(
      createRepository({
        getDeckById: vi.fn().mockResolvedValue({
          ok: true,
          data: createStoredDeck({
            deck: createBaseDeck({
              cards: [
                {
                  section: 'main',
                  cardEntityId: 'entity-bastion',
                  quantity: 1,
                },
              ],
            }),
            visibility: 'private',
          }),
        }),
        saveDeck,
      }),
    )

    await mutateDeckCompositionAction({
      deckId: 'deck-1',
      cardEntityId: 'entity-bastion',
      mutation: 'add',
    })

    const savedDeck = saveDeck.mock.calls[0]?.[1] as Deck | undefined
    expect(savedDeck?.currentVersion.cards).toEqual([
      {
        section: 'main',
        cardEntityId: 'entity-bastion',
        quantity: 2,
      },
    ])
  })

  it('rejects add mutations beyond the builder copy cap', async () => {
    const saveDeck = vi.fn()

    mocks.createDeckWriteRepository.mockReturnValue(
      createRepository({
        getDeckById: vi.fn().mockResolvedValue({
          ok: true,
          data: createStoredDeck({
            deck: createBaseDeck({
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
        saveDeck,
      }),
    )

    const result = await mutateDeckCompositionAction({
      deckId: 'deck-1',
      cardEntityId: 'entity-bastion',
      mutation: 'add',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        message:
          'Builder copy cap reached. A card cannot exceed 4 copies before full validation is available.',
      },
    })
    expect(saveDeck).not.toHaveBeenCalled()
  })

  it('removes the deck entry when quantity reaches zero', async () => {
    const saveDeck = vi.fn().mockResolvedValue({
      ok: true,
      data: undefined,
    })

    mocks.createDeckWriteRepository.mockReturnValue(
      createRepository({
        getDeckById: vi.fn().mockResolvedValue({
          ok: true,
          data: createStoredDeck({
            deck: createBaseDeck({
              cards: [
                {
                  section: 'main',
                  cardEntityId: 'entity-bastion',
                  quantity: 1,
                },
              ],
            }),
            visibility: 'private',
          }),
        }),
        saveDeck,
      }),
    )

    await mutateDeckCompositionAction({
      deckId: 'deck-1',
      cardEntityId: 'entity-bastion',
      mutation: 'decrement',
      sectionKey: 'main',
    })

    const savedDeck = saveDeck.mock.calls[0]?.[1] as Deck | undefined
    expect(savedDeck?.currentVersion.cards).toEqual([])
  })

  it('saves the full deck draft snapshot through the repository path', async () => {
    const saveDeck = vi.fn().mockResolvedValue({
      ok: true,
      data: undefined,
    })
    const getDeckDetailById = vi.fn().mockResolvedValue({
      ok: true,
      data: createDeckDetail({
        totalCards: 2,
        cards: [
          { sectionKey: 'main', cardEntityId: 'entity-bastion', quantity: 2 },
        ],
      }),
    })

    mocks.createDeckWriteRepository.mockReturnValue(
      createRepository({
        getDeckById: vi.fn().mockResolvedValue({
          ok: true,
          data: createStoredDeck({
            deck: createBaseDeck({ cards: [] }),
            visibility: 'private',
          }),
        }),
        saveDeck,
        getDeckDetailById,
      }),
    )

    const result = await saveDeckDraftAction({
      deckId: 'deck-1',
      formatId: 'premium',
      title: 'Azure Bastion',
      description: 'Saved through autosave.',
      tags: ['tempo', 'premium'],
      isFavorite: true,
      cards: [
        {
          sectionKey: 'main',
          cardEntityId: 'entity-bastion',
          canonicalKey: 'card.apex-ruler-bastion',
          name: 'Apex Ruler, Bastion',
          grade: 3,
          cardType: 'normal-unit',
          triggerType: null,
          quantity: 2,
        },
      ],
    })

    expect(result).toEqual({
      ok: true,
      data: createDeckDetail({
        totalCards: 2,
        cards: [
          { sectionKey: 'main', cardEntityId: 'entity-bastion', quantity: 2 },
        ],
      }),
    })
    const savedDeck = saveDeck.mock.calls[0]?.[1] as Deck | undefined
    expect(savedDeck).toEqual(
      expect.objectContaining({
        formatId: 'premium',
        name: 'Azure Bastion',
        description: 'Saved through autosave.',
        tags: ['tempo', 'premium'],
        isFavorite: true,
      }),
    )
    expect(savedDeck?.currentVersion.cards).toEqual([
      {
        section: 'main',
        cardEntityId: 'entity-bastion',
        quantity: 2,
      },
    ])
  })

  it('rejects draft saves that exceed the builder copy cap', async () => {
    const saveDeck = vi.fn()

    mocks.createDeckWriteRepository.mockReturnValue(
      createRepository({
        getDeckById: vi.fn().mockResolvedValue({
          ok: true,
          data: createStoredDeck({
            deck: createBaseDeck({ cards: [] }),
            visibility: 'private',
          }),
        }),
        saveDeck,
      }),
    )

    const result = await saveDeckDraftAction({
      deckId: 'deck-1',
      formatId: 'standard',
      title: 'Azure Bastion',
      description: null,
      tags: ['tempo'],
      isFavorite: false,
      cards: [
        {
          sectionKey: 'main',
          cardEntityId: 'entity-bastion',
          canonicalKey: 'card.apex-ruler-bastion',
          name: 'Apex Ruler, Bastion',
          grade: 3,
          cardType: 'normal-unit',
          triggerType: null,
          quantity: 5,
        },
      ],
    })

    expect(result).toEqual({
      ok: false,
      error: {
        message:
          'Builder copy cap reached. A card cannot exceed 4 copies before full validation is available.',
      },
    })
    expect(saveDeck).not.toHaveBeenCalled()
  })

  it('rejects unsupported format changes before persistence', async () => {
    const saveDeck = vi.fn()

    mocks.createDeckWriteRepository.mockReturnValue(
      createRepository({
        saveDeck,
      }),
    )

    const result = await saveDeckDraftAction({
      deckId: 'deck-1',
      formatId: 'legacy',
      title: 'Azure Bastion',
      description: null,
      tags: ['tempo'],
      isFavorite: false,
      cards: [],
    })

    expect(result).toEqual({
      ok: false,
      error: {
        message:
          'Choose Standard, V Premium, or Premium before saving the deck.',
      },
    })
    expect(saveDeck).not.toHaveBeenCalled()
  })
})

function createRepository(overrides?: Record<string, unknown>) {
  return {
    getOwnerProfileIdByAuthUserId: vi.fn().mockResolvedValue({
      ok: true,
      data: 'profile-1',
    }),
    getDeckById: vi.fn().mockResolvedValue({
      ok: true,
      data: createStoredDeck({
        deck: createBaseDeck(),
        visibility: 'private',
      }),
    }),
    getDeckDetailById: vi.fn().mockResolvedValue({
      ok: true,
      data: createDeckDetail({ totalCards: 0, cards: [] }),
    }),
    createDeck: vi.fn(),
    saveDeck: vi.fn().mockResolvedValue({
      ok: true,
      data: undefined,
    }),
    deleteDeck: vi.fn(),
    ...overrides,
  }
}

function createStoredDeck(input?: {
  readonly deck?: Deck
  readonly visibility?: 'private' | 'unlisted' | 'public'
}) {
  return {
    deck: input?.deck ?? createBaseDeck(),
    visibility: input?.visibility ?? 'private',
  }
}

function createBaseDeck(input?: {
  readonly formatId?: 'standard' | 'premium' | 'v-premium'
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
    formatId: (input?.formatId ?? 'standard') as never,
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

function createDeckDetail(input: {
  readonly totalCards: number
  readonly cards: ReadonlyArray<{
    readonly sectionKey: 'main' | 'ride' | 'g'
    readonly cardEntityId: string
    readonly quantity: number
  }>
}): DeckDetailRecord {
  return {
    id: 'deck-1',
    ownerProfileId: 'profile-1',
    title: 'Azure Bastion',
    description: null,
    tags: ['tempo'],
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
      versionNumber: 1,
      createdByProfileId: 'profile-1',
      versionNote: null,
      createdAt: '2026-04-08T01:00:00.000Z',
      totalCards: input.totalCards,
      sectionCounts: {
        main: input.cards
          .filter((card) => card.sectionKey === 'main')
          .reduce((total, card) => total + card.quantity, 0),
        ride: input.cards
          .filter((card) => card.sectionKey === 'ride')
          .reduce((total, card) => total + card.quantity, 0),
        g: input.cards
          .filter((card) => card.sectionKey === 'g')
          .reduce((total, card) => total + card.quantity, 0),
      },
      cards: input.cards.map((card) => ({
        sectionKey: card.sectionKey,
        cardEntityId: card.cardEntityId,
        canonicalKey: 'card.apex-ruler-bastion',
        name: 'Apex Ruler, Bastion',
        grade: 3,
        cardType: 'normal-unit',
        triggerType: null,
        quantity: card.quantity,
      })),
      sections: [
        {
          key: 'main',
          totalCards: input.cards
            .filter((card) => card.sectionKey === 'main')
            .reduce((total, card) => total + card.quantity, 0),
          cards: input.cards
            .filter((card) => card.sectionKey === 'main')
            .map((card) => ({
              sectionKey: card.sectionKey,
              cardEntityId: card.cardEntityId,
              canonicalKey: 'card.apex-ruler-bastion',
              name: 'Apex Ruler, Bastion',
              grade: 3,
              cardType: 'normal-unit',
              triggerType: null,
              quantity: card.quantity,
            })),
        },
        {
          key: 'ride',
          totalCards: input.cards
            .filter((card) => card.sectionKey === 'ride')
            .reduce((total, card) => total + card.quantity, 0),
          cards: [],
        },
        {
          key: 'g',
          totalCards: input.cards
            .filter((card) => card.sectionKey === 'g')
            .reduce((total, card) => total + card.quantity, 0),
          cards: [],
        },
      ],
    },
  }
}
