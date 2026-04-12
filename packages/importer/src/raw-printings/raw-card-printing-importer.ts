import type {
  ImporterRepository,
  ImportJobRecord,
  RawCardPrintingRecord,
  RawProductRecord,
} from '@web-vg/db/repositories/importer'

import {
  createPayloadFingerprint,
  isPlainJsonObject,
  normalizeOptionalText,
  sanitizeJsonObject,
  type JsonObject,
} from '../raw/shared'

export interface RawCardPrintingImportItemInput {
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
  readonly sourcePayload: JsonObject
}

export interface ImportRawCardPrintingsInput {
  readonly importJobId: string
  readonly printings: readonly RawCardPrintingImportItemInput[]
}

export interface ImportRawCardPrintingsSuccess {
  readonly importJobId: string
  readonly importSourceId: string
  readonly processedCount: number
  readonly createdCount: number
  readonly updatedCount: number
  readonly skippedCount: number
  readonly linkedProductCount: number
  readonly unlinkedProductCount: number
  readonly rawRecordCount: number
  readonly jobStatus: 'running'
  readonly currentStage: 'raw_import'
}

export type ImportRawCardPrintingsErrorCode =
  | 'invalid-input'
  | 'job-not-found'
  | 'job-not-runnable'
  | 'query-failed'
  | 'conflict'

export interface ImportRawCardPrintingsError {
  readonly code: ImportRawCardPrintingsErrorCode
  readonly message: string
  readonly details?: string
}

export type ImportRawCardPrintingsResult =
  | {
      readonly ok: true
      readonly data: ImportRawCardPrintingsSuccess
    }
  | {
      readonly ok: false
      readonly error: ImportRawCardPrintingsError
    }

export interface RawCardPrintingImporter {
  importPrintings(
    input: ImportRawCardPrintingsInput,
  ): Promise<ImportRawCardPrintingsResult>
}

export function createRawCardPrintingImporter(
  repository: ImporterRepository,
): RawCardPrintingImporter {
  return {
    async importPrintings(input) {
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
            message: 'Raw card-printing import job was not found.',
          },
        }
      }

      if (!isRawImportRunnable(job)) {
        return {
          ok: false,
          error: {
            code: 'job-not-runnable',
            message:
              'Raw card-printing import requires a pending or running import job.',
            details: `Current job status: ${job.jobStatus}.`,
          },
        }
      }

      const validationError = validateRawCardPrintingImportItems(
        input.printings,
      )
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

      const normalizedItems = input.printings.map((printing) =>
        normalizeRawCardPrintingImportItem(printing),
      )
      const sourcePrintingIds = normalizedItems.map(
        (printing) => printing.sourcePrintingId,
      )
      const sourceProductIds = uniqueNonNull(
        normalizedItems.map((printing) => printing.sourceProductId),
      )
      const sourceProductCodes = uniqueNonNull(
        normalizedItems.map((printing) => printing.sourceProductCode),
      )

      const existingRecordsResult =
        await repository.listRawCardPrintingRecordsByJobAndSourceIds(
          job.id,
          sourcePrintingIds,
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

      const rawProductsByIdResult =
        await repository.listRawProductRecordsByJobAndSourceIds(
          job.id,
          sourceProductIds,
        )

      if (!rawProductsByIdResult.ok) {
        await markJobFailed(
          repository,
          job,
          startedAt,
          rawProductsByIdResult.error.code,
          rawProductsByIdResult.error.message,
        )

        return {
          ok: false,
          error: rawProductsByIdResult.error,
        }
      }

      const rawProductsByCodeResult =
        await repository.listRawProductRecordsByJobAndCodes(
          job.id,
          sourceProductCodes,
        )

      if (!rawProductsByCodeResult.ok) {
        await markJobFailed(
          repository,
          job,
          startedAt,
          rawProductsByCodeResult.error.code,
          rawProductsByCodeResult.error.message,
        )

        return {
          ok: false,
          error: rawProductsByCodeResult.error,
        }
      }

      const existingRecordsBySourceId = new Map(
        existingRecordsResult.data.map((record) => [
          record.sourcePrintingId,
          record,
        ]),
      )
      const rawProductsBySourceId = new Map(
        rawProductsByIdResult.data.map((record) => [
          record.sourceProductId,
          record,
        ]),
      )
      const rawProductsByCode = groupRawProductsByCode(
        rawProductsByCodeResult.data,
      )

      let createdCount = 0
      let updatedCount = 0
      let skippedCount = 0
      let linkedProductCount = 0
      let unlinkedProductCount = 0

      const upsertPayload = normalizedItems.flatMap((printing) => {
        const linkedRawProductRecord = resolveRawProductContext(
          printing,
          rawProductsBySourceId,
          rawProductsByCode,
        )

        if (linkedRawProductRecord) {
          linkedProductCount += 1
        } else {
          unlinkedProductCount += 1
        }

        const existingRecord = existingRecordsBySourceId.get(
          printing.sourcePrintingId,
        )

        if (!existingRecord) {
          createdCount += 1
          return [
            createUpsertRawCardPrintingRecordInput(
              job.id,
              printing,
              linkedRawProductRecord,
            ),
          ]
        }

        if (
          isSameRawCardPrintingRecord(
            existingRecord,
            printing,
            linkedRawProductRecord,
          )
        ) {
          skippedCount += 1
          return []
        }

        updatedCount += 1

        return [
          createUpsertRawCardPrintingRecordInput(
            job.id,
            printing,
            linkedRawProductRecord,
          ),
        ]
      })

      if (upsertPayload.length > 0) {
        const upsertResult =
          await repository.upsertRawCardPrintingRecords(upsertPayload)

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
          linkedProductCount,
          unlinkedProductCount,
          rawRecordCount,
          jobStatus: 'running',
          currentStage: 'raw_import',
        },
      }
    },
  }
}

interface NormalizedRawCardPrintingImportItem {
  readonly sourcePrintingId: string
  readonly sourceProductId: string | null
  readonly sourceProductCode: string | null
  readonly cardName: string
  readonly printingCode: string | null
  readonly rarity: string | null
  readonly localeCode: string | null
  readonly regionCode: string | null
  readonly cardType: string | null
  readonly nation: string | null
  readonly clan: string | null
  readonly triggerType: string | null
  readonly gradeText: string | null
  readonly powerText: string | null
  readonly criticalText: string | null
  readonly shieldText: string | null
  readonly rulesText: string | null
  readonly sourcePayload: JsonObject
  readonly payloadFingerprint: string
}

function isRawImportRunnable(job: ImportJobRecord) {
  return job.jobStatus === 'pending' || job.jobStatus === 'running'
}

function validateRawCardPrintingImportItems(
  printings: readonly RawCardPrintingImportItemInput[],
): ImportRawCardPrintingsError | null {
  if (printings.length === 0) {
    return {
      code: 'invalid-input',
      message:
        'Raw card-printing import requires at least one printing record.',
    }
  }

  const seenSourcePrintingIds = new Set<string>()

  for (const printing of printings) {
    const sourcePrintingId = printing.sourcePrintingId.trim()
    const cardName = printing.cardName.trim()

    if (sourcePrintingId.length === 0) {
      return {
        code: 'invalid-input',
        message:
          'Raw card-printing records require a non-empty source printing id.',
      }
    }

    if (cardName.length === 0) {
      return {
        code: 'invalid-input',
        message:
          'Raw card-printing records require a non-empty imported card name.',
      }
    }

    if (seenSourcePrintingIds.has(sourcePrintingId)) {
      return {
        code: 'invalid-input',
        message:
          'Duplicate source printing ids are not allowed in one raw card-printing batch.',
      }
    }

    seenSourcePrintingIds.add(sourcePrintingId)

    if (!isPlainJsonObject(printing.sourcePayload)) {
      return {
        code: 'invalid-input',
        message:
          'Raw card-printing source payload must be a JSON object for every imported printing.',
      }
    }
  }

  return null
}

function normalizeRawCardPrintingImportItem(
  printing: RawCardPrintingImportItemInput,
): NormalizedRawCardPrintingImportItem {
  const sourcePayload = sanitizeJsonObject(printing.sourcePayload)

  return {
    sourcePrintingId: printing.sourcePrintingId.trim(),
    sourceProductId: normalizeOptionalText(printing.sourceProductId),
    sourceProductCode: normalizeOptionalText(printing.sourceProductCode),
    cardName: printing.cardName.trim(),
    printingCode: normalizeOptionalText(printing.printingCode),
    rarity: normalizeOptionalText(printing.rarity),
    localeCode: normalizeOptionalText(printing.localeCode),
    regionCode: normalizeOptionalText(printing.regionCode),
    cardType: normalizeOptionalText(printing.cardType),
    nation: normalizeOptionalText(printing.nation),
    clan: normalizeOptionalText(printing.clan),
    triggerType: normalizeOptionalText(printing.triggerType),
    gradeText: normalizeOptionalText(printing.gradeText),
    powerText: normalizeOptionalText(printing.powerText),
    criticalText: normalizeOptionalText(printing.criticalText),
    shieldText: normalizeOptionalText(printing.shieldText),
    rulesText: normalizeOptionalText(printing.rulesText),
    sourcePayload,
    payloadFingerprint: createPayloadFingerprint(sourcePayload),
  }
}

function groupRawProductsByCode(records: readonly RawProductRecord[]) {
  const grouped = new Map<string, RawProductRecord[]>()

  for (const record of records) {
    if (!record.rawCode) {
      continue
    }

    const existingGroup = grouped.get(record.rawCode) ?? []
    existingGroup.push(record)
    grouped.set(record.rawCode, existingGroup)
  }

  return grouped
}

function resolveRawProductContext(
  printing: NormalizedRawCardPrintingImportItem,
  rawProductsBySourceId: ReadonlyMap<string, RawProductRecord>,
  rawProductsByCode: ReadonlyMap<string, readonly RawProductRecord[]>,
) {
  if (printing.sourceProductId) {
    const directMatch = rawProductsBySourceId.get(printing.sourceProductId)

    if (directMatch) {
      return directMatch
    }
  }

  if (!printing.sourceProductCode) {
    return null
  }

  const codeMatches = rawProductsByCode.get(printing.sourceProductCode) ?? []

  return codeMatches.length === 1 ? (codeMatches[0] ?? null) : null
}

function createUpsertRawCardPrintingRecordInput(
  importJobId: string,
  printing: NormalizedRawCardPrintingImportItem,
  linkedRawProductRecord: RawProductRecord | null,
) {
  return {
    importJobId,
    sourcePrintingId: printing.sourcePrintingId,
    sourceProductId: printing.sourceProductId,
    sourceProductCode: printing.sourceProductCode,
    rawProductRecordId: linkedRawProductRecord?.id ?? null,
    payloadFingerprint: printing.payloadFingerprint,
    rawCardName: printing.cardName,
    rawPrintingCode: printing.printingCode,
    rawRarity: printing.rarity,
    rawLocaleCode: printing.localeCode,
    rawRegionCode: printing.regionCode,
    rawCardType: printing.cardType,
    rawNation: printing.nation,
    rawClan: printing.clan,
    rawTriggerType: printing.triggerType,
    rawGradeText: printing.gradeText,
    rawPowerText: printing.powerText,
    rawCriticalText: printing.criticalText,
    rawShieldText: printing.shieldText,
    rawRulesText: printing.rulesText,
    sourcePayload: printing.sourcePayload,
    updatedAt: new Date().toISOString(),
  }
}

function isSameRawCardPrintingRecord(
  existingRecord: RawCardPrintingRecord,
  normalizedPrinting: NormalizedRawCardPrintingImportItem,
  linkedRawProductRecord: RawProductRecord | null,
) {
  return (
    existingRecord.payloadFingerprint ===
      normalizedPrinting.payloadFingerprint &&
    existingRecord.sourceProductId === normalizedPrinting.sourceProductId &&
    existingRecord.sourceProductCode === normalizedPrinting.sourceProductCode &&
    existingRecord.rawProductRecordId ===
      (linkedRawProductRecord?.id ?? null) &&
    existingRecord.rawCardName === normalizedPrinting.cardName &&
    existingRecord.rawPrintingCode === normalizedPrinting.printingCode &&
    existingRecord.rawRarity === normalizedPrinting.rarity &&
    existingRecord.rawLocaleCode === normalizedPrinting.localeCode &&
    existingRecord.rawRegionCode === normalizedPrinting.regionCode &&
    existingRecord.rawCardType === normalizedPrinting.cardType &&
    existingRecord.rawNation === normalizedPrinting.nation &&
    existingRecord.rawClan === normalizedPrinting.clan &&
    existingRecord.rawTriggerType === normalizedPrinting.triggerType &&
    existingRecord.rawGradeText === normalizedPrinting.gradeText &&
    existingRecord.rawPowerText === normalizedPrinting.powerText &&
    existingRecord.rawCriticalText === normalizedPrinting.criticalText &&
    existingRecord.rawShieldText === normalizedPrinting.shieldText &&
    existingRecord.rawRulesText === normalizedPrinting.rulesText
  )
}

function uniqueNonNull(values: readonly (string | null)[]) {
  return Array.from(
    new Set(values.filter((value): value is string => value !== null)),
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
