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
  './packages/importer/fixtures/dev-json/booster-by-booster-expansion-dz-bt01-keter.json'
const canonicalBootstrapSnippet =
  './supabase/snippets/standard_content_expansion_wave_11_1_canonical_bootstrap.sql'
const choiceRestrictionOverlaySnippet =
  './supabase/snippets/standard_content_expansion_wave_11_1_choice_restriction_overlay.sql'
const boosterCode = 'DZ-BT01'
const sourceKey = 'dev-json.booster-by-booster-expansion.dz-bt01-keter'
const requiredCanonicalKeys = [
  'card.apex-ruler-bastion',
  'card.apex-surpassing-sword-bastion-prime',
  'card.vehement-witch-ramana',
  'card.knight-of-broadaxe-rafluke',
  'card.knight-of-heavenly-hammer-gurgant',
  'card.knight-of-heavenly-pierce-gallus',
  'card.knight-of-heavenly-rend-lif',
  'card.healer-of-heavenly-staff-arshes',
  'card.wisdom-of-beginning-that-cleared-the-world',
  'card.fated-one-of-miracles-rezael',
  'card.wings-of-aspiration-soel',
  'card.knight-of-great-advance-ascensior',
  'card.patrol-of-gusts-ventesta',
  'card.divine-sister-biscotti',
  'card.knight-of-gentle-beauty-nobia',
  'card.bringer-of-protection-cethlan',
  'card.cerrgaon',
] as const
const boosterPrintingSourceIds = [
  'printing-rezael-dz-bt01-rrr',
  'printing-rezael-dz-bt01-dsr',
  'printing-soel-dz-bt01-main',
  'printing-ascensior-dz-bt01-main',
  'printing-ventesta-dz-bt01-main',
  'printing-biscotti-dz-bt01-main',
  'printing-nobia-dz-bt01-main',
  'printing-cethlan-dz-bt01-main',
  'printing-cethlan-dz-bt01-fr',
] as const
const expectedRawProductCount = 1
const expectedRawPrintingCount = boosterPrintingSourceIds.length
const expectedRawRecordCount =
  expectedRawProductCount + expectedRawPrintingCount
const expectedDistinctEntityCount = 7

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

  const initialCatalogSnapshot = await loadBoosterCatalogSnapshot(
    client,
    boosterCode,
  )

  const firstRun = await executeBoosterRun({
    fixturePath,
    adminConfig,
    client,
    importerRepository,
    catalogRepository,
    trackedPublication,
  })
  const secondRun = await executeBoosterRun({
    fixturePath,
    adminConfig,
    client,
    importerRepository,
    catalogRepository,
    trackedPublication,
  })

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

  const activeStandardProfile = await requireSelect(
    client
      .schema('legality')
      .from('rule_profiles')
      .select('id, display_name, version_label')
      .eq('format_id', 'standard')
      .eq('is_active', true),
    'Failed to load active Standard rule profile.',
  )

  const boosterProduct = secondRun.catalogSnapshot.product

  if (!boosterProduct) {
    throw new Error(
      `Published booster product ${boosterCode} was not found after the second run.`,
    )
  }

  const boosterProductPrintings = await requireRepoOk(
    catalogRepository.listProductPrintings(boosterProduct.id),
    `Failed to load published printings for ${boosterCode}.`,
  )
  const rezaelSearch = await requireRepoOk(
    catalogRepository.listCardEntities({
      searchText: 'rezael',
      filters: {
        formatIds: ['standard'],
        eras: ['d'],
        nations: ['keter sanctuary'],
        clans: [],
        cardTypes: [],
        triggerTypes: [],
        rarities: [],
        productKeys: [boosterProduct.canonical_key],
      },
      pageSize: 24,
    }),
    'Failed to search Rezael within the booster scope.',
  )
  const boosterCatalogEntities = await requireRepoOk(
    catalogRepository.listCardEntities({
      filters: {
        formatIds: ['standard'],
        eras: ['d'],
        nations: ['keter sanctuary'],
        clans: [],
        cardTypes: [],
        triggerTypes: [],
        rarities: [],
        productKeys: [boosterProduct.canonical_key],
      },
      pageSize: 32,
    }),
    'Failed to list Standard Keter entities for the booster scope.',
  )

  assert(
    boosterProductPrintings.length === expectedRawPrintingCount,
    `Expected ${expectedRawPrintingCount} published printings for ${boosterCode}.`,
  )
  assert(
    rezaelSearch.items.some(
      (entry) => entry.canonicalKey === 'card.fated-one-of-miracles-rezael',
    ),
    'Expected Rezael to be discoverable in product-scoped search.',
  )
  assert(
    boosterCatalogEntities.totalCount === expectedDistinctEntityCount,
    `Expected ${expectedDistinctEntityCount} distinct catalog entities in the booster scope.`,
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

  const validRezaelDeck = createValidationDeck('deck.standard.rezael.valid', [
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

  const missingRideDeck = createValidationDeck(
    'deck.standard.rezael-format.invalid',
    [
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

  const validRezaelValidation = validateDeck({
    deck: validRezaelDeck,
    context: validationContext,
  })
  const rezaelChoiceValidation = validateDeck({
    deck: rezaelChoiceRestrictionDeck,
    context: validationContext,
  })
  const missingRideValidation = validateDeck({
    deck: missingRideDeck,
    context: validationContext,
  })

  assert(
    validRezaelValidation.summary.errorCount === 0,
    `Expected valid Rezael deck to pass, found ${validRezaelValidation.summary.errorCount} errors.`,
  )
  assert(
    rezaelChoiceValidation.issues.some(
      (issue) => issue.code === 'choice-restriction-violated',
    ),
    'Expected Rezael + Cerrgaon deck to violate the Standard choice restriction.',
  )
  assert(
    missingRideValidation.issues.some(
      (issue) => issue.code === 'standard-ride-deck-missing',
    ),
    'Expected missing ride deck to trigger a Standard format violation.',
  )

  const legalitySamples = await loadLegalityFactsByCanonicalKey(
    catalogRepository,
    importedCanonicalEntities,
    [
      'card.fated-one-of-miracles-rezael',
      'card.bringer-of-protection-cethlan',
      'card.cerrgaon',
    ],
  )

  const secondRunPrintingIdsByKey = new Map(
    secondRun.catalogSnapshot.printings.map(
      (row) => [row.printing_key, row.id] as const,
    ),
  )
  const firstRunPrintingIdsByKey = new Map(
    firstRun.catalogSnapshot.printings.map(
      (row) => [row.printing_key, row.id] as const,
    ),
  )

  assert(
    firstRun.job.sourceId === secondRun.job.sourceId,
    'Expected repeated booster imports to reuse one import source.',
  )
  assert(
    firstRun.job.upstreamSnapshotKey === secondRun.job.upstreamSnapshotKey,
    'Expected repeated booster imports to keep the same snapshot key.',
  )
  assert(
    firstRun.job.inputFingerprint === secondRun.job.inputFingerprint,
    'Expected repeated booster imports to keep the same input fingerprint.',
  )
  assert(
    firstRun.job.id !== secondRun.job.id,
    'Expected repeated booster imports to create distinct import jobs.',
  )

  if (initialCatalogSnapshot.product) {
    assert(
      initialCatalogSnapshot.product.id ===
        firstRun.catalogSnapshot.product?.id,
      'Expected the standalone wave to reuse the pre-existing catalog product row.',
    )
  }

  assert(
    firstRun.catalogSnapshot.product?.id ===
      secondRun.catalogSnapshot.product?.id,
    'Expected the published booster product id to remain stable across repeated imports.',
  )
  assert(
    firstRun.catalogSnapshot.printings.length ===
      secondRun.catalogSnapshot.printings.length,
    'Expected stable published printing count across repeated imports.',
  )

  for (const [printingKey, firstPrintingId] of firstRunPrintingIdsByKey) {
    assert(
      secondRunPrintingIdsByKey.get(printingKey) === firstPrintingId,
      `Expected printing ${printingKey} to reuse the same catalog row id across repeated imports.`,
    )
  }

  assert(
    secondRun.catalogSnapshot.product?.source_import_job_id ===
      secondRun.job.id,
    'Expected catalog product provenance to point at the latest repeated import job.',
  )
  assert(
    secondRun.catalogSnapshot.printings.every(
      (row) =>
        row.source_import_job_id === secondRun.job.id &&
        secondRun.normalizationResultIds.has(
          row.source_normalization_result_id,
        ) &&
        secondRun.rawPrintingIds.has(row.source_raw_card_printing_record_id) &&
        secondRun.rawProductIds.has(row.source_raw_product_record_id),
    ),
    'Expected repeated publication to refresh printing provenance to the latest job without changing printing identity.',
  )

  const totalDurationMs = Date.now() - startedAtMs
  const sourceAfter = await loadImportSourceByKey(client, sourceKey)

  process.stdout.write(
    `${JSON.stringify(
      {
        runtimePath: {
          command: `corepack pnpm dlx tsx ./scripts/run-booster-by-booster-expansion.ts -- ${fixturePath}`,
          importerEntrypoint:
            'tsx --tsconfig ./tsconfig.base.json ./packages/importer/src/dev-json/run-dev-json-import.ts',
          publicationBoundary: 'tracked catalog publication service',
          database: 'local-supabase',
        },
        booster: {
          productCode: boosterCode,
          fixturePath: path.resolve(process.cwd(), fixturePath),
          productAlreadyExistedInCatalog:
            initialCatalogSnapshot.product !== null,
          canonicalBootstrapSnippet,
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
        priorCatalogState: {
          product: initialCatalogSnapshot.product,
          printingCount: initialCatalogSnapshot.printings.length,
          printingKeys: initialCatalogSnapshot.printings.map(
            (row) => row.printing_key,
          ),
        },
        runs: {
          first: summarizeRun(firstRun),
          second: summarizeRun(secondRun),
        },
        normalizationIntegrity: {
          firstRun: {
            rezaelRegular: firstRun.perCase.rezaelRegular,
            rezaelDsr: firstRun.perCase.rezaelDsr,
            cethlanRegular: firstRun.perCase.cethlanRegular,
            cethlanFr: firstRun.perCase.cethlanFr,
          },
          secondRun: {
            rezaelRegular: secondRun.perCase.rezaelRegular,
            rezaelDsr: secondRun.perCase.rezaelDsr,
            cethlanRegular: secondRun.perCase.cethlanRegular,
            cethlanFr: secondRun.perCase.cethlanFr,
          },
        },
        catalogUsability: {
          activeStandardProfiles: activeStandardProfile,
          boosterProduct: secondRun.catalogSnapshot.product,
          productPrintingCount: boosterProductPrintings.length,
          printingKeys: secondRun.catalogSnapshot.printings.map(
            (row) => row.printing_key,
          ),
          productScopedRezaelSearch: {
            totalCount: rezaelSearch.totalCount,
            canonicalKeys: rezaelSearch.items.map((item) => item.canonicalKey),
          },
          boosterScopedCatalog: {
            totalCount: boosterCatalogEntities.totalCount,
            canonicalKeys: boosterCatalogEntities.items.map(
              (item) => item.canonicalKey,
            ),
          },
        },
        validation: {
          restrictionListVersion: standardRestrictionList.version,
          cases: {
            validRezael: {
              issueCodes: validRezaelValidation.issues.map(
                (issue) => issue.code,
              ),
              summary: validRezaelValidation.summary,
            },
            rezaelChoiceRestriction: {
              issueCodes: rezaelChoiceValidation.issues.map(
                (issue) => issue.code,
              ),
              summary: rezaelChoiceValidation.summary,
            },
            missingRideDeck: {
              issueCodes: missingRideValidation.issues.map(
                (issue) => issue.code,
              ),
              summary: missingRideValidation.summary,
            },
          },
        },
        legalitySamples,
        repeatability: {
          sourceReused: firstRun.job.sourceId === secondRun.job.sourceId,
          jobsAreDistinct: firstRun.job.id !== secondRun.job.id,
          inputFingerprintStable:
            firstRun.job.inputFingerprint === secondRun.job.inputFingerprint,
          snapshotKeyStable:
            firstRun.job.upstreamSnapshotKey ===
            secondRun.job.upstreamSnapshotKey,
          productIdStable:
            firstRun.catalogSnapshot.product?.id ===
            secondRun.catalogSnapshot.product?.id,
          printingIdsStable: Array.from(firstRunPrintingIdsByKey.keys()).every(
            (printingKey) =>
              firstRunPrintingIdsByKey.get(printingKey) ===
              secondRunPrintingIdsByKey.get(printingKey),
          ),
          latestProvenancePointsAtSecondRun:
            secondRun.catalogSnapshot.product?.source_import_job_id ===
              secondRun.job.id &&
            secondRun.catalogSnapshot.printings.every(
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

async function executeBoosterRun(input: {
  readonly fixturePath: string
  readonly adminConfig: {
    readonly url: string
    readonly serviceRoleKey: string
  }
  readonly client: ReturnType<typeof createDbClient>
  readonly importerRepository: ReturnType<typeof createImporterRepository>
  readonly catalogRepository: ReturnType<typeof createCatalogRepository>
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
  const catalogSnapshot = await loadBoosterCatalogSnapshot(
    input.client,
    boosterCode,
  )

  assert(
    rawProducts.length === expectedRawProductCount,
    `Expected ${expectedRawProductCount} raw product row for ${boosterCode}.`,
  )
  assert(
    rawPrintings.length === expectedRawPrintingCount,
    `Expected ${expectedRawPrintingCount} raw printings for ${boosterCode}.`,
  )
  assert(
    normalizationResults.length === expectedRawPrintingCount,
    `Expected ${expectedRawPrintingCount} normalization results for ${boosterCode}.`,
  )
  assert(
    normalizationResults.every(
      (row) => row.normalizationStatus === 'auto_resolved',
    ),
    `Expected ${boosterCode} booster wave to normalize without unresolved items.`,
  )
  assert(
    reviewItems.length === 0,
    'Expected no review queue items for the selected booster slice.',
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
    'Expected publication replay to remain stable for the booster wave.',
  )

  const entityIds = Array.from(
    new Set(
      catalogSnapshot.printings
        .map((row) => row.card_entity_id)
        .filter((value): value is string => value !== null),
    ),
  )
  assert(
    entityIds.length === expectedDistinctEntityCount,
    `Expected ${expectedDistinctEntityCount} distinct card entities in ${boosterCode}.`,
  )

  const entities = entityIds.length
    ? await requireSelect(
        input.client
          .schema('catalog')
          .from('card_entities')
          .select('id, canonical_key, name')
          .in('id', entityIds),
        'Failed to load card entities for booster snapshot.',
      )
    : []
  const entityById = new Map(entities.map((row) => [row.id, row] as const))
  const normalizationByRawPrintingId = new Map(
    normalizationResults.map(
      (row) => [row.rawCardPrintingRecordId, row] as const,
    ),
  )
  const publishedByNormalizationId = new Map(
    catalogSnapshot.printings
      .filter((row) => row.source_normalization_result_id !== null)
      .map((row) => [row.source_normalization_result_id, row] as const),
  )
  const perCase = {
    rezaelRegular: summarizeCase(
      'printing-rezael-dz-bt01-rrr',
      rawPrintings,
      normalizationByRawPrintingId,
      publishedByNormalizationId,
      entityById,
      boosterCode,
    ),
    rezaelDsr: summarizeCase(
      'printing-rezael-dz-bt01-dsr',
      rawPrintings,
      normalizationByRawPrintingId,
      publishedByNormalizationId,
      entityById,
      boosterCode,
    ),
    cethlanRegular: summarizeCase(
      'printing-cethlan-dz-bt01-main',
      rawPrintings,
      normalizationByRawPrintingId,
      publishedByNormalizationId,
      entityById,
      boosterCode,
    ),
    cethlanFr: summarizeCase(
      'printing-cethlan-dz-bt01-fr',
      rawPrintings,
      normalizationByRawPrintingId,
      publishedByNormalizationId,
      entityById,
      boosterCode,
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

  return {
    importSummary,
    job,
    rawProducts,
    rawPrintings,
    normalizationResults,
    reviewItems,
    publication,
    publicationReplay,
    catalogSnapshot,
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

async function loadBoosterCatalogSnapshot(
  client: ReturnType<typeof createDbClient>,
  productCode: string,
) {
  const product = await client
    .schema('catalog')
    .from('products')
    .select(
      'id, canonical_key, official_code, name, source_import_job_id, source_raw_product_record_id',
    )
    .eq('official_code', productCode)
    .maybeSingle()

  if (product.error) {
    throw new Error(product.error.message)
  }

  const printings =
    product.data === null
      ? []
      : await requireSelect(
          client
            .schema('catalog')
            .from('card_printings')
            .select(
              'id, printing_key, card_entity_id, product_id, collector_number, printed_name, rarity, source_import_job_id, source_normalization_result_id, source_raw_card_printing_record_id, source_raw_product_record_id',
            )
            .eq('product_id', product.data.id)
            .order('printing_key'),
          `Failed to load ${productCode} catalog printings.`,
        )

  return {
    product: product.data,
    printings,
  }
}

function summarizeRun(run: Awaited<ReturnType<typeof executeBoosterRun>>) {
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
    },
    normalization: {
      totalCount: run.normalizationResults.length,
      statusCounts: countBy(
        run.normalizationResults,
        (row) => row.normalizationStatus,
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
    catalogSnapshot: {
      product: run.catalogSnapshot.product,
      printingCount: run.catalogSnapshot.printings.length,
      printingKeys: run.catalogSnapshot.printings.map(
        (row) => row.printing_key,
      ),
    },
  }
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
    `Booster-by-booster expansion run failed.\n${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  )
  process.exitCode = 1
})
