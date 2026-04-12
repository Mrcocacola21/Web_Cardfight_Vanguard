import {
  cardEntityLookupByCanonicalKey,
  normalizeCanonicalCardKey,
  type CatalogQuery,
} from '@web-vg/catalog'
import { createCatalogRepository, type RepositoryResult } from '@web-vg/db'
import type {
  CatalogCardEntityListRecord,
  CatalogCardPrintingRecord,
} from '@web-vg/db/repositories/catalog'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type {
  CatalogCardDetailViewModel,
  CatalogRelatedProductRecord,
} from '@/features/catalog/catalog-detail.types'

export type CatalogCardDetailData = CatalogCardDetailViewModel

export async function listCatalogCards(
  query: CatalogQuery,
): Promise<RepositoryResult<CatalogCardEntityListRecord>> {
  const client = await createSupabaseServerClient()
  const repository = createCatalogRepository(client)

  return repository.listCardEntities({
    searchText: query.searchText,
    filters: {
      formatIds: query.filters.formatIds,
      eras: query.filters.eras,
      nations: query.filters.nations,
      clans: query.filters.clans,
      cardTypes: query.filters.cardTypes,
      triggerTypes: query.filters.triggerTypes,
      rarities: query.filters.rarities,
      productKeys: query.filters.productKeys,
    },
    sort: query.sort === 'release-date-desc' ? 'name-asc' : query.sort,
    page: query.window.page,
    pageSize: query.window.pageSize,
  })
}

export async function getCatalogCardDetail(
  cardKey: string,
): Promise<RepositoryResult<CatalogCardDetailData | null>> {
  const normalizedCardKey = normalizeCanonicalCardKey(cardKey)

  if (!normalizedCardKey) {
    return {
      ok: true,
      data: null,
    }
  }

  const lookup = cardEntityLookupByCanonicalKey(normalizedCardKey)
  const client = await createSupabaseServerClient()
  const repository = createCatalogRepository(client)

  const cardResult = await repository.getCardEntityByCanonicalKey(lookup.value)

  if (!cardResult.ok) {
    return cardResult
  }

  if (!cardResult.data) {
    return {
      ok: true,
      data: null,
    }
  }

  const printingsResult = await repository.listCardPrintings(cardResult.data.id)

  if (!printingsResult.ok) {
    return printingsResult
  }

  const legalityResult = await repository.getCardLegalityFacts(
    cardResult.data.id,
  )

  if (!legalityResult.ok) {
    return legalityResult
  }

  return {
    ok: true,
    data: {
      card: cardResult.data,
      rules: {
        effectReferences: cardResult.data.effectRefs,
        hasPublishedOracleText: false,
      },
      printings: printingsResult.data,
      legality: legalityResult.data,
      relatedProducts: buildRelatedProducts(printingsResult.data),
    },
  }
}

function buildRelatedProducts(
  printings: readonly CatalogCardPrintingRecord[],
): readonly CatalogRelatedProductRecord[] {
  const products = new Map<string, CatalogRelatedProductRecord>()

  for (const printing of printings) {
    const existing = products.get(printing.product.id)

    if (existing) {
      products.set(printing.product.id, {
        ...existing,
        printingCount: existing.printingCount + 1,
        rarities: sortUniqueValues([...existing.rarities, printing.rarity]),
        localeCodes: sortUniqueValues([
          ...existing.localeCodes,
          printing.localeCode,
        ]),
      })
      continue
    }

    products.set(printing.product.id, {
      id: printing.product.id,
      canonicalKey: printing.product.canonicalKey,
      officialCode: printing.product.officialCode,
      name: printing.product.name,
      productCategory: printing.product.productCategory,
      productKind: printing.product.productKind,
      releaseDate: printing.product.releaseDate,
      regionCode: printing.product.regionCode,
      printingCount: 1,
      rarities: [printing.rarity],
      localeCodes: [printing.localeCode],
    })
  }

  return Array.from(products.values()).sort(
    (left, right) =>
      right.releaseDate.localeCompare(left.releaseDate) ||
      left.officialCode.localeCompare(right.officialCode),
  )
}

function sortUniqueValues(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right),
  )
}
