import type { DeckCard } from '@web-vg/decks'
import { getDeckSectionConstraint } from '@web-vg/shared'
import type { CardId, DeckId, DeckSection, FormatId } from '@web-vg/shared'

import type {
  DeckValidationIssue,
  DeckValidationTarget,
  DeckValidator,
} from '../contracts'
import {
  validateCopyLimitsValidator,
  validateDeckSizeValidator,
} from '../format-baseline-rules'
import { createFormatSectionValidator } from './shared'

const premiumFormatId = 'premium' as FormatId
const premiumDefaultGDeckMaxCards = 16

export const validatePremiumCardFactsValidator: DeckValidator = {
  id: 'validate-premium-card-facts',
  validate: ({ deck, context }) => {
    const relevantCards = getPremiumRelevantCards(deck.currentVersion.cards)

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
        code: 'premium-card-facts-missing',
        message:
          'Premium validation requires prepared card facts for G deck qualification and baseline legality checks.',
        target: createDeckTarget(deck.id),
      },
    ]
  },
}

export const validatePremiumGDeckStructureValidator: DeckValidator = {
  id: 'validate-premium-g-deck-structure',
  validate: ({ deck, context }) => {
    const issues: DeckValidationIssue[] = []
    const gDeckCards = getPremiumRelevantCards(deck.currentVersion.cards, 'g')
    const gDeckSize = countCardQuantity(gDeckCards)
    const gDeckConstraint = getPremiumGDeckConstraint(context)

    if (
      gDeckSize === 0 &&
      gDeckConstraint.required &&
      gDeckConstraint.minCards > 0
    ) {
      issues.push({
        severity: 'error',
        category: 'section',
        code: 'premium-g-deck-missing',
        message:
          'Premium deck is missing the required G deck for the supplied format profile.',
        target: createSectionTarget('g'),
      })

      return issues
    }

    if (
      gDeckSize > gDeckConstraint.maxCards ||
      (gDeckSize > 0 && gDeckSize < gDeckConstraint.minCards)
    ) {
      issues.push({
        severity: 'error',
        category: 'section',
        code: 'premium-g-deck-size-invalid',
        message: `Premium G deck contains ${gDeckSize} cards, but the supplied Premium baseline allows ${gDeckConstraint.minCards} to ${gDeckConstraint.maxCards}.`,
        target: createSectionTarget('g'),
      })
    }

    return issues
  },
}

export const validatePremiumSectionQualificationValidator: DeckValidator = {
  id: 'validate-premium-section-qualification',
  validate: ({ deck, context }) => {
    const cardFacts = context?.cardFacts

    if (!cardFacts || cardFacts.size === 0) {
      return []
    }

    const issues: DeckValidationIssue[] = []

    for (const card of sortCardsForPremiumSectionChecks(
      getPremiumRelevantCards(deck.currentVersion.cards),
    )) {
      const facts = cardFacts.get(card.cardEntityId)

      if (facts?.premiumGDeckEligible == null) {
        issues.push({
          severity: 'error',
          category: 'input',
          code: 'premium-card-section-qualification-missing',
          message: `Premium section validation requires G deck qualification facts for ${String(card.cardEntityId)}.`,
          target: createCardTarget(card.cardEntityId, card.section),
        })
        continue
      }

      if (card.section === 'main' && facts.premiumGDeckEligible) {
        issues.push({
          severity: 'error',
          category: 'card',
          code: 'premium-main-deck-contains-g-deck-card',
          message: `Premium main deck cannot contain G deck cards such as ${String(card.cardEntityId)}.`,
          target: createCardTarget(card.cardEntityId, 'main'),
        })
      }

      if (card.section === 'g' && !facts.premiumGDeckEligible) {
        issues.push({
          severity: 'error',
          category: 'card',
          code: 'premium-g-deck-invalid-card',
          message: `Premium G deck card ${String(card.cardEntityId)} does not satisfy the supplied G deck qualification facts.`,
          target: createCardTarget(card.cardEntityId, 'g'),
        })
      }
    }

    return issues
  },
}

export const validatePremiumCardLegalityValidator: DeckValidator = {
  id: 'validate-premium-card-legality',
  validate: ({ deck, context }) => {
    const cardFacts = context?.cardFacts

    if (!cardFacts || cardFacts.size === 0) {
      return []
    }

    const issues: DeckValidationIssue[] = []

    for (const card of sortCardsForPremiumSectionChecks(
      getPremiumRelevantCards(deck.currentVersion.cards),
    )) {
      const facts = cardFacts.get(card.cardEntityId)

      if (facts?.legalInFormats == null) {
        issues.push({
          severity: 'error',
          category: 'input',
          code: 'premium-card-legality-missing',
          message: `Premium legality validation requires format legality facts for ${String(card.cardEntityId)}.`,
          target: createCardTarget(card.cardEntityId, card.section),
        })
        continue
      }

      if (!isCardLegalInFormat(facts.legalInFormats, premiumFormatId)) {
        issues.push({
          severity: 'error',
          category: 'format',
          code: 'premium-card-legality-invalid',
          message: `Card ${String(card.cardEntityId)} is not legal in Premium under the provided baseline legality facts.`,
          target: createCardTarget(card.cardEntityId, card.section),
        })
      }
    }

    return issues
  },
}

export const premiumValidators: readonly DeckValidator[] = [
  createFormatSectionValidator({
    id: 'validate-premium-sections',
    formatId: 'premium',
    allowedSections: ['main', 'g'],
  }),
  validateDeckSizeValidator,
  validateCopyLimitsValidator,
  validatePremiumCardFactsValidator,
  validatePremiumGDeckStructureValidator,
  validatePremiumSectionQualificationValidator,
  validatePremiumCardLegalityValidator,
]

function getPremiumRelevantCards(
  cards: readonly DeckCard[],
  section?: 'main' | 'g',
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

    return card.section === 'main' || card.section === 'g'
  })
}

function getPremiumGDeckConstraint(
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
): {
  readonly minCards: number
  readonly maxCards: number
  readonly required: boolean
} {
  const gDeckConstraint = context?.format?.profile
    ? getDeckSectionConstraint(context.format.profile as never, 'g')
    : undefined

  if (gDeckConstraint) {
    return {
      minCards: gDeckConstraint.minCards,
      maxCards: gDeckConstraint.maxCards,
      required: gDeckConstraint.required,
    }
  }

  return {
    minCards: 0,
    maxCards: premiumDefaultGDeckMaxCards,
    required: false,
  }
}

function sortCardsForPremiumSectionChecks(
  cards: readonly DeckCard[],
): readonly DeckCard[] {
  return cards.slice().sort((left, right) => {
    const leftSectionOrder = getSectionOrder(left.section)
    const rightSectionOrder = getSectionOrder(right.section)

    if (leftSectionOrder !== rightSectionOrder) {
      return leftSectionOrder - rightSectionOrder
    }

    return String(left.cardEntityId).localeCompare(String(right.cardEntityId))
  })
}

function countCardQuantity(cards: readonly DeckCard[]): number {
  return cards.reduce((total, card) => total + card.quantity, 0)
}

function getSectionOrder(section: DeckSection): number {
  return section === 'main' ? 0 : 1
}

function createDeckTarget(deckId: DeckId): DeckValidationTarget {
  return {
    type: 'deck',
    deckId,
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

function isCardLegalInFormat(
  legalInFormats: readonly FormatId[],
  formatId: FormatId,
): boolean {
  return legalInFormats.some((candidate) => candidate === formatId)
}

function hasNonEmptyValue(value: string): boolean {
  return value.trim().length > 0
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}
