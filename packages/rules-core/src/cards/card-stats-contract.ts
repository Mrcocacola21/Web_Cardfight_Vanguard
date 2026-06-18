import type {
  CardId,
  CardType,
  Clan,
  EffectRefId,
  Grade,
  Keyword,
  Nation,
  TriggerType,
} from '@web-vg/shared'

export interface EngineCardStats {
  readonly cardDefinitionId: CardId
  readonly name?: string
  readonly cardType: CardType
  readonly grade: Grade
  readonly nation?: Nation
  readonly clan?: Clan
  readonly power: number
  readonly shield: number
  readonly critical: number
  readonly triggerType: TriggerType | null
  readonly keywords: readonly Keyword[]
  readonly effectRefs?: readonly EffectRefId[]
}

export interface EngineCardStatsSnapshot {
  readonly cards: readonly EngineCardStats[]
}

export type CardStatsResolutionIssueCode =
  | 'missing_card_stats_snapshot'
  | 'missing_card_definition_id'
  | 'missing_card_stats'

export interface CardStatsResolutionIssue {
  readonly code: CardStatsResolutionIssueCode
  readonly message: string
}

export type CardStatsResolutionResult =
  | {
      readonly ok: true
      readonly stats: EngineCardStats
    }
  | {
      readonly ok: false
      readonly issue: CardStatsResolutionIssue
    }
