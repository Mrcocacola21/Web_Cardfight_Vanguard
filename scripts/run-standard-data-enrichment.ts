import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import {
  createCatalogRepository,
  createDbClient,
} from '../packages/db/src/index.ts'

const cliVersion = '2.88.0'
const _repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const boosterWaveScript = './scripts/run-booster-by-booster-expansion.ts'
const additionalProductsScript =
  './scripts/run-additional-standard-products-expansion.ts'
const enrichmentSnippet =
  './supabase/snippets/standard_data_enrichment_wave_11_4.sql'
const officialStandardDeckRulesUrl =
  'https://en.cf-vanguard.com/howto/fighters_rules/deckrules/'

async function main() {
  const adminConfig = resolveSupabaseAdminConfig()
  const client = createDbClient({
    url: adminConfig.url,
    serviceRoleKey: adminConfig.serviceRoleKey,
  })
  const catalogRepository = createCatalogRepository(client)

  const boosterWave = runJsonScript(boosterWaveScript)
  const additionalProductsWave = runJsonScript(additionalProductsScript)

  const bastion = await requireCard(
    catalogRepository,
    'card.apex-ruler-bastion',
  )
  const rezael = await requireCard(
    catalogRepository,
    'card.fated-one-of-miracles-rezael',
  )
  const coral = await requireCard(catalogRepository, 'card.aurora-star-coral')
  const cerrgaon = await requireCard(catalogRepository, 'card.cerrgaon')
  const kurabiel = await requireCard(
    catalogRepository,
    'card.lifesaving-angel-kurabiel',
  )
  const cethlan = await requireCard(
    catalogRepository,
    'card.bringer-of-protection-cethlan',
  )
  const olbaria = await requireCard(
    catalogRepository,
    'card.spiritual-king-of-determination-olbaria',
  )

  const bastionKeywordTags = await requireRepoOk(
    catalogRepository.listCardEntityKeywordTags(bastion.id),
    'Failed to load keyword tags for Bastion.',
  )
  const rezaelKeywordTags = await requireRepoOk(
    catalogRepository.listCardEntityKeywordTags(rezael.id),
    'Failed to load keyword tags for Rezael.',
  )
  const kurabielKeywordTags = await requireRepoOk(
    catalogRepository.listCardEntityKeywordTags(kurabiel.id),
    'Failed to load keyword tags for Kurabiel.',
  )
  const cethlanKeywordTags = await requireRepoOk(
    catalogRepository.listCardEntityKeywordTags(cethlan.id),
    'Failed to load keyword tags for Cethlan.',
  )
  const olbariaKeywordTags = await requireRepoOk(
    catalogRepository.listCardEntityKeywordTags(olbaria.id),
    'Failed to load keyword tags for Olbaria.',
  )

  assertKeywordTags(bastionKeywordTags, ['persona-ride', 'twin-drive'])
  assertKeywordTags(rezaelKeywordTags, [
    'divine-skill',
    'persona-ride',
    'twin-drive',
  ])
  assertKeywordTags(kurabielKeywordTags, ['sentinel'])
  assertKeywordTags(cethlanKeywordTags, ['sentinel'])
  assertKeywordTags(olbariaKeywordTags, ['over-trigger'])

  const bastionLegality = await requireRepoOk(
    catalogRepository.getCardLegalityFacts(bastion.id),
    'Failed to load legality facts for Bastion.',
  )
  const rezaelLegality = await requireRepoOk(
    catalogRepository.getCardLegalityFacts(rezael.id),
    'Failed to load legality facts for Rezael.',
  )
  const coralLegality = await requireRepoOk(
    catalogRepository.getCardLegalityFacts(coral.id),
    'Failed to load legality facts for Coral.',
  )
  const cerrgaonLegality = await requireRepoOk(
    catalogRepository.getCardLegalityFacts(cerrgaon.id),
    'Failed to load legality facts for Cerrgaon.',
  )

  assertAllowedFormats(bastionLegality, ['premium', 'standard'])
  assertAllowedFormats(coralLegality, ['premium', 'standard'])
  assertAllowedFormats(cerrgaonLegality, ['premium', 'standard'])
  assertDisallowedFormat(bastionLegality, 'v-premium')
  assertDisallowedFormat(coralLegality, 'v-premium')
  assertDisallowedFormat(cerrgaonLegality, 'v-premium')

  const rezaelChoiceRestriction = rezaelLegality.choiceRestrictions.find(
    (entry) => entry.formatId === 'standard',
  )
  const cerrgaonChoiceRestriction = cerrgaonLegality.choiceRestrictions.find(
    (entry) => entry.formatId === 'standard',
  )

  assert(
    rezaelChoiceRestriction?.sourceReference === officialStandardDeckRulesUrl,
    `Expected Rezael Standard choice restriction source = ${officialStandardDeckRulesUrl}.`,
  )
  assert(
    cerrgaonChoiceRestriction?.sourceReference === officialStandardDeckRulesUrl,
    `Expected Cerrgaon Standard choice restriction source = ${officialStandardDeckRulesUrl}.`,
  )

  const rezaelDsrPrinting = await requirePrinting(
    catalogRepository,
    'printing.fated-one-of-miracles-rezael.dz-bt01.dsr01.en',
  )
  const cethlanFrPrinting = await requirePrinting(
    catalogRepository,
    'printing.bringer-of-protection-cethlan.dz-bt01.fr32.en',
  )
  const coralMspPrinting = await requirePrinting(
    catalogRepository,
    'printing.aurora-star-coral.dz-lbt01.msp01.en',
  )
  const cerrgaonCrPrinting = await requirePrinting(
    catalogRepository,
    'printing.cerrgaon.dz-ss05.cr08.en',
  )
  const cerrgaonGcrPrinting = await requirePrinting(
    catalogRepository,
    'printing.cerrgaon.dz-ss05.gcr08.en',
  )

  assert(
    rezaelDsrPrinting.artVariant === 'dsr' &&
      rezaelDsrPrinting.isAlternateArt &&
      !rezaelDsrPrinting.isPromoVariant,
    'Expected Rezael DSR printing to publish as alternate-art DSR.',
  )
  assert(
    cethlanFrPrinting.artVariant === 'fr' &&
      cethlanFrPrinting.isAlternateArt &&
      !cethlanFrPrinting.isPromoVariant,
    'Expected Cethlan FR printing to publish as alternate-art FR.',
  )
  assert(
    coralMspPrinting.artVariant === 'msp' &&
      coralMspPrinting.isAlternateArt &&
      !coralMspPrinting.isPromoVariant,
    'Expected Coral MSP printing to publish as alternate-art MSP.',
  )
  assert(
    cerrgaonCrPrinting.artVariant === 'cr' &&
      !cerrgaonCrPrinting.isAlternateArt &&
      !cerrgaonCrPrinting.isPromoVariant,
    'Expected Cerrgaon CR printing to remain a non-alt special variant.',
  )
  assert(
    cerrgaonGcrPrinting.artVariant === 'gcr' &&
      cerrgaonGcrPrinting.isAlternateArt &&
      !cerrgaonGcrPrinting.isPromoVariant,
    'Expected Cerrgaon GCR printing to publish as alternate-art GCR.',
  )

  const productRows = await requireSelect(
    client
      .schema('catalog')
      .from('products')
      .select('id, canonical_key, official_code')
      .in('official_code', ['DZ-BT01', 'DZ-LBT01', 'DZ-SS05']),
    'Failed to load enriched product rows.',
  )
  const productIdByOfficialCode = new Map(
    productRows.map((row) => [row.official_code, row.id] as const),
  )
  const dzbt01Printings = await requireRepoOk(
    catalogRepository.listProductPrintings(
      requireMapEntry(productIdByOfficialCode, 'DZ-BT01'),
    ),
    'Failed to load DZ-BT01 product printings.',
  )
  const dzlbt01Printings = await requireRepoOk(
    catalogRepository.listProductPrintings(
      requireMapEntry(productIdByOfficialCode, 'DZ-LBT01'),
    ),
    'Failed to load DZ-LBT01 product printings.',
  )
  const dzss05Printings = await requireRepoOk(
    catalogRepository.listProductPrintings(
      requireMapEntry(productIdByOfficialCode, 'DZ-SS05'),
    ),
    'Failed to load DZ-SS05 product printings.',
  )

  returnJson({
    runtimePath: {
      command:
        'corepack pnpm dlx tsx ./scripts/run-standard-data-enrichment.ts',
      prerequisiteScripts: [boosterWaveScript, additionalProductsScript],
      enrichmentSnippet,
      database: 'local-supabase',
    },
    boosterWave: {
      source: boosterWave.source,
      run: boosterWave.runs.second,
      validation: boosterWave.validation,
      repeatability: boosterWave.repeatability,
    },
    additionalProductsWave: {
      source: additionalProductsWave.source,
      run: additionalProductsWave.runs.second,
      validation: additionalProductsWave.validation,
      repeatability: additionalProductsWave.repeatability,
    },
    keywordEnrichment: {
      cards: [
        summarizeKeywordCard(bastion, bastionKeywordTags),
        summarizeKeywordCard(rezael, rezaelKeywordTags),
        summarizeKeywordCard(kurabiel, kurabielKeywordTags),
        summarizeKeywordCard(cethlan, cethlanKeywordTags),
        summarizeKeywordCard(olbaria, olbariaKeywordTags),
      ],
    },
    legalityEnrichment: {
      bastion: summarizeLegality(bastionLegality),
      coral: summarizeLegality(coralLegality),
      rezael: summarizeLegality(rezaelLegality),
      cerrgaon: summarizeLegality(cerrgaonLegality),
    },
    printingIntegrity: {
      printings: [
        summarizePrinting(rezaelDsrPrinting),
        summarizePrinting(cethlanFrPrinting),
        summarizePrinting(coralMspPrinting),
        summarizePrinting(cerrgaonCrPrinting),
        summarizePrinting(cerrgaonGcrPrinting),
      ],
      productViews: {
        dzbt01: summarizeProductPrintings(dzbt01Printings),
        dzlbt01: summarizeProductPrintings(dzlbt01Printings),
        dzss05: summarizeProductPrintings(dzss05Printings),
      },
    },
    architecture: {
      importerWritesDirectlyToCatalog:
        boosterWave.architecture.importerWritesDirectlyToCatalog ||
        additionalProductsWave.architecture.importerWritesDirectlyToCatalog,
      publicationRemainsSingleWriteBridge:
        boosterWave.architecture.publicationRemainsSingleWriteBridge &&
        additionalProductsWave.architecture.publicationRemainsSingleWriteBridge,
      validationDependsOnUi:
        boosterWave.architecture.validationDependsOnUi ||
        additionalProductsWave.architecture.validationDependsOnUi,
      keywordTagsRemainEntityLevel: true,
      printingSemanticsRemainPrintingLevel: true,
    },
  })
}

function summarizeKeywordCard(
  card: {
    readonly canonicalKey: string
    readonly name: string
    readonly keywords: readonly string[]
  },
  keywordTags: readonly Array<{
    readonly id: string
    readonly displayName: string
    readonly category: string
  }>,
) {
  return {
    canonicalKey: card.canonicalKey,
    name: card.name,
    flattenedKeywords: card.keywords,
    structuredKeywordTags: keywordTags.map((tag) => ({
      id: tag.id,
      displayName: tag.displayName,
      category: tag.category,
    })),
  }
}

function summarizeLegality(input: {
  readonly eligibilityOverrides: readonly Array<{
    readonly formatId: string
    readonly eligibilityState: string
    readonly rationale: string | null
  }>
  readonly restrictions: readonly Array<{
    readonly formatId: string
    readonly restrictionType: string
    readonly maxCopies: number | null
    readonly sourceReference: string | null
    readonly versionLabel: string
  }>
  readonly choiceRestrictions: readonly Array<{
    readonly formatId: string
    readonly allowedChoices: number
    readonly sourceReference: string | null
    readonly versionLabel: string
  }>
}) {
  return {
    eligibilityOverrides: input.eligibilityOverrides,
    restrictions: input.restrictions,
    choiceRestrictions: input.choiceRestrictions,
  }
}

function summarizePrinting(input: {
  readonly printingKey: string
  readonly collectorNumber: string
  readonly rarity: string
  readonly artVariant: string | null
  readonly isAlternateArt: boolean
  readonly isPromoVariant: boolean
  readonly product: {
    readonly officialCode: string
    readonly productCategory: string
    readonly productKind: string
  }
}) {
  return {
    printingKey: input.printingKey,
    collectorNumber: input.collectorNumber,
    rarity: input.rarity,
    artVariant: input.artVariant,
    isAlternateArt: input.isAlternateArt,
    isPromoVariant: input.isPromoVariant,
    product: input.product,
  }
}

function summarizeProductPrintings(
  input: readonly Array<{
    readonly printingKey: string
    readonly rarity: string
    readonly artVariant: string | null
    readonly isAlternateArt: boolean
    readonly isPromoVariant: boolean
  }>,
) {
  return {
    totalCount: input.length,
    alternateArtCount: input.filter((printing) => printing.isAlternateArt)
      .length,
    promoCount: input.filter((printing) => printing.isPromoVariant).length,
    items: input.map((printing) => ({
      printingKey: printing.printingKey,
      rarity: printing.rarity,
      artVariant: printing.artVariant,
      isAlternateArt: printing.isAlternateArt,
      isPromoVariant: printing.isPromoVariant,
    })),
  }
}

async function requireCard(
  repository: ReturnType<typeof createCatalogRepository>,
  canonicalKey: string,
) {
  const result = await requireRepoOk(
    repository.getCardEntityByCanonicalKey(canonicalKey),
    `Failed to load ${canonicalKey}.`,
  )

  if (!result) {
    throw new Error(
      `Catalog card ${canonicalKey} is missing. Apply ${enrichmentSnippet} and rerun the Standard expansion scripts first.`,
    )
  }

  return result
}

async function requirePrinting(
  repository: ReturnType<typeof createCatalogRepository>,
  printingKey: string,
) {
  const result = await requireRepoOk(
    repository.getCardPrintingByPrintingKey(printingKey),
    `Failed to load ${printingKey}.`,
  )

  if (!result) {
    throw new Error(`Catalog printing ${printingKey} was not found.`)
  }

  return result
}

function assertKeywordTags(
  keywordTags: readonly Array<{ readonly id: string }>,
  expectedTagIds: readonly string[],
) {
  const actual = keywordTags
    .map((tag) => tag.id)
    .sort((left, right) => left.localeCompare(right))
  const expected = [...expectedTagIds].sort((left, right) =>
    left.localeCompare(right),
  )

  assert(
    actual.length === expected.length &&
      actual.every((value, index) => value === expected[index]),
    `Expected keyword tags ${expected.join(', ')}, received ${actual.join(', ')}.`,
  )
}

function assertAllowedFormats(
  legality: {
    readonly eligibilityOverrides: readonly Array<{
      readonly formatId: string
      readonly eligibilityState: string
    }>
  },
  expectedFormats: readonly string[],
) {
  const actual = legality.eligibilityOverrides
    .filter((entry) => entry.eligibilityState === 'allowed')
    .map((entry) => entry.formatId)
    .sort((left, right) => left.localeCompare(right))
  const expected = [...expectedFormats].sort((left, right) =>
    left.localeCompare(right),
  )

  assert(
    actual.length === expected.length &&
      actual.every((value, index) => value === expected[index]),
    `Expected allowed formats ${expected.join(', ')}, received ${actual.join(', ')}.`,
  )
}

function assertDisallowedFormat(
  legality: {
    readonly eligibilityOverrides: readonly Array<{
      readonly formatId: string
      readonly eligibilityState: string
    }>
  },
  formatId: string,
) {
  const match = legality.eligibilityOverrides.find(
    (entry) => entry.formatId === formatId,
  )

  assert(
    match?.eligibilityState === 'disallowed',
    `Expected ${formatId} to be disallowed.`,
  )
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

function requireMapEntry<TKey, TValue>(
  input: ReadonlyMap<TKey, TValue>,
  key: TKey,
): TValue {
  const value = input.get(key)

  if (value === undefined) {
    throw new Error(`Missing required map entry for ${String(key)}.`)
  }

  return value
}

function runJsonScript(scriptPath: string) {
  const result = runCommand(['corepack', 'pnpm', 'dlx', 'tsx', scriptPath])
  const stdout = result.stdout.trim()
  const jsonStart = stdout.lastIndexOf('\n{')
  const jsonText =
    jsonStart >= 0
      ? stdout.slice(jsonStart + 1)
      : stdout.slice(stdout.indexOf('{'))

  if (!jsonText.startsWith('{')) {
    throw new Error(`Script ${scriptPath} did not emit JSON output.`)
  }

  return JSON.parse(jsonText)
}

function resolveSupabaseAdminConfig() {
  const explicitUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null
  const explicitServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    null
  const envMap = parseEnvOutput(
    runCommand([
      'corepack',
      'pnpm',
      'dlx',
      `supabase@${cliVersion}`,
      'status',
      '-o',
      'env',
    ]).stdout,
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

function runCommand(args: readonly string[]) {
  const result =
    process.platform === 'win32'
      ? spawnSync(
          process.env.ComSpec ?? 'cmd.exe',
          ['/d', '/s', '/c', quoteShellArgs(args)],
          {
            cwd: process.cwd(),
            encoding: 'utf8',
            env: process.env,
            maxBuffer: 20 * 1024 * 1024,
          },
        )
      : spawnSync(args[0]!, args.slice(1), {
          cwd: process.cwd(),
          encoding: 'utf8',
          env: process.env,
          maxBuffer: 20 * 1024 * 1024,
        })

  if (result.error || result.status !== 0) {
    throw new Error(
      result.stderr ||
        result.error?.message ||
        `Command failed: ${args.join(' ')}`,
    )
  }

  return result
}

function quoteShellArgs(args: readonly string[]) {
  return args
    .map((arg) =>
      /[\s"]/u.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg,
    )
    .join(' ')
}

function returnJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

void main().catch((error) => {
  process.stderr.write(
    `Standard data enrichment run failed.\n${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  )
  process.exitCode = 1
})
