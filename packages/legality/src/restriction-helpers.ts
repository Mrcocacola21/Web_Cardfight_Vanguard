import type {
  CardRestrictionRule,
  ChoiceRestrictionRule,
  RestrictionRule,
} from './restrictions'

export function isCardRestrictionRule(
  rule: RestrictionRule,
): rule is CardRestrictionRule {
  return rule.kind === 'card'
}

export function isChoiceRestrictionRule(
  rule: RestrictionRule,
): rule is ChoiceRestrictionRule {
  return rule.kind === 'choice'
}

export function getCardRestrictionCopyLimit(
  rule: CardRestrictionRule,
): number | null {
  switch (rule.type) {
    case 'unrestricted':
      return null
    case 'banned':
      return 0
    case 'limited':
      return 1
    case 'semi-limited':
      return 2
    case 'maximum-copies':
      if (rule.limit === undefined) {
        throw new Error(
          'Card restriction of type "maximum-copies" requires an explicit limit',
        )
      }

      return rule.limit
  }
}
