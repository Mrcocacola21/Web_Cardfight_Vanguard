import { createHash } from 'node:crypto'

import { describe, expect, it, vi } from 'vitest'

import type { RepositoryResult } from '@web-vg/db'
import type {
  CardPrintingNormalizationResultRecord,
  CatalogCardEntityNormalizationRecord,
  ImporterRepository,
  ImportJobRecord,
  ManualReviewItemRecord,
  RawCardPrintingRecord,
  RawProductRecord,
} from '@web-vg/db/repositories/importer'

import { createRawCardPrintingImporter } from './raw-card-printing-importer'

describe('raw card-printing importer', () => {
  it('imports raw printing records and links them to raw product context when available', async () => {
    const repository = createRepositoryDouble({
      job: createRunningCandidateJob('pending'),
      existingPrintingRecords: [],
      rawProductRecordsBySourceId: [
        createRawProductRecord({
          id: 'raw-product-1',
          sourceProductId: 'prod-1',
          rawCode: 'D-BT01',
        }),
      ],
      rawProductRecordsByCode: [],
      rawRecordCount: 3,
    })

    const importer = createRawCardPrintingImporter(repository)
    const result = await importer.importPrintings({
      importJobId: 'job-1',
      printings: [
        {
          sourcePrintingId: 'printing-1',
          sourceProductId: 'prod-1',
          sourceProductCode: 'D-BT01',
          cardName: 'Apex Ruler, Bastion',
          printingCode: '001',
          rarity: 'RRR',
          localeCode: 'jp',
          regionCode: 'jp',
          cardType: 'normal-unit',
          nation: 'Keter Sanctuary',
          gradeText: '3',
          powerText: '13000',
          criticalText: '1',
          shieldText: '0',
          rulesText: '[AUTO]: When this unit attacks...',
          sourcePayload: {
            row: 1,
            title: 'Apex Ruler, Bastion',
          },
        },
        {
          sourcePrintingId: 'printing-2',
          sourceProductCode: 'D-BT99',
          cardName: 'Unknown Promo',
          printingCode: 'PR-001',
          rarity: 'PR',
          sourcePayload: {
            row: 2,
            title: 'Unknown Promo',
          },
        },
      ],
    })

    expect(result).toEqual({
      ok: true,
      data: {
        importJobId: 'job-1',
        importSourceId: 'source-1',
        processedCount: 2,
        createdCount: 2,
        updatedCount: 0,
        skippedCount: 0,
        linkedProductCount: 1,
        unlinkedProductCount: 1,
        rawRecordCount: 3,
        jobStatus: 'running',
        currentStage: 'raw_import',
      },
    })
    expect(repository.upsertRawCardPrintingRecords).toHaveBeenCalledWith([
      expect.objectContaining({
        importJobId: 'job-1',
        sourcePrintingId: 'printing-1',
        rawProductRecordId: 'raw-product-1',
      }),
      expect.objectContaining({
        importJobId: 'job-1',
        sourcePrintingId: 'printing-2',
        rawProductRecordId: null,
      }),
    ])
    expect(repository.updateImportJobNormalizationState).not.toHaveBeenCalled()
    expect(
      repository.upsertCardPrintingNormalizationResults,
    ).not.toHaveBeenCalled()
    expect(repository.upsertManualReviewItems).not.toHaveBeenCalled()
    expect(repository.finalizeImportJob).not.toHaveBeenCalled()
  })

  it('uses source product code fallback when id match is unavailable and the code match is unique', async () => {
    const repository = createRepositoryDouble({
      job: createRunningCandidateJob('running'),
      existingPrintingRecords: [],
      rawProductRecordsBySourceId: [],
      rawProductRecordsByCode: [
        createRawProductRecord({
          id: 'raw-product-2',
          sourceProductId: 'prod-2',
          rawCode: 'D-BT02',
        }),
      ],
      rawRecordCount: 2,
    })

    const importer = createRawCardPrintingImporter(repository)
    const result = await importer.importPrintings({
      importJobId: 'job-1',
      printings: [
        {
          sourcePrintingId: 'printing-1',
          sourceProductCode: 'D-BT02',
          cardName: 'Knight of War Damage, Fosado',
          sourcePayload: {
            title: 'Knight of War Damage, Fosado',
          },
        },
      ],
    })

    expect(result.ok).toBe(true)
    expect(repository.upsertRawCardPrintingRecords).toHaveBeenCalledWith([
      expect.objectContaining({
        sourcePrintingId: 'printing-1',
        rawProductRecordId: 'raw-product-2',
      }),
    ])
  })

  it('updates changed records and refreshes raw-product linkage when payload stays the same', async () => {
    const sharedPayload = {
      row: 1,
      title: 'Apex Ruler, Bastion',
    }
    const repository = createRepositoryDouble({
      job: createRunningCandidateJob('running'),
      existingPrintingRecords: [
        createRawCardPrintingRecord({
          sourcePrintingId: 'printing-1',
          sourcePayload: sharedPayload,
          sourceProductId: 'prod-1',
          sourceProductCode: 'D-BT01',
          rawProductRecordId: null,
        }),
        createRawCardPrintingRecord({
          sourcePrintingId: 'printing-2',
          sourcePayload: {
            title: 'Different payload',
          },
          sourceProductId: 'prod-2',
          sourceProductCode: 'D-BT02',
          rawProductRecordId: 'raw-product-2',
        }),
      ],
      rawProductRecordsBySourceId: [
        createRawProductRecord({
          id: 'raw-product-1',
          sourceProductId: 'prod-1',
          rawCode: 'D-BT01',
        }),
        createRawProductRecord({
          id: 'raw-product-2',
          sourceProductId: 'prod-2',
          rawCode: 'D-BT02',
        }),
      ],
      rawProductRecordsByCode: [],
      rawRecordCount: 4,
    })

    const importer = createRawCardPrintingImporter(repository)
    const result = await importer.importPrintings({
      importJobId: 'job-1',
      printings: [
        {
          sourcePrintingId: 'printing-1',
          sourceProductId: 'prod-1',
          sourceProductCode: 'D-BT01',
          cardName: 'Apex Ruler, Bastion',
          sourcePayload: sharedPayload,
        },
        {
          sourcePrintingId: 'printing-2',
          sourceProductId: 'prod-2',
          sourceProductCode: 'D-BT02',
          cardName: 'Knight of War Damage, Fosado',
          rarity: 'RR',
          sourcePayload: {
            title: 'Updated payload',
          },
        },
      ],
    })

    expect(result).toEqual({
      ok: true,
      data: {
        importJobId: 'job-1',
        importSourceId: 'source-1',
        processedCount: 2,
        createdCount: 0,
        updatedCount: 2,
        skippedCount: 0,
        linkedProductCount: 2,
        unlinkedProductCount: 0,
        rawRecordCount: 4,
        jobStatus: 'running',
        currentStage: 'raw_import',
      },
    })
  })

  it('fails the job on invalid input before writing raw printing records', async () => {
    const repository = createRepositoryDouble({
      job: createRunningCandidateJob('pending'),
      existingPrintingRecords: [],
      rawProductRecordsBySourceId: [],
      rawProductRecordsByCode: [],
      rawRecordCount: 0,
    })

    const importer = createRawCardPrintingImporter(repository)
    const result = await importer.importPrintings({
      importJobId: 'job-1',
      printings: [
        {
          sourcePrintingId: 'printing-1',
          cardName: 'Apex Ruler, Bastion',
          sourcePayload: {
            title: 'row-1',
          },
        },
        {
          sourcePrintingId: 'printing-1',
          cardName: 'Duplicate source id',
          sourcePayload: {
            title: 'row-2',
          },
        },
      ],
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'invalid-input',
        message:
          'Duplicate source printing ids are not allowed in one raw card-printing batch.',
      },
    })
    expect(repository.markImportJobFailed).toHaveBeenCalledOnce()
    expect(repository.upsertRawCardPrintingRecords).not.toHaveBeenCalled()
  })
})

function createRepositoryDouble(input: {
  job: ImportJobRecord | null
  existingPrintingRecords: readonly RawCardPrintingRecord[]
  rawProductRecordsBySourceId: readonly RawProductRecord[]
  rawProductRecordsByCode: readonly RawProductRecord[]
  rawRecordCount: number
}): ImporterRepository & {
  readonly markImportJobRunning: ReturnType<typeof vi.fn>
  readonly markImportJobFailed: ReturnType<typeof vi.fn>
  readonly upsertRawCardPrintingRecords: ReturnType<typeof vi.fn>
  readonly updateImportJobRawRecordCount: ReturnType<typeof vi.fn>
  readonly updateImportJobNormalizationState: ReturnType<typeof vi.fn>
  readonly upsertCardPrintingNormalizationResults: ReturnType<typeof vi.fn>
  readonly upsertManualReviewItems: ReturnType<typeof vi.fn>
  readonly finalizeImportJob: ReturnType<typeof vi.fn>
} {
  return {
    upsertImportSource: vi.fn(() => Promise.resolve(ok(unreachable()))),
    createImportJob: vi.fn(() => Promise.resolve(ok(unreachable()))),
    getImportJobById: vi.fn(() => Promise.resolve(ok(input.job))),
    markImportJobRunning: vi.fn(() =>
      Promise.resolve(ok(input.job ?? unreachable())),
    ),
    markImportJobFailed: vi.fn(() =>
      Promise.resolve(ok(input.job ?? unreachable())),
    ),
    updateImportJobRawRecordCount: vi.fn(() =>
      Promise.resolve(ok(input.job ?? unreachable())),
    ),
    listRawProductRecordsByJobAndSourceIds: vi.fn(() =>
      Promise.resolve(ok(input.rawProductRecordsBySourceId)),
    ),
    listRawProductRecordsByJobAndCodes: vi.fn(() =>
      Promise.resolve(ok(input.rawProductRecordsByCode)),
    ),
    upsertRawProductRecords: vi.fn(() => Promise.resolve(ok([]))),
    listRawCardPrintingRecordsByJobAndSourceIds: vi.fn(() =>
      Promise.resolve(ok(input.existingPrintingRecords)),
    ),
    listRawCardPrintingRecordsByJob: vi.fn(() =>
      Promise.resolve(ok(input.existingPrintingRecords)),
    ),
    upsertRawCardPrintingRecords: vi.fn(() => Promise.resolve(ok([]))),
    listCatalogCardEntitiesByNormalizedNames: vi.fn<
      (
        normalizedNames: readonly string[],
      ) => Promise<
        RepositoryResult<readonly CatalogCardEntityNormalizationRecord[]>
      >
    >(() => Promise.resolve(ok([]))),
    listCardPrintingNormalizationResultsByJob: vi.fn<
      (
        importJobId: string,
      ) => Promise<
        RepositoryResult<readonly CardPrintingNormalizationResultRecord[]>
      >
    >(() => Promise.resolve(ok([]))),
    listCardPrintingNormalizationResultsByJobAndRawIds: vi.fn<
      (
        importJobId: string,
        rawCardPrintingRecordIds: readonly string[],
      ) => Promise<
        RepositoryResult<readonly CardPrintingNormalizationResultRecord[]>
      >
    >(() => Promise.resolve(ok([]))),
    upsertCardPrintingNormalizationResults: vi.fn(() =>
      Promise.resolve(ok([])),
    ),
    markCardPrintingNormalizationResultsSuperseded: vi.fn(() =>
      Promise.resolve(ok(0)),
    ),
    getManualReviewItemById: vi.fn(() => Promise.resolve(ok(null))),
    listManualReviewItemsByJob: vi.fn<
      (
        importJobId: string,
        reviewStatuses?: readonly ManualReviewItemRecord['reviewStatus'][],
      ) => Promise<RepositoryResult<readonly ManualReviewItemRecord[]>>
    >(() => Promise.resolve(ok([]))),
    listManualReviewItemsByNormalizationResultIds: vi.fn<
      (
        normalizationResultIds: readonly string[],
      ) => Promise<RepositoryResult<readonly ManualReviewItemRecord[]>>
    >(() => Promise.resolve(ok([]))),
    upsertManualReviewItems: vi.fn<
      (
        input: readonly unknown[],
      ) => Promise<RepositoryResult<readonly ManualReviewItemRecord[]>>
    >(() => Promise.resolve(ok([]))),
    updateManualReviewItemStatus: vi.fn<
      (input: unknown) => Promise<RepositoryResult<ManualReviewItemRecord>>
    >(() => Promise.resolve(ok(unreachable()))),
    countAllRawRecordsForJob: vi.fn(() =>
      Promise.resolve(ok(input.rawRecordCount)),
    ),
    updateImportJobNormalizationState: vi.fn(() =>
      Promise.resolve(ok(input.job ?? unreachable())),
    ),
    finalizeImportJob: vi.fn(() =>
      Promise.resolve(ok(input.job ?? unreachable())),
    ),
  }
}

function createRunningCandidateJob(
  jobStatus: ImportJobRecord['jobStatus'],
): ImportJobRecord {
  return {
    id: 'job-1',
    sourceId: 'source-1',
    retryOfJobId: null,
    jobStatus,
    currentStage: jobStatus === 'pending' ? 'source' : 'raw_import',
    pipelineVersion: 'v1',
    upstreamSnapshotKey: null,
    inputFingerprint: null,
    scopeMetadata: {},
    statusReason: null,
    errorCode: null,
    rawRecordCount: 0,
    normalizedCandidateCount: 0,
    conflictCount: 0,
    publishedRecordCount: 0,
    createdAt: '2026-04-09T09:00:00.000Z',
    startedAt: jobStatus === 'running' ? '2026-04-09T09:01:00.000Z' : null,
    finishedAt: null,
    updatedAt: '2026-04-09T09:01:00.000Z',
  }
}

function createRawProductRecord(input: {
  id: string
  sourceProductId: string
  rawCode: string | null
}): RawProductRecord {
  return {
    id: input.id,
    importJobId: 'job-1',
    sourceProductId: input.sourceProductId,
    payloadFingerprint: 'hash',
    rawName: 'placeholder product',
    rawCode: input.rawCode,
    rawProductCategory: null,
    rawProductKind: null,
    rawFamilyName: null,
    rawReleaseDateText: null,
    rawRegionCode: null,
    sourcePayload: {},
    createdAt: '2026-04-09T09:00:00.000Z',
    updatedAt: '2026-04-09T09:00:00.000Z',
  }
}

function createRawCardPrintingRecord(input: {
  sourcePrintingId: string
  sourcePayload: Record<string, unknown>
  sourceProductId: string | null
  sourceProductCode: string | null
  rawProductRecordId: string | null
}): RawCardPrintingRecord {
  return {
    id: `raw-${input.sourcePrintingId}`,
    importJobId: 'job-1',
    sourcePrintingId: input.sourcePrintingId,
    sourceProductId: input.sourceProductId,
    sourceProductCode: input.sourceProductCode,
    rawProductRecordId: input.rawProductRecordId,
    payloadFingerprint: hashObject(input.sourcePayload),
    rawCardName: 'placeholder card',
    rawPrintingCode: null,
    rawRarity: null,
    rawLocaleCode: null,
    rawRegionCode: null,
    rawCardType: null,
    rawNation: null,
    rawClan: null,
    rawTriggerType: null,
    rawGradeText: null,
    rawPowerText: null,
    rawCriticalText: null,
    rawShieldText: null,
    rawRulesText: null,
    sourcePayload:
      input.sourcePayload as RawCardPrintingRecord['sourcePayload'],
    createdAt: '2026-04-09T09:00:00.000Z',
    updatedAt: '2026-04-09T09:00:00.000Z',
  }
}

function hashObject(value: Record<string, unknown>) {
  return createHash('sha256')
    .update(
      JSON.stringify(
        Object.keys(value)
          .sort()
          .reduce<Record<string, unknown>>((result, key) => {
            result[key] = value[key]
            return result
          }, {}),
      ),
    )
    .digest('hex')
}

function ok<TData>(data: TData): RepositoryResult<TData> {
  return {
    ok: true,
    data,
  }
}

function unreachable(): never {
  throw new Error('Expected repository double to have a job.')
}
