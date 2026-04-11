import type { Json } from '../../generated/database.types'

export type ImportJobStatus =
  | 'pending'
  | 'running'
  | 'blocked_for_review'
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'cancelled'

export type ImportJobStage =
  | 'source'
  | 'raw_import'
  | 'normalization'
  | 'publication'
  | 'published'

export type CardPrintingNormalizationStatus =
  | 'auto_resolved'
  | 'unresolved'
  | 'ambiguous'
  | 'blocked_for_review'
  | 'superseded'

export type ManualReviewReason =
  | 'ambiguous_mapping'
  | 'unresolved_mapping'
  | 'conflicting_facts'
  | 'exceptional_card'

export type ManualReviewStatus =
  | 'open'
  | 'in_review'
  | 'resolved'
  | 'rejected'
  | 'superseded'
  | 'cancelled'

export type ManualReviewResolutionKind =
  | 'accept_proposed_match'
  | 'select_candidate_match'
  | 'keep_unresolved'
  | 'mark_exceptional'
  | 'reject_imported_record'

export interface ImportSourceRecord {
  readonly id: string
  readonly sourceKey: string
  readonly sourceType: string
  readonly displayName: string
  readonly providerName: string | null
  readonly originUri: string | null
  readonly configuration: Json
  readonly isActive: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ImportJobRecord {
  readonly id: string
  readonly sourceId: string
  readonly retryOfJobId: string | null
  readonly jobStatus: ImportJobStatus
  readonly currentStage: ImportJobStage
  readonly pipelineVersion: string
  readonly upstreamSnapshotKey: string | null
  readonly inputFingerprint: string | null
  readonly scopeMetadata: Json
  readonly statusReason: string | null
  readonly errorCode: string | null
  readonly rawRecordCount: number
  readonly normalizedCandidateCount: number
  readonly conflictCount: number
  readonly publishedRecordCount: number
  readonly createdAt: string
  readonly startedAt: string | null
  readonly finishedAt: string | null
  readonly updatedAt: string
}

export interface RawProductRecord {
  readonly id: string
  readonly importJobId: string
  readonly sourceProductId: string
  readonly payloadFingerprint: string
  readonly rawName: string
  readonly rawCode: string | null
  readonly rawProductCategory: string | null
  readonly rawProductKind: string | null
  readonly rawFamilyName: string | null
  readonly rawReleaseDateText: string | null
  readonly rawRegionCode: string | null
  readonly sourcePayload: Json
  readonly createdAt: string
  readonly updatedAt: string
}

export interface RawCardPrintingRecord {
  readonly id: string
  readonly importJobId: string
  readonly sourcePrintingId: string
  readonly sourceProductId: string | null
  readonly sourceProductCode: string | null
  readonly rawProductRecordId: string | null
  readonly payloadFingerprint: string
  readonly rawCardName: string
  readonly rawPrintingCode: string | null
  readonly rawRarity: string | null
  readonly rawLocaleCode: string | null
  readonly rawRegionCode: string | null
  readonly rawCardType: string | null
  readonly rawNation: string | null
  readonly rawClan: string | null
  readonly rawTriggerType: string | null
  readonly rawGradeText: string | null
  readonly rawPowerText: string | null
  readonly rawCriticalText: string | null
  readonly rawShieldText: string | null
  readonly rawRulesText: string | null
  readonly sourcePayload: Json
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CatalogCardEntityNormalizationRecord {
  readonly id: string
  readonly canonicalKey: string
  readonly name: string
  readonly normalizedName: string
  readonly grade: number
  readonly cardType: string
  readonly nation: string
  readonly clan: string | null
  readonly triggerType: string | null
}

export interface CardPrintingNormalizationResultRecord {
  readonly id: string
  readonly importJobId: string
  readonly rawCardPrintingRecordId: string
  readonly rawProductRecordId: string | null
  readonly normalizationVersion: string
  readonly normalizationStatus: CardPrintingNormalizationStatus
  readonly resolutionBasis: string
  readonly proposedCardEntityId: string | null
  readonly candidateCardEntityIds: readonly string[]
  readonly candidateCount: number
  readonly normalizedName: string
  readonly normalizedGrade: number | null
  readonly normalizedCardType: string | null
  readonly normalizedNation: string | null
  readonly normalizedClan: string | null
  readonly normalizedTriggerType: string | null
  readonly rawPayloadFingerprint: string
  readonly needsManualReview: boolean
  readonly statusReason: string
  readonly conflictSummary: string | null
  readonly resolutionEvidence: Json
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ManualReviewItemRecord {
  readonly id: string
  readonly importJobId: string
  readonly normalizationResultId: string
  readonly rawCardPrintingRecordId: string
  readonly rawProductRecordId: string | null
  readonly reviewReason: ManualReviewReason
  readonly reviewStatus: ManualReviewStatus
  readonly summary: string
  readonly contextPayload: Json
  readonly candidateCardEntityIds: readonly string[]
  readonly proposedCardEntityId: string | null
  readonly resolutionKind: ManualReviewResolutionKind | null
  readonly resolvedCardEntityId: string | null
  readonly decisionNotes: string | null
  readonly openedAt: string
  readonly startedReviewAt: string | null
  readonly resolvedAt: string | null
  readonly closedAt: string | null
  readonly updatedAt: string
}

export interface UpsertRawProductRecordInput {
  readonly importJobId: string
  readonly sourceProductId: string
  readonly payloadFingerprint: string
  readonly rawName: string
  readonly rawCode: string | null
  readonly rawProductCategory: string | null
  readonly rawProductKind: string | null
  readonly rawFamilyName: string | null
  readonly rawReleaseDateText: string | null
  readonly rawRegionCode: string | null
  readonly sourcePayload: Json
  readonly updatedAt: string
}

export interface UpsertImportSourceInput {
  readonly sourceKey: string
  readonly sourceType: string
  readonly displayName: string
  readonly providerName: string | null
  readonly originUri: string | null
  readonly configuration: Json
  readonly isActive: boolean
}

export interface CreateImportJobInput {
  readonly sourceId: string
  readonly retryOfJobId: string | null
  readonly pipelineVersion: string
  readonly upstreamSnapshotKey: string | null
  readonly inputFingerprint: string | null
  readonly scopeMetadata: Json
}

export interface UpsertRawCardPrintingRecordInput {
  readonly importJobId: string
  readonly sourcePrintingId: string
  readonly sourceProductId: string | null
  readonly sourceProductCode: string | null
  readonly rawProductRecordId: string | null
  readonly payloadFingerprint: string
  readonly rawCardName: string
  readonly rawPrintingCode: string | null
  readonly rawRarity: string | null
  readonly rawLocaleCode: string | null
  readonly rawRegionCode: string | null
  readonly rawCardType: string | null
  readonly rawNation: string | null
  readonly rawClan: string | null
  readonly rawTriggerType: string | null
  readonly rawGradeText: string | null
  readonly rawPowerText: string | null
  readonly rawCriticalText: string | null
  readonly rawShieldText: string | null
  readonly rawRulesText: string | null
  readonly sourcePayload: Json
  readonly updatedAt: string
}

export interface UpsertCardPrintingNormalizationResultInput {
  readonly importJobId: string
  readonly rawCardPrintingRecordId: string
  readonly rawProductRecordId: string | null
  readonly normalizationVersion: string
  readonly normalizationStatus: CardPrintingNormalizationStatus
  readonly resolutionBasis: string
  readonly proposedCardEntityId: string | null
  readonly candidateCardEntityIds: readonly string[]
  readonly candidateCount: number
  readonly normalizedName: string
  readonly normalizedGrade: number | null
  readonly normalizedCardType: string | null
  readonly normalizedNation: string | null
  readonly normalizedClan: string | null
  readonly normalizedTriggerType: string | null
  readonly rawPayloadFingerprint: string
  readonly needsManualReview: boolean
  readonly statusReason: string
  readonly conflictSummary: string | null
  readonly resolutionEvidence: Json
  readonly updatedAt: string
}

export interface UpsertManualReviewItemInput {
  readonly importJobId: string
  readonly normalizationResultId: string
  readonly rawCardPrintingRecordId: string
  readonly rawProductRecordId: string | null
  readonly reviewReason: ManualReviewReason
  readonly reviewStatus: ManualReviewStatus
  readonly summary: string
  readonly contextPayload: Json
  readonly candidateCardEntityIds: readonly string[]
  readonly proposedCardEntityId: string | null
  readonly resolutionKind: ManualReviewResolutionKind | null
  readonly resolvedCardEntityId: string | null
  readonly decisionNotes: string | null
  readonly openedAt: string
  readonly startedReviewAt: string | null
  readonly resolvedAt: string | null
  readonly closedAt: string | null
  readonly updatedAt: string
}

export interface MarkImportJobRunningInput {
  readonly id: string
  readonly currentStage: Extract<
    ImportJobStage,
    'raw_import' | 'normalization' | 'publication'
  >
  readonly startedAt: string
}

export interface MarkImportJobFailedInput {
  readonly id: string
  readonly currentStage: ImportJobStage
  readonly startedAt: string
  readonly finishedAt: string
  readonly errorCode: string
  readonly statusReason: string
}

export interface UpdateImportJobRawRecordCountInput {
  readonly id: string
  readonly currentStage: Extract<ImportJobStage, 'raw_import'>
  readonly rawRecordCount: number
}

export interface UpdateImportJobNormalizationStateInput {
  readonly id: string
  readonly jobStatus: Extract<ImportJobStatus, 'running' | 'blocked_for_review'>
  readonly currentStage: Extract<ImportJobStage, 'normalization'>
  readonly normalizedCandidateCount: number
  readonly conflictCount: number
  readonly statusReason: string | null
}

export interface UpdateManualReviewItemStatusInput {
  readonly id: string
  readonly reviewStatus: ManualReviewStatus
  readonly resolutionKind: ManualReviewResolutionKind | null
  readonly resolvedCardEntityId: string | null
  readonly decisionNotes: string | null
  readonly startedReviewAt: string | null
  readonly resolvedAt: string | null
  readonly closedAt: string | null
}

export interface FinalizeImportJobInput {
  readonly id: string
  readonly jobStatus: Extract<
    ImportJobStatus,
    'blocked_for_review' | 'completed' | 'partially_completed' | 'cancelled'
  >
  readonly currentStage: ImportJobStage
  readonly statusReason: string | null
  readonly publishedRecordCount?: number
  readonly finishedAt: string
}
