import type { DeckCard } from '@web-vg/decks'
import type { CardId, DeckId, DeckSection, FormatId } from '@web-vg/shared'

import type {
  DeckValidationCardFacts,
  DeckValidationIssue,
  DeckValidationTarget,
  DeckValidator,
} from '../contracts'
import {
  validateCopyLimitsValidator,
  validateDeckSizeValidator,
} from '../format-baseline-rules'
import { createFormatSectionValidator } from './shared'

const vPremiumFormatId = 'v-premium' as FormatId

export const validateVPremiumCardFactsValidator: DeckValidator = {
  id: 'validate-v-premium-card-facts',
  validate: ({ deck, context }) => {
    const relevantCards = getVPremiumRelevantCards(deck.currentVersion.cards)

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
        code: 'v-premium-card-facts-missing',
        message:
          'V Premium validation requires prepared card facts for clan and baseline legality checks.',
        target: createDeckTarget(deck.id),
      },
    ]
  },
}

export const validateVPremiumClanConstraintsValidator: DeckValidator = {
  id: 'validate-v-premium-clan-constraints',
  validate: ({ deck, context }) => {
    const cardFacts = context?.cardFacts

    if (!cardFacts || cardFacts.size === 0) {
      return []
    }

    const issues: DeckValidationIssue[] = []
    const cardsWithClan: {
      readonly card: DeckCard
      readonly facts: DeckValidationCardFacts
    }[] = []

    for (const card of sortCardsByEntityId(
      getVPremiumRelevantCards(deck.currentVersion.cards),
    )) {
      const facts = cardFacts.get(card.cardEntityId)

      if (
        !facts ||
        facts.clan == null ||
        !hasNonEmptyValue(String(facts.clan))
      ) {
        issues.push({
          severity: 'error',
          category: 'input',
          code: 'v-premium-card-clan-missing',
          message: `V Premium clan validation requires clan facts for ${String(card.cardEntityId)}.`,
          target: createCardTarget(card.cardEntityId, 'main'),
        })
        continue
      }

      cardsWithClan.push({
        card,
        facts,
      })
    }

    const anchorCard = cardsWithClan[0]

    if (!anchorCard) {
      return issues
    }

    for (const entry of cardsWithClan.slice(1)) {
      if (entry.facts.clan === anchorCard.facts.clan) {
        continue
      }

      issues.push({
        severity: 'error',
        category: 'card',
        code: 'v-premium-clan-mismatch',
        message: `V Premium deck clan is ${String(anchorCard.facts.clan)}, but ${String(entry.card.cardEntityId)} belongs to ${String(entry.facts.clan)}.`,
        target: createCardTarget(entry.card.cardEntityId, 'main'),
      })
    }

    return issues
  },
}

export const validateVPremiumCardLegalityValidator: DeckValidator = {
  id: 'validate-v-premium-card-legality',
  validate: ({ deck, context }) => {
    const cardFacts = context?.cardFacts

    if (!cardFacts || cardFacts.size === 0) {
      return []
    }

    const issues: DeckValidationIssue[] = []

    for (const card of sortCardsByEntityId(
      getVPremiumRelevantCards(deck.currentVersion.cards),
    )) {
      const facts = cardFacts.get(card.cardEntityId)

      if (!facts || facts.legalInFormats == null) {
        issues.push({
          severity: 'error',
          category: 'input',
          code: 'v-premium-card-legality-missing',
          message: `V Premium legality validation requires format legality facts for ${String(card.cardEntityId)}.`,
          target: createCardTarget(card.cardEntityId, 'main'),
        })
        continue
      }

      if (!isCardLegalInFormat(facts.legalInFormats, vPremiumFormatId)) {
        issues.push({
          severity: 'error',
          category: 'format',
          code: 'v-premium-card-legality-invalid',
          message: `Card ${String(card.cardEntityId)} is not legal in V Premium under the provided baseline legality facts.`,
          target: createCardTarget(card.cardEntityId, 'main'),
        })
      }
    }

    return issues
  },
}

export const vPremiumValidators: readonly DeckValidator[] = [
  createFormatSectionValidator({
    id: 'validate-v-premium-sections',
    formatId: 'v-premium',
    allowedSections: ['main'],
  }),
  validateDeckSizeValidator,
  validateCopyLimitsValidator,
  validateVPremiumCardFactsValidator,
  validateVPremiumClanConstraintsValidator,
  validateVPremiumCardLegalityValidator,
]

function getVPremiumRelevantCards(
  cards: readonly DeckCard[],
): readonly DeckCard[] {
  return cards.filter((card) => {
    return (
      card.section === 'main' &&
      isPositiveInteger(card.quantity) &&
      hasNonEmptyValue(String(card.cardEntityId))
    )
  })
}

function sortCardsByEntityId(cards: readonly DeckCard[]): readonly DeckCard[] {
  return cards
    .slice()
    .sort((left, right) =>
      String(left.cardEntityId).localeCompare(String(right.cardEntityId)),
    )
}

function createDeckTarget(deckId: DeckId): DeckValidationTarget {
  return {
    type: 'deck',
    deckId,
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
