import type { DeckId, FormatId } from './identifiers'
import type { CardId } from './identifiers'
import type { DeckSection } from './format-contracts'

export type DeckSnapshotCompleteness = 'complete' | 'incomplete'

export interface DeckEntry {
  readonly cardId: CardId
  readonly count: number
}

export interface DeckSectionState {
  readonly section: DeckSection
  readonly entries: readonly DeckEntry[]
}

export interface DeckSnapshot {
  readonly deckId: DeckId
  readonly formatId: FormatId
  readonly revision: number
  readonly completeness: DeckSnapshotCompleteness
  readonly sections: readonly DeckSectionState[]
}
