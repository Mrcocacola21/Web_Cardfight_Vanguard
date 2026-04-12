import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type {
  FinalizeImportJobInput,
  ImportJobRecord,
  ImporterRepository,
  ImportSourceRecord,
  ManualReviewItemRecord,
} from '@web-vg/db/repositories/importer'

import {
  createPayloadFingerprint,
  isPlainJsonObject,
  normalizeOptionalText,
  sanitizeJsonObject,
  type JsonObject,
  type JsonValue,
} from '../raw/shared'
import {
  createRawProductImporter,
  type RawProductImportItemInput,
  type RawProductImporter,
} from '../raw-products'
import {
  createRawCardPrintingImporter,
  type RawCardPrintingImportItemInput,
  type RawCardPrintingImporter,
} from '../raw-printings'
import {
  createCardPrintingNormalizer,
  type CardPrintingNormalizer,
} from '../normalization'

export const devJsonImportSourceType = 'dev_json'
export const devJsonImportPipelineVersion = 'dev-json-importer/v1'
export const devJsonImportContractVersion = 'v1'

const normalizationCompleteStatusReason =
  'Dev JSON import completed through normalization. Publication was not run.'
const rawImportCompleteStatusReason =
  'Dev JSON import completed through raw import only. Publication was not run.'
const reviewBlockedStatusReason =
  'Normalization produced records that require manual review.'

export interface DevJsonImportDocumentInput {
  readonly source: {
    readonly key: string
    readonly displayName: string
    readonly providerName?: string | null
    readonly originUri?: string | null
    readonly snapshotKey?: string | null
    readonly configuration?: JsonObject
  }
  readonly job?: {
    readonly scopeMetadata?: JsonObject
  }
  readonly options?: {
    readonly runNormalization?: boolean
    readonly normalizationVersion?: string | null
  }
  readonly products?: readonly DevJsonProductInput[]
  readonly printings?: readonly DevJsonPrintingInput[]
}

export interface DevJsonProductInput {
  readonly sourceProductId: string
  readonly name: string
  readonly code?: string | null
  readonly productCategory?: string | null
  readonly productKind?: string | null
  readonly familyName?: string | null
  readonly releaseDateText?: string | null
  readonly regionCode?: string | null
  readonly sourcePayload?: JsonObject
}

export interface DevJsonPrintingInput {
  readonly sourcePrintingId: string
  readonly cardName: string
  readonly sourceProductId?: string | null
  readonly sourceProductCode?: string | null
  readonly printingCode?: string | null
  readonly rarity?: string | null
  readonly localeCode?: string | null
  readonly regionCode?: string | null
  readonly cardType?: string | null
  readonly nation?: string | null
  readonly clan?: string | null
  readonly triggerType?: string | null
  readonly gradeText?: string | null
  readonly powerText?: string | null
  readonly criticalText?: string | null
  readonly shieldText?: string | null
  readonly rulesText?: string | null
  readonly sourcePayload?: JsonObject
}

export interface DevJsonImportDocument {
  readonly source: {
    readonly key: string
    readonly displayName: string
    readonly providerName: string | null
    readonly originUri: string | null
    readonly snapshotKey: string | null
    readonly configuration: JsonObject
  }
  readonly job: {
    readonly scopeMetadata: JsonObject
  }
  readonly options: {
    readonly runNormalization: boolean
    readonly normalizationVersion: string | null
  }
  readonly products: readonly RawProductImportItemInput[]
  readonly printings: readonly RawCardPrintingImportItemInput[]
  readonly inputFingerprint: string
}

export interface ReadDevJsonImportDocumentSuccess {
  readonly filePath: string
  readonly document: DevJsonImportDocument
}

export type ReadDevJsonImportDocumentErrorCode =
  | 'file-read-failed'
  | 'invalid-json'
  | 'invalid-input'

export interface ReadDevJsonImportDocumentError {
  readonly code: ReadDevJsonImportDocumentErrorCode
  readonly message: string
  readonly details?: string
}

export type ReadDevJsonImportDocumentResult =
  | {
      readonly ok: true
      readonly data: ReadDevJsonImportDocumentSuccess
    }
  | {
      readonly ok: false
      readonly error: ReadDevJsonImportDocumentError
    }

export interface RunDevJsonImportInput {
  readonly document: DevJsonImportDocument
  readonly filePath?: string
}

export interface DevJsonImportSummary {
  readonly source: {
    readonly id: string
    readonly sourceKey: string
    readonly sourceType: typeof devJsonImportSourceType
    readonly displayName: string
    readonly originUri: string | null
  }
  readonly job: {
    readonly id: string
    readonly jobStatus: 'blocked_for_review' | 'partially_completed' | 'running'
    readonly currentStage: 'raw_import' | 'normalization'
    readonly pipelineVersion: typeof devJsonImportPipelineVersion
    readonly inputFingerprint: string
    readonly upstreamSnapshotKey: string | null
    readonly statusReason: string | null
  }
  readonly rawProducts: {
    readonly processedCount: number
    readonly createdCount: number
    readonly updatedCount: number
    readonly skippedCount: number
  }
  readonly rawPrintings: {
    readonly processedCount: number
    readonly createdCount: number
    readonly updatedCount: number
    readonly skippedCount: number
    readonly linkedProductCount: number
    readonly unlinkedProductCount: number
  }
  readonly normalization: null | {
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
  }
  readonly reviewQueue: null | {
    readonly totalCount: number
    readonly openCount: number
    readonly inReviewCount: number
    readonly resolvedCount: number
    readonly rejectedCount: number
    readonly supersededCount: number
    readonly cancelledCount: number
  }
}

export type RunDevJsonImportErrorCode =
  | 'invalid-input'
  | 'query-failed'
  | 'raw-import-failed'
  | 'normalization-failed'
  | 'job-finalization-failed'

export interface RunDevJsonImportError {
  readonly code: RunDevJsonImportErrorCode
  readonly message: string
  readonly details?: string
}

export type RunDevJsonImportResult =
  | {
      readonly ok: true
      readonly data: DevJsonImportSummary
    }
  | {
      readonly ok: false
      readonly error: RunDevJsonImportError
    }

export interface DevJsonImportRunnerDependencies {
  readonly rawProductImporter?: RawProductImporter
  readonly rawCardPrintingImporter?: RawCardPrintingImporter
  readonly cardPrintingNormalizer?: CardPrintingNormalizer
  readonly now?: () => string
}

export interface DevJsonImportRunner {
  run(input: RunDevJsonImportInput): Promise<RunDevJsonImportResult>
}

export async function readDevJsonImportDocumentFromFile(
  filePath: string,
): Promise<ReadDevJsonImportDocumentResult> {
  const absoluteFilePath = path.resolve(process.cwd(), filePath)

  let fileContent: string

  try {
    fileContent = await readFile(absoluteFilePath, 'utf8')
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'file-read-failed',
        message: `Failed to read dev JSON import file at ${absoluteFilePath}.`,
        details: error instanceof Error ? error.message : String(error),
      },
    }
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(fileContent)
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'invalid-json',
        message: `Dev JSON import file ${absoluteFilePath} is not valid JSON.`,
        details: error instanceof Error ? error.message : String(error),
      },
    }
  }

  const documentResult = normalizeDevJsonImportDocument(parsed, {
    filePath: absoluteFilePath,
  })

  return documentResult.ok
    ? {
        ok: true,
        data: {
          filePath: absoluteFilePath,
          document: documentResult.data,
        },
      }
    : documentResult
}

export function createDevJsonImportRunner(
  repository: ImporterRepository,
  dependencies: DevJsonImportRunnerDependencies = {},
): DevJsonImportRunner {
  const rawProductImporter =
    dependencies.rawProductImporter ?? createRawProductImporter(repository)
  const rawCardPrintingImporter =
    dependencies.rawCardPrintingImporter ??
    createRawCardPrintingImporter(repository)
  const cardPrintingNormalizer =
    dependencies.cardPrintingNormalizer ??
    createCardPrintingNormalizer(repository)
  const now = dependencies.now ?? (() => new Date().toISOString())

  return {
    async run(input) {
      const scopeMetadata = buildScopeMetadata(input.document, input.filePath)
      const source = await repository.upsertImportSource({
        sourceKey: input.document.source.key,
        sourceType: devJsonImportSourceType,
        displayName: input.document.source.displayName,
        providerName: input.document.source.providerName,
        originUri:
          input.document.source.originUri ??
          (input.filePath ? pathToFileURL(input.filePath).href : null),
        configuration: input.document.source.configuration,
        isActive: true,
      })

      if (!source.ok) {
        return {
          ok: false,
          error: mapRunnerRepositoryError(
            source.error,
            'Failed to resolve the dev JSON import source.',
          ),
        }
      }

      const job = await repository.createImportJob({
        sourceId: source.data.id,
        retryOfJobId: null,
        pipelineVersion: devJsonImportPipelineVersion,
        upstreamSnapshotKey: input.document.source.snapshotKey,
        inputFingerprint: input.document.inputFingerprint,
        scopeMetadata,
      })

      if (!job.ok) {
        return {
          ok: false,
          error: mapRunnerRepositoryError(
            job.error,
            'Failed to create the dev JSON import job.',
          ),
        }
      }

      const rawProductsSummary =
        input.document.products.length > 0
          ? await rawProductImporter.importProducts({
              importJobId: job.data.id,
              products: input.document.products,
            })
          : {
              ok: true as const,
              data: {
                importJobId: job.data.id,
                importSourceId: source.data.id,
                processedCount: 0,
                createdCount: 0,
                updatedCount: 0,
                skippedCount: 0,
                rawRecordCount: job.data.rawRecordCount,
                jobStatus: 'running' as const,
                currentStage: 'raw_import' as const,
              },
            }

      if (!rawProductsSummary.ok) {
        return {
          ok: false,
          error: {
            code: 'raw-import-failed',
            message: rawProductsSummary.error.message,
            ...(rawProductsSummary.error.details
              ? { details: rawProductsSummary.error.details }
              : {}),
          },
        }
      }

      const rawPrintingsSummary =
        input.document.printings.length > 0
          ? await rawCardPrintingImporter.importPrintings({
              importJobId: job.data.id,
              printings: input.document.printings,
            })
          : {
              ok: true as const,
              data: {
                importJobId: job.data.id,
                importSourceId: source.data.id,
                processedCount: 0,
                createdCount: 0,
                updatedCount: 0,
                skippedCount: 0,
                linkedProductCount: 0,
                unlinkedProductCount: 0,
                rawRecordCount: rawProductsSummary.data.rawRecordCount,
                jobStatus: 'running' as const,
                currentStage: 'raw_import' as const,
              },
            }

      if (!rawPrintingsSummary.ok) {
        return {
          ok: false,
          error: {
            code: 'raw-import-failed',
            message: rawPrintingsSummary.error.message,
            ...(rawPrintingsSummary.error.details
              ? { details: rawPrintingsSummary.error.details }
              : {}),
          },
        }
      }

      let normalizationSummary: DevJsonImportSummary['normalization'] = null
      let finalJobStatus: DevJsonImportSummary['job']['jobStatus'] = 'running'
      let finalJobStage: DevJsonImportSummary['job']['currentStage'] =
        'raw_import'
      let finalJobStatusReason: string | null = null

      if (
        input.document.options.runNormalization &&
        input.document.printings.length > 0
      ) {
        const normalizationInput = input.document.options.normalizationVersion
          ? {
              importJobId: job.data.id,
              normalizationVersion: input.document.options.normalizationVersion,
            }
          : {
              importJobId: job.data.id,
            }
        const normalizationResult =
          await cardPrintingNormalizer.normalize(normalizationInput)

        if (!normalizationResult.ok) {
          return {
            ok: false,
            error: {
              code: 'normalization-failed',
              message: normalizationResult.error.message,
              ...(normalizationResult.error.details
                ? { details: normalizationResult.error.details }
                : {}),
            },
          }
        }

        normalizationSummary = {
          normalizationVersion: normalizationResult.data.normalizationVersion,
          processedCount: normalizationResult.data.processedCount,
          createdCount: normalizationResult.data.createdCount,
          updatedCount: normalizationResult.data.updatedCount,
          skippedCount: normalizationResult.data.skippedCount,
          supersededCount: normalizationResult.data.supersededCount,
          autoResolvedCount: normalizationResult.data.autoResolvedCount,
          unresolvedCount: normalizationResult.data.unresolvedCount,
          ambiguousCount: normalizationResult.data.ambiguousCount,
          blockedForReviewCount: normalizationResult.data.blockedForReviewCount,
          readyForPublicationCount:
            normalizationResult.data.readyForPublicationCount,
          normalizedCandidateCount:
            normalizationResult.data.normalizedCandidateCount,
        }
        finalJobStage = 'normalization'

        if (normalizationResult.data.jobStatus === 'blocked_for_review') {
          finalJobStatus = 'blocked_for_review'
          finalJobStatusReason = reviewBlockedStatusReason
        } else {
          finalJobStatus = 'partially_completed'
          finalJobStatusReason = normalizationCompleteStatusReason
        }
      } else {
        finalJobStatus = 'partially_completed'
        finalJobStatusReason = rawImportCompleteStatusReason
      }

      const finalizedJob = await finalizeDevJsonImportJob(repository, {
        id: job.data.id,
        jobStatus: finalJobStatus,
        currentStage: finalJobStage,
        statusReason: finalJobStatusReason,
        finishedAt: now(),
      })

      if (!finalizedJob.ok) {
        return {
          ok: false,
          error: finalizedJob.error,
        }
      }

      const finalizedJobRecord = finalizedJob.data
      const reviewItemsResult = input.document.options.runNormalization
        ? await repository.listManualReviewItemsByJob(job.data.id)
        : {
            ok: true as const,
            data: [] as const,
          }

      if (!reviewItemsResult.ok) {
        return {
          ok: false,
          error: mapRunnerRepositoryError(
            reviewItemsResult.error,
            'Failed to load manual review items for the dev JSON import summary.',
          ),
        }
      }

      const reviewQueueSummary =
        input.document.options.runNormalization &&
        input.document.printings.length > 0
          ? summarizeReviewItems(reviewItemsResult.data)
          : null

      return {
        ok: true,
        data: {
          source: {
            id: source.data.id,
            sourceKey: source.data.sourceKey,
            sourceType: devJsonImportSourceType,
            displayName: source.data.displayName,
            originUri: source.data.originUri,
          },
          job: {
            id: finalizedJobRecord.id,
            jobStatus: finalJobStatus,
            currentStage: finalJobStage,
            pipelineVersion: devJsonImportPipelineVersion,
            inputFingerprint: input.document.inputFingerprint,
            upstreamSnapshotKey: finalizedJobRecord.upstreamSnapshotKey,
            statusReason: finalizedJobRecord.statusReason,
          },
          rawProducts: {
            processedCount: rawProductsSummary.data.processedCount,
            createdCount: rawProductsSummary.data.createdCount,
            updatedCount: rawProductsSummary.data.updatedCount,
            skippedCount: rawProductsSummary.data.skippedCount,
          },
          rawPrintings: {
            processedCount: rawPrintingsSummary.data.processedCount,
            createdCount: rawPrintingsSummary.data.createdCount,
            updatedCount: rawPrintingsSummary.data.updatedCount,
            skippedCount: rawPrintingsSummary.data.skippedCount,
            linkedProductCount: rawPrintingsSummary.data.linkedProductCount,
            unlinkedProductCount: rawPrintingsSummary.data.unlinkedProductCount,
          },
          normalization: normalizationSummary,
          reviewQueue: reviewQueueSummary,
        },
      }
    },
  }
}

function normalizeDevJsonImportDocument(
  input: unknown,
  options?: {
    readonly filePath?: string
  },
):
  | {
      readonly ok: true
      readonly data: DevJsonImportDocument
    }
  | {
      readonly ok: false
      readonly error: ReadDevJsonImportDocumentError
    } {
  if (!isPlainJsonObject(input)) {
    return invalidDocument('Dev JSON import input must be a JSON object.')
  }

  const source = input.source

  if (!isPlainJsonObject(source)) {
    return invalidDocument('Dev JSON import input requires a source object.')
  }

  const sourceKey = readRequiredString(
    source.key,
    'Dev JSON import source.key must be a non-empty string.',
  )
  const displayName = readRequiredString(
    source.displayName,
    'Dev JSON import source.displayName must be a non-empty string.',
  )

  if (!sourceKey.ok) {
    return sourceKey
  }

  if (!displayName.ok) {
    return displayName
  }

  const providerNameResult = readOptionalString(
    source.providerName,
    'Dev JSON import source.providerName must be a string when provided.',
  )
  const originUriResult = readOptionalString(
    source.originUri,
    'Dev JSON import source.originUri must be a string when provided.',
  )
  const snapshotKeyResult = readOptionalString(
    source.snapshotKey,
    'Dev JSON import source.snapshotKey must be a string when provided.',
  )
  const configurationResult = readOptionalJsonObject(
    source.configuration,
    'Dev JSON import source.configuration must be a JSON object when provided.',
  )

  if (!providerNameResult.ok) {
    return providerNameResult
  }

  if (!originUriResult.ok) {
    return originUriResult
  }

  if (!snapshotKeyResult.ok) {
    return snapshotKeyResult
  }

  if (!configurationResult.ok) {
    return configurationResult
  }

  const jobBlock = input.job

  if (jobBlock !== undefined && !isPlainJsonObject(jobBlock)) {
    return invalidDocument(
      'Dev JSON import job must be a JSON object when provided.',
    )
  }

  const scopeMetadataResult = readOptionalJsonObject(
    jobBlock?.scopeMetadata,
    'Dev JSON import job.scopeMetadata must be a JSON object when provided.',
  )

  if (!scopeMetadataResult.ok) {
    return scopeMetadataResult
  }

  const optionsBlock = input.options

  if (optionsBlock !== undefined && !isPlainJsonObject(optionsBlock)) {
    return invalidDocument(
      'Dev JSON import options must be a JSON object when provided.',
    )
  }

  const runNormalizationResult = readOptionalBoolean(
    optionsBlock?.runNormalization,
    'Dev JSON import options.runNormalization must be a boolean when provided.',
  )
  const normalizationVersionResult = readOptionalString(
    optionsBlock?.normalizationVersion,
    'Dev JSON import options.normalizationVersion must be a string when provided.',
  )

  if (!runNormalizationResult.ok) {
    return runNormalizationResult
  }

  if (!normalizationVersionResult.ok) {
    return normalizationVersionResult
  }

  const productsResult = normalizeDevJsonProducts(input.products)

  if (!productsResult.ok) {
    return productsResult
  }

  const printingsResult = normalizeDevJsonPrintings(input.printings)

  if (!printingsResult.ok) {
    return printingsResult
  }

  if (productsResult.data.length === 0 && printingsResult.data.length === 0) {
    return invalidDocument(
      'Dev JSON import requires at least one product or one printing record.',
    )
  }

  const normalizedDocumentBase = {
    source: {
      key: sourceKey.data,
      displayName: displayName.data,
      providerName: providerNameResult.data ?? 'local-dev',
      originUri:
        originUriResult.data ??
        (options?.filePath ? pathToFileURL(options.filePath).href : null),
      snapshotKey: snapshotKeyResult.data,
      configuration: sanitizeJsonObject({
        ...(configurationResult.data ?? {}),
        mode: 'dev-json',
        contractVersion: devJsonImportContractVersion,
      }),
    },
    job: {
      scopeMetadata: sanitizeJsonObject({
        ...(scopeMetadataResult.data ?? {}),
      }),
    },
    options: {
      runNormalization: runNormalizationResult.data ?? true,
      normalizationVersion: normalizationVersionResult.data,
    },
    products: productsResult.data,
    printings: printingsResult.data,
  } satisfies Omit<DevJsonImportDocument, 'inputFingerprint'>

  return {
    ok: true,
    data: {
      ...normalizedDocumentBase,
      inputFingerprint: createPayloadFingerprint(
        documentFingerprintPayload(normalizedDocumentBase),
      ),
    },
  }
}

function normalizeDevJsonProducts(value: unknown):
  | {
      readonly ok: true
      readonly data: readonly RawProductImportItemInput[]
    }
  | {
      readonly ok: false
      readonly error: ReadDevJsonImportDocumentError
    } {
  if (value === undefined) {
    return {
      ok: true,
      data: [],
    }
  }

  if (!Array.isArray(value)) {
    return invalidDocument(
      'Dev JSON import products must be an array when provided.',
    )
  }

  const products: RawProductImportItemInput[] = []

  for (const [index, entry] of value.entries()) {
    if (!isPlainJsonObject(entry)) {
      return invalidDocument(
        `Dev JSON import products[${index}] must be a JSON object.`,
      )
    }

    const sourceProductId = readRequiredString(
      entry.sourceProductId,
      `Dev JSON import products[${index}].sourceProductId must be a non-empty string.`,
    )
    const name = readRequiredString(
      entry.name,
      `Dev JSON import products[${index}].name must be a non-empty string.`,
    )
    const code = readOptionalString(
      entry.code,
      `Dev JSON import products[${index}].code must be a string when provided.`,
    )
    const productCategory = readOptionalString(
      entry.productCategory,
      `Dev JSON import products[${index}].productCategory must be a string when provided.`,
    )
    const productKind = readOptionalString(
      entry.productKind,
      `Dev JSON import products[${index}].productKind must be a string when provided.`,
    )
    const familyName = readOptionalString(
      entry.familyName,
      `Dev JSON import products[${index}].familyName must be a string when provided.`,
    )
    const releaseDateText = readOptionalString(
      entry.releaseDateText,
      `Dev JSON import products[${index}].releaseDateText must be a string when provided.`,
    )
    const regionCode = readOptionalString(
      entry.regionCode,
      `Dev JSON import products[${index}].regionCode must be a string when provided.`,
    )
    const sourcePayload = readOptionalJsonObject(
      entry.sourcePayload,
      `Dev JSON import products[${index}].sourcePayload must be a JSON object when provided.`,
    )

    if (!sourceProductId.ok) {
      return sourceProductId
    }

    if (!name.ok) {
      return name
    }

    if (!code.ok) {
      return code
    }

    if (!productCategory.ok) {
      return productCategory
    }

    if (!productKind.ok) {
      return productKind
    }

    if (!familyName.ok) {
      return familyName
    }

    if (!releaseDateText.ok) {
      return releaseDateText
    }

    if (!regionCode.ok) {
      return regionCode
    }

    if (!sourcePayload.ok) {
      return sourcePayload
    }

    products.push({
      sourceProductId: sourceProductId.data,
      name: name.data,
      code: code.data,
      productCategory: productCategory.data,
      productKind: productKind.data,
      familyName: familyName.data,
      releaseDateText: releaseDateText.data,
      regionCode: regionCode.data,
      sourcePayload: sanitizeJsonObject({
        devContractVersion: devJsonImportContractVersion,
        itemKind: 'product',
        sourceProductId: sourceProductId.data,
        name: name.data,
        code: code.data,
        productCategory: productCategory.data,
        productKind: productKind.data,
        familyName: familyName.data,
        releaseDateText: releaseDateText.data,
        regionCode: regionCode.data,
        ...(sourcePayload.data ?? {}),
      }),
    })
  }

  return {
    ok: true,
    data: products,
  }
}

function normalizeDevJsonPrintings(value: unknown):
  | {
      readonly ok: true
      readonly data: readonly RawCardPrintingImportItemInput[]
    }
  | {
      readonly ok: false
      readonly error: ReadDevJsonImportDocumentError
    } {
  if (value === undefined) {
    return {
      ok: true,
      data: [],
    }
  }

  if (!Array.isArray(value)) {
    return invalidDocument(
      'Dev JSON import printings must be an array when provided.',
    )
  }

  const printings: RawCardPrintingImportItemInput[] = []

  for (const [index, entry] of value.entries()) {
    if (!isPlainJsonObject(entry)) {
      return invalidDocument(
        `Dev JSON import printings[${index}] must be a JSON object.`,
      )
    }

    const sourcePrintingId = readRequiredString(
      entry.sourcePrintingId,
      `Dev JSON import printings[${index}].sourcePrintingId must be a non-empty string.`,
    )
    const cardName = readRequiredString(
      entry.cardName,
      `Dev JSON import printings[${index}].cardName must be a non-empty string.`,
    )

    if (!sourcePrintingId.ok) {
      return sourcePrintingId
    }

    if (!cardName.ok) {
      return cardName
    }

    const optionalStringFields = [
      ['sourceProductId', entry.sourceProductId],
      ['sourceProductCode', entry.sourceProductCode],
      ['printingCode', entry.printingCode],
      ['rarity', entry.rarity],
      ['localeCode', entry.localeCode],
      ['regionCode', entry.regionCode],
      ['cardType', entry.cardType],
      ['nation', entry.nation],
      ['clan', entry.clan],
      ['triggerType', entry.triggerType],
      ['gradeText', entry.gradeText],
      ['powerText', entry.powerText],
      ['criticalText', entry.criticalText],
      ['shieldText', entry.shieldText],
      ['rulesText', entry.rulesText],
    ] as const

    const normalizedOptionals = new Map<string, string | null>()

    for (const [fieldName, fieldValue] of optionalStringFields) {
      const result = readOptionalString(
        fieldValue,
        `Dev JSON import printings[${index}].${fieldName} must be a string when provided.`,
      )

      if (!result.ok) {
        return result
      }

      normalizedOptionals.set(fieldName, result.data)
    }

    const sourcePayload = readOptionalJsonObject(
      entry.sourcePayload,
      `Dev JSON import printings[${index}].sourcePayload must be a JSON object when provided.`,
    )

    if (!sourcePayload.ok) {
      return sourcePayload
    }

    const sourceProductIdValue =
      normalizedOptionals.get('sourceProductId') ?? null
    const sourceProductCodeValue =
      normalizedOptionals.get('sourceProductCode') ?? null
    const printingCodeValue = normalizedOptionals.get('printingCode') ?? null
    const rarityValue = normalizedOptionals.get('rarity') ?? null
    const localeCodeValue = normalizedOptionals.get('localeCode') ?? null
    const regionCodeValue = normalizedOptionals.get('regionCode') ?? null
    const cardTypeValue = normalizedOptionals.get('cardType') ?? null
    const nationValue = normalizedOptionals.get('nation') ?? null
    const clanValue = normalizedOptionals.get('clan') ?? null
    const triggerTypeValue = normalizedOptionals.get('triggerType') ?? null
    const gradeTextValue = normalizedOptionals.get('gradeText') ?? null
    const powerTextValue = normalizedOptionals.get('powerText') ?? null
    const criticalTextValue = normalizedOptionals.get('criticalText') ?? null
    const shieldTextValue = normalizedOptionals.get('shieldText') ?? null
    const rulesTextValue = normalizedOptionals.get('rulesText') ?? null

    printings.push({
      sourcePrintingId: sourcePrintingId.data,
      cardName: cardName.data,
      sourceProductId: sourceProductIdValue,
      sourceProductCode: sourceProductCodeValue,
      printingCode: printingCodeValue,
      rarity: rarityValue,
      localeCode: localeCodeValue,
      regionCode: regionCodeValue,
      cardType: cardTypeValue,
      nation: nationValue,
      clan: clanValue,
      triggerType: triggerTypeValue,
      gradeText: gradeTextValue,
      powerText: powerTextValue,
      criticalText: criticalTextValue,
      shieldText: shieldTextValue,
      rulesText: rulesTextValue,
      sourcePayload: sanitizeJsonObject({
        devContractVersion: devJsonImportContractVersion,
        itemKind: 'printing',
        sourcePrintingId: sourcePrintingId.data,
        cardName: cardName.data,
        sourceProductId: sourceProductIdValue,
        sourceProductCode: sourceProductCodeValue,
        printingCode: printingCodeValue,
        rarity: rarityValue,
        localeCode: localeCodeValue,
        regionCode: regionCodeValue,
        cardType: cardTypeValue,
        nation: nationValue,
        clan: clanValue,
        triggerType: triggerTypeValue,
        gradeText: gradeTextValue,
        powerText: powerTextValue,
        criticalText: criticalTextValue,
        shieldText: shieldTextValue,
        rulesText: rulesTextValue,
        ...(sourcePayload.data ?? {}),
      }),
    })
  }

  return {
    ok: true,
    data: printings,
  }
}

async function finalizeDevJsonImportJob(
  repository: ImporterRepository,
  input: FinalizeImportJobInput,
): Promise<
  | {
      readonly ok: true
      readonly data: ImportJobRecord
    }
  | {
      readonly ok: false
      readonly error: RunDevJsonImportError
    }
> {
  const result = await repository.finalizeImportJob(input)

  return result.ok
    ? {
        ok: true,
        data: result.data,
      }
    : {
        ok: false,
        error: mapRunnerRepositoryError(
          result.error,
          'Failed to finalize the dev JSON import job.',
          'job-finalization-failed',
        ),
      }
}

function buildScopeMetadata(
  document: DevJsonImportDocument,
  filePath?: string,
) {
  return sanitizeJsonObject({
    ...document.job.scopeMetadata,
    mode: 'dev-json',
    contractVersion: devJsonImportContractVersion,
    filePath,
    productCount: document.products.length,
    printingCount: document.printings.length,
    runNormalization: document.options.runNormalization,
  })
}

function summarizeReviewItems(reviewItems: readonly ManualReviewItemRecord[]) {
  return {
    totalCount: reviewItems.length,
    openCount: reviewItems.filter((item) => item.reviewStatus === 'open')
      .length,
    inReviewCount: reviewItems.filter(
      (item) => item.reviewStatus === 'in_review',
    ).length,
    resolvedCount: reviewItems.filter(
      (item) => item.reviewStatus === 'resolved',
    ).length,
    rejectedCount: reviewItems.filter(
      (item) => item.reviewStatus === 'rejected',
    ).length,
    supersededCount: reviewItems.filter(
      (item) => item.reviewStatus === 'superseded',
    ).length,
    cancelledCount: reviewItems.filter(
      (item) => item.reviewStatus === 'cancelled',
    ).length,
  }
}

function documentFingerprintPayload(
  document: Omit<DevJsonImportDocument, 'inputFingerprint'>,
) {
  return sanitizeJsonObject({
    source: {
      key: document.source.key,
      displayName: document.source.displayName,
      providerName: document.source.providerName,
      snapshotKey: document.source.snapshotKey,
      configuration: document.source.configuration,
    },
    job: {
      scopeMetadata: document.job.scopeMetadata,
    },
    options: {
      runNormalization: document.options.runNormalization,
      normalizationVersion: document.options.normalizationVersion,
    },
    products: document.products.map((product) =>
      sanitizeJsonObject({
        sourceProductId: product.sourceProductId,
        name: product.name,
        code: product.code,
        productCategory: product.productCategory,
        productKind: product.productKind,
        familyName: product.familyName,
        releaseDateText: product.releaseDateText,
        regionCode: product.regionCode,
        sourcePayload: product.sourcePayload,
      }),
    ),
    printings: document.printings.map((printing) =>
      sanitizeJsonObject({
        sourcePrintingId: printing.sourcePrintingId,
        cardName: printing.cardName,
        sourceProductId: printing.sourceProductId,
        sourceProductCode: printing.sourceProductCode,
        printingCode: printing.printingCode,
        rarity: printing.rarity,
        localeCode: printing.localeCode,
        regionCode: printing.regionCode,
        cardType: printing.cardType,
        nation: printing.nation,
        clan: printing.clan,
        triggerType: printing.triggerType,
        gradeText: printing.gradeText,
        powerText: printing.powerText,
        criticalText: printing.criticalText,
        shieldText: printing.shieldText,
        rulesText: printing.rulesText,
        sourcePayload: printing.sourcePayload,
      }),
    ),
  })
}

function mapRunnerRepositoryError(
  error: {
    readonly message: string
    readonly details?: string
  },
  message: string,
  code: RunDevJsonImportErrorCode = 'query-failed',
): RunDevJsonImportError {
  return {
    code,
    message,
    ...(error.details ? { details: error.details } : {}),
  }
}

function readRequiredString(
  value: unknown,
  message: string,
):
  | {
      readonly ok: true
      readonly data: string
    }
  | {
      readonly ok: false
      readonly error: ReadDevJsonImportDocumentError
    } {
  if (typeof value !== 'string') {
    return invalidDocument(message)
  }

  const normalized = normalizeOptionalText(value)
  return normalized ? { ok: true, data: normalized } : invalidDocument(message)
}

function readOptionalString(
  value: unknown,
  message: string,
):
  | {
      readonly ok: true
      readonly data: string | null
    }
  | {
      readonly ok: false
      readonly error: ReadDevJsonImportDocumentError
    } {
  if (value === undefined || value === null) {
    return {
      ok: true,
      data: null,
    }
  }

  if (typeof value !== 'string') {
    return invalidDocument(message)
  }

  return {
    ok: true,
    data: normalizeOptionalText(value),
  }
}

function readOptionalBoolean(
  value: unknown,
  message: string,
):
  | {
      readonly ok: true
      readonly data: boolean | undefined
    }
  | {
      readonly ok: false
      readonly error: ReadDevJsonImportDocumentError
    } {
  if (value === undefined) {
    return {
      ok: true,
      data: undefined,
    }
  }

  if (typeof value !== 'boolean') {
    return invalidDocument(message)
  }

  return {
    ok: true,
    data: value,
  }
}

function readOptionalJsonObject(
  value: unknown,
  message: string,
):
  | {
      readonly ok: true
      readonly data: JsonObject | null
    }
  | {
      readonly ok: false
      readonly error: ReadDevJsonImportDocumentError
    } {
  if (value === undefined || value === null) {
    return {
      ok: true,
      data: null,
    }
  }

  if (!isPlainJsonObject(value)) {
    return invalidDocument(message)
  }

  return {
    ok: true,
    data: sanitizeArbitraryJsonObject(value),
  }
}

function sanitizeArbitraryJsonObject(input: JsonObject): JsonObject {
  return sanitizeJsonObject(
    Object.fromEntries(
      Object.entries(input).map(([key, value]) => [
        key,
        sanitizeJsonValue(value),
      ]),
    ),
  )
}

function sanitizeJsonValue(
  value: JsonValue | undefined,
): JsonValue | undefined {
  if (value === undefined) {
    return undefined
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item) as JsonValue)
  }

  if (isPlainJsonObject(value)) {
    return sanitizeArbitraryJsonObject(value)
  }

  return value
}

function invalidDocument(message: string): {
  readonly ok: false
  readonly error: ReadDevJsonImportDocumentError
} {
  return {
    ok: false,
    error: {
      code: 'invalid-input',
      message,
    },
  }
}

export function isDevJsonImportSource(
  source: ImportSourceRecord,
): source is ImportSourceRecord & {
  readonly sourceType: typeof devJsonImportSourceType
} {
  return source.sourceType === devJsonImportSourceType
}
