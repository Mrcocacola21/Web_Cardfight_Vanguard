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
  './packages/importer/fixtures/dev-json/additional-standard-products-expansion-wave-11-3.json'
const priorCanonicalBootstrapSnippet =
  './supabase/snippets/standard_content_expansion_wave_11_1_canonical_bootstrap.sql'
const additionalCanonicalBootstrapSnippet =
  './supabase/snippets/additional_standard_products_wave_11_3_canonical_bootstrap.sql'
const choiceRestrictionOverlaySnippet =
  './supabase/snippets/standard_content_expansion_wave_11_1_choice_restriction_overlay.sql'
const sourceKey = 'dev-json.additional-standard-products-expansion-wave-11-3'
const selectedProductCodes = ['D-SD03', 'DZ-LBT01', 'DZ-SS05'] as const
const expectedPrintingCountsByCode = {
  'D-SD03': 15,
  'DZ-LBT01': 5,
  'DZ-SS05': 2,
} as const
const expectedProductKindsByCode = {
  'D-SD03': {
    productCategory: 'deck',
    productKind: 'start',
  },
  'DZ-LBT01': {
    productCategory: 'booster',
    productKind: 'lyrical',
  },
  'DZ-SS05': {
    productCategory: 'special-set',
    productKind: 'special-series',
  },
} as const
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
  'card.absolute-zero-sagitta',
  'card.aurora-star-coral',
  'card.diva-of-echostar-retentir',
  'card.fresh-star-coral',
  'card.cerrgaon',
  'card.fated-one-of-miracles-rezael',
] as const
const expectedRawProductCount = selectedProductCodes.length
const expectedRawPrintingCount = Object.values(
  expectedPrintingCountsByCode,
).reduce((total, count) => total + count, 0)
const expectedRawRecordCount =
  expectedRawProductCount + expectedRawPrintingCount

async function main() {
  const fixturePath = resolveFixturePath(process.argv.slice(2))
  const startedAtMs = Date.now()
  const adminConfig = resolveSupabaseAdminConfig()
  const client = createDbClient({
    url: adminConfig.url,
    serviceRoleKey: adminConfig.serviceRoleKey,
  })
  const sourceBefore = await loadImportSourceByKey(client, sourceKey)

  await ensureCanonicalBootstrap(client)
  await ensureChoiceRestrictionOverlay(client)

  const importerRepository = createImporterRepository(client)
  const publicationRepository = createCatalogPublicationRepository(client)
  const catalogRepository = createCatalogRepository(client)
  const trackedPublication = createTrackedCatalogPublicationService(
    createCatalogPublicationService(publicationRepository),
    importerRepository,
  )

  const priorCatalogState = await loadCatalogStateForSelectedProducts(client)

  const firstRun = await executeWaveRun({
    fixturePath,
    adminConfig,
    client,
    importerRepository,
    trackedPublication,
  })
  const secondRun = await executeWaveRun({
    fixturePath,
    adminConfig,
    client,
    importerRepository,
    trackedPublication,
  })

  const catalogStateAfter = secondRun.catalogState
  const productDetails = await loadProductDetails(
    catalogRepository,
    catalogStateAfter.products,
  )
  const importedCanonicalEntities = await requireSelect(
    client
      .schema('catalog')
      .from('card_entities')
      .select(
        'id, canonical_key, name, normalized_name, grade, card_type, nation, clan, trigger_type',
      )
      .in('canonical_key', [...requiredCanonicalKeys]),
    'Failed to load required canonical entities.',
  )

  assert(
    importedCanonicalEntities.length === requiredCanonicalKeys.length,
    `Expected ${requiredCanonicalKeys.length} canonical entities to be present.`,
  )

  for (const product of catalogStateAfter.products) {
    const expectedType =
      expectedProductKindsByCode[
        product.official_code as keyof typeof expectedProductKindsByCode
      ]

    assert(
      product.product_category === expectedType.productCategory,
      `Expected ${product.official_code} product_category = ${expectedType.productCategory}.`,
    )
    assert(
      product.product_kind === expectedType.productKind,
      `Expected ${product.official_code} product_kind = ${expectedType.productKind}.`,
    )
    assert(
      product.family_id === 'family-standard',
      `Expected ${product.official_code} to remain in family-standard.`,
    )
  }

  const activeStandardProfile = await requireSelect(
    client
      .schema('legality')
      .from('rule_profiles')
      .select('id, display_name, version_label')
      .eq('format_id', 'standard')
      .eq('is_active', true),
    'Failed to load active Standard rule profile.',
  )

  const productByCode = new Map(
    catalogStateAfter.products.map(
      (product) => [product.official_code, product] as const,
    ),
  )
  const dsd03 = requireProduct(productByCode, 'D-SD03')
  const dzlbt01 = requireProduct(productByCode, 'DZ-LBT01')
  const dzss05 = requireProduct(productByCode, 'DZ-SS05')

  const dsd03Printings = await requireRepoOk(
    catalogRepository.listProductPrintings(dsd03.id),
    'Failed to load D-SD03 printings.',
  )
  const dzlbt01Printings = await requireRepoOk(
    catalogRepository.listProductPrintings(dzlbt01.id),
    'Failed to load DZ-LBT01 printings.',
  )
  const dzss05Printings = await requireRepoOk(
    catalogRepository.listProductPrintings(dzss05.id),
    'Failed to load DZ-SS05 printings.',
  )

  assert(
    dsd03Printings.length === expectedPrintingCountsByCode['D-SD03'],
    'Unexpected D-SD03 printing count.',
  )
  assert(
    dzlbt01Printings.length === expectedPrintingCountsByCode['DZ-LBT01'],
    'Unexpected DZ-LBT01 printing count.',
  )
  assert(
    dzss05Printings.length === expectedPrintingCountsByCode['DZ-SS05'],
    'Unexpected DZ-SS05 printing count.',
  )

  const startDeckBastionSearch = await requireRepoOk(
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
        productKeys: [dsd03.canonical_key],
      },
      pageSize: 24,
    }),
    'Failed to search D-SD03 card entities.',
  )
  const lyricalAuroraSearch = await requireRepoOk(
    catalogRepository.listCardEntities({
      searchText: 'aurora',
      filters: {
        formatIds: ['standard'],
        eras: ['d'],
        nations: ['lyrical monasterio'],
        clans: [],
        cardTypes: [],
        triggerTypes: [],
        rarities: [],
        productKeys: [dzlbt01.canonical_key],
      },
      pageSize: 24,
    }),
    'Failed to search DZ-LBT01 card entities.',
  )
  const specialSeriesCerrgaonSearch = await requireRepoOk(
    catalogRepository.listCardEntities({
      searchText: 'cerrgaon',
      filters: {
        formatIds: ['standard'],
        eras: ['d'],
        nations: ['keter sanctuary'],
        clans: [],
        cardTypes: [],
        triggerTypes: [],
        rarities: [],
        productKeys: [dzss05.canonical_key],
      },
      pageSize: 24,
    }),
    'Failed to search DZ-SS05 card entities.',
  )

  assert(
    startDeckBastionSearch.items.some(
      (entry) => entry.canonicalKey === 'card.apex-ruler-bastion',
    ),
    'Expected Bastion to be discoverable inside D-SD03.',
  )
  assert(
    lyricalAuroraSearch.items.some(
      (entry) => entry.canonicalKey === 'card.aurora-star-coral',
    ),
    'Expected Aurora Star, Coral to be discoverable inside DZ-LBT01.',
  )
  assert(
    specialSeriesCerrgaonSearch.items.some(
      (entry) => entry.canonicalKey === 'card.cerrgaon',
    ),
    'Expected Cerrgaon to be discoverable inside DZ-SS05.',
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

  const validBastionDeck = createValidationDeck(
    'deck.standard.start-deck.valid',
    [
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
          'card.the-hour-of-holy-judgement-cometh',
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
          'card.knight-of-heavenly-spear-rooks',
        ),
        quantity: 2,
      },
      {
        section: 'main',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.knight-of-heavenly-sword-fort',
        ),
        quantity: 2,
      },
      {
        section: 'main',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.knight-of-heavenly-bow-base',
        ),
        quantity: 2,
      },
    ],
  )

  const mixedNationDeck = createValidationDeck(
    'deck.standard.lyrical-mixed.invalid',
    [
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
          'card.the-hour-of-holy-judgement-cometh',
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
          'card.aurora-star-coral',
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
          'card.knight-of-heavenly-spear-rooks',
        ),
        quantity: 2,
      },
      {
        section: 'main',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.knight-of-heavenly-sword-fort',
        ),
        quantity: 2,
      },
      {
        section: 'main',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.knight-of-heavenly-bow-base',
        ),
        quantity: 2,
      },
    ],
  )

  const rezaelChoiceRestrictionDeck = createValidationDeck(
    'deck.standard.special-series-choice.invalid',
    [
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
          'card.knight-of-heavenly-spear-rooks',
        ),
        quantity: 2,
      },
      {
        section: 'main',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.knight-of-heavenly-sword-fort',
        ),
        quantity: 1,
      },
      {
        section: 'main',
        cardEntityId: requireCardId(
          cardIdByCanonicalKey,
          'card.knight-of-heavenly-bow-base',
        ),
        quantity: 1,
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
  const mixedNationValidation = validateDeck({
    deck: mixedNationDeck,
    context: validationContext,
  })
  const rezaelChoiceValidation = validateDeck({
    deck: rezaelChoiceRestrictionDeck,
    context: validationContext,
  })

  assert(
    validBastionValidation.summary.errorCount === 0,
    `Expected start-deck validation smoke to pass, found ${validBastionValidation.summary.errorCount} errors.`,
  )
  assert(
    mixedNationValidation.issues.some(
      (issue) => issue.code === 'standard-nation-mismatch',
    ),
    'Expected mixed Bastion + Coral deck to violate Standard nation constraints.',
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
    ['card.apex-ruler-bastion', 'card.aurora-star-coral', 'card.cerrgaon'],
  )

  const firstRunPrintingIdsByKey = new Map(
    firstRun.catalogState.printings.map(
      (row) => [row.printing_key, row.id] as const,
    ),
  )
  const secondRunPrintingIdsByKey = new Map(
    secondRun.catalogState.printings.map(
      (row) => [row.printing_key, row.id] as const,
    ),
  )

  assert(
    firstRun.job.sourceId === secondRun.job.sourceId,
    'Expected repeated non-booster imports to reuse one import source.',
  )
  assert(
    firstRun.job.upstreamSnapshotKey === secondRun.job.upstreamSnapshotKey,
    'Expected repeated non-booster imports to keep one snapshot key.',
  )
  assert(
    firstRun.job.inputFingerprint === secondRun.job.inputFingerprint,
    'Expected repeated non-booster imports to keep one input fingerprint.',
  )
  assert(
    firstRun.job.id !== secondRun.job.id,
    'Expected repeated non-booster imports to create distinct jobs.',
  )

  for (const [productCode, firstProduct] of firstRun.productByCode) {
    assert(
      secondRun.productByCode.get(productCode)?.id === firstProduct.id,
      `Expected ${productCode} product id to remain stable across repeated imports.`,
    )
  }

  for (const [printingKey, firstPrintingId] of firstRunPrintingIdsByKey) {
    assert(
      secondRunPrintingIdsByKey.get(printingKey) === firstPrintingId,
      `Expected printing ${printingKey} to reuse the same catalog row id across repeated imports.`,
    )
  }

  assert(
    secondRun.catalogState.products.every(
      (product) => product.source_import_job_id === secondRun.job.id,
    ),
    'Expected all selected products to point at the latest import job after replay.',
  )
  assert(
    secondRun.catalogState.printings.every(
      (row) =>
        row.source_import_job_id === secondRun.job.id &&
        secondRun.normalizationResultIds.has(
          row.source_normalization_result_id,
        ) &&
        secondRun.rawPrintingIds.has(row.source_raw_card_printing_record_id) &&
        secondRun.rawProductIds.has(row.source_raw_product_record_id),
    ),
    'Expected selected printings to refresh provenance to the latest job without changing printing identity.',
  )

  const totalDurationMs = Date.now() - startedAtMs
  const sourceAfter = await loadImportSourceByKey(client, sourceKey)

  process.stdout.write(
    `${JSON.stringify(
      {
        runtimePath: {
          command: `corepack pnpm dlx tsx ./scripts/run-additional-standard-products-expansion.ts -- ${fixturePath}`,
          importerEntrypoint:
            'tsx --tsconfig ./tsconfig.base.json ./packages/importer/src/dev-json/run-dev-json-import.ts',
          publicationBoundary: 'tracked catalog publication service',
          database: 'local-supabase',
        },
        seed: {
          fixturePath: path.resolve(process.cwd(), fixturePath),
          priorCanonicalBootstrapSnippet,
          additionalCanonicalBootstrapSnippet,
          choiceRestrictionOverlaySnippet,
        },
        performance: {
          totalDurationMs,
          importerDurationMs:
            firstRun.performance.importerDurationMs +
            secondRun.performance.importerDurationMs,
          publicationDurationMs:
            firstRun.performance.publicationDurationMs +
            secondRun.performance.publicationDurationMs,
        },
        source: {
          existedBeforeScript: sourceBefore !== null,
          id: sourceAfter?.id ?? secondRun.importSummary.source.id,
          sourceKey: secondRun.importSummary.source.sourceKey,
          sourceType: secondRun.importSummary.source.sourceType,
          displayName: secondRun.importSummary.source.displayName,
        },
        priorCatalogState: summarizeCatalogState(priorCatalogState),
        runs: {
          first: summarizeRun(firstRun),
          second: summarizeRun(secondRun),
        },
        normalizationIntegrity: {
          firstRun: {
            auroraRegular: firstRun.perCase.auroraRegular,
            auroraMsp: firstRun.perCase.auroraMsp,
            cerrgaonCr: firstRun.perCase.cerrgaonCr,
            cerrgaonGcr: firstRun.perCase.cerrgaonGcr,
          },
          secondRun: {
            auroraRegular: secondRun.perCase.auroraRegular,
            auroraMsp: secondRun.perCase.auroraMsp,
            cerrgaonCr: secondRun.perCase.cerrgaonCr,
            cerrgaonGcr: secondRun.perCase.cerrgaonGcr,
          },
        },
        productFamilyIntegrity: {
          products: catalogStateAfter.products,
          productDetails,
        },
        catalogUsability: {
          activeStandardProfiles: activeStandardProfile,
          productSearches: {
            dsd03Bastion: {
              totalCount: startDeckBastionSearch.totalCount,
              canonicalKeys: startDeckBastionSearch.items.map(
                (item) => item.canonicalKey,
              ),
            },
            dzlbt01Aurora: {
              totalCount: lyricalAuroraSearch.totalCount,
              canonicalKeys: lyricalAuroraSearch.items.map(
                (item) => item.canonicalKey,
              ),
            },
            dzss05Cerrgaon: {
              totalCount: specialSeriesCerrgaonSearch.totalCount,
              canonicalKeys: specialSeriesCerrgaonSearch.items.map(
                (item) => item.canonicalKey,
              ),
            },
          },
          productPrintings: {
            dsd03: summarizeProductPrintings(dsd03Printings),
            dzlbt01: summarizeProductPrintings(dzlbt01Printings),
            dzss05: summarizeProductPrintings(dzss05Printings),
          },
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
            mixedNation: {
              issueCodes: mixedNationValidation.issues.map(
                (issue) => issue.code,
              ),
              summary: mixedNationValidation.summary,
            },
            rezaelChoiceRestriction: {
              issueCodes: rezaelChoiceValidation.issues.map(
                (issue) => issue.code,
              ),
              summary: rezaelChoiceValidation.summary,
            },
          },
        },
        repeatability: {
          sourceReused: firstRun.job.sourceId === secondRun.job.sourceId,
          jobsAreDistinct: firstRun.job.id !== secondRun.job.id,
          inputFingerprintStable:
            firstRun.job.inputFingerprint === secondRun.job.inputFingerprint,
          snapshotKeyStable:
            firstRun.job.upstreamSnapshotKey ===
            secondRun.job.upstreamSnapshotKey,
          productIdsStable: Array.from(firstRun.productByCode.keys()).every(
            (productCode) =>
              firstRun.productByCode.get(productCode)?.id ===
              secondRun.productByCode.get(productCode)?.id,
          ),
          printingIdsStable: Array.from(firstRunPrintingIdsByKey.keys()).every(
            (printingKey) =>
              firstRunPrintingIdsByKey.get(printingKey) ===
              secondRunPrintingIdsByKey.get(printingKey),
          ),
          latestProvenancePointsAtSecondRun:
            secondRun.catalogState.products.every(
              (product) => product.source_import_job_id === secondRun.job.id,
            ) &&
            secondRun.catalogState.printings.every(
              (row) => row.source_import_job_id === secondRun.job.id,
            ),
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

async function executeWaveRun(input: {
  readonly fixturePath: string
  readonly adminConfig: {
    readonly url: string
    readonly serviceRoleKey: string
  }
  readonly client: ReturnType<typeof createDbClient>
  readonly importerRepository: ReturnType<typeof createImporterRepository>
  readonly trackedPublication: ReturnType<
    typeof createTrackedCatalogPublicationService
  >
}) {
  const importerStartedAtMs = Date.now()
  const importSummary = runImporterEntrypoint(
    input.fixturePath,
    input.adminConfig,
  )
  const importerDurationMs = Date.now() - importerStartedAtMs

  const publicationStartedAtMs = Date.now()
  const publication = await requireOk(
    input.trackedPublication.publishImportJob(importSummary.job.id),
    'Publication run failed.',
  )
  const publicationReplay = await requireOk(
    input.trackedPublication.publishImportJob(importSummary.job.id),
    'Publication replay failed.',
  )
  const publicationDurationMs = Date.now() - publicationStartedAtMs

  const job = await requireOk(
    input.importerRepository.getImportJobById(importSummary.job.id),
    'Failed to reload persisted import job.',
  )

  if (!job) {
    throw new Error(`Import job ${importSummary.job.id} was not found.`)
  }

  const rawProducts = await requireSelect(
    input.client
      .schema('importer')
      .from('raw_product_records')
      .select('id, source_product_id, raw_name, raw_code')
      .eq('import_job_id', importSummary.job.id),
    'Failed to load raw products.',
  )
  const rawPrintings = await requireOk(
    input.importerRepository.listRawCardPrintingRecordsByJob(
      importSummary.job.id,
    ),
    'Failed to load raw printings.',
  )
  const normalizationResults = await requireOk(
    input.importerRepository.listCardPrintingNormalizationResultsByJob(
      importSummary.job.id,
    ),
    'Failed to load normalization results.',
  )
  const reviewItems = await requireOk(
    input.importerRepository.listManualReviewItemsByJob(importSummary.job.id),
    'Failed to load manual review items.',
  )
  const catalogState = await loadCatalogStateForSelectedProducts(input.client)
  const _rawPrintingById = new Map(
    rawPrintings.map((row) => [row.id, row] as const),
  )
  const normalizationByRawPrintingId = new Map(
    normalizationResults.map(
      (row) => [row.rawCardPrintingRecordId, row] as const,
    ),
  )
  const entityIds = Array.from(
    new Set(
      catalogState.printings
        .map((row) => row.card_entity_id)
        .filter((value): value is string => value !== null),
    ),
  )
  const entities = entityIds.length
    ? await requireSelect(
        input.client
          .schema('catalog')
          .from('card_entities')
          .select('id, canonical_key, name')
          .in('id', entityIds),
        'Failed to load selected card entities.',
      )
    : []
  const entityById = new Map(entities.map((row) => [row.id, row] as const))
  const publishedByNormalizationId = new Map(
    catalogState.printings
      .filter((row) => row.source_normalization_result_id !== null)
      .map((row) => [row.source_normalization_result_id, row] as const),
  )
  const productByCode = new Map(
    catalogState.products.map(
      (product) => [product.official_code, product] as const,
    ),
  )

  assert(
    rawProducts.length === expectedRawProductCount,
    `Expected ${expectedRawProductCount} raw product rows.`,
  )
  assert(
    rawPrintings.length === expectedRawPrintingCount,
    `Expected ${expectedRawPrintingCount} raw printings.`,
  )
  assert(
    normalizationResults.length === expectedRawPrintingCount,
    `Expected ${expectedRawPrintingCount} normalization results.`,
  )
  assert(
    normalizationResults.every(
      (row) => row.normalizationStatus === 'auto_resolved',
    ),
    'Expected the curated non-booster wave to normalize cleanly.',
  )
  assert(
    reviewItems.length === 0,
    'Expected no review queue items in this curated non-booster wave.',
  )
  assert(
    job.rawRecordCount === expectedRawRecordCount,
    `Expected raw_record_count = ${expectedRawRecordCount}.`,
  )
  assert(
    job.normalizedCandidateCount === expectedRawPrintingCount,
    `Expected normalized_candidate_count = ${expectedRawPrintingCount}.`,
  )
  assert(job.conflictCount === 0, 'Expected conflict_count = 0.')
  assert(
    job.publishedRecordCount === expectedRawPrintingCount,
    `Expected published_record_count = ${expectedRawPrintingCount}.`,
  )
  assert(
    job.currentStage === 'published',
    'Expected final job stage to be published.',
  )
  assert(
    job.jobStatus === 'completed',
    'Expected final job status to be completed.',
  )
  assert(
    publication.attemptedCount === expectedRawPrintingCount &&
      publication.publishableCount === expectedRawPrintingCount &&
      publication.publishedProductCount === expectedRawProductCount &&
      publication.publishedPrintingCount === expectedRawPrintingCount &&
      publication.skippedResults.length === 0,
    `Expected publication summary to publish ${expectedRawPrintingCount} printings without skips.`,
  )
  assert(
    publicationReplay.publishedPrintingCount === expectedRawPrintingCount &&
      publicationReplay.skippedResults.length === 0,
    'Expected publication replay to remain stable for the non-booster wave.',
  )

  const normalizationPerProduct = countNormalizationStatusesByProduct(
    rawPrintings,
    normalizationResults,
  )

  for (const productCode of selectedProductCodes) {
    assert(
      normalizationPerProduct[productCode].total ===
        expectedPrintingCountsByCode[productCode],
      `Expected ${expectedPrintingCountsByCode[productCode]} normalization results for ${productCode}.`,
    )
    assert(
      normalizationPerProduct[productCode].statusCounts.auto_resolved ===
        expectedPrintingCountsByCode[productCode],
      `Expected ${productCode} to auto-resolve cleanly.`,
    )
  }

  const perCase = {
    auroraRegular: summarizeCase(
      'printing-aurora-star-coral-dz-lbt01-rrr',
      rawPrintings,
      normalizationByRawPrintingId,
      publishedByNormalizationId,
      entityById,
      'DZ-LBT01',
    ),
    auroraMsp: summarizeCase(
      'printing-aurora-star-coral-dz-lbt01-msp',
      rawPrintings,
      normalizationByRawPrintingId,
      publishedByNormalizationId,
      entityById,
      'DZ-LBT01',
    ),
    cerrgaonCr: summarizeCase(
      'printing-cerrgaon-dz-ss05-cr',
      rawPrintings,
      normalizationByRawPrintingId,
      publishedByNormalizationId,
      entityById,
      'DZ-SS05',
    ),
    cerrgaonGcr: summarizeCase(
      'printing-cerrgaon-dz-ss05-gcr',
      rawPrintings,
      normalizationByRawPrintingId,
      publishedByNormalizationId,
      entityById,
      'DZ-SS05',
    ),
  }

  assert(
    perCase.auroraRegular.publishedCardEntityId !== null &&
      perCase.auroraRegular.publishedCardEntityId ===
        perCase.auroraMsp.publishedCardEntityId,
    'Expected Aurora Star, Coral regular and MSP printings to point to one entity.',
  )
  assert(
    perCase.cerrgaonCr.publishedCardEntityId !== null &&
      perCase.cerrgaonCr.publishedCardEntityId ===
        perCase.cerrgaonGcr.publishedCardEntityId,
    'Expected Cerrgaon CR and GCR printings to point to one entity.',
  )

  return {
    importSummary,
    job,
    rawProducts,
    rawPrintings,
    normalizationResults,
    reviewItems,
    publication,
    publicationReplay,
    catalogState,
    productByCode,
    perCase,
    rawProductIds: new Set(rawProducts.map((row) => row.id)),
    rawPrintingIds: new Set(rawPrintings.map((row) => row.id)),
    normalizationResultIds: new Set(normalizationResults.map((row) => row.id)),
    performance: {
      importerDurationMs,
      publicationDurationMs,
    },
  }
}

async function loadCatalogStateForSelectedProducts(
  client: ReturnType<typeof createDbClient>,
) {
  const products = await requireSelect(
    client
      .schema('catalog')
      .from('products')
      .select(
        'id, canonical_key, official_code, name, family_id, product_category, product_kind, release_date, region_code, source_import_job_id, source_raw_product_record_id',
      )
      .in('official_code', [...selectedProductCodes])
      .order('official_code'),
    'Failed to load selected catalog products.',
  )
  const productIds = products.map((product) => product.id)
  const printings =
    productIds.length === 0
      ? []
      : await requireSelect(
          client
            .schema('catalog')
            .from('card_printings')
            .select(
              'id, printing_key, card_entity_id, product_id, collector_number, printed_name, rarity, source_import_job_id, source_normalization_result_id, source_raw_card_printing_record_id, source_raw_product_record_id',
            )
            .in('product_id', productIds)
            .order('printing_key'),
          'Failed to load selected catalog printings.',
        )

  return {
    products,
    printings,
  }
}

async function loadProductDetails(
  catalogRepository: ReturnType<typeof createCatalogRepository>,
  products: readonly Array<{
    readonly canonical_key: string
    readonly official_code: string
  }>,
) {
  const details = []

  for (const product of products) {
    const detail = await requireRepoOk(
      catalogRepository.getProductDetailByCanonicalKey(product.canonical_key),
      `Failed to load product detail for ${product.official_code}.`,
    )

    if (!detail) {
      throw new Error(
        `Catalog product detail ${product.official_code} was not found.`,
      )
    }

    details.push(detail)
  }

  return details
}

function summarizeCatalogState(
  state: Awaited<ReturnType<typeof loadCatalogStateForSelectedProducts>>,
) {
  const printingKeysByProductCode = new Map<string, string[]>()

  for (const product of state.products) {
    const printingKeys = state.printings
      .filter((printing) => printing.product_id === product.id)
      .map((printing) => printing.printing_key)
      .sort((left, right) => left.localeCompare(right))

    printingKeysByProductCode.set(product.official_code, printingKeys)
  }

  return state.products.map((product) => ({
    officialCode: product.official_code,
    id: product.id,
    productCategory: product.product_category,
    productKind: product.product_kind,
    sourceImportJobId: product.source_import_job_id,
    printingCount:
      printingKeysByProductCode.get(product.official_code)?.length ?? 0,
    printingKeys: printingKeysByProductCode.get(product.official_code) ?? [],
  }))
}

function summarizeRun(run: Awaited<ReturnType<typeof executeWaveRun>>) {
  return {
    performance: run.performance,
    job: {
      id: run.job.id,
      sourceId: run.job.sourceId,
      upstreamSnapshotKey: run.job.upstreamSnapshotKey,
      inputFingerprint: run.job.inputFingerprint,
      prePublicationStatus: run.importSummary.job.jobStatus,
      prePublicationStage: run.importSummary.job.currentStage,
      finalStatus: run.job.jobStatus,
      finalStage: run.job.currentStage,
      rawRecordCount: run.job.rawRecordCount,
      normalizedCandidateCount: run.job.normalizedCandidateCount,
      conflictCount: run.job.conflictCount,
      publishedRecordCount: run.job.publishedRecordCount,
      startedAt: run.job.startedAt,
      finishedAt: run.job.finishedAt,
    },
    rawStage: {
      rawProductCount: run.rawProducts.length,
      rawPrintingCount: run.rawPrintings.length,
      linkedRawPrintingCount: run.rawPrintings.filter(
        (row) => row.rawProductRecordId !== null,
      ).length,
      rawPrintingsByProduct: countBy(
        run.rawPrintings,
        (row) => row.sourceProductCode ?? 'unknown',
      ),
    },
    normalization: {
      totalCount: run.normalizationResults.length,
      statusCounts: countBy(
        run.normalizationResults,
        (row) => row.normalizationStatus,
      ),
      byProduct: countNormalizationStatusesByProduct(
        run.rawPrintings,
        run.normalizationResults,
      ),
    },
    reviewQueue: {
      totalCount: run.reviewItems.length,
      reasonCounts: countBy(run.reviewItems, (row) => row.reviewReason),
      statusCounts: countBy(run.reviewItems, (row) => row.reviewStatus),
    },
    publication: {
      firstRun: run.publication,
      replay: run.publicationReplay,
    },
    catalogState: summarizeCatalogState(run.catalogState),
  }
}

function summarizeProductPrintings(
  printings: readonly Array<{
    readonly printingKey: string
    readonly rarity: string
    readonly card: {
      readonly canonicalKey: string
      readonly name: string
    }
  }>,
) {
  return {
    totalCount: printings.length,
    items: printings.map((printing) => ({
      printingKey: printing.printingKey,
      rarity: printing.rarity,
      cardCanonicalKey: printing.card.canonicalKey,
      cardName: printing.card.name,
    })),
  }
}

function countNormalizationStatusesByProduct(
  rawPrintings: readonly Array<{
    readonly id: string
    readonly sourceProductCode: string | null
  }>,
  normalizationResults: readonly Array<{
    readonly rawCardPrintingRecordId: string
    readonly normalizationStatus: string
  }>,
) {
  const productCodeByRawPrintingId = new Map(
    rawPrintings.map(
      (row) => [row.id, row.sourceProductCode ?? 'unknown'] as const,
    ),
  )
  const grouped: Record<
    string,
    { total: number; statusCounts: Record<string, number> }
  > = {}

  for (const result of normalizationResults) {
    const productCode =
      productCodeByRawPrintingId.get(result.rawCardPrintingRecordId) ??
      'unknown'
    const entry = grouped[productCode] ?? { total: 0, statusCounts: {} }
    entry.total += 1
    entry.statusCounts[result.normalizationStatus] =
      (entry.statusCounts[result.normalizationStatus] ?? 0) + 1
    grouped[productCode] = entry
  }

  return grouped
}

function requireProduct(
  productByCode: ReadonlyMap<
    string,
    {
      readonly id: string
      readonly canonical_key: string
      readonly official_code: string
    }
  >,
  productCode: (typeof selectedProductCodes)[number],
) {
  const product = productByCode.get(productCode)

  if (!product) {
    throw new Error(`Catalog product ${productCode} was not found.`)
  }

  return product
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
  sourceKeyValue: string,
) {
  const result = await client
    .schema('importer')
    .from('import_sources')
    .select('id, source_key, source_type, display_name, origin_uri')
    .eq('source_type', 'dev_json')
    .eq('source_key', sourceKeyValue)
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
      `Missing canonical bootstrap for ${missing.join(', ')}. Apply ${priorCanonicalBootstrapSnippet} and ${additionalCanonicalBootstrapSnippet} before rerunning.`,
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
  productCode: string,
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
    publishedProductCode: published ? productCode : null,
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
    `Additional Standard products expansion run failed.\n${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  )
  process.exitCode = 1
})
