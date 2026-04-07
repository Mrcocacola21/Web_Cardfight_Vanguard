import type { CardId, FormatId } from '@web-vg/shared'

export type RestrictionType =
  | 'unrestricted'
  | 'banned'
  | 'limited'
  | 'semi-limited'
  | 'maximum-copies'

export interface CardRestrictionRule {
  readonly kind: 'card'
  readonly type: RestrictionType
  readonly formatId: FormatId
  readonly cardId: CardId
  readonly limit?: number
  readonly note?: string
}

export interface ChoiceRestrictionRule {
  readonly kind: 'choice'
  readonly formatId: FormatId
  readonly optionCardIds: readonly CardId[]
  readonly allowedChoices: number
  readonly note?: string
}

export type RestrictionRule = CardRestrictionRule | ChoiceRestrictionRule

export interface RestrictionList {
  readonly formatId: FormatId
  readonly version: string
  readonly rules: readonly RestrictionRule[]
}
