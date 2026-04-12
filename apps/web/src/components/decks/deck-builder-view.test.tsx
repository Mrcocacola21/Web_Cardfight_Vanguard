import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeckBuilderValidationData } from '@/features/decks/deck-builder-validation'
import type { FormatId } from '@web-vg/shared'

import { createDeckBuilderDraft } from '@/features/decks/deck-builder-draft'
import { saveDeckBuilderDraftBackup } from '@/features/decks/deck-builder-draft-storage'

const actionMocks = vi.hoisted(() => ({
  saveDeckDraftAction: vi.fn(),
}))

const navigationMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}))

vi.mock('@/features/decks/server/deck-builder-actions', () => ({
  saveDeckDraftAction: actionMocks.saveDeckDraftAction,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: navigationMocks.refresh,
  }),
}))

import { DeckBuilderView } from './deck-builder-view'

describe('DeckBuilderView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllTimers()
    vi.useRealTimers()
    window.sessionStorage.clear()
  })

  it('renders the builder layout with saved state', () => {
    render(
      <DeckBuilderView
        initialDeck={createDeckDetail()}
        catalogCards={[createCatalogCard()]}
        catalogErrorMessage={null}
        query={{
          searchText: null,
        }}
      />,
    )

    expect(
      screen.getByRole('heading', { name: /azure bastion/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/^catalog$/i)).toBeInTheDocument()
    expect(screen.getByText(/^current deck$/i)).toBeInTheDocument()
    expect(screen.getByText(/^saved$/i)).toBeInTheDocument()
  })

  it('shows the empty deck state when the deck has no cards', () => {
    render(
      <DeckBuilderView
        initialDeck={createEmptyDeckDetail()}
        catalogCards={[createCatalogCard()]}
        catalogErrorMessage={null}
        query={{
          searchText: null,
        }}
      />,
    )

    expect(screen.getByText(/deck is empty/i)).toBeInTheDocument()
  })

  it('renders the validation panel from the current draft without a second UI state', () => {
    render(
      <DeckBuilderView
        initialDeck={createEmptyDeckDetail()}
        catalogCards={[createCatalogCard()]}
        catalogErrorMessage={null}
        validationData={createValidationData()}
        query={{
          searchText: null,
        }}
      />,
    )

    expect(screen.getByText(/^validation$/i)).toBeInTheDocument()
    expect(
      screen.getByText(
        /deck must contain at least one card before validation can succeed/i,
      ),
    ).toBeInTheDocument()
  })

  it('updates the validation panel after draft mutations in the builder UI', () => {
    render(
      <DeckBuilderView
        initialDeck={createEmptyDeckDetail()}
        catalogCards={[createCatalogCard()]}
        catalogErrorMessage={null}
        validationData={createValidationData()}
        query={{
          searchText: null,
        }}
      />,
    )

    expect(
      screen.getByText(
        /deck must contain at least one card before validation can succeed/i,
      ),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /add apex ruler, bastion/i }),
    )

    expect(
      screen.queryByText(
        /deck must contain at least one card before validation can succeed/i,
      ),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/standard decks must contain a ride deck/i),
    ).toBeInTheDocument()
  })

  it('highlights deck rows when validation attributes card-level issues to them', () => {
    render(
      <DeckBuilderView
        initialDeck={createDeckDetail({
          currentVersion: {
            ...createDeckDetail().currentVersion,
            totalCards: 5,
            sectionCounts: { main: 5, ride: 0, g: 0 },
            cards: [{ ...createDeckCard(), quantity: 5 }],
            sections: [
              {
                key: 'main',
                totalCards: 5,
                cards: [{ ...createDeckCard(), quantity: 5 }],
              },
              { key: 'ride', totalCards: 0, cards: [] },
              { key: 'g', totalCards: 0, cards: [] },
            ],
          },
        })}
        catalogCards={[createCatalogCard()]}
        catalogErrorMessage={null}
        validationData={createValidationData()}
        query={{
          searchText: null,
        }}
      />,
    )

    expect(screen.getByText(/5 copies of entity-bastion/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go to card/i })).toHaveAttribute(
      'href',
      '#deck-row-main-entity-bastion',
    )

    const highlightedDeckRow = screen
      .getAllByText('Apex Ruler, Bastion')
      .map((entry) => entry.closest('[data-validation-severity]'))
      .find((entry) => entry != null)

    expect(highlightedDeckRow).toHaveAttribute(
      'data-validation-severity',
      'error',
    )
  })

  it('marks changes as unsaved and autosaves back to saved after add from catalog', async () => {
    actionMocks.saveDeckDraftAction.mockResolvedValueOnce({
      ok: true,
      data: createDeckDetail({
        currentVersion: {
          ...createDeckDetail().currentVersion,
          totalCards: 1,
          sectionCounts: { main: 1, ride: 0, g: 0 },
          cards: [createDeckCard()],
          sections: [
            { key: 'main', totalCards: 1, cards: [createDeckCard()] },
            { key: 'ride', totalCards: 0, cards: [] },
            { key: 'g', totalCards: 0, cards: [] },
          ],
        },
      }),
    })

    render(
      <DeckBuilderView
        initialDeck={createEmptyDeckDetail()}
        catalogCards={[createCatalogCard()]}
        catalogErrorMessage={null}
        query={{
          searchText: null,
        }}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: /add apex ruler, bastion/i }),
    )

    expect(screen.getByText(/^unsaved changes$/i)).toBeInTheDocument()
    expect(screen.getByText(/^x1$/i)).toBeInTheDocument()

    await flushAutosave()

    expect(actionMocks.saveDeckDraftAction).toHaveBeenCalledWith({
      deckId: 'deck-1',
      formatId: 'standard',
      title: 'Azure Bastion',
      description: null,
      tags: [],
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
          quantity: 1,
        },
      ],
    })

    expect(screen.getByText(/^saved$/i)).toBeInTheDocument()
  })

  it('coalesces repeated edits into one autosave request and keeps one deck row per entity', async () => {
    actionMocks.saveDeckDraftAction.mockResolvedValueOnce({
      ok: true,
      data: createDeckDetail({
        currentVersion: {
          ...createDeckDetail().currentVersion,
          totalCards: 2,
          sectionCounts: { main: 2, ride: 0, g: 0 },
          cards: [{ ...createDeckCard(), quantity: 2 }],
          sections: [
            {
              key: 'main',
              totalCards: 2,
              cards: [{ ...createDeckCard(), quantity: 2 }],
            },
            { key: 'ride', totalCards: 0, cards: [] },
            { key: 'g', totalCards: 0, cards: [] },
          ],
        },
      }),
    })

    render(
      <DeckBuilderView
        initialDeck={createEmptyDeckDetail()}
        catalogCards={[createCatalogCard()]}
        catalogErrorMessage={null}
        query={{
          searchText: null,
        }}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: /add apex ruler, bastion/i }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /add apex ruler, bastion/i }),
    )

    expect(screen.getByText(/^x2$/i)).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /remove apex ruler, bastion/i }),
    ).toHaveLength(1)

    await flushAutosave()

    expect(actionMocks.saveDeckDraftAction).toHaveBeenCalledTimes(1)
    expect(actionMocks.saveDeckDraftAction).toHaveBeenCalledWith({
      deckId: 'deck-1',
      formatId: 'standard',
      title: 'Azure Bastion',
      description: null,
      tags: [],
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
          quantity: 2,
        },
      ],
    })
  })

  it('keeps the local draft and shows save error state when autosave fails', async () => {
    actionMocks.saveDeckDraftAction.mockResolvedValueOnce({
      ok: false,
      error: {
        message: 'Autosave failed.',
      },
    })

    render(
      <DeckBuilderView
        initialDeck={createEmptyDeckDetail()}
        catalogCards={[createCatalogCard()]}
        catalogErrorMessage={null}
        query={{
          searchText: null,
        }}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: /add apex ruler, bastion/i }),
    )

    await flushAutosave()

    expect(screen.getByText(/could not save changes/i)).toBeInTheDocument()
    expect(screen.getByText(/^x1$/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /retry save/i }),
    ).toBeInTheDocument()
  })

  it('restores temporary draft state after refresh or navigation and re-autosaves it', async () => {
    const restoredDraft = createDeckBuilderDraft(
      createDeckDetail({
        currentVersion: {
          ...createDeckDetail().currentVersion,
          totalCards: 2,
          sectionCounts: { main: 2, ride: 0, g: 0 },
          cards: [{ ...createDeckCard(), quantity: 2 }],
          sections: [
            {
              key: 'main',
              totalCards: 2,
              cards: [{ ...createDeckCard(), quantity: 2 }],
            },
            { key: 'ride', totalCards: 0, cards: [] },
            { key: 'g', totalCards: 0, cards: [] },
          ],
        },
      }),
    )

    saveDeckBuilderDraftBackup(restoredDraft)

    actionMocks.saveDeckDraftAction.mockResolvedValueOnce({
      ok: true,
      data: createDeckDetail({
        currentVersion: {
          ...createDeckDetail().currentVersion,
          totalCards: 2,
          sectionCounts: { main: 2, ride: 0, g: 0 },
          cards: [{ ...createDeckCard(), quantity: 2 }],
          sections: [
            {
              key: 'main',
              totalCards: 2,
              cards: [{ ...createDeckCard(), quantity: 2 }],
            },
            { key: 'ride', totalCards: 0, cards: [] },
            { key: 'g', totalCards: 0, cards: [] },
          ],
        },
      }),
    })

    render(
      <DeckBuilderView
        initialDeck={createEmptyDeckDetail()}
        catalogCards={[createCatalogCard()]}
        catalogErrorMessage={null}
        query={{
          searchText: null,
        }}
      />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText(/^x2$/i)).toBeInTheDocument()
    expect(screen.getByText(/^unsaved changes$/i)).toBeInTheDocument()
    expect(screen.getByText(/recovered a temporary draft/i)).toBeInTheDocument()

    await flushAutosave()

    expect(actionMocks.saveDeckDraftAction).toHaveBeenCalledTimes(1)
  })

  it('uses the same autosave path for search-based add flow', async () => {
    actionMocks.saveDeckDraftAction.mockResolvedValueOnce({
      ok: true,
      data: createDeckDetail({
        currentVersion: {
          ...createDeckDetail().currentVersion,
          totalCards: 1,
          sectionCounts: { main: 1, ride: 0, g: 0 },
          cards: [createDeckCard()],
          sections: [
            { key: 'main', totalCards: 1, cards: [createDeckCard()] },
            { key: 'ride', totalCards: 0, cards: [] },
            { key: 'g', totalCards: 0, cards: [] },
          ],
        },
      }),
    })

    render(
      <DeckBuilderView
        initialDeck={createEmptyDeckDetail()}
        catalogCards={[createCatalogCard()]}
        catalogErrorMessage={null}
        query={{
          searchText: 'bastion',
        }}
      />,
    )

    expect(screen.getByDisplayValue('bastion')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /clear/i })).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /add apex ruler, bastion/i }),
    )

    await flushAutosave()

    expect(actionMocks.saveDeckDraftAction).toHaveBeenCalledWith({
      deckId: 'deck-1',
      formatId: 'standard',
      title: 'Azure Bastion',
      description: null,
      tags: [],
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
          quantity: 1,
        },
      ],
    })
  })

  it('removes the final deck row when quantity is decremented to zero in the builder UI', async () => {
    actionMocks.saveDeckDraftAction.mockResolvedValueOnce({
      ok: true,
      data: createEmptyDeckDetail(),
    })

    render(
      <DeckBuilderView
        initialDeck={createDeckDetail()}
        catalogCards={[createCatalogCard()]}
        catalogErrorMessage={null}
        query={{
          searchText: null,
        }}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: /decrease apex ruler, bastion/i }),
    )

    expect(screen.getByText(/deck is empty/i)).toBeInTheDocument()
    expect(screen.getByText(/^unsaved changes$/i)).toBeInTheDocument()

    await flushAutosave()

    expect(actionMocks.saveDeckDraftAction).toHaveBeenCalledWith({
      deckId: 'deck-1',
      formatId: 'standard',
      title: 'Azure Bastion',
      description: null,
      tags: [],
      isFavorite: false,
      cards: [],
    })
  })

  it('shows the search empty state when no catalog cards match', () => {
    render(
      <DeckBuilderView
        initialDeck={createEmptyDeckDetail()}
        catalogCards={[]}
        catalogErrorMessage={null}
        query={{
          searchText: 'liael',
        }}
      />,
    )

    expect(screen.getByText(/no cards found/i)).toBeInTheDocument()
  })

  it('disables add controls once the builder copy cap is reached', () => {
    render(
      <DeckBuilderView
        initialDeck={createDeckDetail({
          currentVersion: {
            ...createDeckDetail().currentVersion,
            totalCards: 4,
            sectionCounts: { main: 4, ride: 0, g: 0 },
            cards: [{ ...createDeckCard(), quantity: 4 }],
            sections: [
              {
                key: 'main',
                totalCards: 4,
                cards: [{ ...createDeckCard(), quantity: 4 }],
              },
              { key: 'ride', totalCards: 0, cards: [] },
              { key: 'g', totalCards: 0, cards: [] },
            ],
          },
        })}
        catalogCards={[createCatalogCard()]}
        catalogErrorMessage={null}
        query={{
          searchText: null,
        }}
      />,
    )

    expect(
      screen.getByRole('button', { name: /add apex ruler, bastion/i }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /increase apex ruler, bastion/i }),
    ).toBeDisabled()
  })

  it('autosaves deck metadata edits through the same draft pipeline', async () => {
    actionMocks.saveDeckDraftAction.mockResolvedValueOnce({
      ok: true,
      data: createDeckDetail({
        title: 'Rezael Tempo',
        description: 'Premium draft shell',
        tags: ['tempo', 'premium'],
        isFavorite: true,
        format: {
          id: 'premium',
          displayName: 'Premium',
          description: 'Mixed-era format baseline.',
        },
      }),
    })

    render(
      <DeckBuilderView
        initialDeck={createDeckDetail()}
        catalogCards={[createCatalogCard()]}
        catalogErrorMessage={null}
        query={{
          searchText: null,
        }}
      />,
    )

    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: 'Rezael Tempo' },
    })
    fireEvent.change(screen.getByLabelText(/^format$/i), {
      target: { value: 'premium' },
    })
    fireEvent.change(screen.getByLabelText(/^description$/i), {
      target: { value: 'Premium draft shell' },
    })
    fireEvent.click(screen.getByLabelText(/^mark deck as favorite$/i))
    fireEvent.change(screen.getByLabelText(/^tags$/i), {
      target: { value: 'tempo' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add tag/i }))
    fireEvent.change(screen.getByLabelText(/^tags$/i), {
      target: { value: 'premium' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add tag/i }))

    expect(screen.getByText(/^unsaved changes$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^mark deck as favorite$/i)).toBeChecked()

    await flushAutosave()

    expect(actionMocks.saveDeckDraftAction).toHaveBeenCalledWith({
      deckId: 'deck-1',
      formatId: 'premium',
      title: 'Rezael Tempo',
      description: 'Premium draft shell',
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
          quantity: 1,
        },
      ],
    })

    expect(screen.getByText(/^saved$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^format$/i)).toHaveValue('premium')
    expect(navigationMocks.refresh).toHaveBeenCalledTimes(1)
  })

  it('restores metadata edits from temporary draft backup before autosave completes', async () => {
    const restoredDraft = createDeckBuilderDraft(
      createDeckDetail({
        title: 'Restored Metadata Deck',
        description: 'Recovered draft metadata',
        tags: ['restored'],
        isFavorite: true,
        format: {
          id: 'v-premium',
          displayName: 'V Premium',
          description: 'V-era format path.',
        },
      }),
    )

    saveDeckBuilderDraftBackup(restoredDraft)

    actionMocks.saveDeckDraftAction.mockResolvedValueOnce({
      ok: true,
      data: createDeckDetail({
        title: 'Restored Metadata Deck',
        description: 'Recovered draft metadata',
        tags: ['restored'],
        isFavorite: true,
        format: {
          id: 'v-premium',
          displayName: 'V Premium',
          description: 'V-era format path.',
        },
      }),
    })

    render(
      <DeckBuilderView
        initialDeck={createDeckDetail()}
        catalogCards={[createCatalogCard()]}
        catalogErrorMessage={null}
        query={{
          searchText: null,
        }}
      />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(
      screen.getByDisplayValue('Restored Metadata Deck'),
    ).toBeInTheDocument()
    expect(
      screen.getByDisplayValue('Recovered draft metadata'),
    ).toBeInTheDocument()
    expect(screen.getByText('restored')).toBeInTheDocument()
    expect(screen.getByLabelText(/^mark deck as favorite$/i)).toBeChecked()

    await flushAutosave()

    expect(actionMocks.saveDeckDraftAction).toHaveBeenCalledWith({
      deckId: 'deck-1',
      formatId: 'v-premium',
      title: 'Restored Metadata Deck',
      description: 'Recovered draft metadata',
      tags: ['restored'],
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
          quantity: 1,
        },
      ],
    })
  })
})

async function flushAutosave() {
  await act(async () => {
    vi.advanceTimersByTime(850)
    await Promise.resolve()
  })
}

function createCatalogCard() {
  return {
    id: 'entity-bastion',
    canonicalKey: 'card.apex-ruler-bastion',
    name: 'Apex Ruler, Bastion',
    normalizedName: 'apex ruler bastion',
    grade: 3,
    cardType: 'normal-unit',
    nation: 'keter sanctuary',
    clan: null,
    race: null,
    triggerType: null,
    basePower: 13000,
    baseCritical: 1,
    baseShield: null,
    keywords: [],
    effectRefs: [],
  }
}

function createValidationData(): DeckBuilderValidationData {
  return {
    cards: [
      {
        cardEntityId: 'entity-bastion',
        canonicalKey: 'card.apex-ruler-bastion',
        name: 'Apex Ruler, Bastion',
        grade: 3,
        cardType: 'normal-unit',
        nation: 'Keter Sanctuary',
        clan: null,
        triggerType: null,
        legalInFormats: ['standard', 'v-premium', 'premium'],
        premiumGDeckEligible: null,
      },
    ],
    restrictionLists: [
      {
        formatId: 'standard' as FormatId,
        version: 'standard-baseline-v1',
        rules: [],
      },
      {
        formatId: 'v-premium' as FormatId,
        version: 'v-premium-baseline-v1',
        rules: [],
      },
      {
        formatId: 'premium' as FormatId,
        version: 'premium-baseline-v1',
        rules: [],
      },
    ],
  }
}

function createDeckCard() {
  return {
    sectionKey: 'main' as const,
    cardEntityId: 'entity-bastion',
    canonicalKey: 'card.apex-ruler-bastion',
    name: 'Apex Ruler, Bastion',
    grade: 3,
    cardType: 'normal-unit',
    triggerType: null,
    quantity: 1,
  }
}

function createEmptyDeckDetail() {
  return createDeckDetail({
    currentVersion: {
      ...createDeckDetail().currentVersion,
      totalCards: 0,
      sectionCounts: {
        main: 0,
        ride: 0,
        g: 0,
      },
      cards: [],
      sections: [
        { key: 'main', totalCards: 0, cards: [] },
        { key: 'ride', totalCards: 0, cards: [] },
        { key: 'g', totalCards: 0, cards: [] },
      ],
    },
  })
}

function createDeckDetail(
  overrides?: Partial<{
    title: string
    description: string | null
    tags: string[]
    isFavorite: boolean
    format: {
      id: string
      displayName: string
      description: string | null
    }
    currentVersion: {
      id: string
      deckId: string
      versionNumber: number
      createdByProfileId: string
      versionNote: string | null
      createdAt: string
      totalCards: number
      sectionCounts: {
        main: number
        ride: number
        g: number
      }
      cards: ReturnType<typeof createDeckCard>[]
      sections: {
        key: 'main' | 'ride' | 'g'
        totalCards: number
        cards: ReturnType<typeof createDeckCard>[]
      }[]
    }
  }>,
) {
  return {
    id: 'deck-1',
    ownerProfileId: 'profile-1',
    title: overrides?.title ?? 'Azure Bastion',
    description: overrides?.description ?? null,
    tags: overrides?.tags ?? [],
    isFavorite: overrides?.isFavorite ?? false,
    visibility: 'private',
    archivedAt: null,
    createdAt: '2026-04-08T00:00:00.000Z',
    updatedAt: '2026-04-08T01:00:00.000Z',
    format:
      overrides?.format ??
      ({
        id: 'standard',
        displayName: 'Standard',
        description: 'D-era baseline profile',
      } as const),
    currentVersionId: 'version-1',
    currentVersion: {
      id: 'version-1',
      deckId: 'deck-1',
      versionNumber: 1,
      createdByProfileId: 'profile-1',
      versionNote: null,
      createdAt: '2026-04-08T01:00:00.000Z',
      totalCards: 1,
      sectionCounts: {
        main: 1,
        ride: 0,
        g: 0,
      },
      cards: [createDeckCard()],
      sections: [
        {
          key: 'main' as const,
          totalCards: 1,
          cards: [createDeckCard()],
        },
        {
          key: 'ride' as const,
          totalCards: 0,
          cards: [],
        },
        {
          key: 'g' as const,
          totalCards: 0,
          cards: [],
        },
      ],
      ...overrides?.currentVersion,
    },
  }
}
