import type {
  CardType,
  Clan,
  ConstructionBasis,
  FormatId,
  Nation,
  TriggerType,
} from '@web-vg/shared'

import {
  type CatalogEraKey,
  type CatalogSearchText,
  type ProductCanonicalKey,
  normalizeCatalogEraKey,
  normalizeCatalogSearchText,
  normalizeProductCanonicalKey,
} from './catalog-identifiers'
import type { ProductLineage, Rarity } from './products'

export type CatalogReadPerspective = 'card-entity' | 'card-printing'

export type CatalogSortKey =
  | 'relevance'
  | 'name-asc'
  | 'grade-asc'
  | 'release-date-desc'

export type CatalogFacetKey =
  | 'format'
  | 'era'
  | 'nation'
  | 'clan'
  | 'cardType'
  | 'triggerType'
  | 'rarity'
  | 'product'

export type CatalogIdentityFilterKey = 'nation' | 'clan'

export interface CatalogFormatFilterProfile {
  readonly id: FormatId
  readonly label: string
  readonly constructionBasis: ConstructionBasis
  readonly preferredIdentityFilter: CatalogIdentityFilterKey
  readonly applicableFilterKeys: readonly CatalogFacetKey[]
}

export interface CatalogEraFilterProfile {
  readonly id: CatalogEraKey
  readonly label: string
  readonly productLineages: readonly ProductLineage[]
}

export interface CatalogFilterModel {
  readonly formatIds: readonly FormatId[]
  readonly eras: readonly CatalogEraKey[]
  readonly nations: readonly Nation[]
  readonly clans: readonly Clan[]
  readonly cardTypes: readonly CardType[]
  readonly triggerTypes: readonly TriggerType[]
  readonly rarities: readonly Rarity[]
  readonly productKeys: readonly ProductCanonicalKey[]
}

export interface CatalogQueryWindow {
  readonly page: number
  readonly pageSize: number
}

export interface CatalogQuery {
  readonly searchText: CatalogSearchText | null
  readonly perspective: CatalogReadPerspective
  readonly filters: CatalogFilterModel
  readonly sort: CatalogSortKey
  readonly window: CatalogQueryWindow
}

export interface CatalogFacetValue<TValue extends string = string> {
  readonly value: TValue
  readonly label: string
  readonly count: number
  readonly selected: boolean
}

export interface CatalogFacet<
  TKey extends CatalogFacetKey = CatalogFacetKey,
  TValue extends string = string,
> {
  readonly key: TKey
  readonly label: string
  readonly values: readonly CatalogFacetValue<TValue>[]
}

export interface CatalogFacetResult {
  readonly perspective: CatalogReadPerspective
  readonly facets: readonly CatalogFacet[]
}

export interface CatalogQueryInput {
  readonly searchText?: string | null
  readonly perspective?: string | null
  readonly filters?: Partial<{
    formatIds: readonly string[]
    eras: readonly string[]
    nations: readonly string[]
    clans: readonly string[]
    cardTypes: readonly string[]
    triggerTypes: readonly string[]
    rarities: readonly string[]
    productKeys: readonly string[]
  }> | null
  readonly sort?: string | null
  readonly window?: Partial<{
    page: number
    pageSize: number
  }> | null
}

const supportedPerspectives = new Set<CatalogReadPerspective>([
  'card-entity',
  'card-printing',
])

const supportedSorts = new Set<CatalogSortKey>([
  'relevance',
  'name-asc',
  'grade-asc',
  'release-date-desc',
])

const supportedCardTypes = [
  'normal-unit',
  'trigger-unit',
  'normal-order',
  'blitz-order',
  'set-order',
  'token',
] as const satisfies readonly CardType[]

const supportedTriggerTypes = [
  'critical',
  'draw',
  'front',
  'heal',
  'stand',
  'over',
] as const satisfies readonly TriggerType[]

export const defaultCatalogPerspective: CatalogReadPerspective = 'card-entity'
export const defaultCatalogPage = 1
export const defaultCatalogPageSize = 24
export const maxCatalogPageSize = 96
export const catalogEraFilterProfiles: readonly CatalogEraFilterProfile[] = [
  {
    id: 'd' as CatalogEraKey,
    label: 'D Era',
    productLineages: ['standard-lineage'],
  },
  {
    id: 'v' as CatalogEraKey,
    label: 'V Era',
    productLineages: ['v-lineage'],
  },
  {
    id: 'premium' as CatalogEraKey,
    label: 'Premium Era',
    productLineages: ['premium-lineage'],
  },
  {
    id: 'cross' as CatalogEraKey,
    label: 'Cross-lineage',
    productLineages: ['cross-lineage'],
  },
] as const
export const catalogFormatFilterProfiles: readonly CatalogFormatFilterProfile[] =
  [
    {
      id: 'standard' as FormatId,
      label: 'Standard',
      constructionBasis: 'nation-based',
      preferredIdentityFilter: 'nation',
      applicableFilterKeys: [
        'format',
        'era',
        'nation',
        'cardType',
        'triggerType',
        'rarity',
        'product',
      ],
    },
    {
      id: 'v-premium' as FormatId,
      label: 'V Premium',
      constructionBasis: 'clan-based',
      preferredIdentityFilter: 'clan',
      applicableFilterKeys: [
        'format',
        'era',
        'clan',
        'cardType',
        'triggerType',
        'rarity',
        'product',
      ],
    },
    {
      id: 'premium' as FormatId,
      label: 'Premium',
      constructionBasis: 'clan-based',
      preferredIdentityFilter: 'clan',
      applicableFilterKeys: [
        'format',
        'era',
        'clan',
        'cardType',
        'triggerType',
        'rarity',
        'product',
      ],
    },
  ]

const defaultCatalogApplicableFilterKeys = [
  'format',
  'era',
  'nation',
  'clan',
  'cardType',
  'triggerType',
  'rarity',
  'product',
] as const satisfies readonly CatalogFacetKey[]

export function createEmptyCatalogFilters(): CatalogFilterModel {
  return {
    formatIds: [],
    eras: [],
    nations: [],
    clans: [],
    cardTypes: [],
    triggerTypes: [],
    rarities: [],
    productKeys: [],
  }
}

export function getDefaultCatalogSort(
  perspective: CatalogReadPerspective,
  searchText: CatalogSearchText | null,
): CatalogSortKey {
  if (searchText) {
    return 'relevance'
  }

  if (perspective === 'card-printing') {
    return 'release-date-desc'
  }

  return 'name-asc'
}

export function getCatalogFormatFilterProfile(
  formatId: FormatId | null | undefined,
): CatalogFormatFilterProfile | null {
  return (
    catalogFormatFilterProfiles.find((profile) => profile.id === formatId) ??
    null
  )
}

export function getCatalogEraFilterProfile(
  era: CatalogEraKey | null | undefined,
): CatalogEraFilterProfile | null {
  return catalogEraFilterProfiles.find((profile) => profile.id === era) ?? null
}

export function getCatalogActiveFormatFilterProfile(
  formatIds: readonly FormatId[],
): CatalogFormatFilterProfile | null {
  if (formatIds.length !== 1) {
    return null
  }

  return getCatalogFormatFilterProfile(formatIds[0])
}

export function getCatalogApplicableFilterKeys(
  formatIds: readonly FormatId[],
): readonly CatalogFacetKey[] {
  const activeFormat = getCatalogActiveFormatFilterProfile(formatIds)

  return (
    activeFormat?.applicableFilterKeys ?? defaultCatalogApplicableFilterKeys
  )
}

export function isCatalogFilterKeyApplicable(
  filterKey: CatalogFacetKey,
  formatIds: readonly FormatId[],
): boolean {
  return getCatalogApplicableFilterKeys(formatIds).includes(filterKey)
}

export function resolveCatalogEraProductLineages(
  eras: readonly CatalogEraKey[],
): readonly ProductLineage[] {
  const lineages = new Set<ProductLineage>()

  for (const era of eras) {
    const profile = getCatalogEraFilterProfile(era)

    for (const lineage of profile?.productLineages ?? []) {
      lineages.add(lineage)
    }
  }

  return Array.from(lineages).sort()
}

export function normalizeCatalogPerspective(
  value: string | null | undefined,
): CatalogReadPerspective {
  return supportedPerspectives.has(value as CatalogReadPerspective)
    ? (value as CatalogReadPerspective)
    : defaultCatalogPerspective
}

export function normalizeCatalogSort(
  value: string | null | undefined,
  perspective: CatalogReadPerspective,
  searchText: CatalogSearchText | null,
): CatalogSortKey {
  if (!value || !supportedSorts.has(value as CatalogSortKey)) {
    return getDefaultCatalogSort(perspective, searchText)
  }

  if (value === 'relevance' && !searchText) {
    return getDefaultCatalogSort(perspective, searchText)
  }

  return value as CatalogSortKey
}

export function normalizeCatalogQueryWindow(
  input: CatalogQueryInput['window'],
): CatalogQueryWindow {
  const page = normalizePositiveInteger(input?.page, defaultCatalogPage)
  const pageSize = normalizePositiveInteger(
    input?.pageSize,
    defaultCatalogPageSize,
  )

  return {
    page,
    pageSize: Math.min(pageSize, maxCatalogPageSize),
  }
}

export function getCatalogWindowOffset(window: CatalogQueryWindow): number {
  return (window.page - 1) * window.pageSize
}

export function normalizeCatalogQuery(
  input: CatalogQueryInput = {},
): CatalogQuery {
  const searchText = input.searchText
    ? normalizeCatalogSearchText(input.searchText)
    : null
  const perspective = normalizeCatalogPerspective(input.perspective)
  const filters = normalizeCatalogFilters(input.filters)

  return {
    searchText,
    perspective,
    filters,
    sort: normalizeCatalogSort(input.sort, perspective, searchText),
    window: normalizeCatalogQueryWindow(input.window),
  }
}

function normalizeCatalogFilters(
  filters: CatalogQueryInput['filters'],
): CatalogFilterModel {
  return applyFormatAwareCatalogFilterBehavior({
    formatIds: normalizeStringList(filters?.formatIds, normalizeFormatId),
    eras: normalizeStringList(filters?.eras, normalizeSupportedCatalogEraKey),
    nations: normalizeStringList(filters?.nations, normalizeNation),
    clans: normalizeStringList(filters?.clans, normalizeClan),
    cardTypes: normalizeClosedList(filters?.cardTypes, supportedCardTypes),
    triggerTypes: normalizeClosedList(
      filters?.triggerTypes,
      supportedTriggerTypes,
    ),
    rarities: normalizeStringList(filters?.rarities, normalizeRarity),
    productKeys: normalizeStringList(
      filters?.productKeys,
      normalizeProductCanonicalKey,
    ),
  })
}

export function hasActiveCatalogFilters(filters: CatalogFilterModel): boolean {
  return (
    filters.formatIds.length > 0 ||
    filters.eras.length > 0 ||
    filters.nations.length > 0 ||
    filters.clans.length > 0 ||
    filters.cardTypes.length > 0 ||
    filters.triggerTypes.length > 0 ||
    filters.rarities.length > 0 ||
    filters.productKeys.length > 0
  )
}

export function hasActiveCatalogQueryState(query: CatalogQuery): boolean {
  return (
    query.searchText !== null ||
    hasActiveCatalogFilters(query.filters) ||
    query.perspective !== defaultCatalogPerspective ||
    query.sort !== getDefaultCatalogSort(query.perspective, query.searchText) ||
    query.window.page !== defaultCatalogPage ||
    query.window.pageSize !== defaultCatalogPageSize
  )
}

export function areCatalogQueriesEquivalent(
  left: CatalogQuery,
  right: CatalogQuery,
  options?: {
    readonly ignoreWindow?: boolean
  },
): boolean {
  const ignoreWindow = options?.ignoreWindow ?? false

  return (
    left.searchText === right.searchText &&
    left.perspective === right.perspective &&
    left.sort === right.sort &&
    areCatalogFilterModelsEquivalent(left.filters, right.filters) &&
    (ignoreWindow ||
      areCatalogQueryWindowsEquivalent(left.window, right.window))
  )
}

export function shouldResetCatalogPagination(
  previous: CatalogQuery,
  next: CatalogQuery,
): boolean {
  return !areCatalogQueriesEquivalent(previous, next, { ignoreWindow: true })
}

function normalizeStringList<TValue extends string>(
  values: readonly string[] | undefined,
  normalizeValue?: (value: string) => TValue | null,
): readonly TValue[] {
  const normalized = new Set<TValue>()

  for (const value of values ?? []) {
    const candidate = normalizeValue
      ? normalizeValue(value)
      : (normalizeOpenFilterValue(value)?.toLowerCase() as TValue | null)

    if (candidate) {
      normalized.add(candidate)
    }
  }

  return Array.from(normalized).sort()
}

function normalizeClosedList<TValue extends string>(
  values: readonly string[] | undefined,
  order: readonly TValue[],
): readonly TValue[] {
  const normalized = new Set<TValue>()

  for (const value of values ?? []) {
    const candidate = normalizeOpenFilterValue(value)
    const typedCandidate = order.find((item) => item === candidate)

    if (typedCandidate) {
      normalized.add(typedCandidate)
    }
  }

  return order.filter((value) => normalized.has(value))
}

function normalizeOpenFilterValue(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ')

  return normalized.length > 0 ? normalized : null
}

function normalizePositiveInteger(
  value: number | null | undefined,
  fallback: number,
): number {
  return Number.isInteger(value) && value && value > 0 ? value : fallback
}

function normalizeFormatId(value: string): FormatId | null {
  const normalized = normalizeOpenFilterValue(value)

  return normalized ? (normalized as FormatId) : null
}

function normalizeSupportedCatalogEraKey(value: string): CatalogEraKey | null {
  const normalized = normalizeCatalogEraKey(value)

  return normalized && getCatalogEraFilterProfile(normalized)
    ? normalized
    : null
}

function normalizeNation(value: string): Nation | null {
  const normalized = normalizeOpenFilterValue(value)

  return normalized ? (normalized as Nation) : null
}

function normalizeClan(value: string): Clan | null {
  const normalized = normalizeOpenFilterValue(value)

  return normalized ? (normalized as Clan) : null
}

function normalizeRarity(value: string): Rarity | null {
  const normalized = normalizeOpenFilterValue(value)

  return normalized ? (normalized as Rarity) : null
}

function applyFormatAwareCatalogFilterBehavior(
  filters: CatalogFilterModel,
): CatalogFilterModel {
  const activeFormat = getCatalogActiveFormatFilterProfile(filters.formatIds)

  if (!activeFormat) {
    return filters
  }

  if (activeFormat.preferredIdentityFilter === 'nation') {
    return {
      ...filters,
      clans: [],
    }
  }

  return {
    ...filters,
    nations: [],
  }
}

function areCatalogFilterModelsEquivalent(
  left: CatalogFilterModel,
  right: CatalogFilterModel,
): boolean {
  return (
    areStringListsEquivalent(left.formatIds, right.formatIds) &&
    areStringListsEquivalent(left.eras, right.eras) &&
    areStringListsEquivalent(left.nations, right.nations) &&
    areStringListsEquivalent(left.clans, right.clans) &&
    areStringListsEquivalent(left.cardTypes, right.cardTypes) &&
    areStringListsEquivalent(left.triggerTypes, right.triggerTypes) &&
    areStringListsEquivalent(left.rarities, right.rarities) &&
    areStringListsEquivalent(left.productKeys, right.productKeys)
  )
}

function areCatalogQueryWindowsEquivalent(
  left: CatalogQueryWindow,
  right: CatalogQueryWindow,
): boolean {
  return left.page === right.page && left.pageSize === right.pageSize
}

function areStringListsEquivalent(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}
