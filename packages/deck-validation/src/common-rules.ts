import type { DeckCard } from '@web-vg/decks'
import type {
  CardId,
  DeckSection,
  DeckSectionState,
  FormatId,
} from '@web-vg/shared'

import type {
  DeckValidationIssue,
  DeckValidationTarget,
  DeckValidator,
} from './contracts'

const commonMainDeckSize = 50
const commonMaxCopiesPerCard = 4

const deckSectionOrder: Readonly<Record<DeckSection, number>> = {
  main: 0,
  ride: 1,
  g: 2,
}

export const requireDeckFormatValidator: DeckValidator = {
  id: 'require-deck-format',
  validate: ({ deck }) => {
    if (hasNonEmptyValue(deck.formatId)) {
      return []
    }

    return [
      {
        severity: 'error',
        category: 'format',
        code: 'missing-format',
        message:
          'Deck must declare a format before validation can evaluate it.',
        target: {
          type: 'format',
          field: 'formatId',
          formatId: null,
        },
      },
    ]
  },
}

export const validateDeckEntryShapeValidator: DeckValidator = {
  id: 'validate-deck-entry-shape',
  validate: ({ deck }) => {
    const issues: DeckValidationIssue[] = []

    for (const card of deck.currentVersion.cards) {
      const section = getSectionValue(card.section)
      const cardEntityId = getCardEntityId(card.cardEntityId)

      if (!hasNonEmptyValue(cardEntityId)) {
        issues.push({
          severity: 'error',
          category: 'card',
          code: 'missing-card-entity-id',
          message: `Deck entry in section "${section}" must reference a canonical card entity id.`,
          target: createCardTarget(cardEntityId, section),
        })
      }

      if (!isDeckSection(section)) {
        issues.push({
          severity: 'error',
          category: 'section',
          code: 'invalid-card-section',
          message: `Deck entry section "${section}" is not a supported deck section.`,
          target: {
            type: 'section',
            section: section as DeckSection | (string & {}),
          },
        })
      }

      if (!isPositiveInteger(card.quantity)) {
        issues.push({
          severity: 'error',
          category: 'card',
          code: 'invalid-card-quantity',
          message: `Deck entry quantity for ${cardEntityId} must be a positive integer.`,
          target: createCardTarget(cardEntityId, section),
        })
      }
    }

    return issues
  },
}

export const validateDuplicateDeckEntriesValidator: DeckValidator = {
  id: 'validate-deck-duplicates',
  validate: ({ deck }) => {
    const duplicateEntries = new Map<
      string,
      {
        section: string
        cardEntityId: CardId
        rowCount: number
      }
    >()

    for (const card of deck.currentVersion.cards) {
      const section = getSectionValue(card.section)
      const cardEntityId = getCardEntityId(card.cardEntityId)
      const key = buildDeckCardKey(section, cardEntityId)
      const existingEntry = duplicateEntries.get(key)

      if (existingEntry) {
        duplicateEntries.set(key, {
          ...existingEntry,
          rowCount: existingEntry.rowCount + 1,
        })
        continue
      }

      duplicateEntries.set(key, {
        section,
        cardEntityId,
        rowCount: 1,
      })
    }

    return Array.from(duplicateEntries.values())
      .filter((entry) => entry.rowCount > 1)
      .sort(compareDuplicateEntries)
      .map<DeckValidationIssue>((entry) => ({
        severity: 'error',
        category: 'card',
        code: 'duplicate-card-entry',
        message: `Deck contains duplicate rows for ${entry.cardEntityId} in section ${entry.section}.`,
        target: createCardTarget(entry.cardEntityId, entry.section),
      }))
  },
}

export const validateDeckSizeValidator: DeckValidator = {
  id: 'validate-deck-size',
  validate: ({ deck }) => {
    const issues: DeckValidationIssue[] = []
    const totalCards = countPositiveCards(deck.currentVersion.cards)

    if (totalCards === 0) {
      issues.push({
        severity: 'error',
        category: 'deck',
        code: 'empty-deck',
        message:
          'Deck must contain at least one card before validation can succeed.',
        target: createDeckTarget(deck.id),
      })

      return issues
    }

    const mainDeckSize = countPositiveCardsInSection(
      deck.currentVersion.cards,
      'main',
    )

    if (mainDeckSize < commonMainDeckSize) {
      issues.push({
        severity: 'error',
        category: 'section',
        code: 'main-deck-too-small',
        message: `Main deck contains ${mainDeckSize} cards, but the common validation baseline requires ${commonMainDeckSize}.`,
        target: {
          type: 'section',
          section: 'main',
        },
      })
    }

    if (mainDeckSize > commonMainDeckSize) {
      issues.push({
        severity: 'error',
        category: 'section',
        code: 'main-deck-too-large',
        message: `Main deck contains ${mainDeckSize} cards, but the common validation baseline allows only ${commonMainDeckSize}.`,
        target: {
          type: 'section',
          section: 'main',
        },
      })
    }

    return issues
  },
}

export const validateCopyLimitsValidator: DeckValidator = {
  id: 'validate-copy-limits',
  validate: ({ deck }) => {
    const copiesByCardEntityId = new Map<CardId, number>()

    for (const card of deck.currentVersion.cards) {
      if (card.section !== 'main') {
        continue
      }

      const cardEntityId = getCardEntityId(card.cardEntityId)

      if (
        !hasNonEmptyValue(cardEntityId) ||
        !isPositiveInteger(card.quantity)
      ) {
        continue
      }

      copiesByCardEntityId.set(
        cardEntityId,
        (copiesByCardEntityId.get(cardEntityId) ?? 0) + card.quantity,
      )
    }

    return Array.from(copiesByCardEntityId.entries())
      .filter(([, quantity]) => quantity > commonMaxCopiesPerCard)
      .sort(([leftCardId], [rightCardId]) =>
        String(leftCardId).localeCompare(String(rightCardId)),
      )
      .map<DeckValidationIssue>(([cardEntityId, quantity]) => ({
        severity: 'error',
        category: 'card',
        code: 'copy-limit-exceeded',
        message: `Main deck contains ${quantity} copies of ${cardEntityId}, but the common validation baseline allows only ${commonMaxCopiesPerCard}.`,
        target: {
          type: 'card',
          cardEntityId,
          section: 'main',
        },
      }))
  },
}

export const validateDeckConsistencyValidator: DeckValidator = {
  id: 'validate-deck-consistency',
  validate: ({ deck }) => {
    const issues: DeckValidationIssue[] = []
    const snapshot = deck.currentVersion.snapshot

    if (deck.currentVersion.deckId !== deck.id) {
      issues.push({
        severity: 'error',
        category: 'deck',
        code: 'deck-version-deck-mismatch',
        message: 'Deck current version must point back to the same deck id.',
        target: createDeckTarget(deck.id),
      })
    }

    if (deck.currentVersion.formatId !== deck.formatId) {
      issues.push({
        severity: 'error',
        category: 'format',
        code: 'deck-version-format-mismatch',
        message: 'Deck current version format must match deck metadata format.',
        target: {
          type: 'format',
          field: 'formatId',
          formatId: normalizeFormatId(deck.formatId),
        },
      })
    }

    if (snapshot.deckId !== deck.id) {
      issues.push({
        severity: 'error',
        category: 'deck',
        code: 'snapshot-deck-mismatch',
        message:
          'Deck snapshot must reference the same deck id as the aggregate.',
        target: createDeckTarget(deck.id),
      })
    }

    if (snapshot.formatId !== deck.formatId) {
      issues.push({
        severity: 'error',
        category: 'format',
        code: 'snapshot-format-mismatch',
        message: 'Deck snapshot format must match deck metadata format.',
        target: {
          type: 'format',
          field: 'formatId',
          formatId: normalizeFormatId(deck.formatId),
        },
      })
    }

    if (snapshot.revision !== deck.currentVersion.revision) {
      issues.push({
        severity: 'error',
        category: 'deck',
        code: 'snapshot-revision-mismatch',
        message:
          'Deck snapshot revision must match the current deck version revision.',
        target: createDeckTarget(deck.id),
      })
    }

    const currentCardRows = aggregateDeckCards(deck.currentVersion.cards)
    const snapshotCardRows = aggregateSnapshotSections(snapshot.sections)

    if (!areAggregatedRowsEqual(currentCardRows, snapshotCardRows)) {
      issues.push({
        severity: 'error',
        category: 'deck',
        code: 'snapshot-card-mismatch',
        message:
          'Deck snapshot card composition must match the current deck version cards.',
        target: createDeckTarget(deck.id),
      })
    }

    return issues
  },
}

export const commonDeckValidators: readonly DeckValidator[] = [
  requireDeckFormatValidator,
  validateDeckEntryShapeValidator,
  validateDuplicateDeckEntriesValidator,
  validateDeckSizeValidator,
  validateCopyLimitsValidator,
  validateDeckConsistencyValidator,
]

interface AggregatedDeckRow {
  readonly section: string
  readonly cardEntityId: string
  readonly quantity: number
}

function createDeckTarget(deckId: string): DeckValidationTarget {
  return {
    type: 'deck',
    deckId: deckId as never,
  }
}

function createCardTarget(
  cardEntityId: CardId,
  section: string,
): DeckValidationTarget {
  return isDeckSection(section)
    ? {
        type: 'card',
        cardEntityId,
        section,
      }
    : {
        type: 'card',
        cardEntityId,
        section: section as DeckSection | (string & {}),
      }
}

function aggregateDeckCards(
  cards: readonly DeckCard[],
): readonly AggregatedDeckRow[] {
  const rows = new Map<string, AggregatedDeckRow>()

  for (const card of cards) {
    const section = getSectionValue(card.section)
    const cardEntityId = String(card.cardEntityId)
    const key = buildDeckCardKey(section, cardEntityId)
    const existingRow = rows.get(key)

    rows.set(key, {
      section,
      cardEntityId,
      quantity: (existingRow?.quantity ?? 0) + card.quantity,
    })
  }

  return Array.from(rows.values()).sort(compareAggregatedRows)
}

function countPositiveCards(cards: readonly DeckCard[]): number {
  return cards.reduce((total, card) => {
    return total + (isPositiveInteger(card.quantity) ? card.quantity : 0)
  }, 0)
}

function countPositiveCardsInSection(
  cards: readonly DeckCard[],
  section: DeckSection,
): number {
  return cards.reduce((total, card) => {
    if (card.section !== section || !isPositiveInteger(card.quantity)) {
      return total
    }

    return total + card.quantity
  }, 0)
}

function aggregateSnapshotSections(
  sections: readonly DeckSectionState[],
): readonly AggregatedDeckRow[] {
  const rows = new Map<string, AggregatedDeckRow>()

  for (const sectionState of sections) {
    const section = getSectionValue(sectionState.section)

    for (const entry of sectionState.entries) {
      const cardEntityId = String(entry.cardId)
      const key = buildDeckCardKey(section, cardEntityId)
      const existingRow = rows.get(key)

      rows.set(key, {
        section,
        cardEntityId,
        quantity: (existingRow?.quantity ?? 0) + entry.count,
      })
    }
  }

  return Array.from(rows.values()).sort(compareAggregatedRows)
}

function areAggregatedRowsEqual(
  left: readonly AggregatedDeckRow[],
  right: readonly AggregatedDeckRow[],
): boolean {
  if (left.length !== right.length) {
    return false
  }

  for (const [index, row] of left.entries()) {
    const otherRow = right[index]

    if (
      row.section !== otherRow?.section ||
      row.cardEntityId !== otherRow.cardEntityId ||
      row.quantity !== otherRow.quantity
    ) {
      return false
    }
  }

  return true
}

function compareDuplicateEntries(
  left: {
    readonly section: string
    readonly cardEntityId: CardId
  },
  right: {
    readonly section: string
    readonly cardEntityId: CardId
  },
): number {
  return compareSectionAndCard(
    left.section,
    String(left.cardEntityId),
    right.section,
    String(right.cardEntityId),
  )
}

function compareAggregatedRows(
  left: AggregatedDeckRow,
  right: AggregatedDeckRow,
): number {
  return compareSectionAndCard(
    left.section,
    left.cardEntityId,
    right.section,
    right.cardEntityId,
  )
}

function compareSectionAndCard(
  leftSection: string,
  leftCardEntityId: string,
  rightSection: string,
  rightCardEntityId: string,
): number {
  const leftSectionOrder = getSectionOrder(leftSection)
  const rightSectionOrder = getSectionOrder(rightSection)

  if (leftSectionOrder !== rightSectionOrder) {
    return leftSectionOrder - rightSectionOrder
  }

  if (leftSection !== rightSection) {
    return leftSection.localeCompare(rightSection)
  }

  return leftCardEntityId.localeCompare(rightCardEntityId)
}

function getSectionOrder(section: string): number {
  return isDeckSection(section)
    ? deckSectionOrder[section]
    : Number.MAX_SAFE_INTEGER
}

function buildDeckCardKey(section: string, cardEntityId: string): string {
  return `${section}:${cardEntityId}`
}

function hasNonEmptyValue(value: string): boolean {
  return value.trim().length > 0
}

function normalizeFormatId(formatId: FormatId): FormatId | null {
  return hasNonEmptyValue(formatId) ? formatId : null
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

function isDeckSection(value: string): value is DeckSection {
  return value === 'main' || value === 'ride' || value === 'g'
}

function getSectionValue(section: string): string {
  return String(section)
}

function getCardEntityId(cardEntityId: CardId | string): CardId {
  return String(cardEntityId) as CardId
}
