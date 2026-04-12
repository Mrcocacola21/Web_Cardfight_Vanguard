import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { describe, expect, it, vi } from 'vitest'

import type { RepositoryResult } from '@web-vg/db'
import type {
  CreateImportJobInput,
  FinalizeImportJobInput,
  ImportJobRecord,
  ImportSourceRecord,
  ImporterRepository,
  ManualReviewItemRecord,
  UpsertImportSourceInput,
} from '@web-vg/db/repositories/importer'
import type { NormalizeCardPrintingCandidatesInput } from '../normalization'
import type { ImportRawCardPrintingsInput } from '../raw-printings'
import type { ImportRawProductsInput } from '../raw-products'

import {
  createDevJsonImportRunner,
  devJsonImportContractVersion,
  devJsonImportPipelineVersion,
  devJsonImportSourceType,
  readDevJsonImportDocumentFromFile,
} from './dev-json-importer'

describe('dev JSON importer', () => {
  it('reads a valid dev fixture and normalizes it into the dev import contract', async () => {
    const fixturePath = fileFromHere(
      '../../fixtures/dev-json/sample-standard-with-review.json',
    )

    const result = await readDevJsonImportDocumentFromFile(fixturePath)

    expect(result.ok).toBe(true)

    if (!result.ok) {
      return
    }

    expect(result.data.filePath).toBe(fixturePath)
    expect(result.data.document.source).toEqual(
      expect.objectContaining({
        key: 'dev-json.sample-standard-with-review',
        displayName: 'Dev JSON sample: standard with review',
        providerName: 'local-dev',
        originUri: toFileHref(fixturePath),
        snapshotKey: 'sample-v1',
        configuration: {
          mode: 'dev-json',
          contractVersion: devJsonImportContractVersion,
        },
      }),
    )
    expect(result.data.document.options).toEqual({
      runNormalization: true,
      normalizationVersion: null,
    })
    expect(result.data.document.products).toHaveLength(1)
    expect(result.data.document.printings).toHaveLength(2)
    const firstProduct = result.data.document.products[0]
    const firstPrinting = result.data.document.printings[0]

    expect(firstProduct).toEqual(
      expect.objectContaining({
        sourceProductId: 'prod-d-bt01',
        name: 'D-BT01 Genesis of the Five Greats',
      }),
    )
    expect(firstProduct?.sourcePayload).toMatchObject({
      devContractVersion: devJsonImportContractVersion,
      itemKind: 'product',
      sourceProductId: 'prod-d-bt01',
    })
    expect(firstPrinting).toEqual(
      expect.objectContaining({
        sourcePrintingId: 'printing-bastion-001',
        cardName: 'Apex Ruler, Bastion',
      }),
    )
    expect(firstPrinting?.sourcePayload).toMatchObject({
      devContractVersion: devJsonImportContractVersion,
      itemKind: 'printing',
      sourcePrintingId: 'printing-bastion-001',
    })
    expect(result.data.document.inputFingerprint).toMatch(/^[a-f0-9]{64}$/u)
  })

  it('reads the content-wave-1 fixture as one small realistic Standard D/DZ wave', async () => {
    const fixturePath = fileFromHere(
      '../../fixtures/dev-json/content-wave-1-standard-ddz-minimal.json',
    )

    const result = await readDevJsonImportDocumentFromFile(fixturePath)

    expect(result.ok).toBe(true)

    if (!result.ok) {
      return
    }

    expect(result.data.document.source).toEqual(
      expect.objectContaining({
        key: 'dev-json.content-wave-1-standard-ddz-minimal',
        displayName: 'Content wave 1: minimal Standard D/DZ seed',
        snapshotKey: 'wave-1-v1',
      }),
    )
    expect(result.data.document.products).toHaveLength(3)
    expect(result.data.document.printings).toHaveLength(4)
    expect(
      result.data.document.products.map((product) => product.code),
    ).toEqual(['D-BT01', 'DZ-BT01', 'DZ-BT02'])
    expect(
      result.data.document.printings.map((printing) => [
        printing.cardName,
        printing.sourcePayload.seedCase,
      ]),
    ).toEqual([
      ['Apex Ruler, Bastion', 'normal-single-printing'],
      ['Fated One of Miracles, Rezael', 'multiple-printings-primary'],
      ['Fated One of Miracles, Rezael', 'multiple-printings-parallel'],
      ['Fated One of Time, Liael=Amorta', 'review-unresolved'],
    ])
  })

  it('rejects malformed JSON files and invalid dev input contracts', async () => {
    const malformedFile = await writeTempFile('not-json.txt', '{')
    const invalidContractFile = await writeTempFile(
      'invalid-contract.json',
      JSON.stringify({
        source: {
          key: 'dev-json.invalid',
          displayName: 'Invalid fixture',
        },
        options: {
          runNormalization: 'yes',
        },
      }),
    )

    try {
      const malformedResult =
        await readDevJsonImportDocumentFromFile(malformedFile)
      const invalidContractResult =
        await readDevJsonImportDocumentFromFile(invalidContractFile)

      expect(malformedResult.ok).toBe(false)
      expect(invalidContractResult).toEqual({
        ok: false,
        error: {
          code: 'invalid-input',
          message:
            'Dev JSON import options.runNormalization must be a boolean when provided.',
        },
      })

      if (!malformedResult.ok) {
        expect(malformedResult.error.code).toBe('invalid-json')
        expect(malformedResult.error.message).toBe(
          `Dev JSON import file ${malformedFile} is not valid JSON.`,
        )
        expect(typeof malformedResult.error.details).toBe('string')
      }
    } finally {
      await rm(path.dirname(malformedFile), { recursive: true, force: true })
      await rm(path.dirname(invalidContractFile), {
        recursive: true,
        force: true,
      })
    }
  })

  it('routes raw-only dev imports through tracked source and job creation without calling normalization', async () => {
    const fixturePath = fileFromHere(
      '../../fixtures/dev-json/sample-raw-only.json',
    )
    const documentResult = await readDevJsonImportDocumentFromFile(fixturePath)

    expect(documentResult.ok).toBe(true)

    if (!documentResult.ok) {
      return
    }

    const repository = createRepositoryDouble()
    const rawProductImporter = {
      importProducts: vi.fn((input: ImportRawProductsInput) =>
        Promise.resolve({
          ok: true as const,
          data: {
            importJobId: input.importJobId,
            importSourceId: repository.sources[0]?.id ?? 'source-1',
            processedCount: 1,
            createdCount: 1,
            updatedCount: 0,
            skippedCount: 0,
            rawRecordCount: 1,
            jobStatus: 'running' as const,
            currentStage: 'raw_import' as const,
          },
        }),
      ),
    }
    const rawCardPrintingImporter = {
      importPrintings: vi.fn((input: ImportRawCardPrintingsInput) =>
        Promise.resolve({
          ok: true as const,
          data: {
            importJobId: input.importJobId,
            importSourceId: repository.sources[0]?.id ?? 'source-1',
            processedCount: 1,
            createdCount: 1,
            updatedCount: 0,
            skippedCount: 0,
            linkedProductCount: 1,
            unlinkedProductCount: 0,
            rawRecordCount: 2,
            jobStatus: 'running' as const,
            currentStage: 'raw_import' as const,
          },
        }),
      ),
    }
    const cardPrintingNormalizer = {
      normalize: vi.fn(() =>
        Promise.reject(
          new Error('Normalization should not run for raw-only fixtures.'),
        ),
      ),
    }

    const runner = createDevJsonImportRunner(repository, {
      rawProductImporter,
      rawCardPrintingImporter,
      cardPrintingNormalizer,
      now: () => '2026-04-09T16:00:00.000Z',
    })
    const result = await runner.run({
      document: documentResult.data.document,
      filePath: documentResult.data.filePath,
    })

    expect(result).toEqual({
      ok: true,
      data: {
        source: {
          id: 'source-1',
          sourceKey: 'dev-json.sample-raw-only',
          sourceType: devJsonImportSourceType,
          displayName: 'Dev JSON sample: raw only',
          originUri: toFileHref(fixturePath),
        },
        job: {
          id: 'job-1',
          jobStatus: 'partially_completed',
          currentStage: 'raw_import',
          pipelineVersion: devJsonImportPipelineVersion,
          inputFingerprint: documentResult.data.document.inputFingerprint,
          upstreamSnapshotKey: 'sample-raw-v1',
          statusReason:
            'Dev JSON import completed through raw import only. Publication was not run.',
        },
        rawProducts: {
          processedCount: 1,
          createdCount: 1,
          updatedCount: 0,
          skippedCount: 0,
        },
        rawPrintings: {
          processedCount: 1,
          createdCount: 1,
          updatedCount: 0,
          skippedCount: 0,
          linkedProductCount: 1,
          unlinkedProductCount: 0,
        },
        normalization: null,
        reviewQueue: null,
      },
    })
    expect(rawProductImporter.importProducts).toHaveBeenCalledWith({
      importJobId: 'job-1',
      products: documentResult.data.document.products,
    })
    expect(rawCardPrintingImporter.importPrintings).toHaveBeenCalledWith({
      importJobId: 'job-1',
      printings: documentResult.data.document.printings,
    })
    expect(cardPrintingNormalizer.normalize).not.toHaveBeenCalled()
    expect(repository.sources).toEqual([
      expect.objectContaining({
        id: 'source-1',
        sourceKey: 'dev-json.sample-raw-only',
        sourceType: devJsonImportSourceType,
        originUri: toFileHref(fixturePath),
        configuration: {
          mode: 'dev-json',
          contractVersion: devJsonImportContractVersion,
        },
      }),
    ])
    expect(repository.jobs).toEqual([
      expect.objectContaining({
        id: 'job-1',
        sourceId: 'source-1',
        jobStatus: 'partially_completed',
        currentStage: 'raw_import',
        pipelineVersion: devJsonImportPipelineVersion,
        inputFingerprint: documentResult.data.document.inputFingerprint,
        publishedRecordCount: 0,
      }),
    ])
    expect(repository.listManualReviewItemsByJob).not.toHaveBeenCalled()
  })

  it('reuses the same dev source across repeated imports and can run through normalization with review summaries', async () => {
    const fixturePath = fileFromHere(
      '../../fixtures/dev-json/sample-standard-with-review.json',
    )
    const documentResult = await readDevJsonImportDocumentFromFile(fixturePath)

    expect(documentResult.ok).toBe(true)

    if (!documentResult.ok) {
      return
    }

    const repository = createRepositoryDouble()
    const rawProductImporter = {
      importProducts: vi.fn((input: ImportRawProductsInput) =>
        Promise.resolve({
          ok: true as const,
          data: {
            importJobId: input.importJobId,
            importSourceId: repository.sources[0]?.id ?? 'source-1',
            processedCount: 1,
            createdCount: 1,
            updatedCount: 0,
            skippedCount: 0,
            rawRecordCount: 1,
            jobStatus: 'running' as const,
            currentStage: 'raw_import' as const,
          },
        }),
      ),
    }
    const rawCardPrintingImporter = {
      importPrintings: vi.fn((input: ImportRawCardPrintingsInput) =>
        Promise.resolve({
          ok: true as const,
          data: {
            importJobId: input.importJobId,
            importSourceId: repository.sources[0]?.id ?? 'source-1',
            processedCount: 2,
            createdCount: 2,
            updatedCount: 0,
            skippedCount: 0,
            linkedProductCount: 2,
            unlinkedProductCount: 0,
            rawRecordCount: 3,
            jobStatus: 'running' as const,
            currentStage: 'raw_import' as const,
          },
        }),
      ),
    }
    const cardPrintingNormalizer = {
      normalize: vi.fn((input: NormalizeCardPrintingCandidatesInput) => {
        const importJobId = input.importJobId

        repository.reviewItemsByJobId.set(importJobId, [
          createManualReviewItem(importJobId, {
            id: `${importJobId}-review-open`,
            normalizationResultId: `${importJobId}-normalization-1`,
            rawCardPrintingRecordId: `${importJobId}-raw-printing-1`,
            reviewReason: 'unresolved_mapping',
            reviewStatus: 'open',
          }),
          createManualReviewItem(importJobId, {
            id: `${importJobId}-review-superseded`,
            normalizationResultId: `${importJobId}-normalization-2`,
            rawCardPrintingRecordId: `${importJobId}-raw-printing-2`,
            reviewReason: 'ambiguous_mapping',
            reviewStatus: 'superseded',
          }),
        ])

        return Promise.resolve({
          ok: true as const,
          data: {
            importJobId,
            importSourceId:
              repository.jobs.find((job) => job.id === importJobId)?.sourceId ??
              'source-1',
            normalizationVersion: 'card-printing-normalizer/v1',
            processedCount: 2,
            createdCount: 2,
            updatedCount: 0,
            skippedCount: 0,
            supersededCount: 0,
            autoResolvedCount: 1,
            unresolvedCount: 1,
            ambiguousCount: 0,
            blockedForReviewCount: 0,
            readyForPublicationCount: 1,
            normalizedCandidateCount: 2,
            conflictCount: 1,
            jobStatus: 'blocked_for_review' as const,
            currentStage: 'normalization' as const,
          },
        })
      }),
    }

    const runner = createDevJsonImportRunner(repository, {
      rawProductImporter,
      rawCardPrintingImporter,
      cardPrintingNormalizer,
      now: () => '2026-04-09T16:15:00.000Z',
    })

    const firstRun = await runner.run({
      document: documentResult.data.document,
      filePath: documentResult.data.filePath,
    })
    const secondRun = await runner.run({
      document: documentResult.data.document,
      filePath: documentResult.data.filePath,
    })

    expect(firstRun.ok).toBe(true)
    expect(secondRun.ok).toBe(true)

    if (!firstRun.ok || !secondRun.ok) {
      return
    }

    expect(firstRun.data.source.id).toBe('source-1')
    expect(secondRun.data.source.id).toBe('source-1')
    expect(firstRun.data.job.id).toBe('job-1')
    expect(secondRun.data.job.id).toBe('job-2')
    expect(firstRun.data.job.inputFingerprint).toBe(
      secondRun.data.job.inputFingerprint,
    )
    expect(firstRun.data.job).toEqual(
      expect.objectContaining({
        jobStatus: 'blocked_for_review',
        currentStage: 'normalization',
        statusReason:
          'Normalization produced records that require manual review.',
      }),
    )
    expect(firstRun.data.reviewQueue).toEqual({
      totalCount: 2,
      openCount: 1,
      inReviewCount: 0,
      resolvedCount: 0,
      rejectedCount: 0,
      supersededCount: 1,
      cancelledCount: 0,
    })
    expect(repository.sources).toHaveLength(1)
    expect(repository.jobs).toHaveLength(2)
    expect(repository.jobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'job-1',
          publishedRecordCount: 0,
        }),
        expect.objectContaining({
          id: 'job-2',
          publishedRecordCount: 0,
        }),
      ]),
    )
    expect(rawProductImporter.importProducts).toHaveBeenCalledTimes(2)
    expect(rawCardPrintingImporter.importPrintings).toHaveBeenCalledTimes(2)
    expect(cardPrintingNormalizer.normalize).toHaveBeenCalledTimes(2)
    expect(repository.listManualReviewItemsByJob).toHaveBeenCalledTimes(2)
  })
})

function createRepositoryDouble() {
  const sources: ImportSourceRecord[] = []
  const jobs: ImportJobRecord[] = []
  const reviewItemsByJobId = new Map<string, ManualReviewItemRecord[]>()

  const upsertImportSource = vi.fn(
    (
      input: UpsertImportSourceInput,
    ): Promise<RepositoryResult<ImportSourceRecord>> => {
      const existingSource = sources.find(
        (source) =>
          source.sourceKey === input.sourceKey &&
          source.sourceType === input.sourceType,
      )

      if (existingSource) {
        const updatedSource: ImportSourceRecord = {
          ...existingSource,
          displayName: input.displayName,
          providerName: input.providerName,
          originUri: input.originUri,
          configuration: input.configuration,
          isActive: input.isActive,
          updatedAt: '2026-04-09T15:00:00.000Z',
        }
        const sourceIndex = sources.findIndex(
          (source) => source.id === existingSource.id,
        )
        sources[sourceIndex] = updatedSource
        return Promise.resolve(ok(updatedSource))
      }

      const createdSource: ImportSourceRecord = {
        id: `source-${sources.length + 1}`,
        sourceKey: input.sourceKey,
        sourceType: input.sourceType,
        displayName: input.displayName,
        providerName: input.providerName,
        originUri: input.originUri,
        configuration: input.configuration,
        isActive: input.isActive,
        createdAt: '2026-04-09T15:00:00.000Z',
        updatedAt: '2026-04-09T15:00:00.000Z',
      }
      sources.push(createdSource)
      return Promise.resolve(ok(createdSource))
    },
  )

  const createImportJob = vi.fn(
    (
      input: CreateImportJobInput,
    ): Promise<RepositoryResult<ImportJobRecord>> => {
      const createdJob: ImportJobRecord = {
        id: `job-${jobs.length + 1}`,
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
        createdAt: '2026-04-09T15:05:00.000Z',
        startedAt: null,
        finishedAt: null,
        updatedAt: '2026-04-09T15:05:00.000Z',
      }
      jobs.push(createdJob)
      return Promise.resolve(ok(createdJob))
    },
  )

  const finalizeImportJob = vi.fn(
    (
      input: FinalizeImportJobInput,
    ): Promise<RepositoryResult<ImportJobRecord>> => {
      const jobIndex = jobs.findIndex((job) => job.id === input.id)

      if (jobIndex < 0) {
        throw new Error(`Unexpected job finalization request for ${input.id}.`)
      }

      const existingJob = jobs[jobIndex]!
      const finalizedJob: ImportJobRecord = {
        ...existingJob,
        jobStatus: input.jobStatus,
        currentStage: input.currentStage,
        statusReason: input.statusReason,
        finishedAt: input.finishedAt,
        updatedAt: input.finishedAt,
      }
      jobs[jobIndex] = finalizedJob
      return Promise.resolve(ok(finalizedJob))
    },
  )

  const listManualReviewItemsByJob = vi.fn(
    (
      importJobId: string,
      reviewStatuses?: readonly ManualReviewItemRecord['reviewStatus'][],
    ): Promise<RepositoryResult<readonly ManualReviewItemRecord[]>> => {
      const reviewItems = reviewItemsByJobId.get(importJobId) ?? []
      return Promise.resolve(
        ok(
          reviewStatuses && reviewStatuses.length > 0
            ? reviewItems.filter((item) =>
                reviewStatuses.includes(item.reviewStatus),
              )
            : reviewItems,
        ),
      )
    },
  )

  const notUsed = (name: string) =>
    vi.fn(() =>
      Promise.reject(
        new Error(`Unexpected repository call in dev JSON test: ${name}.`),
      ),
    )

  return {
    sources,
    jobs,
    reviewItemsByJobId,
    upsertImportSource,
    createImportJob,
    finalizeImportJob,
    listManualReviewItemsByJob,
    getImportJobById: notUsed('getImportJobById'),
    markImportJobRunning: notUsed('markImportJobRunning'),
    markImportJobFailed: notUsed('markImportJobFailed'),
    updateImportJobRawRecordCount: notUsed('updateImportJobRawRecordCount'),
    updateImportJobNormalizationState: notUsed(
      'updateImportJobNormalizationState',
    ),
    listRawProductRecordsByJobAndSourceIds: notUsed(
      'listRawProductRecordsByJobAndSourceIds',
    ),
    listRawProductRecordsByJobAndCodes: notUsed(
      'listRawProductRecordsByJobAndCodes',
    ),
    upsertRawProductRecords: notUsed('upsertRawProductRecords'),
    listRawCardPrintingRecordsByJobAndSourceIds: notUsed(
      'listRawCardPrintingRecordsByJobAndSourceIds',
    ),
    listRawCardPrintingRecordsByJob: notUsed('listRawCardPrintingRecordsByJob'),
    upsertRawCardPrintingRecords: notUsed('upsertRawCardPrintingRecords'),
    listCatalogCardEntitiesByNormalizedNames: notUsed(
      'listCatalogCardEntitiesByNormalizedNames',
    ),
    listCardPrintingNormalizationResultsByJob: notUsed(
      'listCardPrintingNormalizationResultsByJob',
    ),
    listCardPrintingNormalizationResultsByJobAndRawIds: notUsed(
      'listCardPrintingNormalizationResultsByJobAndRawIds',
    ),
    upsertCardPrintingNormalizationResults: notUsed(
      'upsertCardPrintingNormalizationResults',
    ),
    markCardPrintingNormalizationResultsSuperseded: notUsed(
      'markCardPrintingNormalizationResultsSuperseded',
    ),
    getManualReviewItemById: notUsed('getManualReviewItemById'),
    listManualReviewItemsByNormalizationResultIds: notUsed(
      'listManualReviewItemsByNormalizationResultIds',
    ),
    upsertManualReviewItems: notUsed('upsertManualReviewItems'),
    updateManualReviewItemStatus: notUsed('updateManualReviewItemStatus'),
    countAllRawRecordsForJob: notUsed('countAllRawRecordsForJob'),
  } as unknown as ImporterRepository & {
    readonly sources: ImportSourceRecord[]
    readonly jobs: ImportJobRecord[]
    readonly reviewItemsByJobId: Map<string, ManualReviewItemRecord[]>
    readonly upsertImportSource: ReturnType<typeof vi.fn>
    readonly createImportJob: ReturnType<typeof vi.fn>
    readonly finalizeImportJob: ReturnType<typeof vi.fn>
    readonly listManualReviewItemsByJob: ReturnType<typeof vi.fn>
  }
}

function createManualReviewItem(
  importJobId: string,
  input: {
    readonly id: string
    readonly normalizationResultId: string
    readonly rawCardPrintingRecordId: string
    readonly reviewReason: ManualReviewItemRecord['reviewReason']
    readonly reviewStatus: ManualReviewItemRecord['reviewStatus']
  },
): ManualReviewItemRecord {
  return {
    id: input.id,
    importJobId,
    normalizationResultId: input.normalizationResultId,
    rawCardPrintingRecordId: input.rawCardPrintingRecordId,
    rawProductRecordId: null,
    reviewReason: input.reviewReason,
    reviewStatus: input.reviewStatus,
    summary: 'Dev JSON review fixture item',
    contextPayload: {
      mode: 'dev-json',
    },
    candidateCardEntityIds: [],
    proposedCardEntityId: null,
    resolutionKind: null,
    resolvedCardEntityId: null,
    decisionNotes: null,
    openedAt: '2026-04-09T15:10:00.000Z',
    startedReviewAt: null,
    resolvedAt: null,
    closedAt: null,
    updatedAt: '2026-04-09T15:10:00.000Z',
  }
}

function fileFromHere(relativePath: string) {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    relativePath,
  )
}

function toFileHref(filePath: string) {
  return pathToFileURL(path.resolve(filePath)).href
}

async function writeTempFile(fileName: string, content: string) {
  const tempDirectory = await mkdtemp(path.join(tmpdir(), 'web-vg-dev-json-'))
  const filePath = path.join(tempDirectory, fileName)
  await writeFile(filePath, content, 'utf8')
  return filePath
}

function ok<TData>(data: TData): RepositoryResult<TData> {
  return {
    ok: true,
    data,
  }
}
