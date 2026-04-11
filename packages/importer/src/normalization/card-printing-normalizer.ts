import type {
  CardPrintingNormalizationResultRecord,
  CardPrintingNormalizationStatus,
  CatalogCardEntityNormalizationRecord,
  ImporterRepository,
  ImportJobRecord,
  RawCardPrintingRecord,
} from '@web-vg/db'

import {
  createPayloadFingerprint,
  normalizeOptionalText,
  type JsonObject,
} from '../raw/shared'
import { createManualReviewQueue } from '../review/manual-review-queue'

const defaultNormalizationVersion = 'card-printing-normalizer/v1'
const reviewBlockedJobReason =
  'Normalization produced records that require manual review.'

type CardPrintingNormalizationBasis =
  | 'exact_name_only'
  | 'exact_name_with_attributes'
  | 'no_name_match'
  | 'conflicting_name_match'
  | 'ambiguous_name_match'
  | 'exceptional_card_shape'

export interface NormalizeCardPrintingCandidatesInput {
  readonly importJobId: string
  readonly rawCardPrintingRecordIds?: readonly string[]
  readonly normalizationVersion?: string
}

export interface NormalizeCardPrintingCandidatesSuccess {
  readonly importJobId: string
  readonly importSourceId: string
  readonly normalizationVersion: string
  readonly processedCount: number
  readonly createdCount: number
  readonly updatedCount: number
  readonly skippedCount: number
  readonly supersededCount: number
  readonly autoResolvedCount: number
  readonly unresolvedCount: number
  readonly ambiguousCount: number
  readonly blockedForReviewCount: number
  readonly readyForPublicationCount: number
  readonly normalizedCandidateCount: number
  readonly conflictCount: number
  readonly jobStatus: 'running' | 'blocked_for_review'
  readonly currentStage: 'normalization'
}

export type NormalizeCardPrintingCandidatesErrorCode =
  | 'invalid-input'
  | 'job-not-found'
  | 'job-not-runnable'
  | 'query-failed'
  | 'conflict'

export interface NormalizeCardPrintingCandidatesError {
  readonly code: NormalizeCardPrintingCandidatesErrorCode
  readonly message: string
  readonly details?: string
}

export type NormalizeCardPrintingCandidatesResult =
  | {
      readonly ok: true
      readonly data: NormalizeCardPrintingCandidatesSuccess
    }
  | {
      readonly ok: false
      readonly error: NormalizeCardPrintingCandidatesError
    }

export interface CardPrintingNormalizer {
  normalize(
    input: NormalizeCardPrintingCandidatesInput,
  ): Promise<NormalizeCardPrintingCandidatesResult>
}

interface NormalizedRawPrintingForResolution {
  readonly rawCardPrintingRecordId: string
  readonly rawProductRecordId: string | null
  readonly rawPayloadFingerprint: string
  readonly normalizedName: string
  readonly normalizedGrade: number | null
  readonly normalizedCardType: string | null
  readonly normalizedNation: string | null
  readonly normalizedClan: string | null
  readonly normalizedTriggerType: string | null
}

interface ProposedNormalizationResult {
  readonly rawCardPrintingRecordId: string
  readonly rawProductRecordId: string | null
  readonly normalizationStatus: Exclude<
    CardPrintingNormalizationStatus,
    'superseded'
  >
  readonly resolutionBasis: CardPrintingNormalizationBasis
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
  readonly resolutionEvidence: JsonObject
}

export function createCardPrintingNormalizer(
  repository: ImporterRepository,
): CardPrintingNormalizer {
  const manualReviewQueue = createManualReviewQueue(repository)

  return {
    async normalize(input) {
      const validationError = validateNormalizationInput(input)

      if (validationError) {
        return {
          ok: false,
          error: validationError,
        }
      }

      const jobResult = await repository.getImportJobById(input.importJobId)

      if (!jobResult.ok) {
        return {
          ok: false,
          error: jobResult.error,
        }
      }

      const job = jobResult.data

      if (!job) {
        return {
          ok: false,
          error: {
            code: 'job-not-found',
            message: 'Card-printing normalization job was not found.',
          },
        }
      }

      if (!isNormalizationRunnable(job)) {
        return {
          ok: false,
          error: {
            code: 'job-not-runnable',
            message:
              'Card-printing normalization requires a pending, running, or blocked-for-review import job.',
            details: `Current job status: ${job.jobStatus}.`,
          },
        }
      }

      const normalizationVersion =
        normalizeOptionalText(input.normalizationVersion) ??
        defaultNormalizationVersion
      const startedAt = job.startedAt ?? new Date().toISOString()

      const runningResult = await repository.markImportJobRunning({
        id: job.id,
        currentStage: 'normalization',
        startedAt,
      })

      if (!runningResult.ok) {
        return {
          ok: false,
          error: runningResult.error,
        }
      }

      const rawPrintingRecordsResult =
        await repository.listRawCardPrintingRecordsByJob(
          job.id,
          input.rawCardPrintingRecordIds,
        )

      if (!rawPrintingRecordsResult.ok) {
        await markJobFailed(
          repository,
          job,
          startedAt,
          rawPrintingRecordsResult.error.code,
          rawPrintingRecordsResult.error.message,
        )

        return {
          ok: false,
          error: rawPrintingRecordsResult.error,
        }
      }

      const rawPrintingRecords = rawPrintingRecordsResult.data

      if (rawPrintingRecords.length === 0) {
        const error: NormalizeCardPrintingCandidatesError = {
          code: 'invalid-input',
          message:
            'Card-printing normalization requires at least one raw printing record.',
        }

        await markJobFailed(
          repository,
          job,
          startedAt,
          error.code,
          error.message,
        )

        return {
          ok: false,
          error,
        }
      }

      const normalizedRawPrintings = rawPrintingRecords.map(
        normalizeRawCardPrintingForResolution,
      )
      const normalizedNames = Array.from(
        new Set(normalizedRawPrintings.map((record) => record.normalizedName)),
      )
      const rawPrintingRecordIds = normalizedRawPrintings.map(
        (record) => record.rawCardPrintingRecordId,
      )

      const existingResultsResult =
        await repository.listCardPrintingNormalizationResultsByJobAndRawIds(
          job.id,
          rawPrintingRecordIds,
        )

      if (!existingResultsResult.ok) {
        await markJobFailed(
          repository,
          job,
          startedAt,
          existingResultsResult.error.code,
          existingResultsResult.error.message,
        )

        return {
          ok: false,
          error: existingResultsResult.error,
        }
      }

      const candidateEntitiesResult =
        await repository.listCatalogCardEntitiesByNormalizedNames(
          normalizedNames,
        )

      if (!candidateEntitiesResult.ok) {
        await markJobFailed(
          repository,
          job,
          startedAt,
          candidateEntitiesResult.error.code,
          candidateEntitiesResult.error.message,
        )

        return {
          ok: false,
          error: candidateEntitiesResult.error,
        }
      }

      const existingResultsByRawPrintingId =
        groupExistingResultsByRawPrintingId(existingResultsResult.data)
      const candidateEntitiesByName = groupCatalogCandidatesByNormalizedName(
        candidateEntitiesResult.data,
      )

      let createdCount = 0
      let updatedCount = 0
      let skippedCount = 0
      let supersededCount = 0
      let autoResolvedCount = 0
      let unresolvedCount = 0
      let ambiguousCount = 0
      let blockedForReviewCount = 0

      const supersedeResultIds = new Set<string>()
      const upsertPayload = normalizedRawPrintings.flatMap((rawPrinting) => {
        const nameMatches =
          candidateEntitiesByName.get(rawPrinting.normalizedName) ?? []
        const proposedResult = resolveRawPrintingToCandidate(
          rawPrinting,
          nameMatches,
        )

        trackResultStatusCounts(proposedResult.normalizationStatus, {
          incrementAutoResolved() {
            autoResolvedCount += 1
          },
          incrementUnresolved() {
            unresolvedCount += 1
          },
          incrementAmbiguous() {
            ambiguousCount += 1
          },
          incrementBlockedForReview() {
            blockedForReviewCount += 1
          },
        })

        const existingResultsForRawPrinting =
          existingResultsByRawPrintingId.get(
            rawPrinting.rawCardPrintingRecordId,
          ) ?? []
        const existingSameVersionResult = existingResultsForRawPrinting.find(
          (result) => result.normalizationVersion === normalizationVersion,
        )

        for (const existingResult of existingResultsForRawPrinting) {
          if (
            existingResult.normalizationVersion !== normalizationVersion &&
            existingResult.normalizationStatus !== 'superseded'
          ) {
            supersedeResultIds.add(existingResult.id)
          }
        }

        if (
          existingSameVersionResult &&
          isSameNormalizationResult(existingSameVersionResult, proposedResult)
        ) {
          skippedCount += 1
          return []
        }

        if (existingSameVersionResult) {
          updatedCount += 1
        } else {
          createdCount += 1
        }

        return [
          createUpsertNormalizationResultInput(
            job.id,
            normalizationVersion,
            proposedResult,
          ),
        ]
      })

      if (supersedeResultIds.size > 0) {
        const supersedeResultsResult =
          await repository.markCardPrintingNormalizationResultsSuperseded(
            Array.from(supersedeResultIds),
          )

        if (!supersedeResultsResult.ok) {
          await markJobFailed(
            repository,
            job,
            startedAt,
            supersedeResultsResult.error.code,
            supersedeResultsResult.error.message,
          )

          return {
            ok: false,
            error: supersedeResultsResult.error,
          }
        }

        supersededCount = supersedeResultsResult.data
      }

      if (upsertPayload.length > 0) {
        const upsertResults =
          await repository.upsertCardPrintingNormalizationResults(upsertPayload)

        if (!upsertResults.ok) {
          await markJobFailed(
            repository,
            job,
            startedAt,
            upsertResults.error.code,
            upsertResults.error.message,
          )

          return {
            ok: false,
            error: upsertResults.error,
          }
        }
      }

      const allJobResultsResult =
        await repository.listCardPrintingNormalizationResultsByJob(job.id)

      if (!allJobResultsResult.ok) {
        await markJobFailed(
          repository,
          job,
          startedAt,
          allJobResultsResult.error.code,
          allJobResultsResult.error.message,
        )

        return {
          ok: false,
          error: allJobResultsResult.error,
        }
      }

      const activeJobResults = allJobResultsResult.data.filter(
        (result) => result.normalizationStatus !== 'superseded',
      )
      const normalizedCandidateCount = activeJobResults.length
      const reviewQueueSyncResult =
        await manualReviewQueue.syncFromNormalizationResults({
          importJobId: job.id,
        })

      if (!reviewQueueSyncResult.ok) {
        await markJobFailed(
          repository,
          job,
          startedAt,
          reviewQueueSyncResult.error.code,
          reviewQueueSyncResult.error.message,
        )

        return {
          ok: false,
          error: reviewQueueSyncResult.error,
        }
      }

      const conflictCount =
        reviewQueueSyncResult.data.openCount +
        reviewQueueSyncResult.data.inReviewCount
      const jobStatus = conflictCount > 0 ? 'blocked_for_review' : 'running'
      const statusReason =
        jobStatus === 'blocked_for_review' ? reviewBlockedJobReason : null
      const updateJobStateResult =
        await repository.updateImportJobNormalizationState({
          id: job.id,
          jobStatus,
          currentStage: 'normalization',
          normalizedCandidateCount,
          conflictCount,
          statusReason,
        })

      if (!updateJobStateResult.ok) {
        await markJobFailed(
          repository,
          job,
          startedAt,
          updateJobStateResult.error.code,
          updateJobStateResult.error.message,
        )

        return {
          ok: false,
          error: updateJobStateResult.error,
        }
      }

      return {
        ok: true,
        data: {
          importJobId: job.id,
          importSourceId: job.sourceId,
          normalizationVersion,
          processedCount: normalizedRawPrintings.length,
          createdCount,
          updatedCount,
          skippedCount,
          supersededCount,
          autoResolvedCount,
          unresolvedCount,
          ambiguousCount,
          blockedForReviewCount,
          readyForPublicationCount: autoResolvedCount,
          normalizedCandidateCount,
          conflictCount,
          jobStatus,
          currentStage: 'normalization',
        },
      }
    },
  }
}

function validateNormalizationInput(
  input: NormalizeCardPrintingCandidatesInput,
): NormalizeCardPrintingCandidatesError | null {
  const normalizationVersion = input.normalizationVersion?.trim()

  if (normalizationVersion !== undefined && normalizationVersion.length === 0) {
    return {
      code: 'invalid-input',
      message:
        'Card-printing normalization version must not be empty when provided.',
    }
  }

  if (!input.rawCardPrintingRecordIds) {
    return null
  }

  if (input.rawCardPrintingRecordIds.length === 0) {
    return {
      code: 'invalid-input',
      message:
        'Card-printing normalization requires at least one raw printing id when an explicit selection is provided.',
    }
  }

  const seenRawPrintingRecordIds = new Set<string>()

  for (const rawPrintingRecordId of input.rawCardPrintingRecordIds) {
    const normalizedId = rawPrintingRecordId.trim()

    if (normalizedId.length === 0) {
      return {
        code: 'invalid-input',
        message:
          'Card-printing normalization does not accept empty raw printing ids.',
      }
    }

    if (seenRawPrintingRecordIds.has(normalizedId)) {
      return {
        code: 'invalid-input',
        message:
          'Duplicate raw printing ids are not allowed in one normalization request.',
      }
    }

    seenRawPrintingRecordIds.add(normalizedId)
  }

  return null
}

function isNormalizationRunnable(job: ImportJobRecord) {
  return (
    job.jobStatus === 'pending' ||
    job.jobStatus === 'running' ||
    job.jobStatus === 'blocked_for_review'
  )
}

function normalizeRawCardPrintingForResolution(
  rawPrinting: RawCardPrintingRecord,
): NormalizedRawPrintingForResolution {
  return {
    rawCardPrintingRecordId: rawPrinting.id,
    rawProductRecordId: rawPrinting.rawProductRecordId,
    rawPayloadFingerprint: rawPrinting.payloadFingerprint,
    normalizedName: normalizeNameForMatching(rawPrinting.rawCardName),
    normalizedGrade: parseNormalizedGrade(rawPrinting.rawGradeText),
    normalizedCardType: normalizeOptionalLowercase(rawPrinting.rawCardType),
    normalizedNation: normalizeOptionalLowercase(rawPrinting.rawNation),
    normalizedClan: normalizeOptionalLowercase(rawPrinting.rawClan),
    normalizedTriggerType: normalizeOptionalLowercase(
      rawPrinting.rawTriggerType,
    ),
  }
}

function normalizeNameForMatching(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeOptionalLowercase(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value)
  return normalized ? normalized.toLowerCase() : null
}

function parseNormalizedGrade(value: string | null | undefined): number | null {
  const normalized = normalizeOptionalText(value)

  if (!normalized || !/^\d+$/.test(normalized)) {
    return null
  }

  return Number.parseInt(normalized, 10)
}

function groupExistingResultsByRawPrintingId(
  results: readonly CardPrintingNormalizationResultRecord[],
) {
  const grouped = new Map<string, CardPrintingNormalizationResultRecord[]>()

  for (const result of results) {
    const existingGroup = grouped.get(result.rawCardPrintingRecordId) ?? []
    existingGroup.push(result)
    grouped.set(result.rawCardPrintingRecordId, existingGroup)
  }

  return grouped
}

function groupCatalogCandidatesByNormalizedName(
  entities: readonly CatalogCardEntityNormalizationRecord[],
) {
  const grouped = new Map<string, CatalogCardEntityNormalizationRecord[]>()

  for (const entity of entities) {
    const existingGroup = grouped.get(entity.normalizedName) ?? []
    existingGroup.push(entity)
    grouped.set(entity.normalizedName, existingGroup)
  }

  return grouped
}

function resolveRawPrintingToCandidate(
  rawPrinting: NormalizedRawPrintingForResolution,
  nameMatches: readonly CatalogCardEntityNormalizationRecord[],
): ProposedNormalizationResult {
  if (nameMatches.length === 0) {
    return {
      rawCardPrintingRecordId: rawPrinting.rawCardPrintingRecordId,
      rawProductRecordId: rawPrinting.rawProductRecordId,
      normalizationStatus: 'unresolved',
      resolutionBasis: 'no_name_match',
      proposedCardEntityId: null,
      candidateCardEntityIds: [],
      candidateCount: 0,
      normalizedName: rawPrinting.normalizedName,
      normalizedGrade: rawPrinting.normalizedGrade,
      normalizedCardType: rawPrinting.normalizedCardType,
      normalizedNation: rawPrinting.normalizedNation,
      normalizedClan: rawPrinting.normalizedClan,
      normalizedTriggerType: rawPrinting.normalizedTriggerType,
      rawPayloadFingerprint: rawPrinting.rawPayloadFingerprint,
      needsManualReview: true,
      statusReason:
        'No canonical card entity matched the normalized imported card name.',
      conflictSummary: null,
      resolutionEvidence: {
        matchedFields: ['name'],
        conflictingFields: [],
      },
    }
  }

  const compatibleMatches = nameMatches.filter((entity) =>
    isCompatibleCardEntityMatch(rawPrinting, entity),
  )
  const providedStructuralFields = collectProvidedStructuralFields(rawPrinting)

  if (compatibleMatches.length === 1) {
    const matchedEntity = compatibleMatches[0]!
    const matchedFields = ['name', ...providedStructuralFields]
    const resolutionBasis =
      providedStructuralFields.length > 0
        ? 'exact_name_with_attributes'
        : 'exact_name_only'

    return {
      rawCardPrintingRecordId: rawPrinting.rawCardPrintingRecordId,
      rawProductRecordId: rawPrinting.rawProductRecordId,
      normalizationStatus: 'auto_resolved',
      resolutionBasis,
      proposedCardEntityId: matchedEntity.id,
      candidateCardEntityIds: [matchedEntity.id],
      candidateCount: 1,
      normalizedName: rawPrinting.normalizedName,
      normalizedGrade: rawPrinting.normalizedGrade,
      normalizedCardType: rawPrinting.normalizedCardType,
      normalizedNation: rawPrinting.normalizedNation,
      normalizedClan: rawPrinting.normalizedClan,
      normalizedTriggerType: rawPrinting.normalizedTriggerType,
      rawPayloadFingerprint: rawPrinting.rawPayloadFingerprint,
      needsManualReview: false,
      statusReason:
        resolutionBasis === 'exact_name_with_attributes'
          ? 'Resolved by exact normalized name and compatible structural fields.'
          : 'Resolved by a single exact normalized name match.',
      conflictSummary: null,
      resolutionEvidence: {
        matchedFields,
        conflictingFields: [],
      },
    }
  }

  if (compatibleMatches.length > 1) {
    return {
      rawCardPrintingRecordId: rawPrinting.rawCardPrintingRecordId,
      rawProductRecordId: rawPrinting.rawProductRecordId,
      normalizationStatus: 'ambiguous',
      resolutionBasis: 'ambiguous_name_match',
      proposedCardEntityId: null,
      candidateCardEntityIds: compatibleMatches.map((entity) => entity.id),
      candidateCount: compatibleMatches.length,
      normalizedName: rawPrinting.normalizedName,
      normalizedGrade: rawPrinting.normalizedGrade,
      normalizedCardType: rawPrinting.normalizedCardType,
      normalizedNation: rawPrinting.normalizedNation,
      normalizedClan: rawPrinting.normalizedClan,
      normalizedTriggerType: rawPrinting.normalizedTriggerType,
      rawPayloadFingerprint: rawPrinting.rawPayloadFingerprint,
      needsManualReview: true,
      statusReason:
        'More than one canonical card entity matched the imported printing.',
      conflictSummary:
        'Multiple canonical card entities remained compatible after exact-name matching.',
      resolutionEvidence: {
        matchedFields: ['name', ...providedStructuralFields],
        conflictingFields: [],
      },
    }
  }

  return {
    rawCardPrintingRecordId: rawPrinting.rawCardPrintingRecordId,
    rawProductRecordId: rawPrinting.rawProductRecordId,
    normalizationStatus: 'blocked_for_review',
    resolutionBasis: 'conflicting_name_match',
    proposedCardEntityId: null,
    candidateCardEntityIds: nameMatches.map((entity) => entity.id),
    candidateCount: nameMatches.length,
    normalizedName: rawPrinting.normalizedName,
    normalizedGrade: rawPrinting.normalizedGrade,
    normalizedCardType: rawPrinting.normalizedCardType,
    normalizedNation: rawPrinting.normalizedNation,
    normalizedClan: rawPrinting.normalizedClan,
    normalizedTriggerType: rawPrinting.normalizedTriggerType,
    rawPayloadFingerprint: rawPrinting.rawPayloadFingerprint,
    needsManualReview: true,
    statusReason:
      'Exact-name matches existed, but the imported structural fields conflicted with all canonical candidates.',
    conflictSummary:
      'Existing canonical cards shared the imported name, but none remained compatible after grade/type/nation/clan/trigger checks.',
    resolutionEvidence: {
      matchedFields: ['name'],
      conflictingFields: collectProvidedStructuralFields(rawPrinting),
    },
  }
}

function isCompatibleCardEntityMatch(
  rawPrinting: NormalizedRawPrintingForResolution,
  entity: CatalogCardEntityNormalizationRecord,
) {
  if (
    rawPrinting.normalizedGrade !== null &&
    entity.grade !== rawPrinting.normalizedGrade
  ) {
    return false
  }

  if (
    rawPrinting.normalizedCardType !== null &&
    entity.cardType.toLowerCase() !== rawPrinting.normalizedCardType
  ) {
    return false
  }

  if (
    rawPrinting.normalizedNation !== null &&
    entity.nation.toLowerCase() !== rawPrinting.normalizedNation
  ) {
    return false
  }

  if (
    rawPrinting.normalizedClan !== null &&
    (entity.clan?.toLowerCase() ?? null) !== rawPrinting.normalizedClan
  ) {
    return false
  }

  if (
    rawPrinting.normalizedTriggerType !== null &&
    (entity.triggerType?.toLowerCase() ?? null) !==
      rawPrinting.normalizedTriggerType
  ) {
    return false
  }

  return true
}

function collectProvidedStructuralFields(
  rawPrinting: NormalizedRawPrintingForResolution,
) {
  const fields: string[] = []

  if (rawPrinting.normalizedGrade !== null) {
    fields.push('grade')
  }

  if (rawPrinting.normalizedCardType !== null) {
    fields.push('cardType')
  }

  if (rawPrinting.normalizedNation !== null) {
    fields.push('nation')
  }

  if (rawPrinting.normalizedClan !== null) {
    fields.push('clan')
  }

  if (rawPrinting.normalizedTriggerType !== null) {
    fields.push('triggerType')
  }

  return fields
}

function trackResultStatusCounts(
  status: ProposedNormalizationResult['normalizationStatus'],
  counters: {
    readonly incrementAutoResolved: () => void
    readonly incrementUnresolved: () => void
    readonly incrementAmbiguous: () => void
    readonly incrementBlockedForReview: () => void
  },
) {
  if (status === 'auto_resolved') {
    counters.incrementAutoResolved()
    return
  }

  if (status === 'unresolved') {
    counters.incrementUnresolved()
    return
  }

  if (status === 'ambiguous') {
    counters.incrementAmbiguous()
    return
  }

  counters.incrementBlockedForReview()
}

function createUpsertNormalizationResultInput(
  importJobId: string,
  normalizationVersion: string,
  result: ProposedNormalizationResult,
) {
  return {
    importJobId,
    rawCardPrintingRecordId: result.rawCardPrintingRecordId,
    rawProductRecordId: result.rawProductRecordId,
    normalizationVersion,
    normalizationStatus: result.normalizationStatus,
    resolutionBasis: result.resolutionBasis,
    proposedCardEntityId: result.proposedCardEntityId,
    candidateCardEntityIds: result.candidateCardEntityIds,
    candidateCount: result.candidateCount,
    normalizedName: result.normalizedName,
    normalizedGrade: result.normalizedGrade,
    normalizedCardType: result.normalizedCardType,
    normalizedNation: result.normalizedNation,
    normalizedClan: result.normalizedClan,
    normalizedTriggerType: result.normalizedTriggerType,
    rawPayloadFingerprint: result.rawPayloadFingerprint,
    needsManualReview: result.needsManualReview,
    statusReason: result.statusReason,
    conflictSummary: result.conflictSummary,
    resolutionEvidence: result.resolutionEvidence,
    updatedAt: new Date().toISOString(),
  }
}

function isSameNormalizationResult(
  existingResult: CardPrintingNormalizationResultRecord,
  nextResult: ProposedNormalizationResult,
) {
  return (
    existingResult.normalizationStatus === nextResult.normalizationStatus &&
    existingResult.resolutionBasis === nextResult.resolutionBasis &&
    existingResult.proposedCardEntityId === nextResult.proposedCardEntityId &&
    existingResult.candidateCount === nextResult.candidateCount &&
    areStringListsEqual(
      existingResult.candidateCardEntityIds,
      nextResult.candidateCardEntityIds,
    ) &&
    existingResult.normalizedName === nextResult.normalizedName &&
    existingResult.normalizedGrade === nextResult.normalizedGrade &&
    existingResult.normalizedCardType === nextResult.normalizedCardType &&
    existingResult.normalizedNation === nextResult.normalizedNation &&
    existingResult.normalizedClan === nextResult.normalizedClan &&
    existingResult.normalizedTriggerType === nextResult.normalizedTriggerType &&
    existingResult.rawPayloadFingerprint === nextResult.rawPayloadFingerprint &&
    existingResult.needsManualReview === nextResult.needsManualReview &&
    existingResult.statusReason === nextResult.statusReason &&
    existingResult.conflictSummary === nextResult.conflictSummary &&
    existingResult.rawProductRecordId === nextResult.rawProductRecordId &&
    createPayloadFingerprint(
      existingResult.resolutionEvidence as JsonObject,
    ) === createPayloadFingerprint(nextResult.resolutionEvidence)
  )
}

function areStringListsEqual(
  left: readonly string[],
  right: readonly string[],
) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

async function markJobFailed(
  repository: ImporterRepository,
  job: ImportJobRecord,
  startedAt: string,
  errorCode: string,
  statusReason: string,
) {
  await repository.markImportJobFailed({
    id: job.id,
    currentStage: 'normalization',
    startedAt,
    finishedAt: new Date().toISOString(),
    errorCode,
    statusReason,
  })
}
