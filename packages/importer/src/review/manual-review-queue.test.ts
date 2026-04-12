import { describe, expect, it } from 'vitest'

import type { RepositoryResult } from '@web-vg/db'
import type {
  CardPrintingNormalizationResultRecord,
  CatalogCardEntityNormalizationRecord,
  ImporterRepository,
  ImportJobRecord,
  ManualReviewItemRecord,
  ManualReviewResolutionKind,
} from '@web-vg/db/repositories/importer'

import { createManualReviewQueue } from './manual-review-queue'

type Mutable<T> = {
  -readonly [K in keyof T]: T[K]
}

describe('manual review queue', () => {
  it('creates explicit review items for unresolved, ambiguous, conflicting, and exceptional normalization outcomes', async () => {
    const repository = createRepositoryDouble({
      job: createJob(),
      normalizationResults: [
        createNormalizationResult({
          id: 'result-unresolved',
          normalizationStatus: 'unresolved',
          resolutionBasis: 'no_name_match',
          normalizedName: 'unknown card',
          statusReason:
            'No canonical card entity matched the normalized imported card name.',
        }),
        createNormalizationResult({
          id: 'result-ambiguous',
          normalizationStatus: 'ambiguous',
          resolutionBasis: 'ambiguous_name_match',
          normalizedName: 'blaster dark',
          candidateCardEntityIds: ['entity-1', 'entity-2'],
          candidateCount: 2,
          statusReason:
            'More than one canonical card entity matched the imported printing.',
        }),
        createNormalizationResult({
          id: 'result-conflict',
          normalizationStatus: 'blocked_for_review',
          resolutionBasis: 'conflicting_name_match',
          normalizedName: 'apex ruler, bastion',
          candidateCardEntityIds: ['entity-3'],
          candidateCount: 1,
          statusReason:
            'Exact-name matches existed, but the imported structural fields conflicted with all canonical candidates.',
          conflictSummary:
            'Existing canonical cards shared the imported name, but none remained compatible after structural checks.',
        }),
        createNormalizationResult({
          id: 'result-exceptional',
          normalizationStatus: 'blocked_for_review',
          resolutionBasis: 'exceptional_card_shape',
          normalizedName: 'token marker',
          statusReason:
            'Imported printing has an exceptional structure that the normal matcher cannot safely interpret.',
        }),
      ],
    })

    const queue = createManualReviewQueue(repository)
    const result = await queue.syncFromNormalizationResults({
      importJobId: 'job-1',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        importJobId: 'job-1',
        processedCount: 4,
        createdCount: 4,
        updatedCount: 0,
        skippedCount: 0,
        supersededCount: 0,
        cancelledCount: 0,
        openCount: 4,
        inReviewCount: 0,
      },
    })
    expect(repository.manualReviewItems).toEqual([
      expect.objectContaining({
        normalizationResultId: 'result-unresolved',
        reviewReason: 'unresolved_mapping',
        reviewStatus: 'open',
      }),
      expect.objectContaining({
        normalizationResultId: 'result-ambiguous',
        reviewReason: 'ambiguous_mapping',
        candidateCardEntityIds: ['entity-1', 'entity-2'],
      }),
      expect.objectContaining({
        normalizationResultId: 'result-conflict',
        reviewReason: 'conflicting_facts',
      }),
      expect.objectContaining({
        normalizationResultId: 'result-exceptional',
        reviewReason: 'exceptional_card',
      }),
    ])
  })

  it('supersedes stale review items and creates a new open item for the latest normalization result', async () => {
    const repository = createRepositoryDouble({
      job: createJob(),
      normalizationResults: [
        createNormalizationResult({
          id: 'result-old',
          normalizationStatus: 'superseded',
          resolutionBasis: 'ambiguous_name_match',
          normalizedName: 'blaster dark',
          candidateCardEntityIds: ['entity-1', 'entity-2'],
          candidateCount: 2,
          statusReason: 'Older normalization result.',
        }),
        createNormalizationResult({
          id: 'result-new',
          normalizationStatus: 'ambiguous',
          resolutionBasis: 'ambiguous_name_match',
          normalizedName: 'blaster dark',
          candidateCardEntityIds: ['entity-2', 'entity-3'],
          candidateCount: 2,
          statusReason:
            'More than one canonical card entity matched the imported printing.',
        }),
      ],
      manualReviewItems: [
        createManualReviewItem({
          id: 'review-1',
          normalizationResultId: 'result-old',
          reviewReason: 'ambiguous_mapping',
          reviewStatus: 'open',
        }),
      ],
    })

    const queue = createManualReviewQueue(repository)
    const result = await queue.syncFromNormalizationResults({
      importJobId: 'job-1',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        importJobId: 'job-1',
        processedCount: 2,
        createdCount: 1,
        updatedCount: 0,
        skippedCount: 0,
        supersededCount: 1,
        cancelledCount: 0,
        openCount: 1,
        inReviewCount: 0,
      },
    })
    expect(
      repository.manualReviewItems.find((item) => item.id === 'review-1'),
    ).toEqual(
      expect.objectContaining({
        reviewStatus: 'superseded',
      }),
    )
    expect(
      repository.manualReviewItems.find(
        (item) => item.normalizationResultId === 'result-new',
      ),
    ).toEqual(
      expect.objectContaining({
        reviewStatus: 'open',
        reviewReason: 'ambiguous_mapping',
      }),
    )
  })

  it('supports a minimal review lifecycle without touching published catalog truth', async () => {
    const repository = createRepositoryDouble({
      job: createJob(),
      normalizationResults: [
        createNormalizationResult({
          id: 'result-1',
          normalizationStatus: 'ambiguous',
          resolutionBasis: 'ambiguous_name_match',
          normalizedName: 'blaster dark',
          candidateCardEntityIds: ['entity-1', 'entity-2'],
          candidateCount: 2,
          statusReason:
            'More than one canonical card entity matched the imported printing.',
        }),
      ],
      manualReviewItems: [
        createManualReviewItem({
          id: 'review-1',
          normalizationResultId: 'result-1',
          reviewReason: 'ambiguous_mapping',
          reviewStatus: 'open',
        }),
      ],
    })

    const queue = createManualReviewQueue(repository)
    const started = await queue.startReview({
      reviewItemId: 'review-1',
    })
    const resolved = await queue.resolveItem({
      reviewItemId: 'review-1',
      resolutionKind: 'select_candidate_match',
      resolvedCardEntityId: 'entity-2',
      decisionNotes: 'Use the later canonical mapping.',
    })

    expect(started.ok).toBe(true)
    expect(resolved.ok).toBe(true)
    if (resolved.ok) {
      expect(resolved.data).toMatchObject({
        id: 'review-1',
        reviewStatus: 'resolved',
        resolutionKind:
          'select_candidate_match' satisfies ManualReviewResolutionKind,
        resolvedCardEntityId: 'entity-2',
        decisionNotes: 'Use the later canonical mapping.',
      })
    }
    expect(repository.catalogWrites).toHaveLength(0)
  })

  it('reopens a resolved review item when the same normalization result changes materially', async () => {
    const repository = createRepositoryDouble({
      job: createJob(),
      normalizationResults: [
        createNormalizationResult({
          id: 'result-1',
          normalizationStatus: 'ambiguous',
          resolutionBasis: 'ambiguous_name_match',
          normalizedName: 'blaster dark',
          candidateCardEntityIds: ['entity-2', 'entity-3'],
          candidateCount: 2,
          statusReason:
            'More than one canonical card entity matched the imported printing.',
        }),
      ],
      manualReviewItems: [
        {
          ...createManualReviewItem({
            id: 'review-1',
            normalizationResultId: 'result-1',
            reviewReason: 'ambiguous_mapping',
            reviewStatus: 'resolved',
          }),
          candidateCardEntityIds: ['entity-1', 'entity-2'],
          resolutionKind: 'select_candidate_match',
          resolvedCardEntityId: 'entity-2',
          decisionNotes: 'Previous manual match.',
          startedReviewAt: '2026-04-09T10:05:00.000Z',
          resolvedAt: '2026-04-09T10:10:00.000Z',
          closedAt: '2026-04-09T10:10:00.000Z',
        },
      ],
    })

    const queue = createManualReviewQueue(repository)
    const result = await queue.syncFromNormalizationResults({
      importJobId: 'job-1',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        importJobId: 'job-1',
        processedCount: 1,
        createdCount: 0,
        updatedCount: 1,
        skippedCount: 0,
        supersededCount: 0,
        cancelledCount: 0,
        openCount: 1,
        inReviewCount: 0,
      },
    })
    expect(repository.manualReviewItems).toEqual([
      expect.objectContaining({
        id: 'review-1',
        normalizationResultId: 'result-1',
        reviewStatus: 'open',
        candidateCardEntityIds: ['entity-2', 'entity-3'],
        resolutionKind: null,
        resolvedCardEntityId: null,
        decisionNotes: null,
        startedReviewAt: null,
        resolvedAt: null,
        closedAt: null,
      }),
    ])
    expect(repository.catalogWrites).toHaveLength(0)
  })

  it('can reject or cancel review items explicitly at queue level', async () => {
    const repository = createRepositoryDouble({
      job: createJob(),
      normalizationResults: [
        createNormalizationResult({
          id: 'result-1',
          normalizationStatus: 'blocked_for_review',
          resolutionBasis: 'exceptional_card_shape',
          normalizedName: 'token marker',
          statusReason: 'Exceptional record.',
        }),
      ],
      manualReviewItems: [
        createManualReviewItem({
          id: 'review-reject',
          normalizationResultId: 'result-1',
          reviewReason: 'exceptional_card',
          reviewStatus: 'open',
        }),
        createManualReviewItem({
          id: 'review-cancel',
          normalizationResultId: 'result-1b',
          reviewReason: 'exceptional_card',
          reviewStatus: 'in_review',
        }),
      ],
    })

    const queue = createManualReviewQueue(repository)
    const rejected = await queue.rejectItem({
      reviewItemId: 'review-reject',
      decisionNotes: 'Source record should not be published.',
    })
    const cancelled = await queue.cancelItem({
      reviewItemId: 'review-cancel',
      decisionNotes: 'Superseded by a later import slice.',
    })

    expect(rejected.ok).toBe(true)
    if (rejected.ok) {
      expect(rejected.data).toMatchObject({
        id: 'review-reject',
        reviewStatus: 'rejected',
        resolutionKind:
          'reject_imported_record' satisfies ManualReviewResolutionKind,
      })
    }
    expect(cancelled.ok).toBe(true)
    if (cancelled.ok) {
      expect(cancelled.data).toMatchObject({
        id: 'review-cancel',
        reviewStatus: 'cancelled',
      })
    }
  })
})

function createRepositoryDouble(input: {
  job: ImportJobRecord
  normalizationResults: readonly CardPrintingNormalizationResultRecord[]
  manualReviewItems?: readonly ManualReviewItemRecord[]
}): ImporterRepository & {
  readonly manualReviewItems: Array<Mutable<ManualReviewItemRecord>>
  readonly catalogWrites: unknown[]
} {
  const manualReviewItems: Array<Mutable<ManualReviewItemRecord>> = [
    ...(input.manualReviewItems ?? []),
  ].map((item) => ({ ...item }))
  const normalizationResults = [...input.normalizationResults]
  const catalogWrites: unknown[] = []
  let nextReviewItemIndex = manualReviewItems.length + 1

  return {
    manualReviewItems,
    catalogWrites,
    upsertImportSource: () => Promise.resolve(ok(unreachable())),
    createImportJob: () => Promise.resolve(ok(unreachable())),
    getImportJobById: () => Promise.resolve(ok(input.job)),
    markImportJobRunning: () => Promise.resolve(ok(input.job)),
    markImportJobFailed: () => Promise.resolve(ok(input.job)),
    updateImportJobRawRecordCount: () => Promise.resolve(ok(input.job)),
    updateImportJobNormalizationState: () => Promise.resolve(ok(input.job)),
    listRawProductRecordsByJobAndSourceIds: () => Promise.resolve(ok([])),
    listRawProductRecordsByJobAndCodes: () => Promise.resolve(ok([])),
    upsertRawProductRecords: () => Promise.resolve(ok([])),
    listRawCardPrintingRecordsByJobAndSourceIds: () => Promise.resolve(ok([])),
    listRawCardPrintingRecordsByJob: () => Promise.resolve(ok([])),
    upsertRawCardPrintingRecords: () => Promise.resolve(ok([])),
    listCatalogCardEntitiesByNormalizedNames: () =>
      Promise.resolve(
        ok([] as readonly CatalogCardEntityNormalizationRecord[]),
      ),
    listCardPrintingNormalizationResultsByJob: () =>
      Promise.resolve(ok(normalizationResults)),
    listCardPrintingNormalizationResultsByJobAndRawIds: () =>
      Promise.resolve(ok(normalizationResults)),
    upsertCardPrintingNormalizationResults: () => Promise.resolve(ok([])),
    markCardPrintingNormalizationResultsSuperseded: () =>
      Promise.resolve(ok(0)),
    getManualReviewItemById: (id) =>
      Promise.resolve(
        ok(manualReviewItems.find((item) => item.id === id) ?? null),
      ),
    listManualReviewItemsByJob: (_jobId, reviewStatuses) =>
      Promise.resolve(
        ok(
          reviewStatuses && reviewStatuses.length > 0
            ? manualReviewItems.filter((item) =>
                reviewStatuses.includes(item.reviewStatus),
              )
            : manualReviewItems,
        ),
      ),
    listManualReviewItemsByNormalizationResultIds: (normalizationResultIds) =>
      Promise.resolve(
        ok(
          manualReviewItems.filter((item) =>
            normalizationResultIds.includes(item.normalizationResultId),
          ),
        ),
      ),
    upsertManualReviewItems: (items) => {
      const written: Array<Mutable<ManualReviewItemRecord>> = []

      for (const item of items) {
        const existingIndex = manualReviewItems.findIndex(
          (existingItem) =>
            existingItem.normalizationResultId === item.normalizationResultId,
        )
        const existingItem =
          existingIndex >= 0 ? manualReviewItems[existingIndex] : null

        const nextItem: Mutable<ManualReviewItemRecord> = {
          id: existingItem?.id ?? `review-${nextReviewItemIndex++}`,
          importJobId: item.importJobId,
          normalizationResultId: item.normalizationResultId,
          rawCardPrintingRecordId: item.rawCardPrintingRecordId,
          rawProductRecordId: item.rawProductRecordId,
          reviewReason: item.reviewReason,
          reviewStatus: item.reviewStatus,
          summary: item.summary,
          contextPayload: item.contextPayload,
          candidateCardEntityIds: [...item.candidateCardEntityIds],
          proposedCardEntityId: item.proposedCardEntityId,
          resolutionKind: item.resolutionKind,
          resolvedCardEntityId: item.resolvedCardEntityId,
          decisionNotes: item.decisionNotes,
          openedAt: item.openedAt,
          startedReviewAt: item.startedReviewAt,
          resolvedAt: item.resolvedAt,
          closedAt: item.closedAt,
          updatedAt: item.updatedAt,
        }

        if (existingIndex >= 0) {
          manualReviewItems[existingIndex] = nextItem
        } else {
          manualReviewItems.push(nextItem)
        }

        written.push(nextItem)
      }

      return Promise.resolve(ok(written))
    },
    updateManualReviewItemStatus: (input) => {
      const reviewItem = manualReviewItems.find((item) => item.id === input.id)

      if (!reviewItem) {
        throw new Error(
          `Review item ${input.id} was expected in the test double.`,
        )
      }

      reviewItem.reviewStatus = input.reviewStatus
      reviewItem.resolutionKind = input.resolutionKind
      reviewItem.resolvedCardEntityId = input.resolvedCardEntityId
      reviewItem.decisionNotes = input.decisionNotes
      reviewItem.startedReviewAt = input.startedReviewAt
      reviewItem.resolvedAt = input.resolvedAt
      reviewItem.closedAt = input.closedAt
      reviewItem.updatedAt = '2026-04-09T13:00:00.000Z'

      return Promise.resolve(ok(reviewItem))
    },
    countAllRawRecordsForJob: () => Promise.resolve(ok(0)),
    finalizeImportJob: () => Promise.resolve(ok(unreachable())),
  }
}

function createJob(): ImportJobRecord {
  return {
    id: 'job-1',
    sourceId: 'source-1',
    retryOfJobId: null,
    jobStatus: 'blocked_for_review',
    currentStage: 'normalization',
    pipelineVersion: 'v1',
    upstreamSnapshotKey: null,
    inputFingerprint: null,
    scopeMetadata: {},
    statusReason: null,
    errorCode: null,
    rawRecordCount: 1,
    normalizedCandidateCount: 1,
    conflictCount: 1,
    publishedRecordCount: 0,
    createdAt: '2026-04-09T10:00:00.000Z',
    startedAt: '2026-04-09T10:01:00.000Z',
    finishedAt: null,
    updatedAt: '2026-04-09T10:01:00.000Z',
  }
}

function createNormalizationResult(input: {
  id: string
  normalizationStatus: CardPrintingNormalizationResultRecord['normalizationStatus']
  resolutionBasis: string
  normalizedName: string
  candidateCardEntityIds?: readonly string[]
  candidateCount?: number
  proposedCardEntityId?: string | null
  statusReason: string
  conflictSummary?: string | null
}): CardPrintingNormalizationResultRecord {
  return {
    id: input.id,
    importJobId: 'job-1',
    rawCardPrintingRecordId: `raw-${input.id}`,
    rawProductRecordId: null,
    normalizationVersion: 'card-printing-normalizer/v1',
    normalizationStatus: input.normalizationStatus,
    resolutionBasis: input.resolutionBasis,
    proposedCardEntityId: input.proposedCardEntityId ?? null,
    candidateCardEntityIds: [...(input.candidateCardEntityIds ?? [])],
    candidateCount: input.candidateCount ?? 0,
    normalizedName: input.normalizedName,
    normalizedGrade: null,
    normalizedCardType: null,
    normalizedNation: null,
    normalizedClan: null,
    normalizedTriggerType: null,
    rawPayloadFingerprint: `${input.id}-hash`,
    needsManualReview: input.normalizationStatus !== 'auto_resolved',
    statusReason: input.statusReason,
    conflictSummary: input.conflictSummary ?? null,
    resolutionEvidence: {
      matchedFields: ['name'],
      conflictingFields: [],
    },
    createdAt: '2026-04-09T10:00:00.000Z',
    updatedAt: '2026-04-09T10:00:00.000Z',
  }
}

function createManualReviewItem(input: {
  id: string
  normalizationResultId: string
  reviewReason: ManualReviewItemRecord['reviewReason']
  reviewStatus: ManualReviewItemRecord['reviewStatus']
}): ManualReviewItemRecord {
  return {
    id: input.id,
    importJobId: 'job-1',
    normalizationResultId: input.normalizationResultId,
    rawCardPrintingRecordId: `raw-${input.normalizationResultId}`,
    rawProductRecordId: null,
    reviewReason: input.reviewReason,
    reviewStatus: input.reviewStatus,
    summary: 'placeholder summary',
    contextPayload: {},
    candidateCardEntityIds: [],
    proposedCardEntityId: null,
    resolutionKind: null,
    resolvedCardEntityId: null,
    decisionNotes: null,
    openedAt: '2026-04-09T10:00:00.000Z',
    startedReviewAt:
      input.reviewStatus === 'in_review' ? '2026-04-09T10:05:00.000Z' : null,
    resolvedAt: null,
    closedAt: null,
    updatedAt: '2026-04-09T10:00:00.000Z',
  }
}

function ok<TData>(data: TData): RepositoryResult<TData> {
  return {
    ok: true,
    data,
  }
}

function unreachable(): never {
  throw new Error('This repository method should not be used in this test.')
}
