import { createHash } from 'node:crypto'

import { describe, expect, it, vi } from 'vitest'

import type {
  CardPrintingNormalizationResultRecord,
  CatalogCardEntityNormalizationRecord,
  ImporterRepository,
  ImportJobRecord,
  ManualReviewItemRecord,
  RawProductRecord,
  RepositoryResult,
} from '@web-vg/db'

import { createRawProductImporter } from './raw-product-importer'

describe('raw product importer', () => {
  it('imports raw product records under a tracked job and returns created counts', async () => {
    const repository = createRepositoryDouble({
      job: {
        id: 'job-1',
        sourceId: 'source-1',
        retryOfJobId: null,
        jobStatus: 'pending',
        currentStage: 'source',
        pipelineVersion: 'v1',
        upstreamSnapshotKey: 'snapshot-1',
        inputFingerprint: 'input-hash',
        scopeMetadata: {},
        statusReason: null,
        errorCode: null,
        rawRecordCount: 0,
        normalizedCandidateCount: 0,
        conflictCount: 0,
        publishedRecordCount: 0,
        createdAt: '2026-04-09T09:00:00.000Z',
        startedAt: null,
        finishedAt: null,
        updatedAt: '2026-04-09T09:00:00.000Z',
      },
      existingRawRecords: [],
      rawRecordCount: 2,
    })

    const importer = createRawProductImporter(repository)
    const result = await importer.importProducts({
      importJobId: 'job-1',
      products: [
        {
          sourceProductId: 'prod-1',
          name: 'D-BT01 Genesis of the Five Greats',
          code: 'D-BT01',
          productCategory: 'booster',
          productKind: 'main',
          familyName: 'Standard Booster',
          releaseDateText: '2021-05-14',
          regionCode: 'jp',
          sourcePayload: {
            title: 'D-BT01 Genesis of the Five Greats',
            product_kind: 'main',
          },
        },
        {
          sourceProductId: 'prod-2',
          name: 'D-SD01 Yu-yu Kondo',
          code: 'D-SD01',
          productCategory: 'deck',
          productKind: 'start',
          familyName: 'Standard Start Deck',
          releaseDateText: '2021-04-02',
          regionCode: 'jp',
          sourcePayload: {
            title: 'D-SD01 Yu-yu Kondo',
            product_kind: 'start',
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
        rawRecordCount: 2,
        jobStatus: 'running',
        currentStage: 'raw_import',
      },
    })
    expect(repository.markImportJobRunning).toHaveBeenCalledOnce()
    expect(repository.upsertRawProductRecords).toHaveBeenCalledOnce()
    expect(repository.updateImportJobRawRecordCount).toHaveBeenCalledOnce()
    expect(repository.markImportJobFailed).not.toHaveBeenCalled()
    expect(repository.updateImportJobNormalizationState).not.toHaveBeenCalled()
    expect(
      repository.upsertCardPrintingNormalizationResults,
    ).not.toHaveBeenCalled()
    expect(repository.upsertManualReviewItems).not.toHaveBeenCalled()
    expect(repository.finalizeImportJob).not.toHaveBeenCalled()
  })

  it('skips unchanged raw products and updates only changed records within the same job', async () => {
    const unchangedPayload = {
      title: 'D-BT01 Genesis of the Five Greats',
      product_kind: 'main',
    }
    const repository = createRepositoryDouble({
      job: {
        id: 'job-1',
        sourceId: 'source-1',
        retryOfJobId: null,
        jobStatus: 'running',
        currentStage: 'raw_import',
        pipelineVersion: 'v1',
        upstreamSnapshotKey: null,
        inputFingerprint: null,
        scopeMetadata: {},
        statusReason: null,
        errorCode: null,
        rawRecordCount: 1,
        normalizedCandidateCount: 0,
        conflictCount: 0,
        publishedRecordCount: 0,
        createdAt: '2026-04-09T09:00:00.000Z',
        startedAt: '2026-04-09T09:01:00.000Z',
        finishedAt: null,
        updatedAt: '2026-04-09T09:01:00.000Z',
      },
      existingRawRecords: [
        createRawProductRecord({
          sourceProductId: 'prod-1',
          rawName: 'D-BT01 Genesis of the Five Greats',
          rawCode: 'D-BT01',
          rawProductCategory: 'booster',
          rawProductKind: 'main',
          rawFamilyName: 'Standard Booster',
          rawReleaseDateText: '2021-05-14',
          rawRegionCode: 'jp',
          sourcePayload: unchangedPayload,
        }),
        createRawProductRecord({
          sourceProductId: 'prod-2',
          rawName: 'D-SD01 Yu-yu Kondo',
          rawCode: 'D-SD01',
          rawProductCategory: 'deck',
          rawProductKind: 'trial',
          rawFamilyName: 'Standard Start Deck',
          rawReleaseDateText: '2021-04-02',
          rawRegionCode: 'jp',
          sourcePayload: {
            title: 'D-SD01 Yu-yu Kondo',
            product_kind: 'trial',
          },
        }),
      ],
      rawRecordCount: 2,
    })

    const importer = createRawProductImporter(repository)
    const result = await importer.importProducts({
      importJobId: 'job-1',
      products: [
        {
          sourceProductId: 'prod-1',
          name: 'D-BT01 Genesis of the Five Greats',
          code: 'D-BT01',
          productCategory: 'booster',
          productKind: 'main',
          familyName: 'Standard Booster',
          releaseDateText: '2021-05-14',
          regionCode: 'jp',
          sourcePayload: unchangedPayload,
        },
        {
          sourceProductId: 'prod-2',
          name: 'D-SD01 Yu-yu Kondo',
          code: 'D-SD01',
          productCategory: 'deck',
          productKind: 'start',
          familyName: 'Standard Start Deck',
          releaseDateText: '2021-04-02',
          regionCode: 'jp',
          sourcePayload: {
            title: 'D-SD01 Yu-yu Kondo',
            product_kind: 'start',
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
        updatedCount: 1,
        skippedCount: 1,
        rawRecordCount: 2,
        jobStatus: 'running',
        currentStage: 'raw_import',
      },
    })
    expect(repository.upsertRawProductRecords).toHaveBeenCalledWith([
      expect.objectContaining({
        importJobId: 'job-1',
        sourceProductId: 'prod-2',
      }),
    ])
  })

  it('fails the job on invalid input before writing raw records', async () => {
    const repository = createRepositoryDouble({
      job: {
        id: 'job-1',
        sourceId: 'source-1',
        retryOfJobId: null,
        jobStatus: 'pending',
        currentStage: 'source',
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
        startedAt: null,
        finishedAt: null,
        updatedAt: '2026-04-09T09:00:00.000Z',
      },
      existingRawRecords: [],
      rawRecordCount: 0,
    })

    const importer = createRawProductImporter(repository)
    const result = await importer.importProducts({
      importJobId: 'job-1',
      products: [
        {
          sourceProductId: 'prod-1',
          name: 'D-BT01 Genesis of the Five Greats',
          sourcePayload: {
            title: 'set-1',
          },
        },
        {
          sourceProductId: 'prod-1',
          name: 'Duplicate id',
          sourcePayload: {
            title: 'set-2',
          },
        },
      ],
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'invalid-input',
        message:
          'Duplicate source product ids are not allowed in one raw product batch.',
      },
    })
    expect(repository.markImportJobFailed).toHaveBeenCalledOnce()
    expect(repository.markImportJobRunning).not.toHaveBeenCalled()
    expect(repository.upsertRawProductRecords).not.toHaveBeenCalled()
  })

  it('does not run against terminal jobs', async () => {
    const repository = createRepositoryDouble({
      job: {
        id: 'job-1',
        sourceId: 'source-1',
        retryOfJobId: null,
        jobStatus: 'completed',
        currentStage: 'publication',
        pipelineVersion: 'v1',
        upstreamSnapshotKey: null,
        inputFingerprint: null,
        scopeMetadata: {},
        statusReason: null,
        errorCode: null,
        rawRecordCount: 3,
        normalizedCandidateCount: 0,
        conflictCount: 0,
        publishedRecordCount: 0,
        createdAt: '2026-04-09T09:00:00.000Z',
        startedAt: '2026-04-09T09:01:00.000Z',
        finishedAt: '2026-04-09T09:05:00.000Z',
        updatedAt: '2026-04-09T09:05:00.000Z',
      },
      existingRawRecords: [],
      rawRecordCount: 3,
    })

    const importer = createRawProductImporter(repository)
    const result = await importer.importProducts({
      importJobId: 'job-1',
      products: [
        {
          sourceProductId: 'prod-1',
          name: 'D-BT01 Genesis of the Five Greats',
          sourcePayload: {
            title: 'set-1',
          },
        },
      ],
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'job-not-runnable',
        message: 'Raw product import requires a pending or running import job.',
        details: 'Current job status: completed.',
      },
    })
    expect(repository.markImportJobRunning).not.toHaveBeenCalled()
    expect(repository.upsertRawProductRecords).not.toHaveBeenCalled()
  })
})

function createRepositoryDouble(input: {
  job: ImportJobRecord | null
  existingRawRecords: readonly RawProductRecord[]
  rawRecordCount: number
}): ImporterRepository & {
  readonly markImportJobRunning: ReturnType<typeof vi.fn>
  readonly markImportJobFailed: ReturnType<typeof vi.fn>
  readonly upsertRawProductRecords: ReturnType<typeof vi.fn>
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
      Promise.resolve(ok(input.existingRawRecords)),
    ),
    listRawProductRecordsByJobAndCodes: vi.fn(() => Promise.resolve(ok([]))),
    upsertRawProductRecords: vi.fn(() => Promise.resolve(ok([]))),
    listRawCardPrintingRecordsByJobAndSourceIds: vi.fn(() =>
      Promise.resolve(ok([])),
    ),
    listRawCardPrintingRecordsByJob: vi.fn(() => Promise.resolve(ok([]))),
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

function createRawProductRecord(input: {
  sourceProductId: string
  sourcePayload: Record<string, unknown>
  rawName?: string
  rawCode?: string | null
  rawProductCategory?: string | null
  rawProductKind?: string | null
  rawFamilyName?: string | null
  rawReleaseDateText?: string | null
  rawRegionCode?: string | null
}): RawProductRecord {
  return {
    id: `raw-${input.sourceProductId}`,
    importJobId: 'job-1',
    sourceProductId: input.sourceProductId,
    payloadFingerprint: hashObject(input.sourcePayload),
    rawName: input.rawName ?? 'placeholder',
    rawCode: input.rawCode ?? null,
    rawProductCategory: input.rawProductCategory ?? null,
    rawProductKind: input.rawProductKind ?? null,
    rawFamilyName: input.rawFamilyName ?? null,
    rawReleaseDateText: input.rawReleaseDateText ?? null,
    rawRegionCode: input.rawRegionCode ?? null,
    sourcePayload: input.sourcePayload as RawProductRecord['sourcePayload'],
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
