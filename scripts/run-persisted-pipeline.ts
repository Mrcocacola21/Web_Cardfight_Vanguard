import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import {
  createCatalogPublicationRepository,
  createDbClient,
  createImporterRepository,
} from '../packages/db/src/index.ts'
import {
  createCatalogPublicationService,
  createTrackedCatalogPublicationService,
} from '../packages/catalog/src/index.ts'

const cliVersion = '2.88.0'
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const importerEntrypoint = path.join(
  repoRoot,
  'packages',
  'importer',
  'src',
  'dev-json',
  'run-dev-json-import.ts',
)
const requiredCanonicalKeys = [
  'card.apex-ruler-bastion',
  'card.fated-one-of-miracles-rezael',
] as const

async function main() {
  const fixturePath = resolveFixturePath(process.argv.slice(2))

  if (!fixturePath) {
    process.stdout.write(
      'Usage: pnpm pipeline:dev-json -- <path-to-dev-json-fixture>\n',
    )
    process.exitCode = 1
    return
  }

  const adminConfig = resolveSupabaseAdminConfig()
  const client = createDbClient({
    url: adminConfig.url,
    serviceRoleKey: adminConfig.serviceRoleKey,
  })
  const sourceKey = 'dev-json.content-wave-1-standard-ddz-minimal'
  const sourceBefore = await loadImportSourceByKey(client, sourceKey)

  await ensureWaveOneCanonicalBootstrap(client)

  const importSummary = runImporterEntrypoint(fixturePath, adminConfig)
  const importerRepository = createImporterRepository(client)
  const publicationRepository = createCatalogPublicationRepository(client)
  const publicationLogs: unknown[] = []

  const trackedPublication = createTrackedCatalogPublicationService(
    createCatalogPublicationService(publicationRepository),
    importerRepository,
    {
      logger: {
        info(entry) {
          publicationLogs.push(entry)
        },
        error(entry) {
          publicationLogs.push(entry)
        },
      },
    },
  )

  const publication = await requireOk(
    trackedPublication.publishImportJob(importSummary.job.id),
    'Publication run failed.',
  )
  const publicationReplay = await requireOk(
    trackedPublication.publishImportJob(importSummary.job.id),
    'Publication replay failed.',
  )
  const job = await requireOk(
    importerRepository.getImportJobById(importSummary.job.id),
    'Failed to reload persisted import job.',
  )

  if (!job) {
    throw new Error(`Import job ${importSummary.job.id} was not found.`)
  }

  const rawProducts = await requireSelect(
    client
      .schema('importer')
      .from('raw_product_records')
      .select('id, source_product_id, raw_name, raw_code')
      .eq('import_job_id', importSummary.job.id),
    'Failed to load raw products.',
  )
  const rawPrintings = await requireOk(
    importerRepository.listRawCardPrintingRecordsByJob(importSummary.job.id),
    'Failed to load raw printings.',
  )
  const normalizationResults = await requireOk(
    importerRepository.listCardPrintingNormalizationResultsByJob(
      importSummary.job.id,
    ),
    'Failed to load normalization results.',
  )
  const reviewItems = await requireOk(
    importerRepository.listManualReviewItemsByJob(importSummary.job.id),
    'Failed to load manual review items.',
  )
  const publishedProducts = await requireSelect(
    client
      .schema('catalog')
      .from('products')
      .select(
        'id, canonical_key, official_code, name, source_import_job_id, source_raw_product_record_id',
      )
      .eq('source_import_job_id', importSummary.job.id),
    'Failed to load published products.',
  )
  const publishedPrintings = await requireSelect(
    client
      .schema('catalog')
      .from('card_printings')
      .select(
        'id, printing_key, card_entity_id, product_id, collector_number, printed_name, source_import_job_id, source_normalization_result_id, source_raw_card_printing_record_id, source_raw_product_record_id',
      )
      .eq('source_import_job_id', importSummary.job.id),
    'Failed to load published printings.',
  )
  const entityIds = Array.from(
    new Set(publishedPrintings.map((row) => row.card_entity_id)),
  )
  const productIds = Array.from(
    new Set(publishedPrintings.map((row) => row.product_id)),
  )
  const entities = entityIds.length
    ? await requireSelect(
        client
          .schema('catalog')
          .from('card_entities')
          .select('id, canonical_key, name')
          .in('id', entityIds),
        'Failed to load published card entities.',
      )
    : []
  const products = productIds.length
    ? await requireSelect(
        client
          .schema('catalog')
          .from('products')
          .select('id, official_code, name')
          .in('id', productIds),
        'Failed to load published product lookups.',
      )
    : []
  const sourceAfter = await loadImportSourceByKey(client, sourceKey)
  const entityById = new Map(entities.map((row) => [row.id, row] as const))
  const productById = new Map(products.map((row) => [row.id, row] as const))
  const _rawPrintingById = new Map(
    rawPrintings.map((row) => [row.id, row] as const),
  )
  const normalizationByRawPrintingId = new Map(
    normalizationResults.map(
      (row) => [row.rawCardPrintingRecordId, row] as const,
    ),
  )
  const publishedByNormalizationId = new Map(
    publishedPrintings
      .filter((row) => row.source_normalization_result_id !== null)
      .map((row) => [row.source_normalization_result_id, row] as const),
  )
  const perCase = {
    bastion: summarizeCase(
      'printing-bastion-d-bt01-main',
      rawPrintings,
      normalizationByRawPrintingId,
      publishedByNormalizationId,
      entityById,
      productById,
    ),
    rezaelRegular: summarizeCase(
      'printing-rezael-dz-bt01-rrr',
      rawPrintings,
      normalizationByRawPrintingId,
      publishedByNormalizationId,
      entityById,
      productById,
    ),
    rezaelDsr: summarizeCase(
      'printing-rezael-dz-bt01-dsr',
      rawPrintings,
      normalizationByRawPrintingId,
      publishedByNormalizationId,
      entityById,
      productById,
    ),
    liael: summarizeCase(
      'printing-liael-amorta-dz-bt02-main',
      rawPrintings,
      normalizationByRawPrintingId,
      publishedByNormalizationId,
      entityById,
      productById,
    ),
  }

  assert(rawProducts.length === 3, 'Expected 3 raw product rows.')
  assert(rawPrintings.length === 4, 'Expected 4 raw printing rows.')
  assert(normalizationResults.length === 4, 'Expected 4 normalization results.')
  assert(
    normalizationResults.filter(
      (row) => row.normalizationStatus === 'auto_resolved',
    ).length === 3,
    'Expected 3 auto_resolved normalization results.',
  )
  assert(
    normalizationResults.filter(
      (row) => row.normalizationStatus === 'unresolved',
    ).length === 1,
    'Expected 1 unresolved normalization result.',
  )
  assert(reviewItems.length === 1, 'Expected 1 manual review item.')
  assert(publishedProducts.length === 3, 'Expected 3 published products.')
  assert(publishedPrintings.length === 3, 'Expected 3 published printings.')
  assert(
    job.currentStage === 'published',
    'Expected final job stage to be published.',
  )
  assert(
    job.jobStatus === 'partially_completed',
    'Expected final job status to be partially_completed.',
  )
  assert(job.publishedRecordCount === 3, 'Expected published_record_count = 3.')
  assert(job.finishedAt !== null, 'Expected finished_at to be set.')
  assert(
    perCase.rezaelRegular.publishedCardEntityId !== null &&
      perCase.rezaelRegular.publishedCardEntityId ===
        perCase.rezaelDsr.publishedCardEntityId,
    'Expected both Rezael printings to point to one published entity.',
  )
  assert(
    perCase.liael.normalizationStatus === 'unresolved' &&
      perCase.liael.publishedPrintingId === null,
    'Expected Liael to remain unresolved and unpublished.',
  )

  process.stdout.write(
    `${JSON.stringify(
      {
        runtimePath: {
          command:
            'corepack pnpm pipeline:dev-json -- ./packages/importer/fixtures/dev-json/content-wave-1-standard-ddz-minimal.json',
          importerEntrypoint:
            'tsx --tsconfig ./tsconfig.base.json ./packages/importer/src/dev-json/run-dev-json-import.ts',
          publicationBoundary: 'tracked catalog publication service',
          database: 'local-supabase',
        },
        seed: {
          fixturePath: path.resolve(process.cwd(), fixturePath),
          bootstrapSnippet:
            './supabase/snippets/wave_1_canonical_bootstrap.sql',
        },
        source: {
          existedBeforeRun: sourceBefore !== null,
          id: sourceAfter?.id ?? importSummary.source.id,
          sourceKey: importSummary.source.sourceKey,
          sourceType: importSummary.source.sourceType,
          displayName: importSummary.source.displayName,
          originUri: importSummary.source.originUri,
        },
        job: {
          id: job.id,
          prePublicationStatus: importSummary.job.jobStatus,
          prePublicationStage: importSummary.job.currentStage,
          finalStatus: job.jobStatus,
          finalStage: job.currentStage,
          statusReason: job.statusReason,
          errorCode: job.errorCode,
          rawRecordCount: job.rawRecordCount,
          normalizedCandidateCount: job.normalizedCandidateCount,
          conflictCount: job.conflictCount,
          publishedRecordCount: job.publishedRecordCount,
          startedAt: job.startedAt,
          finishedAt: job.finishedAt,
        },
        rawStage: {
          rawProductCount: rawProducts.length,
          rawPrintingCount: rawPrintings.length,
          linkedRawPrintingCount: rawPrintings.filter(
            (row) => row.rawProductRecordId !== null,
          ).length,
        },
        normalization: {
          totalCount: normalizationResults.length,
          statusCounts: countBy(
            normalizationResults,
            (row) => row.normalizationStatus,
          ),
          readyForPublicationCount: normalizationResults.filter(
            (row) => row.normalizationStatus === 'auto_resolved',
          ).length,
        },
        reviewQueue: {
          totalCount: reviewItems.length,
          reasonCounts: countBy(reviewItems, (row) => row.reviewReason),
          statusCounts: countBy(reviewItems, (row) => row.reviewStatus),
        },
        publication: {
          firstRun: publication,
          replay: publicationReplay,
          logs: publicationLogs,
          publishedProducts: publishedProducts.map((row) => ({
            id: row.id,
            officialCode: row.official_code,
            name: row.name,
            sourceRawProductRecordId: row.source_raw_product_record_id,
          })),
          publishedPrintings: publishedPrintings.map((row) => ({
            id: row.id,
            printingKey: row.printing_key,
            printedName: row.printed_name,
            collectorNumber: row.collector_number,
            cardEntityId: row.card_entity_id,
            cardEntityName: entityById.get(row.card_entity_id)?.name ?? null,
            cardCanonicalKey:
              entityById.get(row.card_entity_id)?.canonical_key ?? null,
            productCode: productById.get(row.product_id)?.official_code ?? null,
            productName: productById.get(row.product_id)?.name ?? null,
            sourceNormalizationResultId: row.source_normalization_result_id,
            sourceRawCardPrintingRecordId:
              row.source_raw_card_printing_record_id,
            sourceRawProductRecordId: row.source_raw_product_record_id,
          })),
        },
        traceability: {
          samplePublishedPrinting:
            publishedPrintings.length === 0
              ? null
              : {
                  printingId: publishedPrintings[0]!.id,
                  normalizationResultId:
                    publishedPrintings[0]!.source_normalization_result_id,
                  rawCardPrintingRecordId:
                    publishedPrintings[0]!.source_raw_card_printing_record_id,
                  rawProductRecordId:
                    publishedPrintings[0]!.source_raw_product_record_id,
                  importJobId: job.id,
                  sourceId: sourceAfter?.id ?? importSummary.source.id,
                },
        },
        perCase,
      },
      null,
      2,
    )}\n`,
  )
}

function resolveFixturePath(args: readonly string[]) {
  const normalizedArgs = args.filter((arg) => arg !== '--')
  const firstArg = normalizedArgs[0]
  return !firstArg || firstArg === '--help' || firstArg === '-h'
    ? null
    : firstArg
}

function resolveSupabaseAdminConfig() {
  const explicitUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null
  const explicitServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    null
  const envMap = parseEnvOutput(
    runCommand(
      [
        'corepack',
        'pnpm',
        'dlx',
        `supabase@${cliVersion}`,
        'status',
        '-o',
        'env',
      ],
      process.env,
    ).stdout,
  )

  return {
    url: explicitUrl ?? envMap.API_URL ?? '',
    serviceRoleKey: explicitServiceRoleKey ?? envMap.SERVICE_ROLE_KEY ?? '',
  }
}

function parseEnvOutput(output: string) {
  return Object.fromEntries(
    output
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf('=')
        const key = line.slice(0, separatorIndex)
        const rawValue = line.slice(separatorIndex + 1)
        return [
          key,
          rawValue.startsWith('"') && rawValue.endsWith('"')
            ? rawValue.slice(1, -1)
            : rawValue,
        ] as const
      }),
  )
}

function runImporterEntrypoint(
  fixturePath: string,
  adminConfig: { url: string; serviceRoleKey: string },
) {
  const env = {
    ...process.env,
    SUPABASE_URL: adminConfig.url,
    SUPABASE_SERVICE_ROLE_KEY: adminConfig.serviceRoleKey,
  }
  const result =
    process.platform === 'win32'
      ? spawnSync(
          'powershell.exe',
          [
            '-NoProfile',
            '-Command',
            `& tsx --tsconfig '${path.join(repoRoot, 'tsconfig.base.json').replace(/'/g, "''")}' '${importerEntrypoint.replace(/'/g, "''")}' '${fixturePath.replace(/'/g, "''")}'`,
          ],
          {
            cwd: process.cwd(),
            encoding: 'utf8',
            env,
            maxBuffer: 20 * 1024 * 1024,
          },
        )
      : runCommand(
          [
            'tsx',
            '--tsconfig',
            path.join(repoRoot, 'tsconfig.base.json'),
            importerEntrypoint,
            fixturePath,
          ],
          env,
        )

  if (result.error || result.status !== 0) {
    throw new Error(
      result.stderr ||
        result.error?.message ||
        'Importer runtime entrypoint failed.',
    )
  }

  const stdout = result.stdout.trim()
  const jsonStart = stdout.indexOf('{')

  if (jsonStart < 0) {
    throw new Error('Importer runtime entrypoint did not emit JSON output.')
  }

  return JSON.parse(stdout.slice(jsonStart))
}

function runCommand(args: readonly string[], env: NodeJS.ProcessEnv) {
  if (
    process.platform === 'win32' &&
    (args[0]?.endsWith('.exe') ||
      args[0]?.endsWith('.cmd') ||
      args[0]?.includes('\\') ||
      args[0]?.includes('/'))
  ) {
    return spawnSync(args[0], args.slice(1), {
      cwd: process.cwd(),
      encoding: 'utf8',
      env,
      maxBuffer: 20 * 1024 * 1024,
    })
  }

  return process.platform === 'win32'
    ? spawnSync(
        process.env.ComSpec ?? 'cmd.exe',
        ['/d', '/s', '/c', quoteShellArgs(args)],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          env,
          maxBuffer: 20 * 1024 * 1024,
        },
      )
    : spawnSync(args[0]!, args.slice(1), {
        cwd: process.cwd(),
        encoding: 'utf8',
        env,
        maxBuffer: 20 * 1024 * 1024,
      })
}

function quoteShellArgs(args: readonly string[]) {
  return args
    .map((arg) =>
      /[\s"]/u.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg,
    )
    .join(' ')
}

async function loadImportSourceByKey(
  client: ReturnType<typeof createDbClient>,
  sourceKey: string,
) {
  const result = await client
    .schema('importer')
    .from('import_sources')
    .select('id, source_key, source_type, display_name, origin_uri')
    .eq('source_type', 'dev_json')
    .eq('source_key', sourceKey)
    .maybeSingle()

  if (result.error) {
    throw new Error(result.error.message)
  }

  return result.data
}

async function ensureWaveOneCanonicalBootstrap(
  client: ReturnType<typeof createDbClient>,
) {
  const result = await client
    .schema('catalog')
    .from('card_entities')
    .select('canonical_key')
    .in('canonical_key', [...requiredCanonicalKeys])

  if (result.error) {
    throw new Error(result.error.message)
  }

  const existingKeys = new Set(
    (result.data ?? []).map((row) => row.canonical_key),
  )
  const missing = requiredCanonicalKeys.filter((key) => !existingKeys.has(key))

  if (missing.length > 0) {
    throw new Error(
      `Missing canonical bootstrap for ${missing.join(', ')}. Apply ./supabase/snippets/wave_1_canonical_bootstrap.sql before rerunning.`,
    )
  }
}

async function requireOk<T>(
  promise: Promise<
    | { ok: true; data: T }
    | { ok: false; error: { message: string; details?: string } }
  >,
  message: string,
) {
  const result = await promise

  if (!result.ok) {
    throw new Error(
      result.error.details
        ? `${message} ${result.error.details}`
        : `${message} ${result.error.message}`,
    )
  }

  return result.data
}

async function requireSelect<T>(
  promise: Promise<{ data: T[] | null; error: { message: string } | null }>,
  message: string,
) {
  const result = await promise

  if (result.error) {
    throw new Error(`${message} ${result.error.message}`)
  }

  return result.data ?? []
}

function summarizeCase(
  sourcePrintingId: string,
  rawPrintings: readonly Array<{
    readonly id: string
    readonly sourcePrintingId: string
    readonly rawCardName: string
    readonly rawPrintingCode: string | null
  }>,
  normalizationByRawPrintingId: ReadonlyMap<string, any>,
  publishedByNormalizationId: ReadonlyMap<string, any>,
  entityById: ReadonlyMap<string, any>,
  productById: ReadonlyMap<string, any>,
) {
  const rawPrinting = rawPrintings.find(
    (row) => row.sourcePrintingId === sourcePrintingId,
  )
  const normalization = rawPrinting
    ? (normalizationByRawPrintingId.get(rawPrinting.id) ?? null)
    : null
  const published =
    normalization?.id !== undefined
      ? (publishedByNormalizationId.get(normalization.id) ?? null)
      : null

  return {
    sourcePrintingId,
    rawPrintingId: rawPrinting?.id ?? null,
    rawCardName: rawPrinting?.rawCardName ?? null,
    rawPrintingCode: rawPrinting?.rawPrintingCode ?? null,
    normalizationResultId: normalization?.id ?? null,
    normalizationStatus: normalization?.normalizationStatus ?? null,
    proposedCardEntityId: normalization?.proposedCardEntityId ?? null,
    candidateCount: normalization?.candidateCount ?? null,
    needsManualReview: normalization?.needsManualReview ?? null,
    publishedPrintingId: published?.id ?? null,
    publishedPrintingKey: published?.printing_key ?? null,
    publishedCardEntityId: published?.card_entity_id ?? null,
    publishedCardEntityName:
      published?.card_entity_id !== undefined
        ? (entityById.get(published.card_entity_id)?.name ?? null)
        : null,
    publishedCardCanonicalKey:
      published?.card_entity_id !== undefined
        ? (entityById.get(published.card_entity_id)?.canonical_key ?? null)
        : null,
    publishedProductCode:
      published?.product_id !== undefined
        ? (productById.get(published.product_id)?.official_code ?? null)
        : null,
  }
}

function countBy<T>(items: readonly T[], keyOf: (item: T) => string) {
  const counts: Record<string, number> = {}

  for (const item of items) {
    const key = keyOf(item)
    counts[key] = (counts[key] ?? 0) + 1
  }

  return counts
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

void main().catch((error) => {
  process.stderr.write(
    `Persisted pipeline run failed.\n${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  )
  process.exitCode = 1
})
