import {
  createCatalogRepository,
  type CatalogCardEntityRecord,
  type CatalogCardPrintingRecord,
  type RepositoryResult,
} from '@web-vg/db'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export interface CatalogCardDetailData {
  readonly card: CatalogCardEntityRecord
  readonly printings: readonly CatalogCardPrintingRecord[]
}

export async function listCatalogCards(): Promise<
  RepositoryResult<readonly CatalogCardEntityRecord[]>
> {
  const client = await createSupabaseServerClient()
  const repository = createCatalogRepository(client)

  return repository.listCardEntities()
}

export async function getCatalogCardDetail(
  cardKey: string,
): Promise<RepositoryResult<CatalogCardDetailData | null>> {
  const client = await createSupabaseServerClient()
  const repository = createCatalogRepository(client)

  const cardResult = await repository.getCardEntityByCanonicalKey(cardKey)

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

  return {
    ok: true,
    data: {
      card: cardResult.data,
      printings: printingsResult.data,
    },
  }
}
