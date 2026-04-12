import {
  addCard,
  createDeck,
  DeckDomainError,
  decrementCard,
  incrementCard,
  removeCard,
  type Deck,
} from '@web-vg/decks'
import type {
  DeckDetailRecord,
  DeckSectionKey,
} from '@web-vg/db/repositories/decks'
import type { CardId, DeckSection, FormatId } from '@web-vg/shared'

import type { DeckBuilderDraftSaveInput } from '@/features/decks/deck-builder-draft'
import { DECK_BUILDER_MAX_COPIES } from '@/features/decks/deck-builder-limits'
import { isSupportedDeckFormatId } from '@/features/decks/deck-format-options'

import {
  type DeckApplicationResult,
  type DeckApplicationServices,
  type OwnedDeckState,
  resolveOwnedDeck,
} from './deck-application-support'

export type DeckBuilderMutationKind =
  | 'add'
  | 'increment'
  | 'decrement'
  | 'remove'

export interface DeckBuilderMutationInput {
  readonly authUserId: string
  readonly deckId: string
  readonly cardEntityId: string
  readonly mutation: DeckBuilderMutationKind
  readonly sectionKey?: DeckSectionKey
}

export type DeckBuilderMutationResult = DeckApplicationResult<DeckDetailRecord>

export interface SaveDeckDraftCommand extends DeckBuilderDraftSaveInput {
  readonly authUserId: string
}

export type SaveDeckDraftResult = DeckBuilderMutationResult

export async function mutateDeckCompositionUseCase(
  services: DeckApplicationServices,
  input: DeckBuilderMutationInput,
): Promise<DeckBuilderMutationResult> {
  const ownedDeckResult = await resolveOwnedDeck(services, {
    authUserId: input.authUserId,
    deckId: input.deckId,
    forbiddenMessage: 'The current profile cannot edit this deck.',
  })

  if (!ownedDeckResult.ok) {
    return ownedDeckResult
  }

  let nextDeck: Deck

  try {
    nextDeck = applyDeckMutation(ownedDeckResult.data.storedDeck.deck, input)
  } catch (error) {
    return mapDeckMutationFailure(error)
  }

  return persistDeckChange(services, ownedDeckResult.data, nextDeck)
}

export async function saveDeckDraftUseCase(
  services: DeckApplicationServices,
  input: SaveDeckDraftCommand,
): Promise<SaveDeckDraftResult> {
  if (!isSupportedDeckFormatId(input.formatId)) {
    return {
      ok: false,
      error: {
        code: 'unsupported-format',
        message:
          'Choose Standard, V Premium, or Premium before saving the deck.',
      },
    }
  }

  const ownedDeckResult = await resolveOwnedDeck(services, {
    authUserId: input.authUserId,
    deckId: input.deckId,
    forbiddenMessage: 'The current profile cannot edit this deck.',
  })

  if (!ownedDeckResult.ok) {
    return ownedDeckResult
  }

  let nextDeck: Deck

  try {
    nextDeck = createDeckFromDraftInput(
      ownedDeckResult.data.storedDeck.deck,
      input,
    )
    assertDraftWithinBuilderCopyCap(nextDeck)
  } catch (error) {
    return mapDeckMutationFailure(error)
  }

  return persistDeckChange(services, ownedDeckResult.data, nextDeck)
}

function applyDeckMutation(deck: Deck, input: DeckBuilderMutationInput): Deck {
  const cardEntityId = input.cardEntityId as CardId
  const section = (input.sectionKey ?? 'main') as DeckSection

  switch (input.mutation) {
    case 'add':
      return addCard(deck, cardEntityId, 1, {
        section,
        maxQuantity: DECK_BUILDER_MAX_COPIES,
      })
    case 'increment':
      return incrementCard(deck, cardEntityId, {
        section,
        maxQuantity: DECK_BUILDER_MAX_COPIES,
      })
    case 'decrement':
      return decrementCard(deck, cardEntityId, { section })
    case 'remove':
      return removeCard(deck, cardEntityId, { section })
  }
}

function createDeckFromDraftInput(
  deck: Deck,
  input: DeckBuilderDraftSaveInput,
): Deck {
  return createDeck({
    id: deck.id,
    ownerId: deck.ownerId,
    formatId: input.formatId as FormatId,
    name: input.title,
    description: input.description,
    tags: input.tags,
    isFavorite: input.isFavorite,
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt,
    currentVersionId: deck.currentVersion.id,
    revision: deck.currentVersion.revision,
    cards: input.cards.map((card) => ({
      section: card.sectionKey as DeckSection,
      cardEntityId: card.cardEntityId as CardId,
      quantity: card.quantity,
    })),
  })
}

function assertDraftWithinBuilderCopyCap(deck: Deck): void {
  for (const card of deck.currentVersion.cards) {
    if (card.quantity > DECK_BUILDER_MAX_COPIES) {
      throw new DeckDomainError(
        'max-quantity-exceeded',
        `Deck card quantity cannot exceed ${DECK_BUILDER_MAX_COPIES}.`,
      )
    }
  }
}

async function persistDeckChange(
  services: DeckApplicationServices,
  ownedDeckState: OwnedDeckState,
  nextDeck: Deck,
): Promise<DeckBuilderMutationResult> {
  const saveResult = await services.repository.saveDeck(
    ownedDeckState.storedDeck,
    nextDeck,
  )

  if (!saveResult.ok) {
    return {
      ok: false,
      error: {
        code: 'repository-failed',
        message: saveResult.error.message,
      },
    }
  }

  const detailResult = await services.repository.getDeckDetailById(nextDeck.id)

  if (!detailResult.ok) {
    return {
      ok: false,
      error: {
        code: 'repository-failed',
        message: detailResult.error.message,
      },
    }
  }

  if (!detailResult.data) {
    return {
      ok: false,
      error: {
        code: 'repository-failed',
        message: 'The updated deck could not be loaded after save.',
      },
    }
  }

  return {
    ok: true,
    data: detailResult.data,
  }
}

function mapDeckMutationFailure(error: unknown): DeckBuilderMutationResult {
  if (
    error instanceof DeckDomainError &&
    error.code === 'max-quantity-exceeded'
  ) {
    return {
      ok: false,
      error: {
        code: 'max-quantity-exceeded',
        message: `Builder copy cap reached. A card cannot exceed ${DECK_BUILDER_MAX_COPIES} copies before full validation is available.`,
      },
    }
  }

  if (error instanceof DeckDomainError) {
    return {
      ok: false,
      error: {
        code: 'mutation-failed',
        message: error.message,
      },
    }
  }

  return {
    ok: false,
    error: {
      code: 'mutation-failed',
      message: 'The deck mutation could not be applied.',
    },
  }
}
