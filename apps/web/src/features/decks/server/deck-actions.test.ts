import { createDeck, type Deck } from '@web-vg/decks'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { initialDeckCreateFormState } from '@/features/decks/server/deck-create-form-state'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getCurrentAuthState: vi.fn(),
  createDeckWriteRepository: vi.fn(),
  redirect: vi.fn(),
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

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import {
  createDeckAction,
  deleteDeckAction,
  duplicateDeckAction,
} from './deck-actions'

describe('deck-actions', () => {
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

  it('creates an empty Standard deck and redirects into its detail page', async () => {
    const createDeckRecord = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'deck-new',
      },
    })

    mocks.createDeckWriteRepository.mockReturnValue(
      createRepository({
        createDeck: createDeckRecord,
      }),
    )

    const formData = new FormData()
    formData.set('formatId', 'standard')

    await createDeckAction(initialDeckCreateFormState, formData)

    expect(createDeckRecord).toHaveBeenCalledWith({
      ownerProfileId: 'profile-1',
      formatId: 'standard',
      name: 'Untitled Deck',
      description: null,
      tags: [],
      isFavorite: false,
      cards: [],
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/decks')
    expect(mocks.redirect).toHaveBeenCalledWith('/decks/deck-new')
  })

  it('creates an empty deck in the selected format', async () => {
    const createDeckRecord = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'deck-premium',
      },
    })

    mocks.createDeckWriteRepository.mockReturnValue(
      createRepository({
        createDeck: createDeckRecord,
      }),
    )

    const formData = new FormData()
    formData.set('formatId', 'premium')

    await createDeckAction(initialDeckCreateFormState, formData)

    expect(createDeckRecord).toHaveBeenCalledWith({
      ownerProfileId: 'profile-1',
      formatId: 'premium',
      name: 'Untitled Deck',
      description: null,
      tags: [],
      isFavorite: false,
      cards: [],
    })
    expect(mocks.redirect).toHaveBeenCalledWith('/decks/deck-premium')
  })

  it('returns a validation error for unsupported formats', async () => {
    const createDeckRecord = vi.fn()

    mocks.createDeckWriteRepository.mockReturnValue(
      createRepository({
        createDeck: createDeckRecord,
      }),
    )

    const formData = new FormData()
    formData.set('formatId', 'unsupported')

    const result = await createDeckAction(initialDeckCreateFormState, formData)

    expect(createDeckRecord).not.toHaveBeenCalled()
    expect(result).toEqual({
      status: 'error',
      message: 'Select one of the supported formats before creating a deck.',
      fieldErrors: {
        formatId: 'Choose Standard, V Premium, or Premium.',
      },
    })
  })

  it('duplicates the current deck composition under a copied title', async () => {
    const getDeckById = vi.fn().mockResolvedValue({
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
    })
    const createDeckRecord = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'deck-copy',
      },
    })

    mocks.createDeckWriteRepository.mockReturnValue(
      createRepository({
        getDeckById,
        createDeck: createDeckRecord,
      }),
    )

    const formData = new FormData()
    formData.set('deckId', 'deck-1')

    await duplicateDeckAction(formData)

    expect(getDeckById).toHaveBeenCalledWith('deck-1')
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
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/decks')
  })

  it('deletes an owned deck and revalidates list/detail routes', async () => {
    const getDeckById = vi.fn().mockResolvedValue({
      ok: true,
      data: createStoredDeck({
        deck: createBaseDeck(),
        visibility: 'private',
      }),
    })
    const deleteDeckRecord = vi.fn().mockResolvedValue({
      ok: true,
      data: undefined,
    })

    mocks.createDeckWriteRepository.mockReturnValue(
      createRepository({
        getDeckById,
        deleteDeck: deleteDeckRecord,
      }),
    )

    const formData = new FormData()
    formData.set('deckId', 'deck-1')

    await deleteDeckAction(formData)

    expect(deleteDeckRecord).toHaveBeenCalledWith('deck-1')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/decks')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/decks/deck-1')
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
    getDeckDetailById: vi.fn(),
    createDeck: vi.fn(),
    saveDeck: vi.fn(),
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
