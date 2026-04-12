import type { RepositoryError } from '@web-vg/db'
import type {
  CardPrintingNormalizationResultRecord,
  ImporterRepository,
  ManualReviewItemRecord,
  ManualReviewReason,
  ManualReviewResolutionKind,
  UpsertManualReviewItemInput,
} from '@web-vg/db/repositories/importer'

import { normalizeOptionalText, type JsonObject } from '../raw/shared'

const activeReviewStatuses = ['open', 'in_review'] as const
const exceptionalNormalizationBases = new Set([
  'exceptional_card_shape',
  'exceptional_import_shape',
  'exceptional_metadata_gap',
])

export interface SyncManualReviewQueueInput {
  readonly importJobId: string
  readonly normalizationResultIds?: readonly string[]
}

export interface SyncManualReviewQueueSuccess {
  readonly importJobId: string
  readonly processedCount: number
  readonly createdCount: number
  readonly updatedCount: number
  readonly skippedCount: number
  readonly supersededCount: number
  readonly cancelledCount: number
  readonly openCount: number
  readonly inReviewCount: number
}

export type SyncManualReviewQueueErrorCode =
  | 'invalid-input'
  | 'job-not-found'
  | 'query-failed'

export interface SyncManualReviewQueueError {
  readonly code: SyncManualReviewQueueErrorCode
  readonly message: string
  readonly details?: string
}

export type SyncManualReviewQueueResult =
  | {
      readonly ok: true
      readonly data: SyncManualReviewQueueSuccess
    }
  | {
      readonly ok: false
      readonly error: SyncManualReviewQueueError
    }

export interface StartManualReviewInput {
  readonly reviewItemId: string
}

export interface ResolveManualReviewInput {
  readonly reviewItemId: string
  readonly resolutionKind: Exclude<
    ManualReviewResolutionKind,
    'reject_imported_record'
  >
  readonly resolvedCardEntityId?: string | null
  readonly decisionNotes?: string | null
}

export interface RejectManualReviewInput {
  readonly reviewItemId: string
  readonly decisionNotes?: string | null
}

export interface CancelManualReviewInput {
  readonly reviewItemId: string
  readonly decisionNotes?: string | null
}

export interface ListManualReviewItemsInput {
  readonly importJobId: string
  readonly reviewStatuses?: readonly ManualReviewItemRecord['reviewStatus'][]
}

export type ManualReviewQueueMutationErrorCode =
  | 'invalid-input'
  | 'review-item-not-found'
  | 'review-item-not-actionable'
  | 'query-failed'

export interface ManualReviewQueueMutationError {
  readonly code: ManualReviewQueueMutationErrorCode
  readonly message: string
  readonly details?: string
}

export type ManualReviewQueueMutationResult =
  | {
      readonly ok: true
      readonly data: ManualReviewItemRecord
    }
  | {
      readonly ok: false
      readonly error: ManualReviewQueueMutationError
    }

export interface ManualReviewQueue {
  syncFromNormalizationResults(
    input: SyncManualReviewQueueInput,
  ): Promise<SyncManualReviewQueueResult>
  listItems(input: ListManualReviewItemsInput): Promise<
    | {
        readonly ok: true
        readonly data: readonly ManualReviewItemRecord[]
      }
    | {
        readonly ok: false
        readonly error: SyncManualReviewQueueError
      }
  >
  startReview(
    input: StartManualReviewInput,
  ): Promise<ManualReviewQueueMutationResult>
  resolveItem(
    input: ResolveManualReviewInput,
  ): Promise<ManualReviewQueueMutationResult>
  rejectItem(
    input: RejectManualReviewInput,
  ): Promise<ManualReviewQueueMutationResult>
  cancelItem(
    input: CancelManualReviewInput,
  ): Promise<ManualReviewQueueMutationResult>
}

interface DerivedReviewItem {
  readonly importJobId: string
  readonly normalizationResultId: string
  readonly rawCardPrintingRecordId: string
  readonly rawProductRecordId: string | null
  readonly reviewReason: ManualReviewReason
  readonly summary: string
  readonly contextPayload: JsonObject
  readonly candidateCardEntityIds: readonly string[]
  readonly proposedCardEntityId: string | null
}

export function createManualReviewQueue(
  repository: ImporterRepository,
): ManualReviewQueue {
  return {
    async syncFromNormalizationResults(input) {
      const validationError = validateSyncInput(input)

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
          error: mapSyncRepositoryError(jobResult.error),
        }
      }

      const job = jobResult.data

      if (!job) {
        return {
          ok: false,
          error: {
            code: 'job-not-found',
            message: 'Manual review queue job was not found.',
          },
        }
      }

      const normalizationResultsResult =
        await repository.listCardPrintingNormalizationResultsByJob(job.id)

      if (!normalizationResultsResult.ok) {
        return {
          ok: false,
          error: mapSyncRepositoryError(normalizationResultsResult.error),
        }
      }

      const scopedNormalizationResults = selectNormalizationResultsForSync(
        normalizationResultsResult.data,
        input.normalizationResultIds,
      )

      if (scopedNormalizationResults.length === 0) {
        return {
          ok: true,
          data: {
            importJobId: job.id,
            processedCount: 0,
            createdCount: 0,
            updatedCount: 0,
            skippedCount: 0,
            supersededCount: 0,
            cancelledCount: 0,
            openCount: 0,
            inReviewCount: 0,
          },
        }
      }

      const existingItemsResult =
        await repository.listManualReviewItemsByNormalizationResultIds(
          scopedNormalizationResults.map((result) => result.id),
        )

      if (!existingItemsResult.ok) {
        return {
          ok: false,
          error: mapSyncRepositoryError(existingItemsResult.error),
        }
      }

      const existingItemsByNormalizationResultId = new Map(
        existingItemsResult.data.map((item) => [
          item.normalizationResultId,
          item,
        ]),
      )

      let createdCount = 0
      let updatedCount = 0
      let skippedCount = 0
      let supersededCount = 0
      let cancelledCount = 0

      const upsertPayload: UpsertManualReviewItemInput[] = []

      for (const normalizationResult of scopedNormalizationResults) {
        const existingItem = existingItemsByNormalizationResultId.get(
          normalizationResult.id,
        )
        const derivedReviewItem = deriveReviewItem(normalizationResult)

        if (!derivedReviewItem) {
          if (
            existingItem &&
            existingItem.reviewStatus !== 'superseded' &&
            existingItem.reviewStatus !== 'cancelled'
          ) {
            const nextStatus =
              normalizationResult.normalizationStatus === 'superseded'
                ? 'superseded'
                : 'cancelled'
            const statusUpdateResult =
              await repository.updateManualReviewItemStatus({
                id: existingItem.id,
                reviewStatus: nextStatus,
                resolutionKind: existingItem.resolutionKind,
                resolvedCardEntityId: existingItem.resolvedCardEntityId,
                decisionNotes:
                  existingItem.decisionNotes ??
                  (nextStatus === 'superseded'
                    ? 'Superseded by a newer normalization result.'
                    : 'Normalization result no longer requires manual review.'),
                startedReviewAt: existingItem.startedReviewAt,
                resolvedAt:
                  nextStatus === 'cancelled'
                    ? existingItem.resolvedAt
                    : existingItem.resolvedAt,
                closedAt: new Date().toISOString(),
              })

            if (!statusUpdateResult.ok) {
              return {
                ok: false,
                error: mapSyncRepositoryError(statusUpdateResult.error),
              }
            }

            if (nextStatus === 'superseded') {
              supersededCount += 1
            } else {
              cancelledCount += 1
            }
          } else {
            skippedCount += 1
          }

          continue
        }

        if (!existingItem) {
          createdCount += 1
          upsertPayload.push(
            createManualReviewUpsertInput(derivedReviewItem, null),
          )
          continue
        }

        const isSameReviewItem = isSameDerivedReviewItem(
          existingItem,
          derivedReviewItem,
        )

        if (existingItem.reviewStatus === 'open') {
          if (isSameReviewItem) {
            skippedCount += 1
            continue
          }

          updatedCount += 1
          upsertPayload.push(
            createManualReviewUpsertInput(derivedReviewItem, existingItem),
          )
          continue
        }

        if (existingItem.reviewStatus === 'in_review') {
          if (isSameReviewItem) {
            skippedCount += 1
            continue
          }

          updatedCount += 1
          upsertPayload.push(
            createManualReviewUpsertInput(derivedReviewItem, existingItem),
          )
          continue
        }

        if (
          existingItem.reviewStatus === 'resolved' ||
          existingItem.reviewStatus === 'rejected'
        ) {
          if (isSameReviewItem) {
            skippedCount += 1
            continue
          }

          updatedCount += 1
          upsertPayload.push(
            createManualReviewUpsertInput(
              derivedReviewItem,
              createReopenedReviewItem(existingItem),
            ),
          )
          continue
        }

        if (
          existingItem.reviewStatus === 'superseded' ||
          existingItem.reviewStatus === 'cancelled'
        ) {
          updatedCount += 1
          upsertPayload.push(
            createManualReviewUpsertInput(
              derivedReviewItem,
              createReopenedReviewItem(existingItem),
            ),
          )
          continue
        }

        updatedCount += 1
        upsertPayload.push(
          createManualReviewUpsertInput(derivedReviewItem, existingItem),
        )
      }

      if (upsertPayload.length > 0) {
        const upsertResult =
          await repository.upsertManualReviewItems(upsertPayload)

        if (!upsertResult.ok) {
          return {
            ok: false,
            error: mapSyncRepositoryError(upsertResult.error),
          }
        }
      }

      const activeItemsResult = await repository.listManualReviewItemsByJob(
        job.id,
        activeReviewStatuses,
      )

      if (!activeItemsResult.ok) {
        return {
          ok: false,
          error: mapSyncRepositoryError(activeItemsResult.error),
        }
      }

      const openCount = activeItemsResult.data.filter(
        (item) => item.reviewStatus === 'open',
      ).length
      const inReviewCount = activeItemsResult.data.filter(
        (item) => item.reviewStatus === 'in_review',
      ).length

      return {
        ok: true,
        data: {
          importJobId: job.id,
          processedCount: scopedNormalizationResults.length,
          createdCount,
          updatedCount,
          skippedCount,
          supersededCount,
          cancelledCount,
          openCount,
          inReviewCount,
        },
      }
    },

    async listItems(input) {
      const jobResult = await repository.getImportJobById(input.importJobId)

      if (!jobResult.ok) {
        return {
          ok: false,
          error: mapSyncRepositoryError(jobResult.error),
        }
      }

      if (!jobResult.data) {
        return {
          ok: false,
          error: {
            code: 'job-not-found',
            message: 'Manual review queue job was not found.',
          },
        }
      }

      const itemsResult = await repository.listManualReviewItemsByJob(
        input.importJobId,
        input.reviewStatuses,
      )

      if (!itemsResult.ok) {
        return {
          ok: false,
          error: mapSyncRepositoryError(itemsResult.error),
        }
      }

      return {
        ok: true,
        data: itemsResult.data,
      }
    },

    async startReview(input) {
      const reviewItemResult = await repository.getManualReviewItemById(
        input.reviewItemId,
      )

      if (!reviewItemResult.ok) {
        return {
          ok: false,
          error: mapMutationRepositoryError(reviewItemResult.error),
        }
      }

      const reviewItem = reviewItemResult.data

      if (!reviewItem) {
        return {
          ok: false,
          error: {
            code: 'review-item-not-found',
            message: 'Manual review item was not found.',
          },
        }
      }

      if (reviewItem.reviewStatus !== 'open') {
        return {
          ok: false,
          error: {
            code: 'review-item-not-actionable',
            message: 'Only open review items can enter active review.',
            details: `Current review status: ${reviewItem.reviewStatus}.`,
          },
        }
      }

      const updatedResult = await repository.updateManualReviewItemStatus({
        id: reviewItem.id,
        reviewStatus: 'in_review',
        resolutionKind: reviewItem.resolutionKind,
        resolvedCardEntityId: reviewItem.resolvedCardEntityId,
        decisionNotes: reviewItem.decisionNotes,
        startedReviewAt: reviewItem.startedReviewAt ?? new Date().toISOString(),
        resolvedAt: reviewItem.resolvedAt,
        closedAt: reviewItem.closedAt,
      })

      return updatedResult.ok
        ? {
            ok: true,
            data: updatedResult.data,
          }
        : {
            ok: false,
            error: mapMutationRepositoryError(updatedResult.error),
          }
    },

    async resolveItem(input) {
      const reviewItemState = await loadActionableReviewItem(
        repository,
        input.reviewItemId,
      )

      if (!reviewItemState.ok) {
        return reviewItemState
      }

      const reviewItem = reviewItemState.data
      const decisionNotes = normalizeOptionalText(input.decisionNotes)

      if (
        (input.resolutionKind === 'accept_proposed_match' ||
          input.resolutionKind === 'select_candidate_match') &&
        !input.resolvedCardEntityId
      ) {
        return {
          ok: false,
          error: {
            code: 'invalid-input',
            message:
              'Resolving a review item to a canonical match requires a resolved card entity id.',
          },
        }
      }

      const now = new Date().toISOString()
      const updatedResult = await repository.updateManualReviewItemStatus({
        id: reviewItem.id,
        reviewStatus: 'resolved',
        resolutionKind: input.resolutionKind,
        resolvedCardEntityId: input.resolvedCardEntityId ?? null,
        decisionNotes,
        startedReviewAt: reviewItem.startedReviewAt ?? now,
        resolvedAt: now,
        closedAt: now,
      })

      return updatedResult.ok
        ? {
            ok: true,
            data: updatedResult.data,
          }
        : {
            ok: false,
            error: mapMutationRepositoryError(updatedResult.error),
          }
    },

    async rejectItem(input) {
      const reviewItemState = await loadActionableReviewItem(
        repository,
        input.reviewItemId,
      )

      if (!reviewItemState.ok) {
        return reviewItemState
      }

      const reviewItem = reviewItemState.data
      const now = new Date().toISOString()
      const updatedResult = await repository.updateManualReviewItemStatus({
        id: reviewItem.id,
        reviewStatus: 'rejected',
        resolutionKind: 'reject_imported_record',
        resolvedCardEntityId: null,
        decisionNotes: normalizeOptionalText(input.decisionNotes),
        startedReviewAt: reviewItem.startedReviewAt ?? now,
        resolvedAt: now,
        closedAt: now,
      })

      return updatedResult.ok
        ? {
            ok: true,
            data: updatedResult.data,
          }
        : {
            ok: false,
            error: mapMutationRepositoryError(updatedResult.error),
          }
    },

    async cancelItem(input) {
      const reviewItemResult = await repository.getManualReviewItemById(
        input.reviewItemId,
      )

      if (!reviewItemResult.ok) {
        return {
          ok: false,
          error: mapMutationRepositoryError(reviewItemResult.error),
        }
      }

      const reviewItem = reviewItemResult.data

      if (!reviewItem) {
        return {
          ok: false,
          error: {
            code: 'review-item-not-found',
            message: 'Manual review item was not found.',
          },
        }
      }

      if (
        reviewItem.reviewStatus === 'resolved' ||
        reviewItem.reviewStatus === 'rejected' ||
        reviewItem.reviewStatus === 'superseded' ||
        reviewItem.reviewStatus === 'cancelled'
      ) {
        return {
          ok: false,
          error: {
            code: 'review-item-not-actionable',
            message: 'Terminal review items cannot be cancelled again.',
            details: `Current review status: ${reviewItem.reviewStatus}.`,
          },
        }
      }

      const now = new Date().toISOString()
      const updatedResult = await repository.updateManualReviewItemStatus({
        id: reviewItem.id,
        reviewStatus: 'cancelled',
        resolutionKind: reviewItem.resolutionKind,
        resolvedCardEntityId: reviewItem.resolvedCardEntityId,
        decisionNotes:
          normalizeOptionalText(input.decisionNotes) ??
          reviewItem.decisionNotes,
        startedReviewAt: reviewItem.startedReviewAt,
        resolvedAt: reviewItem.resolvedAt,
        closedAt: now,
      })

      return updatedResult.ok
        ? {
            ok: true,
            data: updatedResult.data,
          }
        : {
            ok: false,
            error: mapMutationRepositoryError(updatedResult.error),
          }
    },
  }
}

function validateSyncInput(
  input: SyncManualReviewQueueInput,
): SyncManualReviewQueueError | null {
  if (!input.normalizationResultIds) {
    return null
  }

  if (input.normalizationResultIds.length === 0) {
    return {
      code: 'invalid-input',
      message:
        'Manual review queue sync requires at least one normalization result id when an explicit selection is provided.',
    }
  }

  const seenNormalizationResultIds = new Set<string>()

  for (const normalizationResultId of input.normalizationResultIds) {
    const normalizedId = normalizationResultId.trim()

    if (normalizedId.length === 0) {
      return {
        code: 'invalid-input',
        message:
          'Manual review queue sync does not accept empty normalization result ids.',
      }
    }

    if (seenNormalizationResultIds.has(normalizedId)) {
      return {
        code: 'invalid-input',
        message:
          'Duplicate normalization result ids are not allowed in one manual review queue sync request.',
      }
    }

    seenNormalizationResultIds.add(normalizedId)
  }

  return null
}

function selectNormalizationResultsForSync(
  results: readonly CardPrintingNormalizationResultRecord[],
  normalizationResultIds: readonly string[] | undefined,
) {
  if (!normalizationResultIds) {
    return results
  }

  const selectedIds = new Set(normalizationResultIds)
  return results.filter((result) => selectedIds.has(result.id))
}

function deriveReviewItem(
  normalizationResult: CardPrintingNormalizationResultRecord,
): DerivedReviewItem | null {
  if (normalizationResult.normalizationStatus === 'auto_resolved') {
    return null
  }

  if (normalizationResult.normalizationStatus === 'superseded') {
    return null
  }

  const reviewReason = mapReviewReason(normalizationResult)
  const summary = buildReviewSummary(normalizationResult, reviewReason)

  return {
    importJobId: normalizationResult.importJobId,
    normalizationResultId: normalizationResult.id,
    rawCardPrintingRecordId: normalizationResult.rawCardPrintingRecordId,
    rawProductRecordId: normalizationResult.rawProductRecordId,
    reviewReason,
    summary,
    contextPayload: {
      normalizationStatus: normalizationResult.normalizationStatus,
      resolutionBasis: normalizationResult.resolutionBasis,
      normalizedName: normalizationResult.normalizedName,
      normalizedGrade: normalizationResult.normalizedGrade,
      normalizedCardType: normalizationResult.normalizedCardType,
      normalizedNation: normalizationResult.normalizedNation,
      normalizedClan: normalizationResult.normalizedClan,
      normalizedTriggerType: normalizationResult.normalizedTriggerType,
      candidateCount: normalizationResult.candidateCount,
      candidateCardEntityIds: [...normalizationResult.candidateCardEntityIds],
      proposedCardEntityId: normalizationResult.proposedCardEntityId,
      statusReason: normalizationResult.statusReason,
      conflictSummary: normalizationResult.conflictSummary,
      resolutionEvidence: normalizationResult.resolutionEvidence,
    },
    candidateCardEntityIds: [...normalizationResult.candidateCardEntityIds],
    proposedCardEntityId: normalizationResult.proposedCardEntityId,
  }
}

function mapReviewReason(
  normalizationResult: CardPrintingNormalizationResultRecord,
): ManualReviewReason {
  if (normalizationResult.normalizationStatus === 'unresolved') {
    return 'unresolved_mapping'
  }

  if (normalizationResult.normalizationStatus === 'ambiguous') {
    return 'ambiguous_mapping'
  }

  return exceptionalNormalizationBases.has(normalizationResult.resolutionBasis)
    ? 'exceptional_card'
    : 'conflicting_facts'
}

function buildReviewSummary(
  normalizationResult: CardPrintingNormalizationResultRecord,
  reviewReason: ManualReviewReason,
) {
  const cardName = normalizationResult.normalizedName

  if (reviewReason === 'unresolved_mapping') {
    return `No canonical card entity matched "${cardName}".`
  }

  if (reviewReason === 'ambiguous_mapping') {
    return `Multiple canonical card entities matched "${cardName}".`
  }

  if (reviewReason === 'exceptional_card') {
    return `Imported printing "${cardName}" requires exceptional manual handling.`
  }

  return `Imported facts for "${cardName}" conflicted with available canonical matches.`
}

function isSameDerivedReviewItem(
  existingItem: ManualReviewItemRecord,
  nextItem: DerivedReviewItem,
) {
  return (
    existingItem.reviewReason === nextItem.reviewReason &&
    existingItem.summary === nextItem.summary &&
    existingItem.rawCardPrintingRecordId === nextItem.rawCardPrintingRecordId &&
    existingItem.rawProductRecordId === nextItem.rawProductRecordId &&
    existingItem.proposedCardEntityId === nextItem.proposedCardEntityId &&
    areStringListsEqual(
      existingItem.candidateCardEntityIds,
      nextItem.candidateCardEntityIds,
    ) &&
    JSON.stringify(existingItem.contextPayload) ===
      JSON.stringify(nextItem.contextPayload)
  )
}

function createManualReviewUpsertInput(
  nextItem: DerivedReviewItem,
  existingItem: ManualReviewItemRecord | null,
) {
  return {
    importJobId: nextItem.importJobId,
    normalizationResultId: nextItem.normalizationResultId,
    rawCardPrintingRecordId: nextItem.rawCardPrintingRecordId,
    rawProductRecordId: nextItem.rawProductRecordId,
    reviewReason: nextItem.reviewReason,
    reviewStatus: existingItem?.reviewStatus ?? 'open',
    summary: nextItem.summary,
    contextPayload: nextItem.contextPayload,
    candidateCardEntityIds: nextItem.candidateCardEntityIds,
    proposedCardEntityId: nextItem.proposedCardEntityId,
    resolutionKind: existingItem?.resolutionKind ?? null,
    resolvedCardEntityId: existingItem?.resolvedCardEntityId ?? null,
    decisionNotes: existingItem?.decisionNotes ?? null,
    openedAt: existingItem?.openedAt ?? new Date().toISOString(),
    startedReviewAt: existingItem?.startedReviewAt ?? null,
    resolvedAt: existingItem?.resolvedAt ?? null,
    closedAt: existingItem?.closedAt ?? null,
    updatedAt: new Date().toISOString(),
  }
}

function createReopenedReviewItem(existingItem: ManualReviewItemRecord) {
  return {
    ...existingItem,
    reviewStatus: 'open' as const,
    resolutionKind: null,
    resolvedCardEntityId: null,
    decisionNotes: null,
    startedReviewAt: null,
    resolvedAt: null,
    closedAt: null,
  }
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

async function loadActionableReviewItem(
  repository: ImporterRepository,
  reviewItemId: string,
): Promise<
  | {
      readonly ok: true
      readonly data: ManualReviewItemRecord
    }
  | {
      readonly ok: false
      readonly error: ManualReviewQueueMutationError
    }
> {
  const reviewItemResult =
    await repository.getManualReviewItemById(reviewItemId)

  if (!reviewItemResult.ok) {
    return {
      ok: false,
      error: mapMutationRepositoryError(reviewItemResult.error),
    }
  }

  const reviewItem = reviewItemResult.data

  if (!reviewItem) {
    return {
      ok: false,
      error: {
        code: 'review-item-not-found',
        message: 'Manual review item was not found.',
      },
    }
  }

  if (
    reviewItem.reviewStatus !== 'open' &&
    reviewItem.reviewStatus !== 'in_review'
  ) {
    return {
      ok: false,
      error: {
        code: 'review-item-not-actionable',
        message:
          'Only open or in-review items can be updated through manual review actions.',
        details: `Current review status: ${reviewItem.reviewStatus}.`,
      },
    }
  }

  return {
    ok: true,
    data: reviewItem,
  }
}

function mapSyncRepositoryError(
  error: RepositoryError,
): SyncManualReviewQueueError {
  return {
    code: 'query-failed',
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
  }
}

function mapMutationRepositoryError(
  error: RepositoryError,
): ManualReviewQueueMutationError {
  return {
    code: 'query-failed',
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
  }
}
