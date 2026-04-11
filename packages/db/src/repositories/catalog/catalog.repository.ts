import type { QueryData } from '@supabase/supabase-js'
import type { Tables } from '../../generated/database.types'

import type { DbClient } from '../shared/client'
import { err, mapQueryError, ok, type RepositoryResult } from '../shared/result'
import {
  mapCardEntityRow,
  mapCardPrintingDetailRow,
  mapCardPrintingRow,
  mapProductDetailRow,
  mapProductPrintingRow,
} from './catalog.mappers'
import type {
  CatalogCardChoiceRestrictionRecord,
  CatalogCardEntityRecord,
  CatalogCardEntityListQuery,
  CatalogCardEntityListRecord,
  CatalogCardEligibilityRecord,
  CatalogCardLegalityRecord,
  CatalogCardPrintingDetailRecord,
  CatalogCardPrintingRecord,
  CatalogKeywordTagRecord,
  CatalogCardRestrictionRecord,
  CatalogProductDetailRecord,
  CatalogProductPrintingRecord,
} from './catalog.types'

const cardEntitySelect =
  'id, canonical_key, name, normalized_name, grade, card_type, nation, clan, race, trigger_type, base_power, base_critical, base_shield, keywords, effect_refs'
const productSelect =
  'id, canonical_key, family_id, official_code, name, product_category, product_kind, release_date, region_code, cycle_key'

export interface CatalogRepository {
  listCardEntities(
    query?: Partial<CatalogCardEntityListQuery>,
  ): Promise<RepositoryResult<CatalogCardEntityListRecord>>
  getCardEntityById(
    id: string,
  ): Promise<RepositoryResult<CatalogCardEntityRecord | null>>
  getCardEntityByCanonicalKey(
    canonicalKey: string,
  ): Promise<RepositoryResult<CatalogCardEntityRecord | null>>
  getCardPrintingByPrintingKey(
    printingKey: string,
  ): Promise<RepositoryResult<CatalogCardPrintingDetailRecord | null>>
  getCardLegalityFacts(
    cardEntityId: string,
  ): Promise<RepositoryResult<CatalogCardLegalityRecord>>
  listCardEntityKeywordTags(
    cardEntityId: string,
  ): Promise<RepositoryResult<readonly CatalogKeywordTagRecord[]>>
  getProductDetailByCanonicalKey(
    canonicalKey: string,
  ): Promise<RepositoryResult<CatalogProductDetailRecord | null>>
  listCardPrintings(
    cardEntityId: string,
  ): Promise<RepositoryResult<readonly CatalogCardPrintingRecord[]>>
  listProductPrintings(
    productId: string,
  ): Promise<RepositoryResult<readonly CatalogProductPrintingRecord[]>>
}

export function createCatalogRepository(client: DbClient): CatalogRepository {
  return {
    async listCardEntities(input) {
      const query = normalizeCardEntityListQuery(input)
      const offset = (query.page - 1) * query.pageSize

      if (hasPrintingScopedCatalogFilters(query.filters)) {
        const eligibleCardEntityIdsResult =
          await resolveCardEntityIdsForCatalogFilters(client, query.filters)

        if (!eligibleCardEntityIdsResult.ok) {
          return eligibleCardEntityIdsResult
        }

        if (eligibleCardEntityIdsResult.data.length === 0) {
          return ok(createEmptyCardEntityListRecord(query))
        }

        let request = client
          .schema('catalog')
          .from('card_entities')
          .select(cardEntitySelect, { count: 'exact' })
          .in('id', eligibleCardEntityIdsResult.data)

        request = applyCardEntityListFilters(request, query)
        request = applyCardEntityListSort(request, query.sort)
        request = request.range(offset, offset + query.pageSize - 1)

        const { data, error, count } = await request

        if (error) {
          return err(
            mapQueryError(error, 'Failed to list catalog card entities.'),
          )
        }

        const totalCount = count ?? 0
        const pageCount =
          totalCount > 0 ? Math.ceil(totalCount / query.pageSize) : 1

        return ok({
          items: (data ?? []).map(mapCardEntityRow),
          totalCount,
          page: query.page,
          pageSize: query.pageSize,
          pageCount,
          hasPreviousPage: query.page > 1,
          hasNextPage: query.page < pageCount,
        })
      }

      let request = client
        .schema('catalog')
        .from('card_entities')
        .select(cardEntitySelect, { count: 'exact' })

      request = applyCardEntityListFilters(request, query)
      request = applyCardEntityListSort(request, query.sort)
      request = request.range(offset, offset + query.pageSize - 1)

      const { data, error, count } = await request

      if (error) {
        return err(
          mapQueryError(error, 'Failed to list catalog card entities.'),
        )
      }

      const totalCount = count ?? 0
      const pageCount =
        totalCount > 0 ? Math.ceil(totalCount / query.pageSize) : 1

      return ok({
        items: (data ?? []).map(mapCardEntityRow),
        totalCount,
        page: query.page,
        pageSize: query.pageSize,
        pageCount,
        hasPreviousPage: query.page > 1,
        hasNextPage: query.page < pageCount,
      })
    },

    async getCardEntityById(id) {
      const { data, error } = await client
        .schema('catalog')
        .from('card_entities')
        .select(cardEntitySelect)
        .eq('id', id)
        .maybeSingle()

      if (error) {
        return err(mapQueryError(error, 'Failed to load catalog card entity.'))
      }

      return ok(data ? mapCardEntityRow(data) : null)
    },

    async getCardEntityByCanonicalKey(canonicalKey) {
      const { data, error } = await client
        .schema('catalog')
        .from('card_entities')
        .select(cardEntitySelect)
        .eq('canonical_key', canonicalKey)
        .maybeSingle()

      if (error) {
        return err(mapQueryError(error, 'Failed to load catalog card entity.'))
      }

      return ok(data ? mapCardEntityRow(data) : null)
    },

    async getCardPrintingByPrintingKey(printingKey) {
      const query = client
        .schema('catalog')
        .from('card_printings')
        .select(
          `id, printing_key, card_entity_id, collector_number, rarity, locale_code, region_code, printed_name, art_variant, is_alternate_art, is_promo_variant, product:products(${productSelect}), card:card_entities(${cardEntitySelect})`,
        )
        .eq('printing_key', printingKey)
        .maybeSingle()

      type CardPrintingDetailQueryResult = QueryData<typeof query>

      const { data, error } = await query

      if (error) {
        return err(
          mapQueryError(error, 'Failed to load catalog card printing.'),
        )
      }

      const row: CardPrintingDetailQueryResult | null = data ?? null

      return ok(row ? mapCardPrintingDetailRow(row) : null)
    },

    async getCardLegalityFacts(cardEntityId) {
      const activeRuleProfilesResult = await loadActiveRuleProfiles(client)

      if (!activeRuleProfilesResult.ok) {
        return activeRuleProfilesResult
      }

      const activeRuleProfiles = activeRuleProfilesResult.data

      if (activeRuleProfiles.size === 0) {
        return ok(emptyCatalogCardLegality)
      }

      const activeRuleProfileIds = Array.from(activeRuleProfiles.keys())
      const publishedProductFamilyIdsResult =
        await loadPublishedProductFamilyIdsForCardEntity(client, cardEntityId)

      if (!publishedProductFamilyIdsResult.ok) {
        return publishedProductFamilyIdsResult
      }

      const publishedProductFamilyIds = publishedProductFamilyIdsResult.data
      const supportedProductFamiliesByRuleProfileResult =
        await loadRuleProfileProductFamilies(client, activeRuleProfileIds)

      if (!supportedProductFamiliesByRuleProfileResult.ok) {
        return supportedProductFamiliesByRuleProfileResult
      }

      const supportedProductFamiliesByRuleProfile =
        supportedProductFamiliesByRuleProfileResult.data

      const { data: eligibilityRows, error: eligibilityError } = await client
        .schema('legality')
        .from('rule_profile_card_eligibility_overrides')
        .select('rule_profile_id, eligibility_state, rationale')
        .eq('card_entity_id', cardEntityId)
        .in('rule_profile_id', activeRuleProfileIds)

      if (eligibilityError) {
        return err(
          mapQueryError(
            eligibilityError,
            'Failed to load card format eligibility facts.',
          ),
        )
      }

      const restrictionListsResult = await loadActiveRestrictionLists(
        client,
        activeRuleProfileIds,
      )

      if (!restrictionListsResult.ok) {
        return restrictionListsResult
      }

      const restrictionLists = restrictionListsResult.data
      const restrictionListIds = Array.from(restrictionLists.keys())

      const { data: restrictionRows, error: restrictionError } =
        restrictionListIds.length > 0
          ? await client
              .schema('legality')
              .from('card_restriction_rules')
              .select('restriction_list_id, restriction_type, max_copies, note')
              .eq('card_entity_id', cardEntityId)
              .in('restriction_list_id', restrictionListIds)
          : { data: [], error: null }

      if (restrictionError) {
        return err(
          mapQueryError(
            restrictionError,
            'Failed to load card restriction facts.',
          ),
        )
      }

      const { data: choiceRestrictionLinks, error: choiceLinkError } =
        await client
          .schema('legality')
          .from('choice_restriction_rule_cards')
          .select('choice_restriction_rule_id')
          .eq('card_entity_id', cardEntityId)

      if (choiceLinkError) {
        return err(
          mapQueryError(
            choiceLinkError,
            'Failed to load choice restriction memberships.',
          ),
        )
      }

      const choiceRestrictionRuleIds = Array.from(
        new Set(
          (choiceRestrictionLinks ?? []).map(
            (row) => row.choice_restriction_rule_id,
          ),
        ),
      )

      const { data: choiceRestrictionRows, error: choiceRestrictionError } =
        choiceRestrictionRuleIds.length > 0 && restrictionListIds.length > 0
          ? await client
              .schema('legality')
              .from('choice_restriction_rules')
              .select('id, restriction_list_id, allowed_choices, note')
              .in('id', choiceRestrictionRuleIds)
              .in('restriction_list_id', restrictionListIds)
          : { data: [], error: null }

      if (choiceRestrictionError) {
        return err(
          mapQueryError(
            choiceRestrictionError,
            'Failed to load active choice restriction facts.',
          ),
        )
      }

      const explicitEligibilityByRuleProfileId = new Map<
        string,
        CatalogCardEligibilityRecord
      >(
        (eligibilityRows ?? [])
          .flatMap((row) =>
            mapLegalityEligibilityRow(
              row,
              activeRuleProfiles.get(row.rule_profile_id),
            ),
          )
          .map(
            (entry) =>
              [entry.ruleProfileId, entry] satisfies [
                string,
                CatalogCardEligibilityRecord,
              ],
          ),
      )

      const eligibilityOverrides = Array.from(activeRuleProfiles.values())
        .flatMap((ruleProfile) => {
          const explicitEntry = explicitEligibilityByRuleProfileId.get(
            ruleProfile.id,
          )

          if (explicitEntry) {
            return [explicitEntry]
          }

          const supportedProductFamilies =
            supportedProductFamiliesByRuleProfile.get(ruleProfile.id) ?? []

          if (
            supportedProductFamilies.length === 0 ||
            publishedProductFamilyIds.size === 0
          ) {
            return []
          }

          const hasSupportedPublishedFamily = supportedProductFamilies.some(
            (productFamilyId) => publishedProductFamilyIds.has(productFamilyId),
          )

          return [
            {
              formatId: ruleProfile.formatId,
              formatName: ruleProfile.formatName,
              ruleProfileId: ruleProfile.id,
              ruleProfileName: ruleProfile.displayName,
              eligibilityState: hasSupportedPublishedFamily
                ? 'allowed'
                : 'disallowed',
              rationale: hasSupportedPublishedFamily
                ? 'Published printings exist in product families supported by this format profile.'
                : 'No published printings for this card exist in product families supported by this format profile.',
            } satisfies CatalogCardEligibilityRecord,
          ]
        })
        .sort(compareLegalityFacts)

      const restrictions = (restrictionRows ?? [])
        .flatMap((row) =>
          mapLegalityRestrictionRow(
            row,
            restrictionLists.get(row.restriction_list_id),
            activeRuleProfiles,
          ),
        )
        .sort(compareLegalityFacts)

      const choiceRestrictions = (choiceRestrictionRows ?? [])
        .flatMap((row) =>
          mapLegalityChoiceRestrictionRow(
            row,
            restrictionLists.get(row.restriction_list_id),
            activeRuleProfiles,
          ),
        )
        .sort(compareLegalityFacts)

      return ok({
        eligibilityOverrides,
        restrictions,
        choiceRestrictions,
      })
    },

    async listCardEntityKeywordTags(cardEntityId) {
      const { data, error } = await client
        .schema('catalog')
        .from('card_entity_keyword_tags')
        .select(
          'card_entity_id, keyword:keyword_tags(id, display_name, category, description, sort_order)',
        )
        .eq('card_entity_id', cardEntityId)

      if (error) {
        return err(
          mapQueryError(error, 'Failed to load catalog card keyword tags.'),
        )
      }

      return ok(
        (data ?? [])
          .flatMap((row) =>
            mapKeywordTagLinkRow(row as CardEntityKeywordTagLinkRow),
          )
          .sort(compareKeywordTagRecords),
      )
    },

    async getProductDetailByCanonicalKey(canonicalKey) {
      const query = client
        .schema('catalog')
        .from('products')
        .select(
          `${productSelect}, family:product_families(id, display_name, lineage)`,
        )
        .eq('canonical_key', canonicalKey)
        .maybeSingle()

      type ProductDetailQueryResult = QueryData<typeof query>

      const { data, error } = await query

      if (error) {
        return err(mapQueryError(error, 'Failed to load catalog product.'))
      }

      const row: ProductDetailQueryResult | null = data ?? null

      return ok(row ? mapProductDetailRow(row) : null)
    },

    async listCardPrintings(cardEntityId) {
      const query = client
        .schema('catalog')
        .from('card_printings')
        .select(
          'id, printing_key, card_entity_id, collector_number, rarity, locale_code, region_code, printed_name, art_variant, is_alternate_art, is_promo_variant, product:products(id, canonical_key, family_id, official_code, name, product_category, product_kind, release_date, region_code, cycle_key)',
        )
        .eq('card_entity_id', cardEntityId)
        .order('collector_number', { ascending: true })

      type CardPrintingQueryResult = QueryData<typeof query>

      const { data, error } = await query

      if (error) {
        return err(
          mapQueryError(error, 'Failed to load catalog card printings.'),
        )
      }

      const rows: CardPrintingQueryResult = data ?? []

      return ok(rows.map(mapCardPrintingRow))
    },

    async listProductPrintings(productId) {
      const query = client
        .schema('catalog')
        .from('card_printings')
        .select(
          'id, printing_key, collector_number, rarity, locale_code, region_code, printed_name, art_variant, is_alternate_art, is_promo_variant, card:card_entities(id, canonical_key, name, grade, card_type, trigger_type, nation, clan)',
        )
        .eq('product_id', productId)
        .order('collector_number', { ascending: true })

      type ProductPrintingQueryResult = QueryData<typeof query>

      const { data, error } = await query

      if (error) {
        return err(
          mapQueryError(error, 'Failed to load catalog product printings.'),
        )
      }

      const rows: ProductPrintingQueryResult = data ?? []

      return ok(rows.map(mapProductPrintingRow))
    },
  }
}

type ActiveRuleProfileRow = Pick<
  Tables<{ schema: 'legality' }, 'rule_profiles'>,
  'id' | 'display_name' | 'format_id'
>
type LegalityFormatRow = Pick<
  Tables<{ schema: 'legality' }, 'formats'>,
  'id' | 'display_name'
>
type EligibilityOverrideRow = Pick<
  Tables<{ schema: 'legality' }, 'rule_profile_card_eligibility_overrides'>,
  'rule_profile_id' | 'eligibility_state' | 'rationale'
>
type RestrictionListRow = Pick<
  Tables<{ schema: 'legality' }, 'restriction_lists'>,
  | 'id'
  | 'rule_profile_id'
  | 'version_label'
  | 'effective_from'
  | 'source_reference'
>
type CardRestrictionRow = Pick<
  Tables<{ schema: 'legality' }, 'card_restriction_rules'>,
  'restriction_list_id' | 'restriction_type' | 'max_copies' | 'note'
>
type ChoiceRestrictionRuleRow = Pick<
  Tables<{ schema: 'legality' }, 'choice_restriction_rules'>,
  'id' | 'restriction_list_id' | 'allowed_choices' | 'note'
>
type KeywordTagRow = Pick<
  Tables<{ schema: 'catalog' }, 'keyword_tags'>,
  'id' | 'display_name' | 'category' | 'description' | 'sort_order'
>

interface CardEntityKeywordTagLinkRow {
  readonly card_entity_id: string
  readonly keyword: KeywordTagRow | null
}

interface ActiveRuleProfileInfo {
  readonly id: string
  readonly displayName: string
  readonly formatId: string
  readonly formatName: string
}

const emptyCatalogCardLegality: CatalogCardLegalityRecord = {
  eligibilityOverrides: [],
  restrictions: [],
  choiceRestrictions: [],
}

const defaultCardEntityListQuery: CatalogCardEntityListQuery = {
  searchText: null,
  filters: {
    formatIds: [],
    eras: [],
    nations: [],
    clans: [],
    cardTypes: [],
    triggerTypes: [],
    rarities: [],
    productKeys: [],
  },
  sort: 'name-asc',
  page: 1,
  pageSize: 24,
}

const catalogNationDbValues = new Map<string, string>([
  ['dragon empire', 'Dragon Empire'],
  ['dark states', 'Dark States'],
  ['keter sanctuary', 'Keter Sanctuary'],
  ['stoicheia', 'Stoicheia'],
  ['brandt gate', 'Brandt Gate'],
  ['lyrical monasterio', 'Lyrical Monasterio'],
])

const catalogClanDbValues = new Map<string, string>([
  ['royal paladin', 'Royal Paladin'],
  ['gear chronicle', 'Gear Chronicle'],
])

const catalogEraLineageDbValues = new Map<string, string>([
  ['d', 'standard-lineage'],
  ['v', 'v-lineage'],
  ['premium', 'premium-lineage'],
  ['cross', 'cross-lineage'],
])

function normalizeCardEntityListQuery(
  input?: Partial<CatalogCardEntityListQuery>,
): CatalogCardEntityListQuery {
  return {
    searchText: normalizeSearchText(input?.searchText),
    filters: {
      formatIds: normalizeStringList(input?.filters?.formatIds),
      eras: normalizeStringList(input?.filters?.eras),
      nations: normalizeStringList(input?.filters?.nations),
      clans: normalizeStringList(input?.filters?.clans),
      cardTypes: normalizeStringList(input?.filters?.cardTypes),
      triggerTypes: normalizeStringList(input?.filters?.triggerTypes),
      rarities: normalizeStringList(input?.filters?.rarities),
      productKeys: normalizeStringList(input?.filters?.productKeys),
    },
    sort: normalizeCardEntityListSort(input?.sort),
    page: normalizePositiveInteger(
      input?.page,
      defaultCardEntityListQuery.page,
    ),
    pageSize: Math.min(
      normalizePositiveInteger(
        input?.pageSize,
        defaultCardEntityListQuery.pageSize,
      ),
      96,
    ),
  }
}

function normalizeSearchText(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, ' ') ?? ''

  return normalized.length > 0 ? normalized : null
}

function normalizeStringList(
  values: readonly string[] | undefined,
): readonly string[] {
  const normalized = new Set<string>()

  for (const value of values ?? []) {
    const candidate = value.trim().toLowerCase()

    if (candidate.length > 0) {
      normalized.add(candidate)
    }
  }

  return Array.from(normalized)
}

function normalizeCardEntityListSort(
  value: CatalogCardEntityListQuery['sort'] | undefined,
): CatalogCardEntityListQuery['sort'] {
  return value === 'grade-asc' || value === 'relevance' ? value : 'name-asc'
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  return Number.isInteger(value) && value && value > 0 ? value : fallback
}

function mapNationFilterToDbValue(value: string): string {
  return catalogNationDbValues.get(value) ?? value
}

function mapClanFilterToDbValue(value: string): string {
  return (
    catalogClanDbValues.get(value) ??
    value
      .split(' ')
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(' ')
  )
}

function mapEraFilterToProductFamilyLineage(value: string): string {
  return catalogEraLineageDbValues.get(value) ?? value
}

function mapRarityFilterToDbValue(value: string): string {
  return value.toUpperCase()
}

function hasPrintingScopedCatalogFilters(
  filters: CatalogCardEntityListQuery['filters'],
): boolean {
  return (
    filters.formatIds.length > 0 ||
    filters.eras.length > 0 ||
    filters.rarities.length > 0 ||
    filters.productKeys.length > 0
  )
}

function applyCardEntityListFilters<
  TRequest extends {
    ilike(column: string, value: string): TRequest
    in(column: string, value: readonly unknown[]): TRequest
  },
>(request: TRequest, query: CatalogCardEntityListQuery): TRequest {
  let nextRequest = request

  if (query.searchText) {
    nextRequest = nextRequest.ilike(
      'normalized_name',
      `%${query.searchText.toLowerCase()}%`,
    )
  }

  if (query.filters.nations.length > 0) {
    nextRequest = nextRequest.in(
      'nation',
      query.filters.nations.map(mapNationFilterToDbValue),
    )
  }

  if (query.filters.clans.length > 0) {
    nextRequest = nextRequest.in(
      'clan',
      query.filters.clans.map(mapClanFilterToDbValue),
    )
  }

  if (query.filters.cardTypes.length > 0) {
    nextRequest = nextRequest.in('card_type', query.filters.cardTypes)
  }

  if (query.filters.triggerTypes.length > 0) {
    nextRequest = nextRequest.in('trigger_type', query.filters.triggerTypes)
  }

  return nextRequest
}

function applyCardEntityListSort<
  TRequest extends {
    order(
      column: string,
      options?: {
        ascending?: boolean
      },
    ): TRequest
  },
>(request: TRequest, sort: CatalogCardEntityListQuery['sort']): TRequest {
  if (sort === 'grade-asc') {
    return request
      .order('grade', { ascending: true })
      .order('normalized_name', { ascending: true })
  }

  // "relevance" is currently a search-aware fallback, not a dedicated ranking engine.
  return request.order('normalized_name', { ascending: true })
}

function createEmptyCardEntityListRecord(
  query: CatalogCardEntityListQuery,
): CatalogCardEntityListRecord {
  return {
    items: [],
    totalCount: 0,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: 1,
    hasPreviousPage: query.page > 1,
    hasNextPage: false,
  }
}

type ActiveFormatRuleProfileRow = Pick<
  Tables<{ schema: 'legality' }, 'rule_profiles'>,
  'id' | 'format_id'
>
type RuleProfileProductFamilyRow = Pick<
  Tables<{ schema: 'legality' }, 'rule_profile_product_families'>,
  'product_family_id'
>
type CatalogProductFamilyIdRow = Pick<
  Tables<{ schema: 'catalog' }, 'product_families'>,
  'id'
>
type CatalogProductIdRow = Pick<Tables<{ schema: 'catalog' }, 'products'>, 'id'>
type CatalogProductFamilyMembershipRow = Pick<
  Tables<{ schema: 'catalog' }, 'products'>,
  'family_id'
>
type ProductPrintingCardEntityRow = Pick<
  Tables<{ schema: 'catalog' }, 'card_printings'>,
  'card_entity_id'
>
type CardPrintingProductIdRow = Pick<
  Tables<{ schema: 'catalog' }, 'card_printings'>,
  'product_id'
>

async function resolveCardEntityIdsForCatalogFilters(
  client: DbClient,
  filters: CatalogCardEntityListQuery['filters'],
): Promise<RepositoryResult<readonly string[]>> {
  const productIdsResult = await resolveProductIdsForCatalogFilters(
    client,
    filters,
  )

  if (!productIdsResult.ok) {
    return productIdsResult
  }

  const resolvedProductIds = productIdsResult.data

  if (resolvedProductIds !== null && resolvedProductIds.length === 0) {
    return ok([])
  }

  let request = client
    .schema('catalog')
    .from('card_printings')
    .select('card_entity_id')

  if (resolvedProductIds !== null) {
    request = request.in('product_id', resolvedProductIds)
  }

  if (filters.rarities.length > 0) {
    request = request.in(
      'rarity',
      filters.rarities.map(mapRarityFilterToDbValue),
    )
  }

  const { data: printingRows, error: printingError } = await request

  if (printingError) {
    return err(
      mapQueryError(
        printingError,
        'Failed to resolve card printings for catalog filters.',
      ),
    )
  }

  return ok(
    Array.from(
      new Set(
        (printingRows ?? []).map(
          (row: ProductPrintingCardEntityRow) => row.card_entity_id,
        ),
      ),
    ),
  )
}

async function resolveProductIdsForCatalogFilters(
  client: DbClient,
  filters: CatalogCardEntityListQuery['filters'],
): Promise<RepositoryResult<readonly string[] | null>> {
  const familyIdsResult = await resolveProductFamilyIdsForCatalogFilters(
    client,
    filters,
  )

  if (!familyIdsResult.ok) {
    return familyIdsResult
  }

  const familyIds = familyIdsResult.data

  if (familyIds !== null && familyIds.length === 0) {
    return ok([])
  }

  if (familyIds === null && filters.productKeys.length === 0) {
    return ok(null)
  }

  let request = client.schema('catalog').from('products').select('id')

  if (familyIds !== null) {
    request = request.in('family_id', familyIds)
  }

  if (filters.productKeys.length > 0) {
    request = request.in('canonical_key', filters.productKeys)
  }

  const { data: productRows, error: productError } = await request

  if (productError) {
    return err(
      mapQueryError(
        productError,
        'Failed to resolve products for catalog filters.',
      ),
    )
  }

  return ok(
    Array.from(
      new Set((productRows ?? []).map((row: CatalogProductIdRow) => row.id)),
    ),
  )
}

async function resolveProductFamilyIdsForCatalogFilters(
  client: DbClient,
  filters: CatalogCardEntityListQuery['filters'],
): Promise<RepositoryResult<readonly string[] | null>> {
  let familyIds: readonly string[] | null = null

  if (filters.formatIds.length > 0) {
    const formatFamilyIdsResult = await resolveProductFamilyIdsForFormats(
      client,
      filters.formatIds,
    )

    if (!formatFamilyIdsResult.ok) {
      return formatFamilyIdsResult
    }

    familyIds = formatFamilyIdsResult.data
  }

  if (filters.eras.length > 0) {
    const eraFamilyIdsResult = await resolveProductFamilyIdsForEras(
      client,
      filters.eras,
    )

    if (!eraFamilyIdsResult.ok) {
      return eraFamilyIdsResult
    }

    familyIds =
      familyIds === null
        ? eraFamilyIdsResult.data
        : intersectStringLists(familyIds, eraFamilyIdsResult.data)
  }

  return ok(familyIds)
}

async function resolveProductFamilyIdsForFormats(
  client: DbClient,
  formatIds: readonly string[],
): Promise<RepositoryResult<readonly string[]>> {
  const uniqueFormatIds = Array.from(new Set(formatIds))

  if (uniqueFormatIds.length === 0) {
    return ok([])
  }

  const { data: ruleProfileRows, error: ruleProfileError } = await client
    .schema('legality')
    .from('rule_profiles')
    .select('id, format_id')
    .eq('is_active', true)
    .in('format_id', uniqueFormatIds)

  if (ruleProfileError) {
    return err(
      mapQueryError(
        ruleProfileError,
        'Failed to resolve active catalog formats.',
      ),
    )
  }

  const activeRuleProfiles: ActiveFormatRuleProfileRow[] = ruleProfileRows ?? []
  const activeRuleProfileIds = Array.from(
    new Set(activeRuleProfiles.map((row) => row.id)),
  )

  if (activeRuleProfileIds.length === 0) {
    return ok([])
  }

  const { data: productFamilyRows, error: productFamilyError } = await client
    .schema('legality')
    .from('rule_profile_product_families')
    .select('product_family_id')
    .in('rule_profile_id', activeRuleProfileIds)

  if (productFamilyError) {
    return err(
      mapQueryError(
        productFamilyError,
        'Failed to resolve supported product families for catalog formats.',
      ),
    )
  }

  return ok(
    Array.from(
      new Set(
        (productFamilyRows ?? []).map(
          (row: RuleProfileProductFamilyRow) => row.product_family_id,
        ),
      ),
    ),
  )
}

async function resolveProductFamilyIdsForEras(
  client: DbClient,
  eras: readonly string[],
): Promise<RepositoryResult<readonly string[]>> {
  const lineages = Array.from(
    new Set(eras.map(mapEraFilterToProductFamilyLineage)),
  )

  if (lineages.length === 0) {
    return ok([])
  }

  const { data, error } = await client
    .schema('catalog')
    .from('product_families')
    .select('id')
    .in('lineage', lineages)

  if (error) {
    return err(
      mapQueryError(
        error,
        'Failed to resolve product families for catalog era filters.',
      ),
    )
  }

  return ok(
    Array.from(
      new Set((data ?? []).map((row: CatalogProductFamilyIdRow) => row.id)),
    ),
  )
}

function intersectStringLists(
  left: readonly string[],
  right: readonly string[],
): readonly string[] {
  const rightSet = new Set(right)

  return Array.from(new Set(left.filter((value) => rightSet.has(value)))).sort()
}

async function loadActiveRuleProfiles(
  client: DbClient,
): Promise<RepositoryResult<ReadonlyMap<string, ActiveRuleProfileInfo>>> {
  const { data: profileRows, error: profileError } = await client
    .schema('legality')
    .from('rule_profiles')
    .select('id, display_name, format_id')
    .eq('is_active', true)

  if (profileError) {
    return err(
      mapQueryError(profileError, 'Failed to load active rule profiles.'),
    )
  }

  const rows: ActiveRuleProfileRow[] = profileRows ?? []

  if (rows.length === 0) {
    return ok(new Map())
  }

  const { data: formatRows, error: formatError } = await client
    .schema('legality')
    .from('formats')
    .select('id, display_name')
    .in('id', Array.from(new Set(rows.map((row) => row.format_id))))

  if (formatError) {
    return err(mapQueryError(formatError, 'Failed to load legality formats.'))
  }

  const formatMap = new Map<string, LegalityFormatRow>(
    (formatRows ?? []).map(
      (row) => [row.id, row] satisfies [string, LegalityFormatRow],
    ),
  )
  const profileMap = new Map<string, ActiveRuleProfileInfo>()

  for (const row of rows) {
    const format = formatMap.get(row.format_id)

    if (!format) {
      return err({
        code: 'query-failed',
        message: 'Failed to resolve an active legality format.',
        details: `Rule profile ${row.id} references missing format ${row.format_id}.`,
      })
    }

    profileMap.set(row.id, {
      id: row.id,
      displayName: row.display_name,
      formatId: format.id,
      formatName: format.display_name,
    })
  }

  return ok(profileMap)
}

async function loadActiveRestrictionLists(
  client: DbClient,
  ruleProfileIds: readonly string[],
): Promise<RepositoryResult<ReadonlyMap<string, RestrictionListRow>>> {
  if (ruleProfileIds.length === 0) {
    return ok(new Map())
  }

  const { data, error } = await client
    .schema('legality')
    .from('restriction_lists')
    .select(
      'id, rule_profile_id, version_label, effective_from, source_reference',
    )
    .eq('is_active', true)
    .in('rule_profile_id', Array.from(new Set(ruleProfileIds)))

  if (error) {
    return err(
      mapQueryError(error, 'Failed to load active legality restriction lists.'),
    )
  }

  return ok(
    new Map(
      (data ?? []).map(
        (row) => [row.id, row] satisfies [string, RestrictionListRow],
      ),
    ),
  )
}

async function loadPublishedProductFamilyIdsForCardEntity(
  client: DbClient,
  cardEntityId: string,
): Promise<RepositoryResult<ReadonlySet<string>>> {
  const { data: printingRows, error: printingError } = await client
    .schema('catalog')
    .from('card_printings')
    .select('product_id')
    .eq('card_entity_id', cardEntityId)

  if (printingError) {
    return err(
      mapQueryError(
        printingError,
        'Failed to resolve published printings for card legality facts.',
      ),
    )
  }

  const productIds = Array.from(
    new Set(
      (printingRows ?? []).map(
        (row: CardPrintingProductIdRow) => row.product_id,
      ),
    ),
  )

  if (productIds.length === 0) {
    return ok(new Set())
  }

  const { data: productRows, error: productError } = await client
    .schema('catalog')
    .from('products')
    .select('family_id')
    .in('id', productIds)

  if (productError) {
    return err(
      mapQueryError(
        productError,
        'Failed to resolve published product families for card legality facts.',
      ),
    )
  }

  return ok(
    new Set(
      (productRows ?? []).map(
        (row: CatalogProductFamilyMembershipRow) => row.family_id,
      ),
    ),
  )
}

async function loadRuleProfileProductFamilies(
  client: DbClient,
  ruleProfileIds: readonly string[],
): Promise<RepositoryResult<ReadonlyMap<string, readonly string[]>>> {
  if (ruleProfileIds.length === 0) {
    return ok(new Map())
  }

  const { data, error } = await client
    .schema('legality')
    .from('rule_profile_product_families')
    .select('rule_profile_id, product_family_id')
    .in('rule_profile_id', Array.from(new Set(ruleProfileIds)))

  if (error) {
    return err(
      mapQueryError(
        error,
        'Failed to resolve supported product families for card legality facts.',
      ),
    )
  }

  const familiesByRuleProfile = new Map<string, string[]>()

  for (const row of data ?? []) {
    const families = familiesByRuleProfile.get(row.rule_profile_id) ?? []
    families.push(row.product_family_id)
    familiesByRuleProfile.set(row.rule_profile_id, families)
  }

  return ok(familiesByRuleProfile)
}

function mapLegalityEligibilityRow(
  row: EligibilityOverrideRow,
  ruleProfile: ActiveRuleProfileInfo | undefined,
): readonly CatalogCardEligibilityRecord[] {
  if (!ruleProfile) {
    return []
  }

  return [
    {
      formatId: ruleProfile.formatId,
      formatName: ruleProfile.formatName,
      ruleProfileId: ruleProfile.id,
      ruleProfileName: ruleProfile.displayName,
      eligibilityState:
        row.eligibility_state as CatalogCardEligibilityRecord['eligibilityState'],
      rationale: row.rationale,
    },
  ]
}

function mapLegalityRestrictionRow(
  row: CardRestrictionRow,
  restrictionList: RestrictionListRow | undefined,
  activeRuleProfiles: ReadonlyMap<string, ActiveRuleProfileInfo>,
): readonly CatalogCardRestrictionRecord[] {
  if (!restrictionList) {
    return []
  }

  const ruleProfile = activeRuleProfiles.get(restrictionList.rule_profile_id)

  if (!ruleProfile) {
    return []
  }

  return [
    {
      formatId: ruleProfile.formatId,
      formatName: ruleProfile.formatName,
      ruleProfileId: ruleProfile.id,
      ruleProfileName: ruleProfile.displayName,
      restrictionType: row.restriction_type,
      maxCopies: row.max_copies,
      note: row.note,
      sourceReference: restrictionList.source_reference,
      effectiveFrom: restrictionList.effective_from,
      versionLabel: restrictionList.version_label,
    },
  ]
}

function mapLegalityChoiceRestrictionRow(
  row: ChoiceRestrictionRuleRow,
  restrictionList: RestrictionListRow | undefined,
  activeRuleProfiles: ReadonlyMap<string, ActiveRuleProfileInfo>,
): readonly CatalogCardChoiceRestrictionRecord[] {
  if (!restrictionList) {
    return []
  }

  const ruleProfile = activeRuleProfiles.get(restrictionList.rule_profile_id)

  if (!ruleProfile) {
    return []
  }

  return [
    {
      formatId: ruleProfile.formatId,
      formatName: ruleProfile.formatName,
      ruleProfileId: ruleProfile.id,
      ruleProfileName: ruleProfile.displayName,
      allowedChoices: row.allowed_choices,
      note: row.note,
      sourceReference: restrictionList.source_reference,
      effectiveFrom: restrictionList.effective_from,
      versionLabel: restrictionList.version_label,
    },
  ]
}

function compareLegalityFacts<
  TValue extends { formatName: string; ruleProfileName: string },
>(left: TValue, right: TValue): number {
  return (
    left.formatName.localeCompare(right.formatName) ||
    left.ruleProfileName.localeCompare(right.ruleProfileName)
  )
}

function mapKeywordTagLinkRow(
  row: CardEntityKeywordTagLinkRow,
): readonly CatalogKeywordTagRecord[] {
  if (!row.keyword) {
    return []
  }

  return [
    {
      id: row.keyword.id,
      displayName: row.keyword.display_name,
      category: row.keyword.category as CatalogKeywordTagRecord['category'],
      description: row.keyword.description,
      sortOrder: row.keyword.sort_order,
    },
  ]
}

function compareKeywordTagRecords(
  left: CatalogKeywordTagRecord,
  right: CatalogKeywordTagRecord,
): number {
  return (
    left.sortOrder - right.sortOrder ||
    left.displayName.localeCompare(right.displayName) ||
    left.id.localeCompare(right.id)
  )
}
