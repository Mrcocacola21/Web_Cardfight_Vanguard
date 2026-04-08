export type DeckSectionKey = 'main' | 'ride' | 'g'

export interface DeckFormatRecord {
  readonly id: string
  readonly displayName: string
  readonly description: string | null
}

export interface DeckSectionCountsRecord {
  readonly main: number
  readonly ride: number
  readonly g: number
}

export interface DeckCardRecord {
  readonly sectionKey: string
  readonly cardEntityId: string
  readonly quantity: number
}

export interface DeckVersionRecord {
  readonly id: string
  readonly deckId: string
  readonly versionNumber: number
  readonly createdByProfileId: string
  readonly versionNote: string | null
  readonly createdAt: string
  readonly cards: readonly DeckCardRecord[]
}

export interface DeckRecord {
  readonly id: string
  readonly ownerProfileId: string
  readonly formatId: string
  readonly title: string
  readonly description: string | null
  readonly visibility: string
  readonly archivedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly currentVersion: DeckVersionRecord | null
}

export interface DeckListItemRecord {
  readonly id: string
  readonly ownerProfileId: string
  readonly title: string
  readonly description: string | null
  readonly visibility: string
  readonly archivedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly format: DeckFormatRecord
  readonly currentVersionId: string | null
  readonly currentVersionNumber: number | null
  readonly totalCards: number
  readonly sectionCounts: DeckSectionCountsRecord
}

export interface DeckDetailCardRecord {
  readonly sectionKey: DeckSectionKey
  readonly cardEntityId: string
  readonly canonicalKey: string
  readonly name: string
  readonly grade: number
  readonly cardType: string
  readonly triggerType: string | null
  readonly quantity: number
}

export interface DeckDetailSectionRecord {
  readonly key: DeckSectionKey
  readonly totalCards: number
  readonly cards: readonly DeckDetailCardRecord[]
}

export interface DeckDetailVersionRecord {
  readonly id: string
  readonly deckId: string
  readonly versionNumber: number
  readonly createdByProfileId: string
  readonly versionNote: string | null
  readonly createdAt: string
  readonly totalCards: number
  readonly sectionCounts: DeckSectionCountsRecord
  readonly cards: readonly DeckDetailCardRecord[]
  readonly sections: readonly DeckDetailSectionRecord[]
}

export interface DeckDetailRecord {
  readonly id: string
  readonly ownerProfileId: string
  readonly title: string
  readonly description: string | null
  readonly visibility: string
  readonly archivedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly format: DeckFormatRecord
  readonly currentVersionId: string | null
  readonly currentVersion: DeckDetailVersionRecord | null
}

export interface CreateDeckCardInput {
  readonly sectionKey: string
  readonly cardEntityId: string
  readonly quantity: number
}

export interface CreateDeckInput {
  readonly ownerProfileId: string
  readonly formatId: string
  readonly title: string
  readonly description?: string | null
  readonly visibility?: 'private' | 'unlisted' | 'public'
  readonly versionNote?: string | null
  readonly cards?: readonly CreateDeckCardInput[]
}
