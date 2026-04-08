import type { Tables } from '../../generated/database.types'

import type {
  DeckCardRecord,
  DeckDetailCardRecord,
  DeckDetailRecord,
  DeckDetailSectionRecord,
  DeckDetailVersionRecord,
  DeckFormatRecord,
  DeckListItemRecord,
  DeckRecord,
  DeckSectionCountsRecord,
  DeckSectionKey,
  DeckVersionRecord,
} from './decks.types'

type DeckRow = Tables<{ schema: 'user_data' }, 'decks'>
type DeckVersionRow = Tables<{ schema: 'user_data' }, 'deck_versions'>
type FormatRow = Tables<{ schema: 'legality' }, 'formats'>
type CardEntityRow = Pick<
  Tables<{ schema: 'catalog' }, 'card_entities'>,
  'id' | 'canonical_key' | 'name' | 'grade' | 'card_type' | 'trigger_type'
>
type DeckCardRow = Pick<
  Tables<{ schema: 'user_data' }, 'deck_cards'>,
  'section_key' | 'card_entity_id' | 'quantity'
>
type DeckCardByVersionRow = Pick<
  Tables<{ schema: 'user_data' }, 'deck_cards'>,
  'deck_version_id' | 'section_key' | 'card_entity_id' | 'quantity'
>

export const deckSectionKeys = ['main', 'ride', 'g'] as const

const deckSectionOrder: Readonly<Record<DeckSectionKey, number>> = {
  main: 0,
  ride: 1,
  g: 2,
}

export function createEmptyDeckSectionCounts(): DeckSectionCountsRecord {
  return {
    main: 0,
    ride: 0,
    g: 0,
  }
}

export function mapDeckCardRow(row: DeckCardRow): DeckCardRecord {
  return {
    sectionKey: row.section_key,
    cardEntityId: row.card_entity_id,
    quantity: row.quantity,
  }
}

export function mapDeckVersionRow(
  row: DeckVersionRow,
  cards: readonly DeckCardRecord[],
): DeckVersionRecord {
  return {
    id: row.id,
    deckId: row.deck_id,
    versionNumber: row.version_number,
    createdByProfileId: row.created_by_profile_id,
    versionNote: row.version_note,
    createdAt: row.created_at,
    cards,
  }
}

export function mapDeckRow(
  row: DeckRow,
  currentVersion: DeckVersionRecord | null,
): DeckRecord {
  return {
    id: row.id,
    ownerProfileId: row.owner_profile_id,
    formatId: row.format_id,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentVersion,
  }
}

export function mapDeckFormatRow(row: FormatRow): DeckFormatRecord {
  return {
    id: row.id,
    displayName: row.display_name,
    description: row.description,
  }
}

export function createDeckSectionCounts(
  cards: readonly Pick<DeckCardByVersionRow, 'section_key' | 'quantity'>[],
): DeckSectionCountsRecord {
  const counts: {
    main: number
    ride: number
    g: number
  } = {
    main: 0,
    ride: 0,
    g: 0,
  }

  for (const card of cards) {
    if (card.section_key === 'main') {
      counts.main += card.quantity
      continue
    }

    if (card.section_key === 'ride') {
      counts.ride += card.quantity
      continue
    }

    if (card.section_key === 'g') {
      counts.g += card.quantity
    }
  }

  return counts
}

export function getTotalCards(sectionCounts: DeckSectionCountsRecord): number {
  return sectionCounts.main + sectionCounts.ride + sectionCounts.g
}

export function mapDeckDetailCardRow(
  row: Pick<
    DeckCardByVersionRow,
    'section_key' | 'card_entity_id' | 'quantity'
  >,
  cardEntity: CardEntityRow,
): DeckDetailCardRecord {
  return {
    sectionKey: row.section_key as DeckSectionKey,
    cardEntityId: row.card_entity_id,
    canonicalKey: cardEntity.canonical_key,
    name: cardEntity.name,
    grade: cardEntity.grade,
    cardType: cardEntity.card_type,
    triggerType: cardEntity.trigger_type,
    quantity: row.quantity,
  }
}

export function buildDeckSections(
  cards: readonly DeckDetailCardRecord[],
  sectionCounts: DeckSectionCountsRecord,
): readonly DeckDetailSectionRecord[] {
  return deckSectionKeys.map((sectionKey) => ({
    key: sectionKey,
    totalCards: sectionCounts[sectionKey],
    cards: cards
      .filter((card) => card.sectionKey === sectionKey)
      .sort((left, right) => {
        if (left.grade !== right.grade) {
          return left.grade - right.grade
        }

        return left.name.localeCompare(right.name)
      }),
  }))
}

export function mapDeckListItemRow(
  row: DeckRow,
  format: DeckFormatRecord,
  currentVersion: DeckVersionRow | null,
  sectionCounts: DeckSectionCountsRecord,
): DeckListItemRecord {
  return {
    id: row.id,
    ownerProfileId: row.owner_profile_id,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    format,
    currentVersionId: row.current_version_id,
    currentVersionNumber: currentVersion?.version_number ?? null,
    totalCards: getTotalCards(sectionCounts),
    sectionCounts,
  }
}

export function mapDeckDetailVersionRow(
  row: DeckVersionRow,
  cards: readonly DeckDetailCardRecord[],
): DeckDetailVersionRecord {
  const sortedCards = [...cards].sort((left, right) => {
    if (
      deckSectionOrder[left.sectionKey] !== deckSectionOrder[right.sectionKey]
    ) {
      return (
        deckSectionOrder[left.sectionKey] - deckSectionOrder[right.sectionKey]
      )
    }

    if (left.grade !== right.grade) {
      return left.grade - right.grade
    }

    return left.name.localeCompare(right.name)
  })

  const sectionCounts = createDeckSectionCounts(
    sortedCards.map((card) => ({
      section_key: card.sectionKey,
      quantity: card.quantity,
    })),
  )

  return {
    id: row.id,
    deckId: row.deck_id,
    versionNumber: row.version_number,
    createdByProfileId: row.created_by_profile_id,
    versionNote: row.version_note,
    createdAt: row.created_at,
    totalCards: getTotalCards(sectionCounts),
    sectionCounts,
    cards: sortedCards,
    sections: buildDeckSections(sortedCards, sectionCounts),
  }
}

export function mapDeckDetailRow(
  row: DeckRow,
  format: DeckFormatRecord,
  currentVersion: DeckDetailVersionRecord | null,
): DeckDetailRecord {
  return {
    id: row.id,
    ownerProfileId: row.owner_profile_id,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    format,
    currentVersionId: row.current_version_id,
    currentVersion,
  }
}
