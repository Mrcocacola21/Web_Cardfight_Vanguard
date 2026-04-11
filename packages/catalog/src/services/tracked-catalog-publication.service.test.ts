import { describe, expect, it } from 'vitest'

import { createCatalogPublicationService } from './catalog-publication.service'
import type {
  CatalogPublicationRawProductSource,
  CatalogPrintingPublicationSource,
  CatalogPublishedPrintingRecord,
  CatalogPublishedProductRecord,
  CatalogPublicationStore,
} from './catalog-publication.service'
import {
  createTrackedCatalogPublicationService,
  type CatalogPublicationLifecycleStore,
  type CatalogPublicationLogEntry,
  type CatalogPublicationLogger,
  type TrackedImportJobRecord,
} from './tracked-catalog-publication.service'

describe('tracked catalog publication service', () => {
  it('publishes wave-1 records, finalizes the job as published, and keeps mixed review cases honest', async () => {
    const publicationStore = createPublicationStore()
    const publicationService = createCatalogPublicationService(publicationStore)
    const lifecycle = createLifecycleStore({
      id: 'job-1',
      jobStatus: 'blocked_for_review',
      currentStage: 'normalization',
      startedAt: '2026-04-10T11:00:00.000Z',
      finishedAt: '2026-04-10T11:05:00.000Z',
      publishedRecordCount: 0,
      statusReason: '1 normalization result needs review.',
    })
    const logger = createTestLogger()

    const service = createTrackedCatalogPublicationService(
      publicationService,
      lifecycle.store,
      {
        logger,
        now: createNowSequence(['2026-04-10T12:00:00.000Z']),
      },
    )

    const result = await service.publishImportJob('job-1')

    expect(result).toEqual({
      ok: true,
      data: {
        importJobId: 'job-1',
        attemptedCount: 4,
        publishableCount: 3,
        publishedProductCount: 3,
        publishedPrintingCount: 3,
        skippedResults: [
          {
            normalizationResultId: 'normalization-liael',
            reason: 'non_publishable_status',
          },
        ],
        finalJobStatus: 'partially_completed',
        finalJobStage: 'published',
        publishedRecordCount: 3,
        finishedAt: '2026-04-10T12:00:00.000Z',
        replayedExistingPublication: false,
      },
    })

    expect(publicationStore.products).toHaveLength(3)
    expect(publicationStore.printings).toHaveLength(3)
    expect(lifecycle.job.currentStage).toBe('published')
    expect(lifecycle.job.jobStatus).toBe('partially_completed')
    expect(lifecycle.job.publishedRecordCount).toBe(3)
    expect(lifecycle.job.finishedAt).toBe('2026-04-10T12:00:00.000Z')
    expect(lifecycle.markRunningCalls).toHaveLength(1)
    expect(lifecycle.finalizeCalls).toHaveLength(1)
    expect(logger.entries).toEqual([
      {
        level: 'info',
        entry: {
          event: 'publication_started',
          importJobId: 'job-1',
          replayedExistingPublication: false,
          jobStatus: 'running',
          currentStage: 'publication',
        },
      },
      {
        level: 'info',
        entry: {
          event: 'publication_succeeded',
          importJobId: 'job-1',
          replayedExistingPublication: false,
          currentStage: 'published',
          jobStatus: 'partially_completed',
          attemptedCount: 4,
          publishableCount: 3,
          publishedPrintingCount: 3,
          skippedCount: 1,
        },
      },
    ])
  })

  it('replays publication idempotently without inflating counts or mutating terminal job state', async () => {
    const publicationStore = createPublicationStore()
    const publicationService = createCatalogPublicationService(publicationStore)
    const lifecycle = createLifecycleStore({
      id: 'job-1',
      jobStatus: 'blocked_for_review',
      currentStage: 'normalization',
      startedAt: '2026-04-10T11:00:00.000Z',
      finishedAt: '2026-04-10T11:05:00.000Z',
      publishedRecordCount: 0,
      statusReason: '1 normalization result needs review.',
    })
    const logger = createTestLogger()

    const service = createTrackedCatalogPublicationService(
      publicationService,
      lifecycle.store,
      {
        logger,
        now: createNowSequence(['2026-04-10T12:00:00.000Z']),
      },
    )

    const firstRun = await service.publishImportJob('job-1')
    const secondRun = await service.publishImportJob('job-1')

    expect(firstRun.ok).toBe(true)
    expect(secondRun).toEqual({
      ok: true,
      data: {
        importJobId: 'job-1',
        attemptedCount: 4,
        publishableCount: 3,
        publishedProductCount: 3,
        publishedPrintingCount: 3,
        skippedResults: [
          {
            normalizationResultId: 'normalization-liael',
            reason: 'non_publishable_status',
          },
        ],
        finalJobStatus: 'partially_completed',
        finalJobStage: 'published',
        publishedRecordCount: 3,
        finishedAt: '2026-04-10T12:00:00.000Z',
        replayedExistingPublication: true,
      },
    })

    expect(publicationStore.products).toHaveLength(3)
    expect(publicationStore.printings).toHaveLength(3)
    expect(lifecycle.markRunningCalls).toHaveLength(1)
    expect(lifecycle.finalizeCalls).toHaveLength(1)
    expect(lifecycle.job.currentStage).toBe('published')
    expect(lifecycle.job.jobStatus).toBe('partially_completed')
    expect(lifecycle.job.publishedRecordCount).toBe(3)
    expect(lifecycle.job.finishedAt).toBe('2026-04-10T12:00:00.000Z')
  })

  it('marks the import job failed at publication stage when the first publication attempt fails', async () => {
    const lifecycle = createLifecycleStore({
      id: 'job-1',
      jobStatus: 'running',
      currentStage: 'normalization',
      startedAt: '2026-04-10T11:00:00.000Z',
      finishedAt: null,
      publishedRecordCount: 0,
      statusReason: null,
    })
    const logger = createTestLogger()
    const service = createTrackedCatalogPublicationService(
      {
        publishImportJob: () =>
          Promise.resolve({
            ok: false,
            error: {
              code: 'publication-failed' as const,
              message: 'Catalog write failed.',
              details: 'card_printings upsert aborted',
            },
          }),
      },
      lifecycle.store,
      {
        logger,
        now: createNowSequence(['2026-04-10T12:05:00.000Z']),
      },
    )

    const result = await service.publishImportJob('job-1')

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'publication-failed',
        message: 'Catalog write failed.',
        details: 'card_printings upsert aborted',
      },
    })

    expect(lifecycle.job.currentStage).toBe('publication')
    expect(lifecycle.job.jobStatus).toBe('failed')
    expect(lifecycle.job.publishedRecordCount).toBe(0)
    expect(lifecycle.job.finishedAt).toBe('2026-04-10T12:05:00.000Z')
    expect(lifecycle.markRunningCalls).toHaveLength(1)
    expect(lifecycle.markFailedCalls).toHaveLength(1)
    expect(lifecycle.finalizeCalls).toHaveLength(0)
    expect(logger.entries).toEqual([
      {
        level: 'info',
        entry: {
          event: 'publication_started',
          importJobId: 'job-1',
          replayedExistingPublication: false,
          jobStatus: 'running',
          currentStage: 'publication',
        },
      },
      {
        level: 'error',
        entry: {
          event: 'publication_failed',
          importJobId: 'job-1',
          replayedExistingPublication: false,
          currentStage: 'publication',
          jobStatus: 'failed',
          errorCode: 'publication-failed',
          message: 'Catalog write failed.',
        },
      },
    ])
  })
})

function createLifecycleStore(initialJob: TrackedImportJobRecord): {
  readonly job: TrackedImportJobRecord
  readonly markRunningCalls: Array<{
    readonly id: string
    readonly currentStage: 'publication'
    readonly startedAt: string
  }>
  readonly finalizeCalls: Array<{
    readonly id: string
    readonly jobStatus: 'completed' | 'partially_completed'
    readonly currentStage: 'published'
    readonly statusReason: string | null
    readonly publishedRecordCount: number
    readonly finishedAt: string
  }>
  readonly markFailedCalls: Array<{
    readonly id: string
    readonly currentStage: 'publication'
    readonly startedAt: string
    readonly finishedAt: string
    readonly errorCode: string
    readonly statusReason: string
  }>
  readonly store: CatalogPublicationLifecycleStore
} {
  let job = { ...initialJob }
  const markRunningCalls: Array<{
    readonly id: string
    readonly currentStage: 'publication'
    readonly startedAt: string
  }> = []
  const finalizeCalls: Array<{
    readonly id: string
    readonly jobStatus: 'completed' | 'partially_completed'
    readonly currentStage: 'published'
    readonly statusReason: string | null
    readonly publishedRecordCount: number
    readonly finishedAt: string
  }> = []
  const markFailedCalls: Array<{
    readonly id: string
    readonly currentStage: 'publication'
    readonly startedAt: string
    readonly finishedAt: string
    readonly errorCode: string
    readonly statusReason: string
  }> = []

  return {
    get job() {
      return job
    },
    markRunningCalls,
    finalizeCalls,
    markFailedCalls,
    store: {
      getImportJobById(id) {
        return Promise.resolve({
          ok: true,
          data: job.id === id ? { ...job } : null,
        })
      },
      markImportJobRunning(input) {
        markRunningCalls.push(input)
        job = {
          ...job,
          jobStatus: 'running',
          currentStage: input.currentStage,
          startedAt: input.startedAt,
          finishedAt: null,
          statusReason: null,
        }

        return Promise.resolve({
          ok: true,
          data: { ...job },
        })
      },
      finalizeImportJob(input) {
        finalizeCalls.push(input)
        job = {
          ...job,
          jobStatus: input.jobStatus,
          currentStage: input.currentStage,
          statusReason: input.statusReason,
          publishedRecordCount: input.publishedRecordCount,
          finishedAt: input.finishedAt,
        }

        return Promise.resolve({
          ok: true,
          data: { ...job },
        })
      },
      markImportJobFailed(input) {
        markFailedCalls.push(input)
        job = {
          ...job,
          jobStatus: 'failed',
          currentStage: input.currentStage,
          finishedAt: input.finishedAt,
          statusReason: input.statusReason,
        }

        return Promise.resolve({
          ok: true,
          data: { ...job },
        })
      },
    },
  }
}

function createTestLogger(): CatalogPublicationLogger & {
  readonly entries: ReadonlyArray<{
    readonly level: 'info' | 'error'
    readonly entry: CatalogPublicationLogEntry
  }>
} {
  const entries: Array<{
    readonly level: 'info' | 'error'
    readonly entry: CatalogPublicationLogEntry
  }> = []

  return {
    entries,
    info(entry) {
      entries.push({
        level: 'info',
        entry,
      })
    },
    error(entry) {
      entries.push({
        level: 'error',
        entry,
      })
    },
  }
}

function createPublicationStore(): CatalogPublicationStore & {
  readonly products: CatalogPublishedProductRecord[]
  readonly printings: CatalogPublishedPrintingRecord[]
} {
  const rawProducts: CatalogPublicationRawProductSource[] = [
    {
      rawProductId: 'raw-product-d-bt01',
      importJobId: 'job-1',
      sourceProductId: 'product-d-bt01',
      rawName: 'Genesis of the Five Greats',
      rawCode: 'D-BT01',
      rawProductCategory: 'booster',
      rawProductKind: 'main',
      rawReleaseDateText: '2021-05-14',
      rawRegionCode: 'en',
    },
    {
      rawProductId: 'raw-product-dz-bt01',
      importJobId: 'job-1',
      sourceProductId: 'product-dz-bt01',
      rawName: 'Fated Clash',
      rawCode: 'DZ-BT01',
      rawProductCategory: 'booster',
      rawProductKind: 'main',
      rawReleaseDateText: '2024-05-03',
      rawRegionCode: 'en',
    },
    {
      rawProductId: 'raw-product-dz-bt02',
      importJobId: 'job-1',
      sourceProductId: 'product-dz-bt02',
      rawName: 'Illusionless Strife',
      rawCode: 'DZ-BT02',
      rawProductCategory: 'booster',
      rawProductKind: 'main',
      rawReleaseDateText: '2024-06-07',
      rawRegionCode: 'en',
    },
  ]

  const printingSources: CatalogPrintingPublicationSource[] = [
    {
      importJobId: 'job-1',
      normalizationResultId: 'normalization-bastion',
      rawCardPrintingId: 'raw-printing-bastion',
      rawProductId: 'raw-product-d-bt01',
      normalizationStatus: 'auto_resolved',
      cardEntityId: 'entity-bastion',
      sourcePrintingId: 'printing-bastion-d-bt01-main',
      rawCardName: 'Apex Ruler, Bastion',
      rawPrintingCode: 'D-BT01/001EN',
      rawRarity: 'RRR',
      rawLocaleCode: 'en',
      rawRegionCode: 'en',
      rawProduct: rawProducts[0]!,
    },
    {
      importJobId: 'job-1',
      normalizationResultId: 'normalization-rezael-main',
      rawCardPrintingId: 'raw-printing-rezael-main',
      rawProductId: 'raw-product-dz-bt01',
      normalizationStatus: 'auto_resolved',
      cardEntityId: 'entity-rezael',
      sourcePrintingId: 'printing-rezael-dz-bt01-rrr',
      rawCardName: 'Fated One of Miracles, Rezael',
      rawPrintingCode: 'DZ-BT01/010EN',
      rawRarity: 'RRR',
      rawLocaleCode: 'en',
      rawRegionCode: 'en',
      rawProduct: rawProducts[1]!,
    },
    {
      importJobId: 'job-1',
      normalizationResultId: 'normalization-rezael-dsr',
      rawCardPrintingId: 'raw-printing-rezael-dsr',
      rawProductId: 'raw-product-dz-bt01',
      normalizationStatus: 'auto_resolved',
      cardEntityId: 'entity-rezael',
      sourcePrintingId: 'printing-rezael-dz-bt01-dsr',
      rawCardName: 'Fated One of Miracles, Rezael',
      rawPrintingCode: 'DZ-BT01/DSR01EN',
      rawRarity: 'DSR',
      rawLocaleCode: 'en',
      rawRegionCode: 'en',
      rawProduct: rawProducts[1]!,
    },
    {
      importJobId: 'job-1',
      normalizationResultId: 'normalization-liael',
      rawCardPrintingId: 'raw-printing-liael',
      rawProductId: 'raw-product-dz-bt02',
      normalizationStatus: 'unresolved',
      cardEntityId: null,
      sourcePrintingId: 'printing-liael-amorta-dz-bt02-main',
      rawCardName: 'Fated One of Time, Liael=Amorta',
      rawPrintingCode: 'DZ-BT02/010EN',
      rawRarity: 'RRR',
      rawLocaleCode: 'en',
      rawRegionCode: 'en',
      rawProduct: rawProducts[2]!,
    },
  ]

  const products: CatalogPublishedProductRecord[] = []
  const printings: CatalogPublishedPrintingRecord[] = []

  return {
    products,
    printings,
    listRawProductsByImportJob(importJobId) {
      return Promise.resolve({
        ok: true,
        data: rawProducts.filter(
          (product) => product.importJobId === importJobId,
        ),
      })
    },
    listPrintingPublicationSourcesByImportJob({ importJobId }) {
      return Promise.resolve({
        ok: true,
        data: printingSources.filter(
          (source) => source.importJobId === importJobId,
        ),
      })
    },
    listCatalogProductsByIdentity(identities) {
      const identityKeys = new Set(
        identities.map(
          (identity) =>
            `${identity.familyId}::${identity.officialCode.toUpperCase()}::${identity.regionCode ?? ''}`,
        ),
      )

      return Promise.resolve({
        ok: true,
        data: products.filter((product) =>
          identityKeys.has(
            `${product.familyId}::${product.officialCode.toUpperCase()}::${product.regionCode ?? ''}`,
          ),
        ),
      })
    },
    listCatalogPrintingsByKeys(printingKeys) {
      return Promise.resolve({
        ok: true,
        data: printings.filter((printing) =>
          printingKeys.includes(printing.printingKey),
        ),
      })
    },
    upsertCatalogProducts(input) {
      for (const product of input) {
        upsertProduct(products, product)
      }

      return Promise.resolve({
        ok: true,
        data: [...products],
      })
    },
    upsertCatalogPrintings(input) {
      for (const printing of input) {
        upsertPrinting(printings, printing)
      }

      return Promise.resolve({
        ok: true,
        data: [...printings],
      })
    },
  }
}

function upsertProduct(
  target: CatalogPublishedProductRecord[],
  input: {
    readonly id: string
    readonly canonicalKey: string
    readonly familyId: string
    readonly officialCode: string
    readonly name: string
    readonly regionCode: string | null
    readonly sourceImportJobId: string
    readonly sourceRawProductRecordId: string
  },
): void {
  const existingIndex = target.findIndex(
    (product) =>
      product.familyId === input.familyId &&
      product.officialCode === input.officialCode &&
      product.regionCode === input.regionCode,
  )

  const nextRecord: CatalogPublishedProductRecord = {
    id: existingIndex >= 0 ? target[existingIndex]!.id : input.id,
    canonicalKey: input.canonicalKey,
    familyId: input.familyId,
    officialCode: input.officialCode,
    name: input.name,
    regionCode: input.regionCode,
    sourceImportJobId: input.sourceImportJobId,
    sourceRawProductRecordId: input.sourceRawProductRecordId,
  }

  if (existingIndex >= 0) {
    target.splice(existingIndex, 1, nextRecord)
    return
  }

  target.push(nextRecord)
}

function upsertPrinting(
  target: CatalogPublishedPrintingRecord[],
  input: {
    readonly id: string
    readonly printingKey: string
    readonly cardEntityId: string
    readonly productId: string
    readonly sourceNormalizationResultId: string
    readonly sourceRawCardPrintingRecordId: string
  },
): void {
  const existingIndex = target.findIndex(
    (printing) => printing.printingKey === input.printingKey,
  )

  const nextRecord: CatalogPublishedPrintingRecord = {
    id: existingIndex >= 0 ? target[existingIndex]!.id : input.id,
    printingKey: input.printingKey,
    cardEntityId: input.cardEntityId,
    productId: input.productId,
    sourceNormalizationResultId: input.sourceNormalizationResultId,
    sourceRawCardPrintingRecordId: input.sourceRawCardPrintingRecordId,
  }

  if (existingIndex >= 0) {
    target.splice(existingIndex, 1, nextRecord)
    return
  }

  target.push(nextRecord)
}

function createNowSequence(values: readonly string[]): () => string {
  let index = 0

  return () => {
    const next = values[index]

    if (!next) {
      throw new Error('Test clock exhausted.')
    }

    index += 1

    return next
  }
}
