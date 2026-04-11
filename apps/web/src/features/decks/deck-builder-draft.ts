import {
  addCard,
  createDeck,
  decrementCard,
  incrementCard,
  removeCard,
  renameDeck,
  setDeckDescription,
  setDeckFavorite,
  setDeckTags,
  type Deck,
} from '@web-vg/decks'
import type { DeckDetailRecord, DeckSectionKey } from '@web-vg/db'
import type {
  CardId,
  DeckId,
  DeckSection,
  FormatId,
  UserId,
} from '@web-vg/shared'

import { DECK_BUILDER_MAX_COPIES } from './deck-builder-limits'

const draftTimestamp = '1970-01-01T00:00:00.000Z'

export interface DeckBuilderDraftCard {
  readonly sectionKey: DeckSectionKey
  readonly cardEntityId: string
  readonly canonicalKey: string
  readonly name: string
  readonly grade: number
  readonly cardType: string
  readonly triggerType: string | null
  readonly quantity: number
}

export interface DeckBuilderDraft {
  readonly deckId: string
  readonly ownerProfileId: string
  readonly formatId: string
  readonly title: string
  readonly description: string | null
  readonly tags: readonly string[]
  readonly isFavorite: boolean
  readonly currentVersionId: string | null
  readonly updatedAt: string
  readonly cards: readonly DeckBuilderDraftCard[]
}

export interface DeckBuilderDraftSaveInput {
  readonly deckId: string
  readonly formatId: string
  readonly title: string
  readonly description: string | null
  readonly tags: readonly string[]
  readonly isFavorite: boolean
  readonly cards: readonly DeckBuilderDraftCard[]
}

export interface UpdateDeckBuilderDraftMetadataInput {
  readonly formatId?: string
  readonly title?: string
  readonly description?: string | null
  readonly tags?: readonly string[]
  readonly isFavorite?: boolean
}

export type DeckBuilderDraftMutationKind =
  | 'add'
  | 'increment'
  | 'decrement'
  | 'remove'

export interface DeckBuilderDraftMutationInput {
  readonly cardEntityId: string
  readonly mutation: DeckBuilderDraftMutationKind
  readonly sectionKey?: DeckSectionKey
  readonly card?: {
    readonly canonicalKey: string
    readonly name: string
    readonly grade: number
    readonly cardType: string
    readonly triggerType: string | null
  }
}

export function createDeckBuilderDraft(
  deck: DeckDetailRecord,
): DeckBuilderDraft {
  return {
    deckId: deck.id,
    ownerProfileId: deck.ownerProfileId,
    formatId: deck.format.id,
    title: deck.title,
    description: deck.description,
    tags: deck.tags,
    isFavorite: deck.isFavorite,
    currentVersionId: deck.currentVersionId,
    updatedAt: deck.updatedAt,
    cards:
      deck.currentVersion?.cards.map((card) => ({
        sectionKey: card.sectionKey,
        cardEntityId: card.cardEntityId,
        canonicalKey: card.canonicalKey,
        name: card.name,
        grade: card.grade,
        cardType: card.cardType,
        triggerType: card.triggerType,
        quantity: card.quantity,
      })) ?? [],
  }
}

export function createDeckBuilderDraftSaveInput(
  draft: DeckBuilderDraft,
): DeckBuilderDraftSaveInput {
  return {
    deckId: draft.deckId,
    formatId: draft.formatId,
    title: draft.title,
    description: draft.description,
    tags: draft.tags,
    isFavorite: draft.isFavorite,
    cards: draft.cards,
  }
}

export function createDeckBuilderDraftSignature(
  draft: DeckBuilderDraft,
): string {
  return JSON.stringify({
    formatId: draft.formatId,
    title: draft.title,
    description: draft.description,
    tags: draft.tags,
    isFavorite: draft.isFavorite,
    cards: draft.cards
      .map((card) => ({
        sectionKey: card.sectionKey,
        cardEntityId: card.cardEntityId,
        quantity: card.quantity,
      }))
      .sort(compareDraftCardIdentity),
  })
}

export function getDeckBuilderDraftQuantity(
  draft: DeckBuilderDraft,
  cardEntityId: string,
): number {
  return draft.cards.reduce((total, card) => {
    return card.cardEntityId === cardEntityId ? total + card.quantity : total
  }, 0)
}

export function applyDeckBuilderDraftMutation(
  draft: DeckBuilderDraft,
  input: DeckBuilderDraftMutationInput,
): DeckBuilderDraft {
  const domainDeck = mapDraftToDomain(deckToDraftBaseline(draft))
  const cardDetailsByEntityId = buildCardDetailsByEntityId(draft, input)
  const cardEntityId = input.cardEntityId as CardId
  const section = (input.sectionKey ?? 'main') as DeckSection

  const nextDeck =
    input.mutation === 'add'
      ? addCard(domainDeck, cardEntityId, 1, {
          section,
          maxQuantity: DECK_BUILDER_MAX_COPIES,
        })
      : input.mutation === 'increment'
        ? incrementCard(domainDeck, cardEntityId, {
            section,
            maxQuantity: DECK_BUILDER_MAX_COPIES,
          })
        : input.mutation === 'decrement'
          ? decrementCard(domainDeck, cardEntityId, { section })
          : removeCard(domainDeck, cardEntityId, { section })

  return mapDomainToDraft(draft, nextDeck, cardDetailsByEntityId)
}

export function updateDeckBuilderDraftMetadata(
  draft: DeckBuilderDraft,
  input: UpdateDeckBuilderDraftMetadataInput,
): DeckBuilderDraft {
  let nextDeck = mapDraftToDomain(deckToDraftBaseline(draft))

  if (input.title !== undefined) {
    nextDeck = renameDeck(nextDeck, input.title)
  }

  if (input.description !== undefined) {
    nextDeck = setDeckDescription(nextDeck, input.description)
  }

  if (input.tags !== undefined) {
    nextDeck = setDeckTags(nextDeck, input.tags)
  }

  if (input.isFavorite !== undefined) {
    nextDeck = setDeckFavorite(nextDeck, input.isFavorite)
  }

  if (input.formatId !== undefined && input.formatId !== nextDeck.formatId) {
    nextDeck = createDeck({
      id: nextDeck.id,
      ownerId: nextDeck.ownerId,
      formatId: input.formatId as FormatId,
      name: nextDeck.name,
      description: nextDeck.description,
      tags: nextDeck.tags,
      isFavorite: nextDeck.isFavorite,
      createdAt: draftTimestamp,
      updatedAt: nextDeck.updatedAt,
      currentVersionId: nextDeck.currentVersion.id,
      revision: nextDeck.currentVersion.revision,
      cards: nextDeck.currentVersion.cards,
    })
  }

  return mapDomainToDraft(draft, nextDeck, buildCardDetailsByEntityId(draft))
}

function deckToDraftBaseline(draft: DeckBuilderDraft): DeckBuilderDraft {
  return {
    ...draft,
    cards: draft.cards.slice().sort(compareDraftCards),
  }
}

function mapDraftToDomain(draft: DeckBuilderDraft): Deck {
  return createDeck({
    id: draft.deckId as DeckId,
    ownerId: draft.ownerProfileId as UserId,
    formatId: draft.formatId as FormatId,
    name: draft.title,
    description: draft.description,
    tags: draft.tags,
    isFavorite: draft.isFavorite,
    createdAt: draftTimestamp,
    updatedAt: draft.updatedAt,
    currentVersionId: (draft.currentVersionId ??
      `${draft.deckId}-draft-version`) as never,
    cards: draft.cards.map((card) => ({
      section: card.sectionKey as DeckSection,
      cardEntityId: card.cardEntityId as CardId,
      quantity: card.quantity,
    })),
  })
}

function mapDomainToDraft(
  draft: DeckBuilderDraft,
  deck: Deck,
  cardDetailsByEntityId: ReadonlyMap<
    string,
    Omit<DeckBuilderDraftCard, 'sectionKey' | 'quantity'>
  >,
): DeckBuilderDraft {
  return {
    deckId: draft.deckId,
    ownerProfileId: draft.ownerProfileId,
    formatId: deck.formatId,
    title: deck.name,
    description: deck.description,
    tags: [...deck.tags],
    isFavorite: deck.isFavorite,
    currentVersionId: draft.currentVersionId,
    updatedAt: deck.updatedAt,
    cards: deck.currentVersion.cards.map((card) => {
      const cardDetails = cardDetailsByEntityId.get(card.cardEntityId)

      if (!cardDetails) {
        throw new Error(
          `Deck builder draft is missing card details for ${card.cardEntityId}.`,
        )
      }

      return {
        ...cardDetails,
        sectionKey: card.section as DeckSectionKey,
        quantity: card.quantity,
      }
    }),
  }
}

function buildCardDetailsByEntityId(
  draft: DeckBuilderDraft,
  input?: DeckBuilderDraftMutationInput,
): ReadonlyMap<string, Omit<DeckBuilderDraftCard, 'sectionKey' | 'quantity'>> {
  const cardDetailsByEntityId = new Map<
    string,
    Omit<DeckBuilderDraftCard, 'sectionKey' | 'quantity'>
  >()

  for (const card of draft.cards) {
    cardDetailsByEntityId.set(card.cardEntityId, {
      cardEntityId: card.cardEntityId,
      canonicalKey: card.canonicalKey,
      name: card.name,
      grade: card.grade,
      cardType: card.cardType,
      triggerType: card.triggerType,
    })
  }

  if (input?.card) {
    cardDetailsByEntityId.set(input.cardEntityId, {
      cardEntityId: input.cardEntityId,
      canonicalKey: input.card.canonicalKey,
      name: input.card.name,
      grade: input.card.grade,
      cardType: input.card.cardType,
      triggerType: input.card.triggerType,
    })
  }

  return cardDetailsByEntityId
}

function compareDraftCards(
  left: DeckBuilderDraftCard,
  right: DeckBuilderDraftCard,
): number {
  const leftKey = `${left.sectionKey}:${left.cardEntityId}`
  const rightKey = `${right.sectionKey}:${right.cardEntityId}`

  return leftKey.localeCompare(rightKey)
}

function compareDraftCardIdentity(
  left: {
    readonly sectionKey: DeckSectionKey
    readonly cardEntityId: string
    readonly quantity: number
  },
  right: {
    readonly sectionKey: DeckSectionKey
    readonly cardEntityId: string
    readonly quantity: number
  },
): number {
  const leftKey = `${left.sectionKey}:${left.cardEntityId}`
  const rightKey = `${right.sectionKey}:${right.cardEntityId}`

  return leftKey.localeCompare(rightKey)
}
