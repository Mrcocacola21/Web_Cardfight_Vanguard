import type {
  DeckEntry,
  DeckId,
  DeckSection,
  DeckSectionState,
  DeckSnapshot,
  FormatId,
  UserId,
} from '@web-vg/shared'

export interface DeckStructure {
  readonly sections: readonly DeckSectionState[]
}

export interface DeckVersion {
  readonly deckId: DeckId
  readonly revision: number
  readonly formatId: FormatId
  readonly structure: DeckStructure
  readonly snapshot: DeckSnapshot
}

export interface Deck {
  readonly id: DeckId
  readonly ownerUserId: UserId
  readonly name: string
  readonly currentFormatId: FormatId
  readonly versions: readonly DeckVersion[]
}

export type { DeckEntry, DeckSection, DeckSnapshot }
