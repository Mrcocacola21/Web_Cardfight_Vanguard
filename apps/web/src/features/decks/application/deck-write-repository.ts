import type { Deck } from '@web-vg/decks'
import type { DeckDetailRecord } from '@web-vg/db/repositories/decks'
import type { DeckSection } from '@web-vg/shared'

export type DeckVisibility = 'private' | 'unlisted' | 'public'

export interface StoredDeck {
  readonly deck: Deck
  readonly visibility: DeckVisibility
}

export type DeckWriteRepositoryResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: {
        readonly message: string
      }
    }

export interface CreateDeckRecordInput {
  readonly ownerProfileId: string
  readonly formatId: string
  readonly name: string
  readonly description: string | null
  readonly tags: readonly string[]
  readonly isFavorite: boolean
  readonly visibility?: DeckVisibility
  readonly cards: readonly {
    readonly section: DeckSection
    readonly cardEntityId: string
    readonly quantity: number
  }[]
}

export interface DeckWriteRepository {
  getOwnerProfileIdByAuthUserId(
    authUserId: string,
  ): Promise<DeckWriteRepositoryResult<string | null>>
  getDeckById(id: string): Promise<DeckWriteRepositoryResult<StoredDeck | null>>
  getDeckDetailById(
    id: string,
  ): Promise<DeckWriteRepositoryResult<DeckDetailRecord | null>>
  createDeck(
    input: CreateDeckRecordInput,
  ): Promise<DeckWriteRepositoryResult<{ readonly id: string }>>
  saveDeck(
    current: StoredDeck,
    nextDeck: Deck,
  ): Promise<DeckWriteRepositoryResult<void>>
  deleteDeck(id: string): Promise<DeckWriteRepositoryResult<void>>
}
