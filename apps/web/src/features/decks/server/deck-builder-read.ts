import { normalizeCatalogQuery } from '@web-vg/catalog'
import type { CatalogCardEntityListRecord, RepositoryResult } from '@web-vg/db'

import { listCatalogCards } from '@/features/catalog/server/catalog-read'

interface ListDeckBuilderCatalogCardsInput {
  readonly formatId: string
  readonly searchText: string | null
}

export async function listDeckBuilderCatalogCards({
  formatId,
  searchText,
}: ListDeckBuilderCatalogCardsInput): Promise<
  RepositoryResult<CatalogCardEntityListRecord>
> {
  const query = normalizeCatalogQuery({
    searchText,
    filters: {
      formatIds: [formatId],
    },
    sort: searchText ? 'relevance' : 'grade-asc',
    window: {
      page: 1,
      pageSize: 18,
    },
  })

  return listCatalogCards(query)
}
