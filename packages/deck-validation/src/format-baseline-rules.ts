import type { DeckCard } from '@web-vg/decks'
import { getDeckSectionConstraint } from '@web-vg/shared'

import type {
  DeckValidationInput,
  DeckValidationIssue,
  DeckValidator,
  SupportedDeckValidationFormatId,
} from './contracts'
import {
  isSupportedDeckValidationFormatId,
  normalizeDeckValidationFormatId,
} from './formats/shared'

const fallbackMainDeckConstraints: Readonly<
  Record<
    SupportedDeckValidationFormatId,
    {
      readonly minCards: number
      readonly maxCards: number
    }
  >
> = {
  standard: {
    minCards: 50,
    maxCards: 50,
  },
  'v-premium': {
    minCards: 50,
    maxCards: 50,
  },
  premium: {
    minCards: 50,
    maxCards: 50,
  },
}

const fallbackMainDeckCopyLimits: Readonly<
  Record<SupportedDeckValidationFormatId, number>
> = {
  standard: 4,
  'v-premium': 4,
  premium: 4,
}

export const validateDeckSizeValidator: DeckValidator = {
  id: 'validate-deck-size',
  validate: (input) => {
    if (countPositiveCards(input.deck.currentVersion.cards) === 0) {
      return []
    }

    const mainDeckConstraint = resolveMainDeckConstraint(input)

    if (!mainDeckConstraint) {
      return []
    }

    const mainDeckSize = countPositiveCardsInSection(
      input.deck.currentVersion.cards,
      'main',
    )
    const issues: DeckValidationIssue[] = []

    if (mainDeckSize < mainDeckConstraint.minCards) {
      issues.push({
        severity: 'error',
        category: 'section',
        code: 'main-deck-too-small',
        message: `Main deck contains ${mainDeckSize} cards, but the format baseline requires ${mainDeckConstraint.minCards}.`,
        target: {
          type: 'section',
          section: 'main',
        },
      })
    }

    if (mainDeckSize > mainDeckConstraint.maxCards) {
      issues.push({
        severity: 'error',
        category: 'section',
        code: 'main-deck-too-large',
        message: `Main deck contains ${mainDeckSize} cards, but the format baseline allows only ${mainDeckConstraint.maxCards}.`,
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
  validate: (input) => {
    const maxCopiesPerCard = resolveMainDeckCopyLimit(input)

    if (maxCopiesPerCard == null) {
      return []
    }

    const copiesByCardEntityId = new Map<string, number>()

    for (const card of input.deck.currentVersion.cards) {
      if (card.section !== 'main') {
        continue
      }

      const cardEntityId = String(card.cardEntityId)

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
      .filter(([, quantity]) => quantity > maxCopiesPerCard)
      .sort(([leftCardId], [rightCardId]) =>
        leftCardId.localeCompare(rightCardId),
      )
      .map<DeckValidationIssue>(([cardEntityId, quantity]) => ({
        severity: 'error',
        category: 'card',
        code: 'copy-limit-exceeded',
        message: `Main deck contains ${quantity} copies of ${cardEntityId}, but the format baseline allows only ${maxCopiesPerCard}.`,
        target: {
          type: 'card',
          cardEntityId: cardEntityId as never,
          section: 'main',
        },
      }))
  },
}

function resolveMainDeckConstraint(input: DeckValidationInput): {
  readonly minCards: number
  readonly maxCards: number
} | null {
  const profile = input.context?.format?.profile

  if (profile && profile.formatId === input.deck.formatId) {
    const mainDeckConstraint = getDeckSectionConstraint(profile, 'main')

    if (mainDeckConstraint) {
      return {
        minCards: mainDeckConstraint.minCards,
        maxCards: mainDeckConstraint.maxCards,
      }
    }
  }

  const supportedFormatId = resolveSupportedFormatId(input)

  return supportedFormatId
    ? fallbackMainDeckConstraints[supportedFormatId]
    : null
}

function resolveMainDeckCopyLimit(input: DeckValidationInput): number | null {
  const profile = input.context?.format?.profile

  if (profile && profile.formatId === input.deck.formatId) {
    return profile.constructionRules.duplicateConstraint.defaultMaxCopiesPerCard
  }

  const supportedFormatId = resolveSupportedFormatId(input)

  return supportedFormatId
    ? fallbackMainDeckCopyLimits[supportedFormatId]
    : null
}

function resolveSupportedFormatId(
  input: DeckValidationInput,
): SupportedDeckValidationFormatId | null {
  const formatId = normalizeDeckValidationFormatId(input.deck.formatId)

  if (!formatId || !isSupportedDeckValidationFormatId(formatId)) {
    return null
  }

  return formatId
}

function countPositiveCards(cards: readonly DeckCard[]): number {
  return cards.reduce((total, card) => {
    return total + (isPositiveInteger(card.quantity) ? card.quantity : 0)
  }, 0)
}

function countPositiveCardsInSection(
  cards: readonly DeckCard[],
  section: 'main',
): number {
  return cards.reduce((total, card) => {
    if (card.section !== section || !isPositiveInteger(card.quantity)) {
      return total
    }

    return total + card.quantity
  }, 0)
}

function hasNonEmptyValue(value: string): boolean {
  return value.trim().length > 0
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}
