import type {
  CardId,
  DeckSection,
  DeckSectionState,
  DeckSnapshot,
  DeckSnapshotCompleteness,
  FormatId,
  UserId,
} from '@web-vg/shared'

import type {
  Deck,
  DeckCard,
  DeckTag,
  DeckVersion,
  DeckVersionId,
} from './deck'
import type { DeckId } from '@web-vg/shared'

const deckSectionOrder: Readonly<Record<DeckSection, number>> = {
  main: 0,
  ride: 1,
  g: 2,
}

export type DeckDomainErrorCode =
  | 'empty-name'
  | 'invalid-quantity'
  | 'invalid-max-quantity'
  | 'max-quantity-exceeded'
  | 'invalid-revision'

export class DeckDomainError extends Error {
  readonly code: DeckDomainErrorCode

  constructor(code: DeckDomainErrorCode, message: string) {
    super(message)
    this.name = 'DeckDomainError'
    this.code = code
  }
}

export interface CreateDeckVersionInput {
  readonly id: DeckVersionId
  readonly deckId: DeckId
  readonly formatId: FormatId
  readonly revision: number
  readonly createdAt: string
  readonly cards?: readonly DeckCard[]
  readonly completeness?: DeckSnapshotCompleteness
}

export interface CreateDeckInput {
  readonly id: DeckId
  readonly ownerId: UserId
  readonly formatId: FormatId
  readonly name: string
  readonly description?: string | null
  readonly tags?: readonly DeckTag[]
  readonly isFavorite?: boolean
  readonly createdAt: string
  readonly updatedAt?: string
  readonly currentVersionId: DeckVersionId
  readonly revision?: number
  readonly cards?: readonly DeckCard[]
  readonly completeness?: DeckSnapshotCompleteness
}

export interface DeckMutationOptions {
  readonly section?: DeckSection
  readonly updatedAt?: string
  readonly revision?: number
  readonly completeness?: DeckSnapshotCompleteness
  readonly maxQuantity?: number
}

export interface DeckSectionCounts {
  readonly main: number
  readonly ride: number
  readonly g: number
}

export function createDeckVersion(input: CreateDeckVersionInput): DeckVersion {
  const revision = normalizeRevision(input.revision)
  const cards = normalizeDeckCards(input.cards ?? [])

  return {
    id: input.id,
    deckId: input.deckId,
    revision,
    formatId: input.formatId,
    createdAt: input.createdAt,
    cards,
    snapshot: createDeckSnapshot({
      deckId: input.deckId,
      formatId: input.formatId,
      revision,
      completeness: input.completeness ?? 'complete',
      cards,
    }),
  }
}

export function createDeck(input: CreateDeckInput): Deck {
  const name = normalizeDeckName(input.name)
  const currentVersion = createDeckVersion({
    id: input.currentVersionId,
    deckId: input.id,
    formatId: input.formatId,
    revision: input.revision ?? 1,
    createdAt: input.createdAt,
    ...(input.cards ? { cards: input.cards } : {}),
    ...(input.completeness ? { completeness: input.completeness } : {}),
  })

  return {
    id: input.id,
    ownerId: input.ownerId,
    formatId: input.formatId,
    name,
    description: normalizeDescription(input.description),
    tags: normalizeDeckTags(input.tags),
    isFavorite: input.isFavorite ?? false,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt,
    currentVersion,
  }
}

export function renameDeck(deck: Deck, name: string, updatedAt?: string): Deck {
  return {
    ...deck,
    name: normalizeDeckName(name),
    updatedAt: updatedAt ?? deck.updatedAt,
  }
}

export function setDeckDescription(
  deck: Deck,
  description: string | null | undefined,
  updatedAt?: string,
): Deck {
  return {
    ...deck,
    description: normalizeDescription(description),
    updatedAt: updatedAt ?? deck.updatedAt,
  }
}

export function setDeckTags(
  deck: Deck,
  tags: readonly DeckTag[],
  updatedAt?: string,
): Deck {
  return {
    ...deck,
    tags: normalizeDeckTags(tags),
    updatedAt: updatedAt ?? deck.updatedAt,
  }
}

export function setDeckFavorite(
  deck: Deck,
  isFavorite: boolean,
  updatedAt?: string,
): Deck {
  return {
    ...deck,
    isFavorite,
    updatedAt: updatedAt ?? deck.updatedAt,
  }
}

export function addCard(
  deck: Deck,
  cardEntityId: CardId,
  quantity = 1,
  options?: DeckMutationOptions,
): Deck {
  assertPositiveQuantity(quantity)

  const section = options?.section ?? 'main'
  const nextQuantity =
    getDeckCardQuantity(deck, cardEntityId, section) + quantity

  return setCardCount(deck, cardEntityId, nextQuantity, {
    ...options,
    section,
  })
}

export function incrementCard(
  deck: Deck,
  cardEntityId: CardId,
  options?: DeckMutationOptions,
): Deck {
  return addCard(deck, cardEntityId, 1, options)
}

export function decrementCard(
  deck: Deck,
  cardEntityId: CardId,
  options?: DeckMutationOptions,
): Deck {
  const section = options?.section ?? 'main'
  const currentQuantity = getDeckCardQuantity(deck, cardEntityId, section)

  if (currentQuantity === 0) {
    return deck
  }

  return setCardCount(deck, cardEntityId, currentQuantity - 1, {
    ...options,
    section,
  })
}

export function setCardCount(
  deck: Deck,
  cardEntityId: CardId,
  quantity: number,
  options?: DeckMutationOptions,
): Deck {
  assertNonNegativeQuantity(quantity)
  assertValidMaxQuantity(options?.maxQuantity)

  if (options?.maxQuantity != null && quantity > options.maxQuantity) {
    throw new DeckDomainError(
      'max-quantity-exceeded',
      `Deck card quantity cannot exceed ${options.maxQuantity}.`,
    )
  }

  const section = options?.section ?? 'main'
  const nextCards = deck.currentVersion.cards.filter(
    (card) => !(card.section === section && card.cardEntityId === cardEntityId),
  )

  if (quantity > 0) {
    nextCards.push({
      section,
      cardEntityId,
      quantity,
    })
  }

  return replaceDeckCards(deck, nextCards, options)
}

export const updateQuantity = setCardCount

export function removeCard(
  deck: Deck,
  cardEntityId: CardId,
  options?: Omit<DeckMutationOptions, 'section'> & {
    readonly section?: DeckSection
  },
): Deck {
  const section = options?.section
  const nextCards = deck.currentVersion.cards.filter((card) => {
    if (card.cardEntityId !== cardEntityId) {
      return true
    }

    if (section) {
      return card.section !== section
    }

    return false
  })

  return replaceDeckCards(deck, nextCards, options)
}

export function clearDeck(deck: Deck, options?: DeckMutationOptions): Deck {
  return replaceDeckCards(deck, [], options)
}

export function listDeckCards(
  deck: Deck,
  section?: DeckSection,
): readonly DeckCard[] {
  if (!section) {
    return deck.currentVersion.cards
  }

  return deck.currentVersion.cards.filter((card) => card.section === section)
}

export function getDeckCardQuantity(
  deck: Deck,
  cardEntityId: CardId,
  section?: DeckSection,
): number {
  return deck.currentVersion.cards.reduce((total, card) => {
    if (card.cardEntityId !== cardEntityId) {
      return total
    }

    if (section && card.section !== section) {
      return total
    }

    return total + card.quantity
  }, 0)
}

export function getDeckSectionCounts(deck: Deck): DeckSectionCounts {
  return deck.currentVersion.cards.reduce<DeckSectionCounts>(
    (counts, card) => ({
      ...counts,
      [card.section]: counts[card.section] + card.quantity,
    }),
    {
      main: 0,
      ride: 0,
      g: 0,
    },
  )
}

export function getDeckTotalCards(deck: Deck): number {
  const sectionCounts = getDeckSectionCounts(deck)

  return sectionCounts.main + sectionCounts.ride + sectionCounts.g
}

export function toDeckSnapshot(deck: Deck): DeckSnapshot {
  return deck.currentVersion.snapshot
}

export function normalizeDeckCards(
  cards: readonly DeckCard[],
): readonly DeckCard[] {
  const mergedCards = new Map<string, DeckCard>()

  for (const card of cards) {
    assertPositiveQuantity(card.quantity)

    const key = `${card.section}:${String(card.cardEntityId)}`
    const existingCard = mergedCards.get(key)

    mergedCards.set(key, {
      section: card.section,
      cardEntityId: card.cardEntityId,
      quantity: (existingCard?.quantity ?? 0) + card.quantity,
    })
  }

  return Array.from(mergedCards.values()).sort(compareDeckCards)
}

function replaceDeckCards(
  deck: Deck,
  cards: readonly DeckCard[],
  options?: DeckMutationOptions,
): Deck {
  const nextVersion = createDeckVersion({
    id: deck.currentVersion.id,
    deckId: deck.id,
    formatId: deck.formatId,
    revision: options?.revision ?? deck.currentVersion.revision,
    createdAt: deck.currentVersion.createdAt,
    cards,
    completeness:
      options?.completeness ?? deck.currentVersion.snapshot.completeness,
  })

  return {
    ...deck,
    updatedAt: options?.updatedAt ?? deck.updatedAt,
    currentVersion: nextVersion,
  }
}

function createDeckSnapshot(input: {
  readonly deckId: DeckId
  readonly formatId: FormatId
  readonly revision: number
  readonly completeness: DeckSnapshotCompleteness
  readonly cards: readonly DeckCard[]
}): DeckSnapshot {
  return {
    deckId: input.deckId,
    formatId: input.formatId,
    revision: input.revision,
    completeness: input.completeness,
    sections: buildDeckSectionStates(input.cards),
  }
}

function buildDeckSectionStates(
  cards: readonly DeckCard[],
): readonly DeckSectionState[] {
  const sectionMap = new Map<DeckSection, DeckCard[]>()

  for (const card of cards) {
    const sectionCards = sectionMap.get(card.section)

    if (sectionCards) {
      sectionCards.push(card)
      continue
    }

    sectionMap.set(card.section, [card])
  }

  return Array.from(sectionMap.entries())
    .sort(([leftSection], [rightSection]) => {
      return deckSectionOrder[leftSection] - deckSectionOrder[rightSection]
    })
    .map(([section, sectionCards]) => ({
      section,
      entries: sectionCards
        .slice()
        .sort(compareDeckCards)
        .map((card) => ({
          cardId: card.cardEntityId,
          count: card.quantity,
        })),
    }))
}

function normalizeDeckName(name: string): string {
  const trimmedName = name.trim()

  if (trimmedName.length === 0) {
    throw new DeckDomainError(
      'empty-name',
      'Deck name must contain at least one non-space character.',
    )
  }

  return trimmedName
}

function normalizeDescription(
  description: string | null | undefined,
): string | null {
  if (description == null) {
    return null
  }

  const trimmedDescription = description.trim()

  return trimmedDescription.length === 0 ? null : trimmedDescription
}

function normalizeDeckTags(
  tags: readonly DeckTag[] | undefined,
): readonly DeckTag[] {
  if (!tags || tags.length === 0) {
    return []
  }

  const normalizedTags = Array.from(
    new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
  )

  return normalizedTags
}

function normalizeRevision(revision: number): number {
  if (!Number.isInteger(revision) || revision <= 0) {
    throw new DeckDomainError(
      'invalid-revision',
      'Deck revision must be a positive integer.',
    )
  }

  return revision
}

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DeckDomainError(
      'invalid-quantity',
      'Deck card quantity must be a positive integer.',
    )
  }
}

function assertNonNegativeQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new DeckDomainError(
      'invalid-quantity',
      'Deck card quantity must be a non-negative integer.',
    )
  }
}

function assertValidMaxQuantity(maxQuantity: number | undefined): void {
  if (
    maxQuantity != null &&
    (!Number.isInteger(maxQuantity) || maxQuantity <= 0)
  ) {
    throw new DeckDomainError(
      'invalid-max-quantity',
      'Deck max quantity must be a positive integer when provided.',
    )
  }
}

function compareDeckCards(left: DeckCard, right: DeckCard): number {
  if (left.section !== right.section) {
    return deckSectionOrder[left.section] - deckSectionOrder[right.section]
  }

  return String(left.cardEntityId).localeCompare(String(right.cardEntityId))
}
