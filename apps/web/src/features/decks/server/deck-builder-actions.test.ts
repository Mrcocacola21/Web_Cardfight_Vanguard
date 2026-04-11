import type { RepositoryResult } from '@web-vg/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as DbModule from '@web-vg/db'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getCurrentAuthState: vi.fn(),
  createProfilesRepository: vi.fn(),
  createDecksRepository: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/auth/server/auth-session', () => ({
  getCurrentAuthState: mocks.getCurrentAuthState,
}))

vi.mock('@web-vg/db', async () => {
  const actual = await vi.importActual<typeof DbModule>('@web-vg/db')

  return {
    ...actual,
    createProfilesRepository: mocks.createProfilesRepository,
    createDecksRepository: mocks.createDecksRepository,
  }
})

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import {
  mutateDeckCompositionAction,
  saveDeckDraftAction,
} from './deck-builder-actions'

describe('deck-builder-actions', () => {
  const client = { auth: {} }
  const profile = {
    id: 'profile-1',
    username: 'azure_pilot',
    displayName: 'Azure Pilot',
    bio: null,
    avatarUrl: null,
    visibility: 'private',
    createdAt: '2026-04-08T00:00:00.000Z',
    updatedAt: '2026-04-08T00:00:00.000Z',
  }

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
    mocks.createProfilesRepository.mockReturnValue({
      getProfileByAuthUserId: vi.fn().mockResolvedValue({
        ok: true,
        data: profile,
      } satisfies RepositoryResult<typeof profile | null>),
    })
  })

  it('adds a canonical card into the owned deck through the domain mutation path', async () => {
    const getDeckById = vi.fn().mockResolvedValue({
      ok: true,
      data: createDeckRecord({
        cards: [],
      }),
    })
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

    mocks.createDecksRepository.mockReturnValue({
      getDeckById,
      saveDeck,
      getDeckDetailById,
    })

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
    expect(saveDeck).toHaveBeenCalledWith({
      deckId: 'deck-1',
      ownerProfileId: 'profile-1',
      formatId: 'standard',
      title: 'Azure Bastion',
      description: null,
      tags: ['tempo'],
      isFavorite: false,
      visibility: 'private',
      cards: [
        {
          sectionKey: 'main',
          cardEntityId: 'entity-bastion',
          quantity: 1,
        },
      ],
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/decks')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/decks/deck-1')
  })

  it('increments the quantity instead of duplicating deck entries', async () => {
    const getDeckById = vi.fn().mockResolvedValue({
      ok: true,
      data: createDeckRecord({
        cards: [
          { sectionKey: 'main', cardEntityId: 'entity-bastion', quantity: 1 },
        ],
      }),
    })
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

    mocks.createDecksRepository.mockReturnValue({
      getDeckById,
      saveDeck,
      getDeckDetailById,
    })

    await mutateDeckCompositionAction({
      deckId: 'deck-1',
      cardEntityId: 'entity-bastion',
      mutation: 'increment',
      sectionKey: 'main',
    })

    expect(saveDeck).toHaveBeenCalledWith({
      deckId: 'deck-1',
      ownerProfileId: 'profile-1',
      formatId: 'standard',
      title: 'Azure Bastion',
      description: null,
      tags: ['tempo'],
      isFavorite: false,
      visibility: 'private',
      cards: [
        {
          sectionKey: 'main',
          cardEntityId: 'entity-bastion',
          quantity: 2,
        },
      ],
    })
  })

  it('reuses the add mutation path to increase quantity without duplicate rows', async () => {
    const getDeckById = vi.fn().mockResolvedValue({
      ok: true,
      data: createDeckRecord({
        cards: [
          { sectionKey: 'main', cardEntityId: 'entity-bastion', quantity: 1 },
        ],
      }),
    })
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

    mocks.createDecksRepository.mockReturnValue({
      getDeckById,
      saveDeck,
      getDeckDetailById,
    })

    await mutateDeckCompositionAction({
      deckId: 'deck-1',
      cardEntityId: 'entity-bastion',
      mutation: 'add',
    })

    expect(saveDeck).toHaveBeenCalledWith({
      deckId: 'deck-1',
      ownerProfileId: 'profile-1',
      formatId: 'standard',
      title: 'Azure Bastion',
      description: null,
      tags: ['tempo'],
      isFavorite: false,
      visibility: 'private',
      cards: [
        {
          sectionKey: 'main',
          cardEntityId: 'entity-bastion',
          quantity: 2,
        },
      ],
    })
  })

  it('rejects add mutations beyond the builder copy cap', async () => {
    const getDeckById = vi.fn().mockResolvedValue({
      ok: true,
      data: createDeckRecord({
        cards: [
          { sectionKey: 'main', cardEntityId: 'entity-bastion', quantity: 4 },
        ],
      }),
    })
    const saveDeck = vi.fn()

    mocks.createDecksRepository.mockReturnValue({
      getDeckById,
      saveDeck,
      getDeckDetailById: vi.fn(),
    })

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
    const getDeckById = vi.fn().mockResolvedValue({
      ok: true,
      data: createDeckRecord({
        cards: [
          { sectionKey: 'main', cardEntityId: 'entity-bastion', quantity: 1 },
        ],
      }),
    })
    const saveDeck = vi.fn().mockResolvedValue({
      ok: true,
      data: undefined,
    })
    const getDeckDetailById = vi.fn().mockResolvedValue({
      ok: true,
      data: createDeckDetail({
        totalCards: 0,
        cards: [],
      }),
    })

    mocks.createDecksRepository.mockReturnValue({
      getDeckById,
      saveDeck,
      getDeckDetailById,
    })

    await mutateDeckCompositionAction({
      deckId: 'deck-1',
      cardEntityId: 'entity-bastion',
      mutation: 'decrement',
      sectionKey: 'main',
    })

    expect(saveDeck).toHaveBeenCalledWith({
      deckId: 'deck-1',
      ownerProfileId: 'profile-1',
      formatId: 'standard',
      title: 'Azure Bastion',
      description: null,
      tags: ['tempo'],
      isFavorite: false,
      visibility: 'private',
      cards: [],
    })
  })

  it('saves the full deck draft snapshot through the repository path', async () => {
    const getDeckById = vi.fn().mockResolvedValue({
      ok: true,
      data: createDeckRecord({
        cards: [],
      }),
    })
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

    mocks.createDecksRepository.mockReturnValue({
      getDeckById,
      saveDeck,
      getDeckDetailById,
    })

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
    expect(saveDeck).toHaveBeenCalledWith({
      deckId: 'deck-1',
      ownerProfileId: 'profile-1',
      formatId: 'premium',
      title: 'Azure Bastion',
      description: 'Saved through autosave.',
      tags: ['tempo', 'premium'],
      isFavorite: true,
      visibility: 'private',
      cards: [
        {
          sectionKey: 'main',
          cardEntityId: 'entity-bastion',
          quantity: 2,
        },
      ],
    })
  })

  it('rejects draft saves that exceed the builder copy cap', async () => {
    const getDeckById = vi.fn().mockResolvedValue({
      ok: true,
      data: createDeckRecord({
        cards: [],
      }),
    })
    const saveDeck = vi.fn()

    mocks.createDecksRepository.mockReturnValue({
      getDeckById,
      saveDeck,
      getDeckDetailById: vi.fn(),
    })

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

function createDeckRecord(input: {
  readonly cards: ReadonlyArray<{
    readonly sectionKey: 'main' | 'ride' | 'g'
    readonly cardEntityId: string
    readonly quantity: number
  }>
}) {
  return {
    id: 'deck-1',
    ownerProfileId: 'profile-1',
    formatId: 'standard',
    title: 'Azure Bastion',
    description: null,
    tags: ['tempo'],
    isFavorite: false,
    visibility: 'private',
    archivedAt: null,
    createdAt: '2026-04-08T00:00:00.000Z',
    updatedAt: '2026-04-08T01:00:00.000Z',
    currentVersion: {
      id: 'version-1',
      deckId: 'deck-1',
      versionNumber: 1,
      createdByProfileId: 'profile-1',
      versionNote: null,
      createdAt: '2026-04-08T01:00:00.000Z',
      cards: input.cards,
    },
  }
}

function createDeckDetail(input: {
  readonly totalCards: number
  readonly cards: ReadonlyArray<{
    readonly sectionKey: 'main' | 'ride' | 'g'
    readonly cardEntityId: string
    readonly quantity: number
  }>
}) {
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
          key: 'main' as const,
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
          key: 'ride' as const,
          totalCards: input.cards
            .filter((card) => card.sectionKey === 'ride')
            .reduce((total, card) => total + card.quantity, 0),
          cards: [],
        },
        {
          key: 'g' as const,
          totalCards: input.cards
            .filter((card) => card.sectionKey === 'g')
            .reduce((total, card) => total + card.quantity, 0),
          cards: [],
        },
      ],
    },
  }
}
