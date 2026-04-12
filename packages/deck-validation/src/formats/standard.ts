import type { DeckCard } from '@web-vg/decks'
import type { CardId, CardType, DeckSection, Grade } from '@web-vg/shared'
import { getDeckSectionConstraint } from '@web-vg/shared'

import type {
  DeckValidationCardFacts,
  DeckValidationIssue,
  DeckValidationTarget,
  DeckValidator,
} from '../contracts'
import { createFormatSectionValidator } from './shared'

const standardRideDeckBaselineSize = 4
const standardRideDeckBaselineGrades = [
  0, 1, 2, 3,
] as const satisfies readonly Grade[]
const standardRideDeckAllowedCardTypes = new Set<CardType>([
  'normal-unit',
  'trigger-unit',
])

export const validateStandardCardFactsValidator: DeckValidator = {
  id: 'validate-standard-card-facts',
  validate: ({ deck, context }) => {
    const relevantCards = getStandardRelevantCards(deck.currentVersion.cards)

    if (relevantCards.length === 0) {
      return []
    }

    const cardFacts = context?.cardFacts

    if (cardFacts && cardFacts.size > 0) {
      return []
    }

    return [
      {
        severity: 'error',
        category: 'input',
        code: 'standard-card-facts-missing',
        message:
          'Standard validation requires catalog card facts for ride deck and nation checks.',
        target: createDeckTarget(deck.id),
      },
    ]
  },
}

export const validateStandardRideDeckValidator: DeckValidator = {
  id: 'validate-standard-ride-deck',
  validate: ({ deck, context }) => {
    const issues: DeckValidationIssue[] = []
    const rideCards = getStandardRelevantCards(
      deck.currentVersion.cards,
      'ride',
    )
    const rideDeckSize = countCardQuantity(rideCards)
    const expectedRideDeckSize = getExpectedStandardRideDeckSize(context)

    if (rideDeckSize === 0) {
      issues.push({
        severity: 'error',
        category: 'section',
        code: 'standard-ride-deck-missing',
        message:
          'Standard decks must contain a ride deck with the baseline grade 0, 1, 2, and 3 line.',
        target: createSectionTarget('ride'),
      })

      return issues
    }

    if (rideDeckSize !== expectedRideDeckSize) {
      issues.push({
        severity: 'error',
        category: 'section',
        code: 'standard-ride-deck-size-invalid',
        message: `Standard ride deck contains ${rideDeckSize} cards, but the baseline Standard validation requires exactly ${expectedRideDeckSize}.`,
        target: createSectionTarget('ride'),
      })
    }

    const cardFacts = context?.cardFacts

    if (!cardFacts || cardFacts.size === 0) {
      return issues
    }

    const gradeCounts = new Map<Grade, number>()
    let canEvaluateGradeSequence = rideDeckSize === expectedRideDeckSize

    for (const card of sortCardsByEntityId(rideCards)) {
      const facts = cardFacts.get(card.cardEntityId)

      if (!facts || facts.grade == null || facts.cardType == null) {
        canEvaluateGradeSequence = false
        issues.push({
          severity: 'error',
          category: 'input',
          code: 'standard-ride-deck-card-metadata-missing',
          message: `Standard ride deck validation requires ${describeMissingRideDeckFields(facts)} for ${String(card.cardEntityId)}.`,
          target: createCardTarget(card.cardEntityId, 'ride'),
        })
        continue
      }

      if (!standardRideDeckAllowedCardTypes.has(facts.cardType)) {
        issues.push({
          severity: 'error',
          category: 'card',
          code: 'standard-ride-deck-card-type-invalid',
          message: `Standard ride deck card ${String(card.cardEntityId)} must be a unit card, but card type is ${facts.cardType}.`,
          target: createCardTarget(card.cardEntityId, 'ride'),
        })
      }

      gradeCounts.set(
        facts.grade,
        (gradeCounts.get(facts.grade) ?? 0) + card.quantity,
      )
    }

    if (
      canEvaluateGradeSequence &&
      !hasBaselineStandardRideDeckGradeSequence(gradeCounts)
    ) {
      issues.push({
        severity: 'error',
        category: 'section',
        code: 'standard-ride-deck-grade-sequence-invalid',
        message:
          'Standard ride deck must contain exactly one card each for grades 0, 1, 2, and 3.',
        target: createSectionTarget('ride'),
      })
    }

    return issues
  },
}

export const validateStandardNationConstraintsValidator: DeckValidator = {
  id: 'validate-standard-nation-constraints',
  validate: ({ deck, context }) => {
    const cardFacts = context?.cardFacts

    if (!cardFacts || cardFacts.size === 0) {
      return []
    }

    const issues: DeckValidationIssue[] = []
    const relevantCards = getStandardRelevantCards(deck.currentVersion.cards)
    const cardsWithNation: {
      readonly card: DeckCard
      readonly facts: DeckValidationCardFacts
    }[] = []

    for (const card of sortCardsForStandardNationAnchor(
      relevantCards,
      cardFacts,
    )) {
      const facts = cardFacts.get(card.cardEntityId)

      if (
        !facts ||
        facts.nation == null ||
        !hasNonEmptyValue(String(facts.nation))
      ) {
        issues.push({
          severity: 'error',
          category: 'input',
          code: 'standard-card-nation-missing',
          message: `Standard nation validation requires nation facts for ${String(card.cardEntityId)}.`,
          target: createCardTarget(card.cardEntityId, card.section),
        })
        continue
      }

      cardsWithNation.push({
        card,
        facts,
      })
    }

    const anchorCard = cardsWithNation[0]

    if (!anchorCard) {
      return issues
    }

    for (const entry of cardsWithNation.slice(1)) {
      if (entry.facts.nation === anchorCard.facts.nation) {
        continue
      }

      issues.push({
        severity: 'error',
        category: 'card',
        code: 'standard-nation-mismatch',
        message: `Standard deck nation is ${String(anchorCard.facts.nation)}, but ${String(entry.card.cardEntityId)} belongs to ${String(entry.facts.nation)}.`,
        target: createCardTarget(entry.card.cardEntityId, entry.card.section),
      })
    }

    return issues
  },
}

export const standardValidators: readonly DeckValidator[] = [
  createFormatSectionValidator({
    id: 'validate-standard-sections',
    formatId: 'standard',
    allowedSections: ['main', 'ride'],
  }),
  validateStandardCardFactsValidator,
  validateStandardRideDeckValidator,
  validateStandardNationConstraintsValidator,
]

function getExpectedStandardRideDeckSize(
  context:
    | {
        readonly format?: {
          readonly profile?: {
            readonly deckStructure: readonly {
              readonly section: DeckSection
              readonly minCards: number
              readonly maxCards: number
              readonly required: boolean
            }[]
          }
        }
      }
    | undefined,
): number {
  const rideConstraint = context?.format?.profile
    ? getDeckSectionConstraint(context.format.profile as never, 'ride')
    : undefined

  if (
    rideConstraint &&
    rideConstraint.required &&
    rideConstraint.minCards === rideConstraint.maxCards &&
    rideConstraint.maxCards > 0
  ) {
    return rideConstraint.maxCards
  }

  return standardRideDeckBaselineSize
}

function hasBaselineStandardRideDeckGradeSequence(
  gradeCounts: ReadonlyMap<Grade, number>,
): boolean {
  if (gradeCounts.size !== standardRideDeckBaselineGrades.length) {
    return false
  }

  return standardRideDeckBaselineGrades.every((grade) => {
    return gradeCounts.get(grade) === 1
  })
}

function sortCardsByEntityId(cards: readonly DeckCard[]): readonly DeckCard[] {
  return cards
    .slice()
    .sort((left, right) =>
      String(left.cardEntityId).localeCompare(String(right.cardEntityId)),
    )
}

function sortCardsForStandardNationAnchor(
  cards: readonly DeckCard[],
  cardFacts: ReadonlyMap<CardId, DeckValidationCardFacts>,
): readonly DeckCard[] {
  return cards.slice().sort((left, right) => {
    const leftSectionOrder = getStandardSectionOrder(left.section)
    const rightSectionOrder = getStandardSectionOrder(right.section)

    if (leftSectionOrder !== rightSectionOrder) {
      return leftSectionOrder - rightSectionOrder
    }

    const leftGrade =
      cardFacts.get(left.cardEntityId)?.grade ?? Number.MAX_SAFE_INTEGER
    const rightGrade =
      cardFacts.get(right.cardEntityId)?.grade ?? Number.MAX_SAFE_INTEGER

    if (leftGrade !== rightGrade) {
      return leftGrade - rightGrade
    }

    return String(left.cardEntityId).localeCompare(String(right.cardEntityId))
  })
}

function countCardQuantity(cards: readonly DeckCard[]): number {
  return cards.reduce((total, card) => total + card.quantity, 0)
}

function getStandardRelevantCards(
  cards: readonly DeckCard[],
  section?: 'main' | 'ride',
): readonly DeckCard[] {
  return cards.filter((card) => {
    if (
      !isPositiveInteger(card.quantity) ||
      !hasNonEmptyValue(String(card.cardEntityId))
    ) {
      return false
    }

    if (section) {
      return card.section === section
    }

    return card.section === 'main' || card.section === 'ride'
  })
}

function describeMissingRideDeckFields(
  facts: DeckValidationCardFacts | undefined,
): string {
  const missingFields: string[] = []

  if (!facts || facts.grade == null) {
    missingFields.push('grade facts')
  }

  if (!facts || facts.cardType == null) {
    missingFields.push('card type facts')
  }

  return missingFields.join(' and ')
}

function createDeckTarget(deckId: string): DeckValidationTarget {
  return {
    type: 'deck',
    deckId: deckId as never,
  }
}

function createSectionTarget(section: DeckSection): DeckValidationTarget {
  return {
    type: 'section',
    section,
  }
}

function createCardTarget(
  cardEntityId: CardId,
  section: DeckSection,
): DeckValidationTarget {
  return {
    type: 'card',
    cardEntityId,
    section,
  }
}

function getStandardSectionOrder(section: DeckSection): number {
  return section === 'ride' ? 0 : 1
}

function hasNonEmptyValue(value: string): boolean {
  return value.trim().length > 0
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}
