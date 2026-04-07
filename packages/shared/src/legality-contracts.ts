import type { CardId, FormatId } from './identifiers'
import type { DeckSection } from './format-contracts'

export type ValidationTarget =
  | 'deck-version'
  | 'draft-snapshot'
  | 'share-publish'
  | 'gameplay-entry'

export type LegalityStatus =
  | 'valid'
  | 'invalid'
  | 'unsupported'
  | 'partially_supported'

export type LegalityIssueSeverity = 'error' | 'warning'

export type LegalityIssueKind =
  | 'deck-structure'
  | 'format-eligibility'
  | 'restriction'
  | 'copy-limit'
  | 'support'
  | 'input'

export type LegalityValidationStage =
  | 'format-eligibility'
  | 'restriction-validation'
  | 'deck-structure-validation'

export interface LegalityIssue {
  readonly code: string
  readonly message: string
  readonly severity: LegalityIssueSeverity
  readonly kind: LegalityIssueKind
  readonly cardId?: CardId
  readonly section?: DeckSection
  readonly ruleReference?: string
}

export interface LegalityResult {
  readonly status: LegalityStatus
  readonly formatId: FormatId
  readonly target: ValidationTarget
  readonly complete: boolean
  readonly checkedStages: readonly LegalityValidationStage[]
  readonly issues: readonly LegalityIssue[]
  readonly unresolvedChecks: readonly string[]
}
