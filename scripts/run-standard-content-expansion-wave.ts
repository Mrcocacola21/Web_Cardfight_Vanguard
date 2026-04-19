import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import {
  createCatalogPublicationRepository,
  createCatalogRepository,
  createDbClient,
  createImporterRepository,
} from '../packages/db/src/index.ts'
import {
  createCatalogPublicationService,
  createTrackedCatalogPublicationService,
} from '../packages/catalog/src/index.ts'
import { validateDeck } from '../packages/deck-validation/src/index.ts'
import { createDeck } from '../packages/decks/src/index.ts'

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
const defaultFixturePath =
  './packages/importer/fixtures/dev-json/standard-content-expansion-wave-11-1-ddz-keter-curated.json'
const canonicalBootstrapSnippet =
  './supabase/snippets/standard_content_expansion_wave_11_1_canonical_bootstrap.sql'
const choiceRestrictionOverlaySnippet =
  './supabase/snippets/standard_content_expansion_wave_11_1_choice_restriction_overlay.sql'

const requiredCanonicalKeys = [
  'card.apex-ruler-bastion',
  'card.knight-of-heavenly-spear-rooks',
  'card.knight-of-heavenly-sword-fort',
  'card.knight-of-heavenly-bow-base',
  'card.vehement-witch-ramana',
  'card.knight-of-broadaxe-rafluke',
  'card.shadow-bow-archer-lisana',
  'card.platinum-wolf',
  'card.lifesaving-angel-kurabiel',
  'card.spiritual-king-of-determination-olbaria',
  'card.knight-of-heavenly-hammer-gurgant',
  'card.knight-of-heavenly-pierce-gallus',
  'card.knight-of-heavenly-rend-lif',
  'card.healer-of-heavenly-staff-arshes',
  'card.the-hour-of-holy-judgement-cometh',
  'card.apex-surpassing-sword-bastion-prime',
  'card.wisdom-of-beginning-that-cleared-the-world',
  'card.fated-one-of-miracles-rezael',
  'card.wings-of-aspiration-soel',
  'card.knight-of-great-advance-ascensior',
  'card.patrol-of-gusts-ventesta',
  'card.divine-sister-biscotti',
  'card.knight-of-gentle-beauty-nobia',
  'card.bringer-of-protection-cethlan',
  'card.cerrgaon',
  'card.academic-of-endeavoring-effoll',
] as const

async function main() {
  const fixturePath = resolveFixturePath(process.argv.slice(2))
  const startedAtMs = Date.now()
  const adminConfig = resolveSupabaseAdminConfig()
  const client = createDbClient({
    url: adminConfig.url,
    serviceRoleKey: adminConfig.serviceRoleKey,
  })
  const sourceKey =
    'dev-json.standard-content-expansion-wave-11-1-ddz-keter-curated'
  const sourceBefore = await loadImportSourceByKey(client, sourceKey)

  await ensureCanonicalBootstrap(client)
  await ensureChoiceRestrictionOverlay(client)

  const importerStartedAtMs = Date.now()
  const importSummary = runImporterEntrypoint(fixturePath, adminConfig)
  const importerDurationMs = Date.now() - importerStartedAtMs

  const importerRepository = createImporterRepository(client)
  const publicationRepository = createCatalogPublicationRepository(client)
  const catalogRepository = createCatalogRepository(client)
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

  const publicationStartedAtMs = Date.now()
  const publication = await requireOk(
    trackedPublication.publishImportJob(importSummary.job.id),
    'Publication run failed.',
  )
  const publicationReplay = await requireOk(
    trackedPublication.publishImportJob(importSummary.job.id),
    'Publication replay failed.',
  )
  const publicationDurationMs = Date.now() - publicationStartedAtMs

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
        'id, printing_key, card_entity_id, product_id, collector_number, printed_name, rarity, source_import_job_id, source_normalization_result_id, source_raw_card_printing_record_id, source_raw_product_record_id',
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
          .select(
            'id, canonical_key, name, normalized_name, grade, card_type, nation, clan, trigger_type',
          )
          .in('id', entityIds),
        'Failed to load published card entities.',
      )
    : []
  const products = productIds.length
    ? await requireSelect(
        client
          .schema('catalog')
          .from('products')
          .select('id, canonical_key, official_code, name')
          .in('id', productIds),
        'Failed to load published product lookups.',
      )
    : []
  const importedCanonicalEntities = await requireSelect(
    client
      .schema('catalog')
      .from('card_entities')
      .select(
        'id, canonical_key, name, normalized_name, grade, card_type, nation, clan, trigger_type',
      )
      .in('canonical_key', [...requiredCanonicalKeys]),
    'Failed to load imported canonical entities.',
  )
  const activeStandardProfile = await requireSelect(
    client
      .schema('legality')
      .from('rule_profiles')
      .select('id, display_name, version_label')
      .eq('format_id', 'standard')
      .eq('is_active', true),
    'Failed to load active Standard rule profile.',
  )
  const sourceAfter = await loadImportSourceByKey(client, sourceKey)
  const entityById = new Map(entities.map((row) => [row.id, row] as const))
  const productById = new Map(products.map((row) => [row.id, row] as const))
  const productByCode = new Map(
    publishedProducts.map((row) => [row.official_code, row] as const),
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

  assert(rawProducts.length === 6, 'Expected 6 raw product rows.')
  assert(rawPrintings.length === 30, 'Expected 30 raw printing rows.')
  assert(
    normalizationResults.length === 30,
    'Expected 30 normalization results.',
  )
  assert(
    normalizationResults.filter(
      (row) => row.normalizationStatus === 'auto_resolved',
    ).length === 29,
    'Expected 29 auto_resolved normalization results.',
  )
  assert(
    normalizationResults.filter(
      (row) => row.normalizationStatus === 'unresolved',
    ).length === 1,
    'Expected 1 unresolved normalization result.',
  )
  assert(reviewItems.length === 1, 'Expected 1 manual review item.')
  assert(publishedProducts.length === 6, 'Expected 6 published products.')
  assert(publishedPrintings.length === 29, 'Expected 29 published printings.')
  assert(
    job.currentStage === 'published',
    'Expected final job stage to be published.',
  )
  assert(
    job.jobStatus === 'partially_completed',
    'Expected final job status to be partially_completed.',
  )
  assert(
    job.publishedRecordCount === 29,
    'Expected published_record_count = 29.',
  )
  assert(
    importedCanonicalEntities.length === requiredCanonicalKeys.length,
    `Expected ${requiredCanonicalKeys.length} canonical entities to be present.`,
  )

  const perCase = {
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
    cethlanRegular: summarizeCase(
      'printing-cethlan-dz-bt01-main',
      rawPrintings,
      normalizationByRawPrintingId,
      publishedByNormalizationId,
      entityById,
      productById,
    ),
    cethlanFr: summarizeCase(
      'printing-cethlan-dz-bt01-fr',
      rawPrintings,
      normalizationByRawPrintingId,
      publishedByNormalizationId,
      entityById,
      productById,
    ),
    cerrgaonCr: summarizeCase(
      'printing-cerrgaon-dz-ss05-cr',
      rawPrintings,
      normalizationByRawPrintingId,
      publishedByNormalizationId,
      entityById,
      productById,
    ),
    cerrgaonGcr: summarizeCase(
      'printing-cerrgaon-dz-ss05-gcr',
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

  assert(
    perCase.rezaelRegular.publishedCardEntityId !== null &&
      perCase.rezaelRegular.publishedCardEntityId ===
        perCase.rezaelDsr.publishedCardEntityId,
    'Expected both Rezael printings to point to one published entity.',
  )
  assert(
    perCase.cethlanRegular.publishedCardEntityId !== null &&
      perCase.cethlanRegular.publishedCardEntityId ===
        perCase.cethlanFr.publishedCardEntityId,
    'Expected both Cethlan printings to point to one published entity.',
  )
  assert(
    perCase.cerrgaonCr.publishedCardEntityId !== null &&
      perCase.cerrgaonCr.publishedCardEntityId ===
        perCase.cerrgaonGcr.publishedCardEntityId,
    'Expected both Cerrgaon printings to point to one published entity.',
  )
  assert(
    perCase.liael.normalizationStatus === 'unresolved' &&
      perCase.liael.publishedPrintingId === null,
    'Expected Liael to remain unresolved and unpublished.',
  )

  const bastionSearch = await requireRepoOk(
    catalogRepository.listCardEntities({
      searchText: 'bastion',
      filters: {
        formatIds: ['standard'],
        eras: ['d'],
        nations: ['keter sanctuary'],
        clans: [],
        cardTypes: [],
        triggerTypes: [],
        rarities: [],
        productKeys: [],
      },
      pageSize: 24,
    }),
    'Failed to search Bastion catalog entities.',
  )
  const keterStandardCatalog = await requireRepoOk(
    catalogRepository.listCardEntities({
      filters: {
        formatIds: ['standard'],
        eras: ['d'],
        nations: ['keter sanctuary'],
        clans: [],
        cardTypes: [],
        triggerTypes: [],
        rarities: [],
        productKeys: [],
      },
      pageSize: 96,
    }),
    'Failed to load Keter Standard catalog entities.',
  )

  const dzBt01Product = productByCode.get('DZ-BT01')

  if (!dzBt01Product) {
    throw new Error('Published product DZ-BT01 was not found.')
  }

  const rezaelFilteredSearch = await requireRepoOk(
    catalogRepository.listCardEntities({
      searchText: 'rezael',
      filters: {
        formatIds: [],
        eras: [],
        nations: [],
        clans: [],
        cardTypes: [],
        triggerTypes: [],
        rarities: [],
        productKeys: [dzBt01Product.canonical_key],
      },
      pageSize: 24,
    }),
    'Failed to run product-scoped Rezael catalog search.',
  )
  const dzBt02Product = productByCode.get('DZ-BT02')
  const dzBt02PublishedPrintings =
    dzBt02Product === undefined
      ? []
      : await requireRepoOk(
          catalogRepository.listProductPrintings(dzBt02Product.id),
          'Failed to load DZ-BT02 published printings.',
        )

  assert(
    bastionSearch.items.some(
      (entry) => entry.canonicalKey === 'card.apex-ruler-bastion',
    ),
    'Expected Bastion to be discoverable in catalog search.',
  )
  assert(
    bastionSearch.items.some(
      (entry) =>
        entry.canonicalKey === 'card.apex-surpassing-sword-bastion-prime',
    ),
    'Expected Bastion Prime to be discoverable in catalog search.',
  )
  assert(
    rezaelFilteredSearch.items.some(
      (entry) => entry.canonicalKey === 'card.fated-one-of-miracles-rezael',
    ),
    'Expected Rezael to be discoverable in DZ-BT01 product-scoped search.',
  )
  assert(
    dzBt02PublishedPrintings.length === 1,
    'Expected DZ-BT02 to retain one published printing while unresolved Liael stayed out of catalog.',
  )

  const standardRestrictionList =
    await loadActiveStandardRestrictionList(client)

  if (!standardRestrictionList) {
    throw new Error('Active Standard restriction list was not found.')
  }

  const importedCardFacts = await buildImportedCardFacts(
    catalogRepository,
    importedCanonicalEntities,
  )
  const cardIdByCanonicalKey = new Map(
    importedCanonicalEntities.map(
      (row) => [row.canonical_key, row.id] as const,
    ),
  )

  const validBastionDeck = createValidationDeck('deck.standard.bastion.valid', [
    {
      section: 'ride',
      cardEntityId: requireCardId(
        cardIdByCanonicalKey,
        'card.knight-of-heavenly-bow-base',
      ),
      quantity: 1,
    },
    {
      section: 'ride',
      cardEntityId: requireCardId(
        cardIdByCanonicalKey,
        'card.knight-of-heavenly-sword-fort',
      ),
      quantity: 1,
    },
    {
      section: 'ride',
      cardEntityId: requireCardId(
        cardIdByCanonicalKey,
        'card.knight-of-heavenly-spear-rooks',
      ),
      quantity: 1,
    },
    {
      section: 'ride',
      cardEntityId: requireCardId(
        cardIdByCanonicalKey,
        'card.apex-ruler-bastion',
      ),
      quantity: 1,
    },
    {
      section: 'main',
      cardEntityId: requireCardId(
        cardIdByCanonicalKey,
        'card.apex-ruler-bastion',
      ),
      quantity: 4,
    },
    {
      section: 'main',
      cardEntityId: requireCardId(
        cardIdByCanonicalKey,
        'card.apex-surpassing-sword-bastion-prime',
      ),
      quantity: 4,
    },
    {
      section: 'main',
      cardEntityId: requireCardId(
        cardIdByCanonicalKey,
        'card.vehement-witch-ramana',
      ),
      quantity: 4,
    },
    {
      section: 'main',
      cardEntityId: requireCardId(
        cardIdByCanonicalKey,
        'card.knight-of-broadaxe-rafluke',
      ),
      quantity: 4,
    },
    {
      section: 'main',
      cardEntityId: requireCardId(
        cardIdByCanonicalKey,
        'card.shadow-bow-archer-lisana',
      ),
      quantity: 4,
    },
    {
      section: 'main',
      cardEntityId: requireCardId(cardIdByCanonicalKey, 'card.platinum-wolf'),
      quantity: 4,
    },
    {
      section: 'main',
      cardEntityId: requireCardId(
        cardIdByCanonicalKey,
        'card.lifesaving-angel-kurabiel',
      ),
      quantity: 4,
    },
    {
      section: 'main',
      cardEntityId: requireCardId(
        cardIdByCanonicalKey,
        'card.knight-of-heavenly-hammer-gurgant',
      ),
      quantity: 4,
    },
    {
      section: 'main',
      cardEntityId: requireCardId(
        cardIdByCanonicalKey,
        'card.knight-of-heavenly-pierce-gallus',
      ),
      quantity: 4,
    },
    {
      section: 'main',
      cardEntityId: requireCardId(
        cardIdByCanonicalKey,
        'card.knight-of-heavenly-rend-lif',
      ),
      quantity: 4,
    },
    {
      section: 'main',
      cardEntityId: requireCardId(
        cardIdByCanonicalKey,
        'card.healer-of-heavenly-staff-arshes',
      ),
      quantity: 4,
    },
    {
      section: 'main',
      cardEntityId: requireCardId(
        cardIdByCanonicalKey,
        'card.the-hour-of-holy-judgement-cometh',
      ),
      quantity: 2,
    },
    {
      section: 'main',
      cardEntityId: requireCardId(
        cardIdByCanonicalKey,
        'card.wisdom-of-beginning-that-cleared-the-world',
      ),
      quantity: 4,
    },
  ])

  const rezaelChoiceRestrictionDeck = createValidationDeck(
    'deck.standard.rezael-choice.invalid',
    [
      {
        section: 'ride',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.wings-of-aspiration-soel',
        ),
        quantity: 1,
      },
      {
        section: 'ride',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.knight-of-great-advance-ascensior',
        ),
        quantity: 1,
      },
      {
        section: 'ride',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.patrol-of-gusts-ventesta',
        ),
        quantity: 1,
      },
      {
        section: 'ride',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.fated-one-of-miracles-rezael',
        ),
        quantity: 1,
      },
      {
        section: 'main',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.fated-one-of-miracles-rezael',
        ),
        quantity: 4,
      },
      {
        section: 'main',
        cardEntityId: requireCardId(cardIdByCanonicalKey, 'card.cerrgaon'),
        quantity: 4,
      },
      {
        section: 'main',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.divine-sister-biscotti',
        ),
        quantity: 4,
      },
      {
        section: 'main',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.knight-of-gentle-beauty-nobia',
        ),
        quantity: 4,
      },
      {
        section: 'main',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.bringer-of-protection-cethlan',
        ),
        quantity: 4,
      },
      {
        section: 'main',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.apex-surpassing-sword-bastion-prime',
        ),
        quantity: 4,
      },
      {
        section: 'main',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.vehement-witch-ramana',
        ),
        quantity: 4,
      },
      {
        section: 'main',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.knight-of-broadaxe-rafluke',
        ),
        quantity: 4,
      },
      {
        section: 'main',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.knight-of-heavenly-hammer-gurgant',
        ),
        quantity: 4,
      },
      {
        section: 'main',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.knight-of-heavenly-pierce-gallus',
        ),
        quantity: 4,
      },
      {
        section: 'main',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.knight-of-heavenly-rend-lif',
        ),
        quantity: 4,
      },
      {
        section: 'main',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.healer-of-heavenly-staff-arshes',
        ),
        quantity: 4,
      },
      {
        section: 'main',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.wisdom-of-beginning-that-cleared-the-world',
        ),
        quantity: 2,
      },
    ],
  )

  const validationContext = {
    cardFacts: importedCardFacts,
    restrictions: {
      listId: standardRestrictionList.version,
      activeList: standardRestrictionList,
    },
  }
  const validBastionValidation = validateDeck({
    deck: validBastionDeck,
    context: validationContext,
  })
  const rezaelChoiceValidation = validateDeck({
    deck: rezaelChoiceRestrictionDeck,
    context: validationContext,
  })

  assert(
    validBastionValidation.summary.errorCount === 0,
    `Expected Bastion validation smoke deck to pass, found ${validBastionValidation.summary.errorCount} errors.`,
  )
  assert(
    rezaelChoiceValidation.issues.some(
      (issue) => issue.code === 'choice-restriction-violated',
    ),
    'Expected Rezael + Cerrgaon deck to violate the Standard choice restriction.',
  )

  const legalitySamples = await loadLegalityFactsByCanonicalKey(
    catalogRepository,
    importedCanonicalEntities,
    [
      'card.apex-ruler-bastion',
      'card.fated-one-of-miracles-rezael',
      'card.cerrgaon',
      'card.academic-of-endeavoring-effoll',
    ],
  )
  const totalDurationMs = Date.now() - startedAtMs

  process.stdout.write(
    `${JSON.stringify(
      {
        runtimePath: {
          command: `corepack pnpm dlx tsx ./scripts/run-standard-content-expansion-wave.ts -- ${fixturePath}`,
          importerEntrypoint:
            'tsx --tsconfig ./tsconfig.base.json ./packages/importer/src/dev-json/run-dev-json-import.ts',
          publicationBoundary: 'tracked catalog publication service',
          database: 'local-supabase',
        },
        seed: {
          fixturePath: path.resolve(process.cwd(), fixturePath),
          canonicalBootstrapSnippet,
          choiceRestrictionOverlaySnippet,
        },
        performance: {
          importerDurationMs,
          publicationDurationMs,
          totalDurationMs,
        },
        source: {
          existedBeforeRun: sourceBefore !== null,
          id: sourceAfter?.id ?? importSummary.source.id,
          sourceKey: importSummary.source.sourceKey,
          sourceType: importSummary.source.sourceType,
          displayName: importSummary.source.displayName,
        },
        job: {
          id: job.id,
          prePublicationStatus: importSummary.job.jobStatus,
          prePublicationStage: importSummary.job.currentStage,
          finalStatus: job.jobStatus,
          finalStage: job.currentStage,
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
        },
        reviewQueue: {
          totalCount: reviewItems.length,
          reasonCounts: countBy(reviewItems, (row) => row.reviewReason),
          statusCounts: countBy(reviewItems, (row) => row.reviewStatus),
        },
        publication: {
          firstRun: publication,
          replay: publicationReplay,
        },
        canonicalIntegrity: {
          importedCanonicalKeys: importedCanonicalEntities
            .map((row) => row.canonical_key)
            .sort((left, right) => left.localeCompare(right)),
          perCase,
        },
        catalogUsability: {
          activeStandardProfiles: activeStandardProfile,
          bastionSearch: {
            totalCount: bastionSearch.totalCount,
            canonicalKeys: bastionSearch.items.map((item) => item.canonicalKey),
          },
          keterStandardCatalog: {
            totalCount: keterStandardCatalog.totalCount,
            canonicalKeys: keterStandardCatalog.items.map(
              (item) => item.canonicalKey,
            ),
          },
          dzBt01RezaelSearch: {
            totalCount: rezaelFilteredSearch.totalCount,
            canonicalKeys: rezaelFilteredSearch.items.map(
              (item) => item.canonicalKey,
            ),
          },
          dzBt02PublishedPrintings: dzBt02PublishedPrintings.map((item) => ({
            printingKey: item.printingKey,
            cardCanonicalKey: item.card.canonicalKey,
            cardName: item.card.name,
          })),
        },
        legalitySamples,
        validation: {
          restrictionListVersion: standardRestrictionList.version,
          cases: {
            validBastion: {
              issueCodes: validBastionValidation.issues.map(
                (issue) => issue.code,
              ),
              summary: validBastionValidation.summary,
            },
            rezaelChoiceRestriction: {
              issueCodes: rezaelChoiceValidation.issues.map(
                (issue) => issue.code,
              ),
              summary: rezaelChoiceValidation.summary,
            },
          },
        },
        architecture: {
          importerWritesDirectlyToCatalog: false,
          publicationRemainsSingleWriteBridge: true,
          canonicalBootstrapRequired: true,
          validationDependsOnUi: false,
        },
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
    ? defaultFixturePath
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

async function ensureCanonicalBootstrap(
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
      `Missing canonical bootstrap for ${missing.join(', ')}. Apply ${canonicalBootstrapSnippet} before rerunning.`,
    )
  }
}

async function ensureChoiceRestrictionOverlay(
  client: ReturnType<typeof createDbClient>,
) {
  const cerrgaon = await client
    .schema('catalog')
    .from('card_entities')
    .select('id')
    .eq('canonical_key', 'card.cerrgaon')
    .maybeSingle()
  const rezael = await client
    .schema('catalog')
    .from('card_entities')
    .select('id')
    .eq('canonical_key', 'card.fated-one-of-miracles-rezael')
    .maybeSingle()

  if (cerrgaon.error || rezael.error || !cerrgaon.data || !rezael.data) {
    throw new Error(
      'Choice restriction overlay check failed while resolving Cerrgaon / Rezael canonical ids.',
    )
  }

  const memberships = await client
    .schema('legality')
    .from('choice_restriction_rule_cards')
    .select('choice_restriction_rule_id, card_entity_id')
    .in('card_entity_id', [cerrgaon.data.id, rezael.data.id])

  if (memberships.error) {
    throw new Error(memberships.error.message)
  }

  const grouped = new Map<string, string[]>()

  for (const row of memberships.data ?? []) {
    const existing = grouped.get(row.choice_restriction_rule_id) ?? []
    existing.push(row.card_entity_id)
    grouped.set(row.choice_restriction_rule_id, existing)
  }

  const sharedChoiceRuleId = Array.from(grouped.entries()).find(([, ids]) => {
    const idSet = new Set(ids)
    return idSet.has(cerrgaon.data.id) && idSet.has(rezael.data.id)
  })?.[0]

  if (!sharedChoiceRuleId) {
    throw new Error(
      `Missing choice restriction overlay for Cerrgaon + Rezael. Apply ${choiceRestrictionOverlaySnippet} before rerunning.`,
    )
  }
}

async function buildImportedCardFacts(
  catalogRepository: ReturnType<typeof createCatalogRepository>,
  importedCanonicalEntities: readonly Array<{
    readonly id: string
    readonly canonical_key: string
    readonly grade: number
    readonly card_type: string
    readonly nation: string | null
    readonly clan: string | null
    readonly trigger_type: string | null
  }>,
) {
  const cardFacts = new Map<string, any>()

  for (const card of importedCanonicalEntities) {
    const legality = await requireRepoOk(
      catalogRepository.getCardLegalityFacts(card.id),
      `Failed to load legality facts for ${card.canonical_key}.`,
    )

    cardFacts.set(card.id, {
      grade: card.grade,
      cardType: card.card_type,
      nation: card.nation,
      clan: card.clan,
      triggerType: card.trigger_type,
      legalInFormats: Array.from(
        new Set(
          legality.eligibilityOverrides
            .filter((entry) => entry.eligibilityState === 'allowed')
            .map((entry) => entry.formatId),
        ),
      ).sort((left, right) => left.localeCompare(right)),
      premiumGDeckEligible: null,
    })
  }

  return cardFacts
}

async function loadLegalityFactsByCanonicalKey(
  catalogRepository: ReturnType<typeof createCatalogRepository>,
  importedCanonicalEntities: readonly Array<{
    readonly id: string
    readonly canonical_key: string
    readonly name: string
  }>,
  canonicalKeys: readonly string[],
) {
  const entityByCanonicalKey = new Map(
    importedCanonicalEntities.map((row) => [row.canonical_key, row] as const),
  )
  const samples = []

  for (const canonicalKey of canonicalKeys) {
    const entity = entityByCanonicalKey.get(canonicalKey)

    if (!entity) {
      continue
    }

    const legality = await requireRepoOk(
      catalogRepository.getCardLegalityFacts(entity.id),
      `Failed to load legality sample for ${canonicalKey}.`,
    )

    samples.push({
      canonicalKey,
      name: entity.name,
      eligibilityOverrides: legality.eligibilityOverrides,
      restrictions: legality.restrictions,
      choiceRestrictions: legality.choiceRestrictions,
    })
  }

  return samples
}

async function loadActiveStandardRestrictionList(
  client: ReturnType<typeof createDbClient>,
) {
  const listResult = await client
    .schema('legality')
    .from('restriction_lists')
    .select('id, version_label')
    .eq('rule_profile_id', 'standard-baseline-v1')
    .eq('is_active', true)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (listResult.error || !listResult.data) {
    return null
  }

  const list = listResult.data
  const [cardRulesResult, choiceRulesResult] = await Promise.all([
    client
      .schema('legality')
      .from('card_restriction_rules')
      .select('card_entity_id, restriction_type, max_copies, note')
      .eq('restriction_list_id', list.id),
    client
      .schema('legality')
      .from('choice_restriction_rules')
      .select('id, allowed_choices, note')
      .eq('restriction_list_id', list.id),
  ])

  if (cardRulesResult.error || choiceRulesResult.error) {
    return null
  }

  const choiceRuleIds = (choiceRulesResult.data ?? []).map((row) => row.id)
  const membershipsResult =
    choiceRuleIds.length === 0
      ? { data: [], error: null }
      : await client
          .schema('legality')
          .from('choice_restriction_rule_cards')
          .select('choice_restriction_rule_id, card_entity_id')
          .in('choice_restriction_rule_id', choiceRuleIds)

  if (membershipsResult.error) {
    return null
  }

  const optionCardIdsByRuleId = new Map<string, string[]>()

  for (const membership of membershipsResult.data ?? []) {
    const existing =
      optionCardIdsByRuleId.get(membership.choice_restriction_rule_id) ?? []
    existing.push(membership.card_entity_id)
    optionCardIdsByRuleId.set(
      membership.choice_restriction_rule_id,
      Array.from(new Set(existing)).sort((left, right) =>
        left.localeCompare(right),
      ),
    )
  }

  return {
    formatId: 'standard',
    version: list.version_label,
    rules: [
      ...(cardRulesResult.data ?? []).map((row) => ({
        kind: 'card',
        type: row.restriction_type,
        formatId: 'standard',
        cardId: row.card_entity_id,
        ...(row.max_copies != null ? { limit: row.max_copies } : {}),
        ...(row.note ? { note: row.note } : {}),
      })),
      ...(choiceRulesResult.data ?? []).map((row) => ({
        kind: 'choice',
        formatId: 'standard',
        optionCardIds: optionCardIdsByRuleId.get(row.id) ?? [],
        allowedChoices: row.allowed_choices,
        ...(row.note ? { note: row.note } : {}),
      })),
    ],
  }
}

function createValidationDeck(
  id: string,
  cards: readonly Array<{
    readonly section: 'main' | 'ride'
    readonly cardEntityId: string
    readonly quantity: number
  }>,
) {
  return createDeck({
    id: id as any,
    ownerId: 'user.validation' as any,
    formatId: 'standard' as any,
    name: id,
    createdAt: '2026-04-17T00:00:00.000Z',
    updatedAt: '2026-04-17T00:00:00.000Z',
    currentVersionId: `${id}.v1` as any,
    cards: cards as any,
  })
}

function requireCardId(
  cardIdByCanonicalKey: ReadonlyMap<string, string>,
  canonicalKey: string,
) {
  const cardId = cardIdByCanonicalKey.get(canonicalKey)

  if (!cardId) {
    throw new Error(
      `Canonical card ${canonicalKey} is missing from imported entities.`,
    )
  }

  return cardId
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

async function requireRepoOk<T>(
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
    publishedPrintingId: published?.id ?? null,
    publishedPrintingKey: published?.printing_key ?? null,
    publishedCardEntityId: published?.card_entity_id ?? null,
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
    `Standard content expansion wave run failed.\n${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  )
  process.exitCode = 1
})
