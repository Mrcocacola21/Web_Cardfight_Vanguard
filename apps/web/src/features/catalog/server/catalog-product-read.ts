import {
  normalizeProductCanonicalKey,
  productLookupByCanonicalKey,
} from '@web-vg/catalog'
import {
  createCatalogRepository,
  type CatalogProductPrintingRecord,
  type RepositoryResult,
} from '@web-vg/db'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type {
  CatalogProductDetailViewModel,
  CatalogProductSummaryRecord,
} from '@/features/catalog/catalog-product-detail.types'

export async function getCatalogProductDetail(
  productKey: string,
): Promise<RepositoryResult<CatalogProductDetailViewModel | null>> {
  const normalizedProductKey = normalizeProductCanonicalKey(productKey)

  if (!normalizedProductKey) {
    return {
      ok: true,
      data: null,
    }
  }

  const lookup = productLookupByCanonicalKey(normalizedProductKey)
  const client = await createSupabaseServerClient()
  const repository = createCatalogRepository(client)

  const productResult = await repository.getProductDetailByCanonicalKey(
    lookup.value,
  )

  if (!productResult.ok) {
    return productResult
  }

  if (!productResult.data) {
    return {
      ok: true,
      data: null,
    }
  }

  const printingsResult = await repository.listProductPrintings(
    productResult.data.id,
  )

  if (!printingsResult.ok) {
    return printingsResult
  }

  return {
    ok: true,
    data: {
      product: productResult.data,
      printings: printingsResult.data,
      summary: buildProductSummary(printingsResult.data),
    },
  }
}

function buildProductSummary(
  printings: readonly CatalogProductPrintingRecord[],
): CatalogProductSummaryRecord {
  return {
    printingCount: printings.length,
    uniqueCardCount: new Set(printings.map((printing) => printing.card.id))
      .size,
    promoPrintingCount: printings.filter((printing) => printing.isPromoVariant)
      .length,
    alternateArtPrintingCount: printings.filter(
      (printing) => printing.isAlternateArt,
    ).length,
    localeCodes: sortUniqueValues(
      printings.map((printing) => printing.localeCode),
    ),
    rarities: sortUniqueValues(printings.map((printing) => printing.rarity)),
  }
}

function sortUniqueValues(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right),
  )
}
