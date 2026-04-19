import type { Deck } from '@web-vg/decks'
import type { RestrictionList } from '@web-vg/legality'
import type {
  CardId,
  CardType,
  Clan,
  DeckId,
  DeckSection,
  FormatId,
  FormatProfile,
  Grade,
  Nation,
  TriggerType,
} from '@web-vg/shared'

export type KnownDeckValidationIssueCode =
  | 'empty-deck'
  | 'missing-format'
  | 'unsupported-format'
  | 'format-profile-mismatch'
  | 'missing-card-entity-id'
  | 'invalid-card-quantity'
  | 'invalid-card-section'
  | 'main-deck-too-small'
  | 'main-deck-too-large'
  | 'copy-limit-exceeded'
  | 'section-not-allowed-for-format'
  | 'duplicate-card-entry'
  | 'standard-card-facts-missing'
  | 'standard-ride-deck-missing'
  | 'standard-ride-deck-size-invalid'
  | 'standard-ride-deck-grade-sequence-invalid'
  | 'standard-ride-deck-card-type-invalid'
  | 'standard-ride-deck-card-metadata-missing'
  | 'standard-card-nation-missing'
  | 'standard-nation-mismatch'
  | 'v-premium-card-facts-missing'
  | 'v-premium-card-clan-missing'
  | 'v-premium-clan-mismatch'
  | 'v-premium-card-legality-missing'
  | 'v-premium-card-legality-invalid'
  | 'premium-card-facts-missing'
  | 'premium-card-section-qualification-missing'
  | 'premium-g-deck-missing'
  | 'premium-g-deck-size-invalid'
  | 'premium-g-deck-invalid-card'
  | 'premium-main-deck-contains-g-deck-card'
  | 'premium-card-legality-missing'
  | 'premium-card-legality-invalid'
  | 'restriction-list-missing'
  | 'restriction-list-format-mismatch'
  | 'card-banned-in-format'
  | 'card-exceeds-restricted-copies'
  | 'choice-restriction-violated'
  | 'deck-version-deck-mismatch'
  | 'deck-version-format-mismatch'
  | 'snapshot-deck-mismatch'
  | 'snapshot-format-mismatch'
  | 'snapshot-revision-mismatch'
  | 'snapshot-card-mismatch'

export type DeckValidationIssueCode =
  | KnownDeckValidationIssueCode
  | (string & {})

export type DeckValidationIssueSeverity = 'error' | 'warning' | 'info'

export type DeckValidationIssueCategory =
  | 'deck'
  | 'card'
  | 'section'
  | 'format'
  | 'restriction'
  | 'input'

export type KnownDeckValidationRuleId =
  | 'require-deck-format'
  | 'select-format-validator-group'
  | 'validate-deck-presence'
  | 'validate-deck-entry-shape'
  | 'validate-deck-duplicates'
  | 'validate-deck-size'
  | 'validate-copy-limits'
  | 'validate-deck-consistency'
  | 'validate-standard-sections'
  | 'validate-standard-card-facts'
  | 'validate-standard-ride-deck'
  | 'validate-standard-nation-constraints'
  | 'validate-v-premium-sections'
  | 'validate-v-premium-card-facts'
  | 'validate-v-premium-clan-constraints'
  | 'validate-v-premium-card-legality'
  | 'validate-premium-sections'
  | 'validate-premium-card-facts'
  | 'validate-premium-g-deck-structure'
  | 'validate-premium-section-qualification'
  | 'validate-premium-card-legality'
  | 'validate-restriction-list-context'
  | 'validate-restriction-card-rules'
  | 'validate-restriction-choice-rules'

export type DeckValidationRuleId = KnownDeckValidationRuleId | (string & {})

export type SupportedDeckValidationFormatId =
  | 'standard'
  | 'v-premium'
  | 'premium'

export type DeckValidationValidatorGroupId =
  | 'common'
  | 'restriction'
  | SupportedDeckValidationFormatId

export interface DeckValidationCardFacts {
  readonly grade?: Grade | null
  readonly cardType?: CardType | null
  readonly clan?: Clan | null
  readonly nation?: Nation | null
  readonly legalInFormats?: readonly FormatId[] | null
  readonly premiumGDeckEligible?: boolean | null
  readonly triggerType?: TriggerType | null
}

export interface DeckValidationFormatContext {
  readonly profile?: FormatProfile
}

export interface DeckValidationRestrictionContext {
  readonly listId?: string
  readonly activeList?: RestrictionList | null
}

export interface DeckValidationContext {
  readonly format?: DeckValidationFormatContext
  readonly cardFacts?: ReadonlyMap<CardId, DeckValidationCardFacts>
  readonly restrictions?: DeckValidationRestrictionContext
}

export interface DeckValidationInput {
  readonly deck: Deck
  readonly context?: DeckValidationContext
}

export type DeckValidationTarget =
  | {
      readonly type: 'deck'
      readonly deckId: DeckId
    }
  | {
      readonly type: 'format'
      readonly field: 'formatId'
      readonly formatId: FormatId | null
    }
  | {
      readonly type: 'section'
      readonly section: DeckSection | (string & {})
    }
  | {
      readonly type: 'card'
      readonly cardEntityId: CardId
      readonly section?: DeckSection | (string & {})
    }
  | {
      readonly type: 'restriction'
      readonly cardEntityId?: CardId
      readonly restrictionId?: string
    }

export interface DeckValidationIssue {
  readonly severity: DeckValidationIssueSeverity
  readonly category: DeckValidationIssueCategory
  readonly code: DeckValidationIssueCode
  readonly message: string
  readonly target: DeckValidationTarget
}

export interface DeckValidationSummary {
  readonly totalIssues: number
  readonly errorCount: number
  readonly warningCount: number
  readonly infoCount: number
}

export interface DeckValidationResult {
  readonly isValid: boolean
  readonly formatId: FormatId | null
  readonly validatorGroups: readonly DeckValidationValidatorGroupId[]
  readonly evaluatedRules: readonly DeckValidationRuleId[]
  readonly issues: readonly DeckValidationIssue[]
  readonly summary: DeckValidationSummary
}

export interface DeckValidator {
  readonly id: DeckValidationRuleId
  validate(input: DeckValidationInput): readonly DeckValidationIssue[]
}

export interface DeckValidationPlan {
  readonly formatId: FormatId | null
  readonly validatorGroups: readonly DeckValidationValidatorGroupId[]
  readonly commonValidators: readonly DeckValidator[]
  readonly formatValidators: readonly DeckValidator[]
  readonly restrictionValidators: readonly DeckValidator[]
  readonly routingIssues: readonly DeckValidationIssue[]
}

export interface DeckValidationValidatorRegistry {
  readonly commonValidators: readonly DeckValidator[]
  readonly restrictionValidators: readonly DeckValidator[]
  readonly formatValidatorsByFormat: Readonly<
    Record<SupportedDeckValidationFormatId, readonly DeckValidator[]>
  >
}

export interface DeckValidationPipeline {
  readonly registry: DeckValidationValidatorRegistry
  createPlan(input: DeckValidationInput): DeckValidationPlan
  validate(input: DeckValidationInput): DeckValidationResult
}
