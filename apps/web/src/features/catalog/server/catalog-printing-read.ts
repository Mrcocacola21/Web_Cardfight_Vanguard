import {
  cardPrintingLookupByPrintingKey,
  normalizeCardPrintingKey,
} from '@web-vg/catalog'
import { createCatalogRepository, type RepositoryResult } from '@web-vg/db'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { CatalogPrintingDetailViewModel } from '@/features/catalog/catalog-printing-detail.types'

export async function getCatalogPrintingDetail(
  printingKey: string,
): Promise<RepositoryResult<CatalogPrintingDetailViewModel | null>> {
  const normalizedPrintingKey = normalizeCardPrintingKey(printingKey)

  if (!normalizedPrintingKey) {
    return {
      ok: true,
      data: null,
    }
  }

  const lookup = cardPrintingLookupByPrintingKey(normalizedPrintingKey)
  const client = await createSupabaseServerClient()
  const repository = createCatalogRepository(client)

  const printingResult = await repository.getCardPrintingByPrintingKey(
    lookup.value,
  )

  if (!printingResult.ok) {
    return printingResult
  }

  if (!printingResult.data) {
    return {
      ok: true,
      data: null,
    }
  }

  const siblingPrintingsResult = await repository.listCardPrintings(
    printingResult.data.card.id,
  )

  if (!siblingPrintingsResult.ok) {
    return siblingPrintingsResult
  }

  const activePrintingKey = printingResult.data.printingKey

  return {
    ok: true,
    data: {
      printing: printingResult.data,
      siblingPrintings: siblingPrintingsResult.data.filter(
        (sibling) => sibling.printingKey !== activePrintingKey,
      ),
    },
  }
}
