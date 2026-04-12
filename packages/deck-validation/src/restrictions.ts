import type { DeckCard } from '@web-vg/decks'
import {
  getCardRestrictionCopyLimit,
  isCardRestrictionRule,
  isChoiceRestrictionRule,
  type CardRestrictionRule,
  type ChoiceRestrictionRule,
  type RestrictionList,
} from '@web-vg/legality'
import type { CardId, FormatId } from '@web-vg/shared'

import type {
  DeckValidationInput,
  DeckValidationIssue,
  DeckValidationTarget,
  DeckValidator,
} from './contracts'

export const validateRestrictionListContextValidator: DeckValidator = {
  id: 'validate-restriction-list-context',
  validate: (input) => {
    const restrictions = input.context?.restrictions

    if (!restrictions) {
      return []
    }

    if (!restrictions.activeList) {
      return [
        {
          severity: 'warning',
          category: 'restriction',
          code: 'restriction-list-missing',
          message:
            'Restriction validation did not receive an active restriction list, so restriction checks were skipped.',
          target: createRestrictionTarget(
            restrictions.listId ?? 'active-restriction-list',
          ),
        },
      ]
    }

    if (restrictions.activeList.formatId !== input.deck.formatId) {
      return [
        {
          severity: 'error',
          category: 'restriction',
          code: 'restriction-list-format-mismatch',
          message: `Restriction list ${restrictions.activeList.version} targets ${String(restrictions.activeList.formatId)}, but the deck format is ${String(input.deck.formatId)}.`,
          target: createRestrictionTarget(restrictions.activeList.version),
        },
      ]
    }

    return []
  },
}

export const validateRestrictionCardRulesValidator: DeckValidator = {
  id: 'validate-restriction-card-rules',
  validate: (input) => {
    const activeList = getApplicableRestrictionList(input)

    if (!activeList) {
      return []
    }

    const cardCounts = countDeckCardsByEntityId(input.deck.currentVersion.cards)
    const issues: DeckValidationIssue[] = []

    for (const rule of getSortedCardRules(activeList, input.deck.formatId)) {
      const copies = cardCounts.get(rule.cardId) ?? 0

      if (copies === 0) {
        continue
      }

      const copyLimit = getCardRestrictionCopyLimit(rule)

      if (copyLimit === null) {
        continue
      }

      if (copyLimit === 0) {
        issues.push({
          severity: 'error',
          category: 'restriction',
          code: 'card-banned-in-format',
          message: `Card ${String(rule.cardId)} is banned by restriction list ${activeList.version} for ${String(input.deck.formatId)}.`,
          target: createCardTarget(rule.cardId),
        })
        continue
      }

      if (copies > copyLimit) {
        issues.push({
          severity: 'error',
          category: 'restriction',
          code: 'card-exceeds-restricted-copies',
          message: `Card ${String(rule.cardId)} is limited to ${copyLimit} copies by restriction list ${activeList.version}, but the deck contains ${copies}.`,
          target: createCardTarget(rule.cardId),
        })
      }
    }

    return issues
  },
}

export const validateRestrictionChoiceRulesValidator: DeckValidator = {
  id: 'validate-restriction-choice-rules',
  validate: (input) => {
    const activeList = getApplicableRestrictionList(input)

    if (!activeList) {
      return []
    }

    const cardCounts = countDeckCardsByEntityId(input.deck.currentVersion.cards)
    const issues: DeckValidationIssue[] = []

    for (const rule of getSortedChoiceRules(activeList, input.deck.formatId)) {
      const presentOptions = getPresentChoiceOptions(rule, cardCounts)

      if (presentOptions.length <= rule.allowedChoices) {
        continue
      }

      issues.push({
        severity: 'error',
        category: 'restriction',
        code: 'choice-restriction-violated',
        message: `Restriction choice group ${buildChoiceRestrictionId(activeList, rule)} allows ${rule.allowedChoices} card choices, but the deck contains ${presentOptions.length}: ${presentOptions.join(', ')}.`,
        target: createRestrictionTarget(
          buildChoiceRestrictionId(activeList, rule),
        ),
      })
    }

    return issues
  },
}

export const restrictionValidators: readonly DeckValidator[] = [
  validateRestrictionListContextValidator,
  validateRestrictionCardRulesValidator,
  validateRestrictionChoiceRulesValidator,
]

function getApplicableRestrictionList(
  input: DeckValidationInput,
): RestrictionList | null {
  const activeList = input.context?.restrictions?.activeList

  if (!activeList) {
    return null
  }

  return activeList.formatId === input.deck.formatId ? activeList : null
}

function countDeckCardsByEntityId(
  cards: readonly DeckCard[],
): ReadonlyMap<CardId, number> {
  const cardCounts = new Map<CardId, number>()

  for (const card of cards) {
    if (
      !isPositiveInteger(card.quantity) ||
      !hasNonEmptyValue(String(card.cardEntityId))
    ) {
      continue
    }

    cardCounts.set(
      card.cardEntityId,
      (cardCounts.get(card.cardEntityId) ?? 0) + card.quantity,
    )
  }

  return cardCounts
}

function getSortedCardRules(
  activeList: RestrictionList,
  formatId: FormatId,
): readonly CardRestrictionRule[] {
  return activeList.rules
    .filter(
      (rule): rule is CardRestrictionRule =>
        isCardRestrictionRule(rule) && rule.formatId === formatId,
    )
    .sort((left, right) =>
      String(left.cardId).localeCompare(String(right.cardId)),
    )
}

function getSortedChoiceRules(
  activeList: RestrictionList,
  formatId: FormatId,
): readonly ChoiceRestrictionRule[] {
  return activeList.rules
    .filter(
      (rule): rule is ChoiceRestrictionRule =>
        isChoiceRestrictionRule(rule) && rule.formatId === formatId,
    )
    .sort((left, right) =>
      buildChoiceRestrictionId(activeList, left).localeCompare(
        buildChoiceRestrictionId(activeList, right),
      ),
    )
}

function getPresentChoiceOptions(
  rule: ChoiceRestrictionRule,
  cardCounts: ReadonlyMap<CardId, number>,
): readonly string[] {
  return Array.from(
    new Set(
      rule.optionCardIds
        .filter((cardId) => (cardCounts.get(cardId) ?? 0) > 0)
        .map((cardId) => String(cardId)),
    ),
  ).sort((left, right) => left.localeCompare(right))
}

function buildChoiceRestrictionId(
  activeList: RestrictionList,
  rule: ChoiceRestrictionRule,
): string {
  const optionIds = Array.from(
    new Set(rule.optionCardIds.map((cardId) => String(cardId))),
  )
    .sort((left, right) => left.localeCompare(right))
    .join('|')

  return `choice:${activeList.version}:${optionIds}:${rule.allowedChoices}`
}

function createRestrictionTarget(restrictionId: string): DeckValidationTarget {
  return {
    type: 'restriction',
    restrictionId,
  }
}

function createCardTarget(cardEntityId: CardId): DeckValidationTarget {
  return {
    type: 'card',
    cardEntityId,
  }
}

function hasNonEmptyValue(value: string): boolean {
  return value.trim().length > 0
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}
