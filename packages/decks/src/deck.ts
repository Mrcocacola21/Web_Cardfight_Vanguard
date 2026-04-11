import type {
  Brand,
  CardId,
  DeckId,
  DeckSection,
  DeckSnapshot,
  FormatId,
  UserId,
} from '@web-vg/shared'

export type DeckTag = string
export type DeckVersionId = Brand<string, 'DeckVersionId'>

export interface DeckCard {
  readonly section: DeckSection
  readonly cardEntityId: CardId
  readonly quantity: number
}

export interface DeckVersion {
  readonly id: DeckVersionId
  readonly deckId: DeckId
  readonly revision: number
  readonly formatId: FormatId
  readonly createdAt: string
  readonly cards: readonly DeckCard[]
  readonly snapshot: DeckSnapshot
}

export interface Deck {
  readonly id: DeckId
  readonly ownerId: UserId
  readonly formatId: FormatId
  readonly name: string
  readonly description: string | null
  readonly tags: readonly DeckTag[]
  readonly isFavorite: boolean
  readonly createdAt: string
  readonly updatedAt: string
  readonly currentVersion: DeckVersion
}

export type { DeckSection, DeckSnapshot }
