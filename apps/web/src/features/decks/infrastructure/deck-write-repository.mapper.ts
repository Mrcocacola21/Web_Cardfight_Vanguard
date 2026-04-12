import { createDeck, type Deck } from '@web-vg/decks'
import type {
  CreateDeckInput,
  DeckRecord,
  SaveDeckInput,
} from '@web-vg/db/repositories/decks'
import type {
  CardId,
  DeckId,
  DeckSection,
  FormatId,
  UserId,
} from '@web-vg/shared'

import type {
  CreateDeckRecordInput,
  StoredDeck,
} from '@/features/decks/application/deck-write-repository'

export function mapDeckRecordToStoredDeck(deckRecord: DeckRecord): StoredDeck {
  return {
    deck: createDeck({
      id: deckRecord.id as DeckId,
      ownerId: deckRecord.ownerProfileId as UserId,
      formatId: deckRecord.formatId as FormatId,
      name: deckRecord.title,
      description: deckRecord.description,
      tags: deckRecord.tags,
      isFavorite: deckRecord.isFavorite,
      createdAt: deckRecord.createdAt,
      updatedAt: deckRecord.updatedAt,
      currentVersionId: (deckRecord.currentVersion?.id ??
        `${deckRecord.id}-draft-version`) as never,
      revision: deckRecord.currentVersion?.versionNumber ?? 1,
      cards:
        deckRecord.currentVersion?.cards.map((card) => ({
          section: card.sectionKey as DeckSection,
          cardEntityId: card.cardEntityId as CardId,
          quantity: card.quantity,
        })) ?? [],
    }),
    visibility: deckRecord.visibility as StoredDeck['visibility'],
  }
}

export function mapCreateDeckRecordInputToPersistence(
  input: CreateDeckRecordInput,
): CreateDeckInput {
  return {
    ownerProfileId: input.ownerProfileId,
    formatId: input.formatId,
    title: input.name,
    description: input.description,
    tags: input.tags,
    isFavorite: input.isFavorite,
    ...(input.visibility ? { visibility: input.visibility } : {}),
    cards: input.cards.map((card) => ({
      sectionKey: card.section,
      cardEntityId: card.cardEntityId,
      quantity: card.quantity,
    })),
  }
}

export function mapStoredDeckToSaveDeckInput(
  current: StoredDeck,
  nextDeck: Deck,
): SaveDeckInput {
  return {
    deckId: nextDeck.id,
    ownerProfileId: nextDeck.ownerId,
    formatId: nextDeck.formatId,
    title: nextDeck.name,
    description: nextDeck.description,
    tags: nextDeck.tags,
    isFavorite: nextDeck.isFavorite,
    visibility: current.visibility,
    cards: nextDeck.currentVersion.cards.map((card) => ({
      sectionKey: card.section,
      cardEntityId: card.cardEntityId,
      quantity: card.quantity,
    })),
  }
}
