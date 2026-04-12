import { describe, expect, it, vi } from 'vitest'

import type { RepositoryResult } from '@web-vg/db'
import type {
  CardPrintingNormalizationResultRecord,
  CatalogCardEntityNormalizationRecord,
  ImporterRepository,
  ImportJobRecord,
  ManualReviewItemRecord,
  RawCardPrintingRecord,
} from '@web-vg/db/repositories/importer'

import { createCardPrintingNormalizer } from './card-printing-normalizer'

type Mutable<T> = {
  -readonly [K in keyof T]: T[K]
}

describe('card-printing normalizer', () => {
  it('auto-resolves a raw printing to one canonical card entity when exact name and structural fields align', async () => {
    const repository = createRepositoryDouble({
      job: createJob('pending'),
      rawPrintings: [
        createRawPrintingRecord({
          id: 'raw-printing-1',
          rawCardName: 'Apex Ruler, Bastion',
          rawProductRecordId: 'raw-product-1',
          rawGradeText: '3',
          rawCardType: 'normal-unit',
          rawNation: 'Keter Sanctuary',
        }),
      ],
      catalogEntities: [
        createCatalogEntity({
          id: 'entity-1',
          name: 'Apex Ruler, Bastion',
          normalizedName: 'apex ruler, bastion',
          grade: 3,
          cardType: 'normal-unit',
          nation: 'Keter Sanctuary',
        }),
      ],
    })

    const normalizer = createCardPrintingNormalizer(repository)
    const result = await normalizer.normalize({
      importJobId: 'job-1',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        importJobId: 'job-1',
        importSourceId: 'source-1',
        normalizationVersion: 'card-printing-normalizer/v1',
        processedCount: 1,
        createdCount: 1,
        updatedCount: 0,
        skippedCount: 0,
        supersededCount: 0,
        autoResolvedCount: 1,
        unresolvedCount: 0,
        ambiguousCount: 0,
        blockedForReviewCount: 0,
        readyForPublicationCount: 1,
        normalizedCandidateCount: 1,
        conflictCount: 0,
        jobStatus: 'running',
        currentStage: 'normalization',
      },
    })
    expect(repository.normalizationResults).toEqual([
      expect.objectContaining({
        importJobId: 'job-1',
        rawCardPrintingRecordId: 'raw-printing-1',
        rawProductRecordId: 'raw-product-1',
        normalizationStatus: 'auto_resolved',
        proposedCardEntityId: 'entity-1',
        candidateCardEntityIds: ['entity-1'],
        needsManualReview: false,
        rawPayloadFingerprint: 'raw-printing-1-hash',
      }),
    ])
    expect(repository.manualReviewItems).toEqual([])
    expect(repository.upsertRawProductRecords).not.toHaveBeenCalled()
    expect(repository.upsertRawCardPrintingRecords).not.toHaveBeenCalled()
    expect(repository.finalizeImportJob).not.toHaveBeenCalled()
  })

  it('keeps no-name matches unresolved without forcing a fake canonical attachment', async () => {
    const repository = createRepositoryDouble({
      job: createJob('running'),
      rawPrintings: [
        createRawPrintingRecord({
          id: 'raw-printing-1',
          rawCardName: 'Completely Unknown Unit',
        }),
      ],
      catalogEntities: [],
    })

    const normalizer = createCardPrintingNormalizer(repository)
    const result = await normalizer.normalize({
      importJobId: 'job-1',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        importJobId: 'job-1',
        importSourceId: 'source-1',
        normalizationVersion: 'card-printing-normalizer/v1',
        processedCount: 1,
        createdCount: 1,
        updatedCount: 0,
        skippedCount: 0,
        supersededCount: 0,
        autoResolvedCount: 0,
        unresolvedCount: 1,
        ambiguousCount: 0,
        blockedForReviewCount: 0,
        readyForPublicationCount: 0,
        normalizedCandidateCount: 1,
        conflictCount: 1,
        jobStatus: 'blocked_for_review',
        currentStage: 'normalization',
      },
    })
    expect(repository.normalizationResults[0]).toEqual(
      expect.objectContaining({
        normalizationStatus: 'unresolved',
        proposedCardEntityId: null,
        needsManualReview: true,
      }),
    )
    expect(repository.manualReviewItems).toHaveLength(1)
    expect(repository.manualReviewItems[0]).toMatchObject({
      importJobId: 'job-1',
      rawCardPrintingRecordId: 'raw-printing-1',
      reviewReason: 'unresolved_mapping',
      reviewStatus: 'open',
    })
    expect(typeof repository.manualReviewItems[0]?.normalizationResultId).toBe(
      'string',
    )
    expect(repository.finalizeImportJob).not.toHaveBeenCalled()
  })

  it('marks compatible multiple matches as ambiguous and blocks the job for review', async () => {
    const repository = createRepositoryDouble({
      job: createJob('running'),
      rawPrintings: [
        createRawPrintingRecord({
          id: 'raw-printing-1',
          rawCardName: 'Blaster Dark',
          rawGradeText: '2',
        }),
      ],
      catalogEntities: [
        createCatalogEntity({
          id: 'entity-1',
          name: 'Blaster Dark',
          normalizedName: 'blaster dark',
          grade: 2,
          cardType: 'normal-unit',
          nation: 'Keter Sanctuary',
        }),
        createCatalogEntity({
          id: 'entity-2',
          name: 'Blaster Dark',
          normalizedName: 'blaster dark',
          grade: 2,
          cardType: 'normal-unit',
          nation: 'Keter Sanctuary',
        }),
      ],
    })

    const normalizer = createCardPrintingNormalizer(repository)
    const result = await normalizer.normalize({
      importJobId: 'job-1',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        importJobId: 'job-1',
        importSourceId: 'source-1',
        normalizationVersion: 'card-printing-normalizer/v1',
        processedCount: 1,
        createdCount: 1,
        updatedCount: 0,
        skippedCount: 0,
        supersededCount: 0,
        autoResolvedCount: 0,
        unresolvedCount: 0,
        ambiguousCount: 1,
        blockedForReviewCount: 0,
        readyForPublicationCount: 0,
        normalizedCandidateCount: 1,
        conflictCount: 1,
        jobStatus: 'blocked_for_review',
        currentStage: 'normalization',
      },
    })
    expect(repository.normalizationResults[0]).toEqual(
      expect.objectContaining({
        normalizationStatus: 'ambiguous',
        candidateCardEntityIds: ['entity-1', 'entity-2'],
        needsManualReview: true,
      }),
    )
    expect(repository.job.statusReason).toBe(
      'Normalization produced records that require manual review.',
    )
    expect(repository.manualReviewItems).toEqual([
      expect.objectContaining({
        reviewReason: 'ambiguous_mapping',
      }),
    ])
  })

  it('blocks for review when name matches exist but structural fields conflict with every candidate', async () => {
    const repository = createRepositoryDouble({
      job: createJob('running'),
      rawPrintings: [
        createRawPrintingRecord({
          id: 'raw-printing-1',
          rawCardName: 'Apex Ruler, Bastion',
          rawGradeText: '2',
          rawNation: 'Dragon Empire',
        }),
      ],
      catalogEntities: [
        createCatalogEntity({
          id: 'entity-1',
          name: 'Apex Ruler, Bastion',
          normalizedName: 'apex ruler, bastion',
          grade: 3,
          cardType: 'normal-unit',
          nation: 'Keter Sanctuary',
        }),
      ],
    })

    const normalizer = createCardPrintingNormalizer(repository)
    const result = await normalizer.normalize({
      importJobId: 'job-1',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        importJobId: 'job-1',
        importSourceId: 'source-1',
        normalizationVersion: 'card-printing-normalizer/v1',
        processedCount: 1,
        createdCount: 1,
        updatedCount: 0,
        skippedCount: 0,
        supersededCount: 0,
        autoResolvedCount: 0,
        unresolvedCount: 0,
        ambiguousCount: 0,
        blockedForReviewCount: 1,
        readyForPublicationCount: 0,
        normalizedCandidateCount: 1,
        conflictCount: 1,
        jobStatus: 'blocked_for_review',
        currentStage: 'normalization',
      },
    })
    expect(repository.normalizationResults[0]).toEqual(
      expect.objectContaining({
        normalizationStatus: 'blocked_for_review',
        proposedCardEntityId: null,
        candidateCardEntityIds: ['entity-1'],
        needsManualReview: true,
      }),
    )
    expect(repository.manualReviewItems).toEqual([
      expect.objectContaining({
        reviewReason: 'conflicting_facts',
      }),
    ])
  })

  it('skips unchanged same-version results and supersedes older versions on a new normalization run', async () => {
    const repository = createRepositoryDouble({
      job: createJob('blocked_for_review'),
      rawPrintings: [
        createRawPrintingRecord({
          id: 'raw-printing-1',
          rawCardName: 'Apex Ruler, Bastion',
          rawGradeText: '3',
          rawCardType: 'normal-unit',
          rawNation: 'Keter Sanctuary',
        }),
      ],
      catalogEntities: [
        createCatalogEntity({
          id: 'entity-1',
          name: 'Apex Ruler, Bastion',
          normalizedName: 'apex ruler, bastion',
          grade: 3,
          cardType: 'normal-unit',
          nation: 'Keter Sanctuary',
        }),
      ],
      normalizationResults: [
        createNormalizationResult({
          id: 'normalization-1',
          rawCardPrintingRecordId: 'raw-printing-1',
          normalizationVersion: 'card-printing-normalizer/v1',
          normalizationStatus: 'auto_resolved',
          proposedCardEntityId: 'entity-1',
          candidateCardEntityIds: ['entity-1'],
          candidateCount: 1,
          normalizedName: 'apex ruler, bastion',
          normalizedGrade: 3,
          normalizedCardType: 'normal-unit',
          normalizedNation: 'keter sanctuary',
          needsManualReview: false,
          statusReason:
            'Resolved by exact normalized name and compatible structural fields.',
        }),
      ],
    })

    const normalizer = createCardPrintingNormalizer(repository)
    const firstRun = await normalizer.normalize({
      importJobId: 'job-1',
    })
    const secondRun = await normalizer.normalize({
      importJobId: 'job-1',
      normalizationVersion: 'card-printing-normalizer/v2',
    })

    expect(firstRun).toEqual({
      ok: true,
      data: {
        importJobId: 'job-1',
        importSourceId: 'source-1',
        normalizationVersion: 'card-printing-normalizer/v1',
        processedCount: 1,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 1,
        supersededCount: 0,
        autoResolvedCount: 1,
        unresolvedCount: 0,
        ambiguousCount: 0,
        blockedForReviewCount: 0,
        readyForPublicationCount: 1,
        normalizedCandidateCount: 1,
        conflictCount: 0,
        jobStatus: 'running',
        currentStage: 'normalization',
      },
    })
    expect(secondRun).toEqual({
      ok: true,
      data: {
        importJobId: 'job-1',
        importSourceId: 'source-1',
        normalizationVersion: 'card-printing-normalizer/v2',
        processedCount: 1,
        createdCount: 1,
        updatedCount: 0,
        skippedCount: 0,
        supersededCount: 1,
        autoResolvedCount: 1,
        unresolvedCount: 0,
        ambiguousCount: 0,
        blockedForReviewCount: 0,
        readyForPublicationCount: 1,
        normalizedCandidateCount: 1,
        conflictCount: 0,
        jobStatus: 'running',
        currentStage: 'normalization',
      },
    })
    expect(repository.normalizationResults).toHaveLength(2)
    expect(
      repository.normalizationResults.find(
        (result) =>
          result.normalizationVersion === 'card-printing-normalizer/v1',
      ),
    ).toEqual(
      expect.objectContaining({
        normalizationStatus: 'superseded',
      }),
    )
    expect(
      repository.normalizationResults.find(
        (result) =>
          result.normalizationVersion === 'card-printing-normalizer/v2',
      ),
    ).toEqual(
      expect.objectContaining({
        normalizationStatus: 'auto_resolved',
      }),
    )
  })
})

function createRepositoryDouble(input: {
  job: ImportJobRecord
  rawPrintings: readonly RawCardPrintingRecord[]
  catalogEntities: readonly CatalogCardEntityNormalizationRecord[]
  normalizationResults?: readonly CardPrintingNormalizationResultRecord[]
}): ImporterRepository & {
  readonly job: ImportJobRecord
  readonly normalizationResults: CardPrintingNormalizationResultRecord[]
  readonly manualReviewItems: Array<Mutable<ManualReviewItemRecord>>
  readonly upsertRawProductRecords: ReturnType<typeof vi.fn>
  readonly upsertRawCardPrintingRecords: ReturnType<typeof vi.fn>
  readonly finalizeImportJob: ReturnType<typeof vi.fn>
} {
  const normalizationResults: Array<
    Mutable<CardPrintingNormalizationResultRecord>
  > = [...(input.normalizationResults ?? [])].map((result) => ({ ...result }))
  const manualReviewItems: Array<Mutable<ManualReviewItemRecord>> = []
  let nextNormalizationResultIndex = normalizationResults.length + 1
  let nextReviewItemIndex = 1
  const job: Mutable<ImportJobRecord> = { ...input.job }

  return {
    job,
    normalizationResults,
    manualReviewItems,
    upsertImportSource: () => Promise.resolve(ok(unreachable())),
    createImportJob: () => Promise.resolve(ok(unreachable())),
    getImportJobById: () => Promise.resolve(ok(job)),
    markImportJobRunning: ({ currentStage, startedAt }) => {
      job.jobStatus = 'running'
      job.currentStage = currentStage
      job.startedAt = startedAt
      job.finishedAt = null
      job.errorCode = null
      job.statusReason = null
      return Promise.resolve(ok(job))
    },
    markImportJobFailed: ({
      currentStage,
      startedAt,
      finishedAt,
      errorCode,
      statusReason,
    }) => {
      job.jobStatus = 'failed'
      job.currentStage = currentStage
      job.startedAt = startedAt
      job.finishedAt = finishedAt
      job.errorCode = errorCode
      job.statusReason = statusReason
      return Promise.resolve(ok(job))
    },
    updateImportJobRawRecordCount: () => Promise.resolve(ok(job)),
    updateImportJobNormalizationState: ({
      jobStatus,
      currentStage,
      normalizedCandidateCount,
      conflictCount,
      statusReason,
    }) => {
      job.jobStatus = jobStatus
      job.currentStage = currentStage
      job.normalizedCandidateCount = normalizedCandidateCount
      job.conflictCount = conflictCount
      job.statusReason = statusReason
      return Promise.resolve(ok(job))
    },
    listRawProductRecordsByJobAndSourceIds: vi.fn(() =>
      Promise.resolve(ok([])),
    ),
    listRawProductRecordsByJobAndCodes: vi.fn(() => Promise.resolve(ok([]))),
    upsertRawProductRecords: vi.fn(() => Promise.resolve(ok([]))),
    listRawCardPrintingRecordsByJobAndSourceIds: vi.fn(() =>
      Promise.resolve(ok([])),
    ),
    listRawCardPrintingRecordsByJob: (_importJobId, rawCardPrintingRecordIds) =>
      Promise.resolve(
        ok(
          rawCardPrintingRecordIds && rawCardPrintingRecordIds.length > 0
            ? input.rawPrintings.filter((record) =>
                rawCardPrintingRecordIds.includes(record.id),
              )
            : input.rawPrintings,
        ),
      ),
    upsertRawCardPrintingRecords: vi.fn(() => Promise.resolve(ok([]))),
    listCatalogCardEntitiesByNormalizedNames: (normalizedNames) =>
      Promise.resolve(
        ok(
          input.catalogEntities.filter((entity) =>
            normalizedNames.includes(entity.normalizedName),
          ),
        ),
      ),
    listCardPrintingNormalizationResultsByJob: () =>
      Promise.resolve(ok(normalizationResults)),
    listCardPrintingNormalizationResultsByJobAndRawIds: (
      _importJobId,
      rawCardPrintingRecordIds,
    ) =>
      Promise.resolve(
        ok(
          normalizationResults.filter((result) =>
            rawCardPrintingRecordIds.includes(result.rawCardPrintingRecordId),
          ),
        ),
      ),
    upsertCardPrintingNormalizationResults: (results) => {
      const updatedRecords: CardPrintingNormalizationResultRecord[] = []

      for (const result of results) {
        const existingIndex = normalizationResults.findIndex(
          (existingResult) =>
            existingResult.rawCardPrintingRecordId ===
              result.rawCardPrintingRecordId &&
            existingResult.normalizationVersion === result.normalizationVersion,
        )
        const existingRecord =
          existingIndex >= 0 ? normalizationResults[existingIndex]! : null

        const nextRecord: CardPrintingNormalizationResultRecord = {
          id:
            existingRecord?.id ??
            `normalization-${nextNormalizationResultIndex++}`,
          importJobId: result.importJobId,
          rawCardPrintingRecordId: result.rawCardPrintingRecordId,
          rawProductRecordId: result.rawProductRecordId,
          normalizationVersion: result.normalizationVersion,
          normalizationStatus: result.normalizationStatus,
          resolutionBasis: result.resolutionBasis,
          proposedCardEntityId: result.proposedCardEntityId,
          candidateCardEntityIds: [...result.candidateCardEntityIds],
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
          createdAt: existingRecord?.createdAt ?? '2026-04-09T12:00:00.000Z',
          updatedAt: result.updatedAt,
        }

        if (existingIndex >= 0) {
          normalizationResults[existingIndex] = nextRecord
        } else {
          normalizationResults.push(nextRecord)
        }

        updatedRecords.push(nextRecord)
      }

      return Promise.resolve(ok(updatedRecords))
    },
    markCardPrintingNormalizationResultsSuperseded: (resultIds) => {
      let updatedCount = 0

      for (const result of normalizationResults) {
        if (!resultIds.includes(result.id)) {
          continue
        }

        result.normalizationStatus = 'superseded'
        result.needsManualReview = false
        result.conflictSummary = null
        result.updatedAt = '2026-04-09T12:30:00.000Z'
        updatedCount += 1
      }

      return Promise.resolve(ok(updatedCount))
    },
    getManualReviewItemById: (id) =>
      Promise.resolve(
        ok(manualReviewItems.find((item) => item.id === id) ?? null),
      ),
    listManualReviewItemsByJob: (_importJobId, reviewStatuses) =>
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
      const written: ManualReviewItemRecord[] = []

      for (const item of items) {
        const existingIndex = manualReviewItems.findIndex(
          (existingItem) =>
            existingItem.normalizationResultId === item.normalizationResultId,
        )
        const nextItem: Mutable<ManualReviewItemRecord> = {
          id:
            existingIndex >= 0
              ? manualReviewItems[existingIndex]!.id
              : `review-${nextReviewItemIndex++}`,
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
        throw new Error(`Expected review item ${input.id} in test double.`)
      }

      reviewItem.reviewStatus = input.reviewStatus
      reviewItem.resolutionKind = input.resolutionKind
      reviewItem.resolvedCardEntityId = input.resolvedCardEntityId
      reviewItem.decisionNotes = input.decisionNotes
      reviewItem.startedReviewAt = input.startedReviewAt
      reviewItem.resolvedAt = input.resolvedAt
      reviewItem.closedAt = input.closedAt
      reviewItem.updatedAt = '2026-04-09T12:40:00.000Z'

      return Promise.resolve(ok(reviewItem))
    },
    countAllRawRecordsForJob: () =>
      Promise.resolve(ok(input.rawPrintings.length)),
    finalizeImportJob: vi.fn(() => Promise.resolve(ok(unreachable()))),
  }
}

function createJob(jobStatus: ImportJobRecord['jobStatus']): ImportJobRecord {
  return {
    id: 'job-1',
    sourceId: 'source-1',
    retryOfJobId: null,
    jobStatus,
    currentStage: jobStatus === 'pending' ? 'raw_import' : 'normalization',
    pipelineVersion: 'v1',
    upstreamSnapshotKey: null,
    inputFingerprint: null,
    scopeMetadata: {},
    statusReason: jobStatus === 'blocked_for_review' ? 'previous review' : null,
    errorCode: null,
    rawRecordCount: 1,
    normalizedCandidateCount: 0,
    conflictCount: 0,
    publishedRecordCount: 0,
    createdAt: '2026-04-09T10:00:00.000Z',
    startedAt: '2026-04-09T10:01:00.000Z',
    finishedAt: null,
    updatedAt: '2026-04-09T10:01:00.000Z',
  }
}

function createRawPrintingRecord(input: {
  id: string
  rawCardName: string
  rawProductRecordId?: string | null
  rawGradeText?: string | null
  rawCardType?: string | null
  rawNation?: string | null
  rawClan?: string | null
  rawTriggerType?: string | null
}): RawCardPrintingRecord {
  return {
    id: input.id,
    importJobId: 'job-1',
    sourcePrintingId: `source-${input.id}`,
    sourceProductId: null,
    sourceProductCode: null,
    rawProductRecordId: input.rawProductRecordId ?? null,
    payloadFingerprint: `${input.id}-hash`,
    rawCardName: input.rawCardName,
    rawPrintingCode: null,
    rawRarity: null,
    rawLocaleCode: null,
    rawRegionCode: null,
    rawCardType: input.rawCardType ?? null,
    rawNation: input.rawNation ?? null,
    rawClan: input.rawClan ?? null,
    rawTriggerType: input.rawTriggerType ?? null,
    rawGradeText: input.rawGradeText ?? null,
    rawPowerText: null,
    rawCriticalText: null,
    rawShieldText: null,
    rawRulesText: null,
    sourcePayload: {},
    createdAt: '2026-04-09T10:00:00.000Z',
    updatedAt: '2026-04-09T10:00:00.000Z',
  }
}

function createCatalogEntity(input: {
  id: string
  name: string
  normalizedName: string
  grade: number
  cardType: string
  nation: string
  clan?: string | null
  triggerType?: string | null
}): CatalogCardEntityNormalizationRecord {
  return {
    id: input.id,
    canonicalKey: `canonical-${input.id}`,
    name: input.name,
    normalizedName: input.normalizedName,
    grade: input.grade,
    cardType: input.cardType,
    nation: input.nation,
    clan: input.clan ?? null,
    triggerType: input.triggerType ?? null,
  }
}

function createNormalizationResult(input: {
  id: string
  rawCardPrintingRecordId: string
  normalizationVersion: string
  normalizationStatus: CardPrintingNormalizationResultRecord['normalizationStatus']
  proposedCardEntityId: string | null
  candidateCardEntityIds: readonly string[]
  candidateCount: number
  normalizedName: string
  normalizedGrade: number | null
  normalizedCardType: string | null
  normalizedNation: string | null
  needsManualReview: boolean
  statusReason: string
  resolutionEvidence?: CardPrintingNormalizationResultRecord['resolutionEvidence']
}): CardPrintingNormalizationResultRecord {
  const matchedFields = ['name']

  if (input.normalizedGrade !== null) {
    matchedFields.push('grade')
  }

  if (input.normalizedCardType !== null) {
    matchedFields.push('cardType')
  }

  if (input.normalizedNation !== null) {
    matchedFields.push('nation')
  }

  return {
    id: input.id,
    importJobId: 'job-1',
    rawCardPrintingRecordId: input.rawCardPrintingRecordId,
    rawProductRecordId: null,
    normalizationVersion: input.normalizationVersion,
    normalizationStatus: input.normalizationStatus,
    resolutionBasis: 'exact_name_with_attributes',
    proposedCardEntityId: input.proposedCardEntityId,
    candidateCardEntityIds: [...input.candidateCardEntityIds],
    candidateCount: input.candidateCount,
    normalizedName: input.normalizedName,
    normalizedGrade: input.normalizedGrade,
    normalizedCardType: input.normalizedCardType,
    normalizedNation: input.normalizedNation,
    normalizedClan: null,
    normalizedTriggerType: null,
    rawPayloadFingerprint: `${input.rawCardPrintingRecordId}-hash`,
    needsManualReview: input.needsManualReview,
    statusReason: input.statusReason,
    conflictSummary: null,
    resolutionEvidence: input.resolutionEvidence ?? {
      matchedFields,
      conflictingFields: [],
    },
    createdAt: '2026-04-09T10:00:00.000Z',
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
