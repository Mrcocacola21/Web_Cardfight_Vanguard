import type {
  CardId,
  CardType,
  Clan,
  EffectRef,
  Grade,
  Keyword,
  Nation,
  Race,
  TriggerType,
} from '@web-vg/shared'

export interface CardAttributes {
  readonly grade: Grade
  readonly cardType: CardType
  readonly nation: Nation
  readonly clan?: Clan
  readonly race?: Race
  readonly triggerType?: TriggerType
  readonly power?: number
  readonly critical?: number
  readonly shield?: number
  readonly keywords: readonly Keyword[]
}

export interface Card {
  readonly id: CardId
  readonly name: string
  readonly attributes: CardAttributes
  readonly effectRefs: readonly EffectRef[]
}
