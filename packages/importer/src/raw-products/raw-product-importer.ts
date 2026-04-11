import type { ImporterRepository, ImportJobRecord } from '@web-vg/db'

import {
  createPayloadFingerprint,
  isPlainJsonObject,
  normalizeOptionalText,
  sanitizeJsonObject,
  type JsonObject,
} from '../raw/shared'

export interface RawProductImportItemInput {
  readonly sourceProductId: string
  readonly name: string
  readonly code?: string | null
  readonly productCategory?: string | null
  readonly productKind?: string | null
  readonly familyName?: string | null
  readonly releaseDateText?: string | null
  readonly regionCode?: string | null
  readonly sourcePayload: JsonObject
}

export interface ImportRawProductsInput {
  readonly importJobId: string
  readonly products: readonly RawProductImportItemInput[]
}

export interface ImportRawProductsSuccess {
  readonly importJobId: string
  readonly importSourceId: string
  readonly processedCount: number
  readonly createdCount: number
  readonly updatedCount: number
  readonly skippedCount: number
  readonly rawRecordCount: number
  readonly jobStatus: 'running'
  readonly currentStage: 'raw_import'
}

export type ImportRawProductsErrorCode =
  | 'invalid-input'
  | 'job-not-found'
  | 'job-not-runnable'
  | 'query-failed'
  | 'conflict'

export interface ImportRawProductsError {
  readonly code: ImportRawProductsErrorCode
  readonly message: string
  readonly details?: string
}

export type ImportRawProductsResult =
  | {
      readonly ok: true
      readonly data: ImportRawProductsSuccess
    }
  | {
      readonly ok: false
      readonly error: ImportRawProductsError
    }

export interface RawProductImporter {
  importProducts(
    input: ImportRawProductsInput,
  ): Promise<ImportRawProductsResult>
}

export function createRawProductImporter(
  repository: ImporterRepository,
): RawProductImporter {
  return {
    async importProducts(input) {
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
            message: 'Raw product import job was not found.',
          },
        }
      }

      if (!isRawImportRunnable(job)) {
        return {
          ok: false,
          error: {
            code: 'job-not-runnable',
            message:
              'Raw product import requires a pending or running import job.',
            details: `Current job status: ${job.jobStatus}.`,
          },
        }
      }

      const validationError = validateRawProductImportItems(input.products)
      const startedAt = job.startedAt ?? new Date().toISOString()

      if (validationError) {
        await repository.markImportJobFailed({
          id: job.id,
          currentStage: 'raw_import',
          startedAt,
          finishedAt: new Date().toISOString(),
          errorCode: validationError.code,
          statusReason: validationError.message,
        })

        return {
          ok: false,
          error: validationError,
        }
      }

      const runningResult = await repository.markImportJobRunning({
        id: job.id,
        currentStage: 'raw_import',
        startedAt,
      })

      if (!runningResult.ok) {
        return {
          ok: false,
          error: runningResult.error,
        }
      }

      const normalizedItems = input.products.map((product) =>
        normalizeRawProductImportItem(product),
      )
      const sourceProductIds = normalizedItems.map(
        (product) => product.sourceProductId,
      )
      const existingRecordsResult =
        await repository.listRawProductRecordsByJobAndSourceIds(
          job.id,
          sourceProductIds,
        )

      if (!existingRecordsResult.ok) {
        await markJobFailed(
          repository,
          job,
          startedAt,
          existingRecordsResult.error.code,
          existingRecordsResult.error.message,
        )

        return {
          ok: false,
          error: existingRecordsResult.error,
        }
      }

      const existingRecordsBySourceId = new Map(
        existingRecordsResult.data.map((record) => [
          record.sourceProductId,
          record,
        ]),
      )

      let createdCount = 0
      let updatedCount = 0
      let skippedCount = 0

      const upsertPayload = normalizedItems.flatMap((product) => {
        const existingRecord = existingRecordsBySourceId.get(
          product.sourceProductId,
        )

        if (!existingRecord) {
          createdCount += 1
          return [
            {
              importJobId: job.id,
              sourceProductId: product.sourceProductId,
              payloadFingerprint: product.payloadFingerprint,
              rawName: product.name,
              rawCode: product.code,
              rawProductCategory: product.productCategory,
              rawProductKind: product.productKind,
              rawFamilyName: product.familyName,
              rawReleaseDateText: product.releaseDateText,
              rawRegionCode: product.regionCode,
              sourcePayload: product.sourcePayload,
              updatedAt: new Date().toISOString(),
            },
          ]
        }

        if (isSameRawProductRecord(existingRecord, product)) {
          skippedCount += 1
          return []
        }

        updatedCount += 1

        return [
          {
            importJobId: job.id,
            sourceProductId: product.sourceProductId,
            payloadFingerprint: product.payloadFingerprint,
            rawName: product.name,
            rawCode: product.code,
            rawProductCategory: product.productCategory,
            rawProductKind: product.productKind,
            rawFamilyName: product.familyName,
            rawReleaseDateText: product.releaseDateText,
            rawRegionCode: product.regionCode,
            sourcePayload: product.sourcePayload,
            updatedAt: new Date().toISOString(),
          },
        ]
      })

      if (upsertPayload.length > 0) {
        const upsertResult =
          await repository.upsertRawProductRecords(upsertPayload)

        if (!upsertResult.ok) {
          await markJobFailed(
            repository,
            job,
            startedAt,
            upsertResult.error.code,
            upsertResult.error.message,
          )

          return {
            ok: false,
            error: upsertResult.error,
          }
        }
      }

      const rawRecordCountResult = await repository.countAllRawRecordsForJob(
        job.id,
      )

      if (!rawRecordCountResult.ok) {
        await markJobFailed(
          repository,
          job,
          startedAt,
          rawRecordCountResult.error.code,
          rawRecordCountResult.error.message,
        )

        return {
          ok: false,
          error: rawRecordCountResult.error,
        }
      }

      const rawRecordCount = rawRecordCountResult.data
      const updateJobCountResult =
        await repository.updateImportJobRawRecordCount({
          id: job.id,
          currentStage: 'raw_import',
          rawRecordCount,
        })

      if (!updateJobCountResult.ok) {
        await markJobFailed(
          repository,
          job,
          startedAt,
          updateJobCountResult.error.code,
          updateJobCountResult.error.message,
        )

        return {
          ok: false,
          error: updateJobCountResult.error,
        }
      }

      return {
        ok: true,
        data: {
          importJobId: job.id,
          importSourceId: job.sourceId,
          processedCount: normalizedItems.length,
          createdCount,
          updatedCount,
          skippedCount,
          rawRecordCount,
          jobStatus: 'running',
          currentStage: 'raw_import',
        },
      }
    },
  }
}

interface NormalizedRawProductImportItem {
  readonly sourceProductId: string
  readonly name: string
  readonly code: string | null
  readonly productCategory: string | null
  readonly productKind: string | null
  readonly familyName: string | null
  readonly releaseDateText: string | null
  readonly regionCode: string | null
  readonly sourcePayload: JsonObject
  readonly payloadFingerprint: string
}

function isRawImportRunnable(job: ImportJobRecord) {
  return job.jobStatus === 'pending' || job.jobStatus === 'running'
}

function validateRawProductImportItems(
  products: readonly RawProductImportItemInput[],
): ImportRawProductsError | null {
  if (products.length === 0) {
    return {
      code: 'invalid-input',
      message: 'Raw product import requires at least one product record.',
    }
  }

  const seenSourceProductIds = new Set<string>()

  for (const product of products) {
    const sourceProductId = product.sourceProductId.trim()
    const name = product.name.trim()

    if (sourceProductId.length === 0) {
      return {
        code: 'invalid-input',
        message: 'Raw product records require a non-empty source product id.',
      }
    }

    if (name.length === 0) {
      return {
        code: 'invalid-input',
        message: 'Raw product records require a non-empty product name.',
      }
    }

    if (seenSourceProductIds.has(sourceProductId)) {
      return {
        code: 'invalid-input',
        message:
          'Duplicate source product ids are not allowed in one raw product batch.',
      }
    }

    seenSourceProductIds.add(sourceProductId)

    if (!isPlainJsonObject(product.sourcePayload)) {
      return {
        code: 'invalid-input',
        message:
          'Raw product source payload must be a JSON object for every imported product.',
      }
    }
  }

  return null
}

function normalizeRawProductImportItem(
  product: RawProductImportItemInput,
): NormalizedRawProductImportItem {
  const sourcePayload = sanitizeJsonObject(product.sourcePayload)

  return {
    sourceProductId: product.sourceProductId.trim(),
    name: product.name.trim(),
    code: normalizeOptionalText(product.code),
    productCategory: normalizeOptionalText(product.productCategory),
    productKind: normalizeOptionalText(product.productKind),
    familyName: normalizeOptionalText(product.familyName),
    releaseDateText: normalizeOptionalText(product.releaseDateText),
    regionCode: normalizeOptionalText(product.regionCode),
    sourcePayload,
    payloadFingerprint: createPayloadFingerprint(sourcePayload),
  }
}

function isSameRawProductRecord(
  existingRecord: {
    readonly payloadFingerprint: string
    readonly rawName: string
    readonly rawCode: string | null
    readonly rawProductCategory: string | null
    readonly rawProductKind: string | null
    readonly rawFamilyName: string | null
    readonly rawReleaseDateText: string | null
    readonly rawRegionCode: string | null
  },
  normalizedProduct: NormalizedRawProductImportItem,
) {
  return (
    existingRecord.payloadFingerprint ===
      normalizedProduct.payloadFingerprint &&
    existingRecord.rawName === normalizedProduct.name &&
    existingRecord.rawCode === normalizedProduct.code &&
    existingRecord.rawProductCategory === normalizedProduct.productCategory &&
    existingRecord.rawProductKind === normalizedProduct.productKind &&
    existingRecord.rawFamilyName === normalizedProduct.familyName &&
    existingRecord.rawReleaseDateText === normalizedProduct.releaseDateText &&
    existingRecord.rawRegionCode === normalizedProduct.regionCode
  )
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
    currentStage: 'raw_import',
    startedAt,
    finishedAt: new Date().toISOString(),
    errorCode,
    statusReason,
  })
}
