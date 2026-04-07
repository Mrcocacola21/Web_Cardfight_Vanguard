import type {
  CardType,
  Clan,
  Grade,
  Keyword,
  Nation,
  TriggerType,
} from './card-vocabulary'
import type { CardId, EffectRefId } from './identifiers'

export type EffectSource = 'printed' | 'keyword' | 'derived'

export interface EffectRef {
  readonly id: EffectRefId
  readonly sourceCardId: CardId
  readonly source: EffectSource
  readonly key: string
}

export interface GameplayCard {
  readonly cardId: CardId
  readonly name: string
  readonly cardType: CardType
  readonly grade: Grade
  readonly nation: Nation
  readonly clan?: Clan
  readonly triggerType?: TriggerType
  readonly power?: number
  readonly critical?: number
  readonly shield?: number
  readonly keywords: readonly Keyword[]
  readonly effectRefs: readonly EffectRef[]
}
