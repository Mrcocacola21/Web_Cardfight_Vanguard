import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { RepositoryResult } from '@web-vg/db'
import type {
  CardPrintingNormalizationResultRecord,
  CatalogCardEntityNormalizationRecord,
  ImportJobRecord,
  ImportSourceRecord,
  ImporterRepository,
  ManualReviewItemRecord,
  RawCardPrintingRecord,
  RawProductRecord,
} from '@web-vg/db/repositories/importer'

import {
  createDevJsonImportRunner,
  devJsonImportPipelineVersion,
  devJsonImportSourceType,
  readDevJsonImportDocumentFromFile,
} from './dev-json-importer'

type Mutable<T> = {
  -readonly [K in keyof T]: T[K]
}

describe('content wave 1 pipeline run', () => {
  it('runs the prepared Standard / D/DZ wave through dev-json -> raw -> normalization -> review', async () => {
    const fixturePath = fileFromHere(
      '../../fixtures/dev-json/content-wave-1-standard-ddz-minimal.json',
    )
    const documentResult = await readDevJsonImportDocumentFromFile(fixturePath)

    expect(documentResult.ok).toBe(true)

    if (!documentResult.ok) {
      return
    }

    const repository = createIntegrationRepository({
      catalogEntities: [
        createCatalogEntity({
          id: 'entity-bastion',
          canonicalKey: 'apex-ruler-bastion',
          name: 'Apex Ruler, Bastion',
          normalizedName: 'apex ruler, bastion',
          grade: 3,
          cardType: 'normal-unit',
          nation: 'Keter Sanctuary',
        }),
        createCatalogEntity({
          id: 'entity-rezael',
          canonicalKey: 'fated-one-of-miracles-rezael',
          name: 'Fated One of Miracles, Rezael',
          normalizedName: 'fated one of miracles, rezael',
          grade: 3,
          cardType: 'normal-unit',
          nation: 'Keter Sanctuary',
        }),
      ],
    })
    const runner = createDevJsonImportRunner(repository, {
      now: createDeterministicNow(),
    })
    const result = await runner.run({
      document: documentResult.data.document,
      filePath: documentResult.data.filePath,
    })

    expect(result.ok).toBe(true)

    if (!result.ok) {
      return
    }

    const run = result.data

    expect(run.source).toMatchObject({
      id: 'source-1',
      sourceKey: 'dev-json.content-wave-1-standard-ddz-minimal',
      sourceType: devJsonImportSourceType,
      displayName: 'Content wave 1: minimal Standard D/DZ seed',
    })
    expect(run.source.originUri).toContain(
      '/packages/importer/fixtures/dev-json/content-wave-1-standard-ddz-minimal.json',
    )

    expect(run.job).toEqual({
      id: 'job-1',
      jobStatus: 'blocked_for_review',
      currentStage: 'normalization',
      pipelineVersion: devJsonImportPipelineVersion,
      inputFingerprint: documentResult.data.document.inputFingerprint,
      upstreamSnapshotKey: 'wave-1-v1',
      statusReason:
        'Normalization produced records that require manual review.',
    })
    expect(run.rawProducts).toEqual({
      processedCount: 3,
      createdCount: 3,
      updatedCount: 0,
      skippedCount: 0,
    })
    expect(run.rawPrintings).toEqual({
      processedCount: 4,
      createdCount: 4,
      updatedCount: 0,
      skippedCount: 0,
      linkedProductCount: 4,
      unlinkedProductCount: 0,
    })
    expect(run.normalization).toEqual({
      normalizationVersion: 'card-printing-normalizer/v1',
      processedCount: 4,
      createdCount: 4,
      updatedCount: 0,
      skippedCount: 0,
      supersededCount: 0,
      autoResolvedCount: 3,
      unresolvedCount: 1,
      ambiguousCount: 0,
      blockedForReviewCount: 0,
      readyForPublicationCount: 3,
      normalizedCandidateCount: 4,
    })
    expect(run.reviewQueue).toEqual({
      totalCount: 1,
      openCount: 1,
      inReviewCount: 0,
      resolvedCount: 0,
      rejectedCount: 0,
      supersededCount: 0,
      cancelledCount: 0,
    })

    expect(repository.sources).toEqual([
      expect.objectContaining({
        id: 'source-1',
        sourceKey: 'dev-json.content-wave-1-standard-ddz-minimal',
        sourceType: devJsonImportSourceType,
      }),
    ])
    expect(repository.jobs).toEqual([
      expect.objectContaining({
        id: 'job-1',
        sourceId: 'source-1',
        jobStatus: 'blocked_for_review',
        currentStage: 'normalization',
        rawRecordCount: 7,
        normalizedCandidateCount: 4,
        conflictCount: 1,
        publishedRecordCount: 0,
      }),
    ])

    expect(repository.rawProducts).toHaveLength(3)
    expect(
      repository.rawProducts.every((record) => record.importJobId === 'job-1'),
    ).toBe(true)
    expect(repository.rawPrintings).toHaveLength(4)
    expect(
      repository.rawPrintings.every(
        (record) =>
          record.importJobId === 'job-1' && record.rawProductRecordId !== null,
      ),
    ).toBe(true)

    expect(repository.normalizationResults).toHaveLength(4)
    expect(repository.manualReviewItems).toHaveLength(1)
    expect(repository.catalogWrites).toHaveLength(0)

    const bastionResult = expectNormalizationResultForSourcePrinting(
      repository,
      'printing-bastion-d-bt01-main',
    )
    const rezaelPrimaryResult = expectNormalizationResultForSourcePrinting(
      repository,
      'printing-rezael-dz-bt01-rrr',
    )
    const rezaelParallelResult = expectNormalizationResultForSourcePrinting(
      repository,
      'printing-rezael-dz-bt01-dsr',
    )
    const liaelResult = expectNormalizationResultForSourcePrinting(
      repository,
      'printing-liael-amorta-dz-bt02-main',
    )

    expect(bastionResult).toMatchObject({
      normalizationStatus: 'auto_resolved',
      proposedCardEntityId: 'entity-bastion',
      needsManualReview: false,
    })
    expect(rezaelPrimaryResult).toMatchObject({
      normalizationStatus: 'auto_resolved',
      proposedCardEntityId: 'entity-rezael',
      needsManualReview: false,
    })
    expect(rezaelParallelResult).toMatchObject({
      normalizationStatus: 'auto_resolved',
      proposedCardEntityId: 'entity-rezael',
      needsManualReview: false,
    })
    expect(liaelResult).toMatchObject({
      normalizationStatus: 'unresolved',
      proposedCardEntityId: null,
      needsManualReview: true,
      normalizedName: 'fated one of time, liael=amorta',
    })
    expect(
      new Set([
        rezaelPrimaryResult.rawCardPrintingRecordId,
        rezaelParallelResult.rawCardPrintingRecordId,
      ]).size,
    ).toBe(2)
    expect(rezaelPrimaryResult.proposedCardEntityId).toBe('entity-rezael')
    expect(rezaelParallelResult.proposedCardEntityId).toBe('entity-rezael')
    expect(rezaelPrimaryResult.rawCardPrintingRecordId).not.toBe(
      rezaelParallelResult.rawCardPrintingRecordId,
    )
    expect(rezaelPrimaryResult.rawProductRecordId).toBe(
      rezaelParallelResult.rawProductRecordId,
    )
    expect(liaelResult.candidateCount).toBe(0)
    expect(liaelResult.rawProductRecordId).not.toBeNull()

    const readyForPublicationResults = repository.normalizationResults.filter(
      (result) => result.proposedCardEntityId !== null,
    )
    expect(readyForPublicationResults).toHaveLength(3)
    expect(
      readyForPublicationResults.every(
        (result) =>
          result.rawCardPrintingRecordId !==
          liaelResult.rawCardPrintingRecordId,
      ),
    ).toBe(true)

    expect(repository.manualReviewItems).toEqual([
      expect.objectContaining({
        importJobId: 'job-1',
        normalizationResultId: liaelResult.id,
        rawCardPrintingRecordId: liaelResult.rawCardPrintingRecordId,
        reviewReason: 'unresolved_mapping',
        reviewStatus: 'open',
      }),
    ])
  })
})

function createIntegrationRepository(input: {
  readonly catalogEntities: readonly CatalogCardEntityNormalizationRecord[]
}): ImporterRepository & {
  readonly sources: ImportSourceRecord[]
  readonly jobs: ImportJobRecord[]
  readonly rawProducts: RawProductRecord[]
  readonly rawPrintings: RawCardPrintingRecord[]
  readonly normalizationResults: CardPrintingNormalizationResultRecord[]
  readonly manualReviewItems: ManualReviewItemRecord[]
  readonly catalogWrites: unknown[]
} {
  const sources: Array<Mutable<ImportSourceRecord>> = []
  const jobs: Array<Mutable<ImportJobRecord>> = []
  const rawProducts: Array<Mutable<RawProductRecord>> = []
  const rawPrintings: Array<Mutable<RawCardPrintingRecord>> = []
  const normalizationResults: Array<
    Mutable<CardPrintingNormalizationResultRecord>
  > = []
  const manualReviewItems: Array<Mutable<ManualReviewItemRecord>> = []
  const catalogEntities = [...input.catalogEntities]
  const catalogWrites: unknown[] = []

  let nextSourceIndex = 1
  let nextJobIndex = 1
  let nextRawProductIndex = 1
  let nextRawPrintingIndex = 1
  let nextNormalizationIndex = 1
  let nextReviewItemIndex = 1

  return {
    sources,
    jobs,
    rawProducts,
    rawPrintings,
    normalizationResults,
    manualReviewItems,
    catalogWrites,
    upsertImportSource(input) {
      const existingSource = sources.find(
        (source) =>
          source.sourceKey === input.sourceKey &&
          source.sourceType === input.sourceType,
      )

      if (existingSource) {
        existingSource.displayName = input.displayName
        existingSource.providerName = input.providerName
        existingSource.originUri = input.originUri
        existingSource.configuration = input.configuration
        existingSource.isActive = input.isActive
        existingSource.updatedAt = '2026-04-09T16:00:00.000Z'
        return Promise.resolve(ok(existingSource))
      }

      const createdSource: Mutable<ImportSourceRecord> = {
        id: `source-${nextSourceIndex++}`,
        sourceKey: input.sourceKey,
        sourceType: input.sourceType,
        displayName: input.displayName,
        providerName: input.providerName,
        originUri: input.originUri,
        configuration: input.configuration,
        isActive: input.isActive,
        createdAt: '2026-04-09T16:00:00.000Z',
        updatedAt: '2026-04-09T16:00:00.000Z',
      }
      sources.push(createdSource)
      return Promise.resolve(ok(createdSource))
    },

    createImportJob(input) {
      const createdJob: Mutable<ImportJobRecord> = {
        id: `job-${nextJobIndex++}`,
        sourceId: input.sourceId,
        retryOfJobId: input.retryOfJobId,
        jobStatus: 'pending',
        currentStage: 'source',
        pipelineVersion: input.pipelineVersion,
        upstreamSnapshotKey: input.upstreamSnapshotKey,
        inputFingerprint: input.inputFingerprint,
        scopeMetadata: input.scopeMetadata,
        statusReason: null,
        errorCode: null,
        rawRecordCount: 0,
        normalizedCandidateCount: 0,
        conflictCount: 0,
        publishedRecordCount: 0,
        createdAt: '2026-04-09T16:01:00.000Z',
        startedAt: null,
        finishedAt: null,
        updatedAt: '2026-04-09T16:01:00.000Z',
      }
      jobs.push(createdJob)
      return Promise.resolve(ok(createdJob))
    },

    getImportJobById(id) {
      return Promise.resolve(ok(jobs.find((job) => job.id === id) ?? null))
    },

    markImportJobRunning(input) {
      const job = getRequiredJob(jobs, input.id)
      job.jobStatus = 'running'
      job.currentStage = input.currentStage
      job.startedAt = input.startedAt
      job.finishedAt = null
      job.statusReason = null
      job.errorCode = null
      job.updatedAt = input.startedAt
      return Promise.resolve(ok(job))
    },

    markImportJobFailed(input) {
      const job = getRequiredJob(jobs, input.id)
      job.jobStatus = 'failed'
      job.currentStage = input.currentStage
      job.startedAt = input.startedAt
      job.finishedAt = input.finishedAt
      job.statusReason = input.statusReason
      job.errorCode = input.errorCode
      job.updatedAt = input.finishedAt
      return Promise.resolve(ok(job))
    },

    updateImportJobRawRecordCount(input) {
      const job = getRequiredJob(jobs, input.id)
      job.jobStatus = 'running'
      job.currentStage = input.currentStage
      job.rawRecordCount = input.rawRecordCount
      job.statusReason = null
      job.errorCode = null
      job.updatedAt = '2026-04-09T16:02:00.000Z'
      return Promise.resolve(ok(job))
    },

    updateImportJobNormalizationState(input) {
      const job = getRequiredJob(jobs, input.id)
      job.jobStatus = input.jobStatus
      job.currentStage = input.currentStage
      job.normalizedCandidateCount = input.normalizedCandidateCount
      job.conflictCount = input.conflictCount
      job.statusReason = input.statusReason
      job.errorCode = null
      job.finishedAt =
        input.jobStatus === 'blocked_for_review'
          ? '2026-04-09T16:04:00.000Z'
          : null
      job.updatedAt = job.finishedAt ?? '2026-04-09T16:04:00.000Z'
      return Promise.resolve(ok(job))
    },

    finalizeImportJob(input) {
      const job = getRequiredJob(jobs, input.id)
      job.jobStatus = input.jobStatus
      job.currentStage = input.currentStage
      job.statusReason = input.statusReason
      job.errorCode = null
      job.finishedAt = input.finishedAt
      job.updatedAt = input.finishedAt
      return Promise.resolve(ok(job))
    },

    listRawProductRecordsByJobAndSourceIds(importJobId, sourceProductIds) {
      return Promise.resolve(
        ok(
          rawProducts.filter(
            (record) =>
              record.importJobId === importJobId &&
              sourceProductIds.includes(record.sourceProductId),
          ),
        ),
      )
    },

    listRawProductRecordsByJobAndCodes(importJobId, codes) {
      return Promise.resolve(
        ok(
          rawProducts.filter(
            (record) =>
              record.importJobId === importJobId &&
              record.rawCode !== null &&
              codes.includes(record.rawCode),
          ),
        ),
      )
    },

    upsertRawProductRecords(input) {
      const written: RawProductRecord[] = []

      for (const record of input) {
        const existingIndex = rawProducts.findIndex(
          (existingRecord) =>
            existingRecord.importJobId === record.importJobId &&
            existingRecord.sourceProductId === record.sourceProductId,
        )

        const nextRecord: Mutable<RawProductRecord> = {
          id:
            existingIndex >= 0
              ? rawProducts[existingIndex]!.id
              : `raw-product-${nextRawProductIndex++}`,
          importJobId: record.importJobId,
          sourceProductId: record.sourceProductId,
          payloadFingerprint: record.payloadFingerprint,
          rawName: record.rawName,
          rawCode: record.rawCode,
          rawProductCategory: record.rawProductCategory,
          rawProductKind: record.rawProductKind,
          rawFamilyName: record.rawFamilyName,
          rawReleaseDateText: record.rawReleaseDateText,
          rawRegionCode: record.rawRegionCode,
          sourcePayload: record.sourcePayload,
          createdAt:
            existingIndex >= 0
              ? rawProducts[existingIndex]!.createdAt
              : '2026-04-09T16:02:00.000Z',
          updatedAt: record.updatedAt,
        }

        if (existingIndex >= 0) {
          rawProducts[existingIndex] = nextRecord
        } else {
          rawProducts.push(nextRecord)
        }

        written.push(nextRecord)
      }

      return Promise.resolve(ok(written))
    },

    listRawCardPrintingRecordsByJobAndSourceIds(
      importJobId,
      sourcePrintingIds,
    ) {
      return Promise.resolve(
        ok(
          rawPrintings.filter(
            (record) =>
              record.importJobId === importJobId &&
              sourcePrintingIds.includes(record.sourcePrintingId),
          ),
        ),
      )
    },

    listRawCardPrintingRecordsByJob(importJobId, rawCardPrintingRecordIds) {
      return Promise.resolve(
        ok(
          rawPrintings.filter(
            (record) =>
              record.importJobId === importJobId &&
              (!rawCardPrintingRecordIds ||
                rawCardPrintingRecordIds.includes(record.id)),
          ),
        ),
      )
    },

    upsertRawCardPrintingRecords(input) {
      const written: RawCardPrintingRecord[] = []

      for (const record of input) {
        const existingIndex = rawPrintings.findIndex(
          (existingRecord) =>
            existingRecord.importJobId === record.importJobId &&
            existingRecord.sourcePrintingId === record.sourcePrintingId,
        )

        const nextRecord: Mutable<RawCardPrintingRecord> = {
          id:
            existingIndex >= 0
              ? rawPrintings[existingIndex]!.id
              : `raw-printing-${nextRawPrintingIndex++}`,
          importJobId: record.importJobId,
          sourcePrintingId: record.sourcePrintingId,
          sourceProductId: record.sourceProductId,
          sourceProductCode: record.sourceProductCode,
          rawProductRecordId: record.rawProductRecordId,
          payloadFingerprint: record.payloadFingerprint,
          rawCardName: record.rawCardName,
          rawPrintingCode: record.rawPrintingCode,
          rawRarity: record.rawRarity,
          rawLocaleCode: record.rawLocaleCode,
          rawRegionCode: record.rawRegionCode,
          rawCardType: record.rawCardType,
          rawNation: record.rawNation,
          rawClan: record.rawClan,
          rawTriggerType: record.rawTriggerType,
          rawGradeText: record.rawGradeText,
          rawPowerText: record.rawPowerText,
          rawCriticalText: record.rawCriticalText,
          rawShieldText: record.rawShieldText,
          rawRulesText: record.rawRulesText,
          sourcePayload: record.sourcePayload,
          createdAt:
            existingIndex >= 0
              ? rawPrintings[existingIndex]!.createdAt
              : '2026-04-09T16:03:00.000Z',
          updatedAt: record.updatedAt,
        }

        if (existingIndex >= 0) {
          rawPrintings[existingIndex] = nextRecord
        } else {
          rawPrintings.push(nextRecord)
        }

        written.push(nextRecord)
      }

      return Promise.resolve(ok(written))
    },

    listCatalogCardEntitiesByNormalizedNames(normalizedNames) {
      return Promise.resolve(
        ok(
          catalogEntities.filter((entity) =>
            normalizedNames.includes(entity.normalizedName),
          ),
        ),
      )
    },

    listCardPrintingNormalizationResultsByJob(importJobId) {
      return Promise.resolve(
        ok(
          normalizationResults.filter(
            (result) => result.importJobId === importJobId,
          ),
        ),
      )
    },

    listCardPrintingNormalizationResultsByJobAndRawIds(
      importJobId,
      rawCardPrintingRecordIds,
    ) {
      return Promise.resolve(
        ok(
          normalizationResults.filter(
            (result) =>
              result.importJobId === importJobId &&
              rawCardPrintingRecordIds.includes(result.rawCardPrintingRecordId),
          ),
        ),
      )
    },

    upsertCardPrintingNormalizationResults(input) {
      const written: CardPrintingNormalizationResultRecord[] = []

      for (const result of input) {
        const existingIndex = normalizationResults.findIndex(
          (existingResult) =>
            existingResult.rawCardPrintingRecordId ===
              result.rawCardPrintingRecordId &&
            existingResult.normalizationVersion === result.normalizationVersion,
        )

        const nextResult: Mutable<CardPrintingNormalizationResultRecord> = {
          id:
            existingIndex >= 0
              ? normalizationResults[existingIndex]!.id
              : `normalization-${nextNormalizationIndex++}`,
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
          createdAt:
            existingIndex >= 0
              ? normalizationResults[existingIndex]!.createdAt
              : '2026-04-09T16:04:00.000Z',
          updatedAt: result.updatedAt,
        }

        if (existingIndex >= 0) {
          normalizationResults[existingIndex] = nextResult
        } else {
          normalizationResults.push(nextResult)
        }

        written.push(nextResult)
      }

      return Promise.resolve(ok(written))
    },

    markCardPrintingNormalizationResultsSuperseded(resultIds) {
      let updatedCount = 0

      for (const result of normalizationResults) {
        if (!resultIds.includes(result.id)) {
          continue
        }

        result.normalizationStatus = 'superseded'
        result.needsManualReview = false
        result.conflictSummary = null
        result.updatedAt = '2026-04-09T16:05:00.000Z'
        updatedCount += 1
      }

      return Promise.resolve(ok(updatedCount))
    },

    getManualReviewItemById(id) {
      return Promise.resolve(
        ok(manualReviewItems.find((item) => item.id === id) ?? null),
      )
    },

    listManualReviewItemsByJob(importJobId, reviewStatuses) {
      return Promise.resolve(
        ok(
          manualReviewItems.filter(
            (item) =>
              item.importJobId === importJobId &&
              (!reviewStatuses || reviewStatuses.includes(item.reviewStatus)),
          ),
        ),
      )
    },

    listManualReviewItemsByNormalizationResultIds(normalizationResultIds) {
      return Promise.resolve(
        ok(
          manualReviewItems.filter((item) =>
            normalizationResultIds.includes(item.normalizationResultId),
          ),
        ),
      )
    },

    upsertManualReviewItems(input) {
      const written: ManualReviewItemRecord[] = []

      for (const item of input) {
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

    updateManualReviewItemStatus(input) {
      const reviewItem = manualReviewItems.find((item) => item.id === input.id)

      if (!reviewItem) {
        throw new Error(`Expected review item ${input.id} in integration repo.`)
      }

      reviewItem.reviewStatus = input.reviewStatus
      reviewItem.resolutionKind = input.resolutionKind
      reviewItem.resolvedCardEntityId = input.resolvedCardEntityId
      reviewItem.decisionNotes = input.decisionNotes
      reviewItem.startedReviewAt = input.startedReviewAt
      reviewItem.resolvedAt = input.resolvedAt
      reviewItem.closedAt = input.closedAt
      reviewItem.updatedAt = '2026-04-09T16:05:00.000Z'

      return Promise.resolve(ok(reviewItem))
    },

    countAllRawRecordsForJob(importJobId) {
      return Promise.resolve(
        ok(
          rawProducts.filter((record) => record.importJobId === importJobId)
            .length +
            rawPrintings.filter((record) => record.importJobId === importJobId)
              .length,
        ),
      )
    },
  }
}

function createCatalogEntity(input: {
  readonly id: string
  readonly canonicalKey: string
  readonly name: string
  readonly normalizedName: string
  readonly grade: number
  readonly cardType: string
  readonly nation: string
  readonly clan?: string | null
  readonly triggerType?: string | null
}): CatalogCardEntityNormalizationRecord {
  return {
    id: input.id,
    canonicalKey: input.canonicalKey,
    name: input.name,
    normalizedName: input.normalizedName,
    grade: input.grade,
    cardType: input.cardType,
    nation: input.nation,
    clan: input.clan ?? null,
    triggerType: input.triggerType ?? null,
  }
}

function createDeterministicNow() {
  const values = [
    '2026-04-09T16:00:00.000Z',
    '2026-04-09T16:01:00.000Z',
    '2026-04-09T16:02:00.000Z',
    '2026-04-09T16:03:00.000Z',
    '2026-04-09T16:04:00.000Z',
    '2026-04-09T16:05:00.000Z',
    '2026-04-09T16:06:00.000Z',
    '2026-04-09T16:07:00.000Z',
  ]
  let nextIndex = 0

  return () => values[nextIndex++] ?? '2026-04-09T16:08:00.000Z'
}

function expectNormalizationResultForSourcePrinting(
  repository: {
    readonly rawPrintings: readonly RawCardPrintingRecord[]
    readonly normalizationResults: readonly CardPrintingNormalizationResultRecord[]
  },
  sourcePrintingId: string,
) {
  const rawPrinting = repository.rawPrintings.find(
    (record) => record.sourcePrintingId === sourcePrintingId,
  )

  if (!rawPrinting) {
    throw new Error(`Expected raw printing for ${sourcePrintingId}.`)
  }

  const matchedResult = repository.normalizationResults.find(
    (result) => result.rawCardPrintingRecordId === rawPrinting.id,
  )

  if (!matchedResult) {
    throw new Error(
      `Expected normalization result for source printing ${sourcePrintingId}.`,
    )
  }

  return matchedResult
}

function getRequiredJob(
  jobs: readonly Mutable<ImportJobRecord>[],
  jobId: string,
) {
  const job = jobs.find((existingJob) => existingJob.id === jobId)

  if (!job) {
    throw new Error(`Expected import job ${jobId} in integration repo.`)
  }

  return job
}

function fileFromHere(relativePath: string) {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    relativePath,
  )
}

function ok<TData>(data: TData): RepositoryResult<TData> {
  return {
    ok: true,
    data,
  }
}
