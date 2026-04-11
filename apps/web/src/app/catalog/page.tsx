import { redirect } from 'next/navigation'

import { CatalogListView } from '@/components/catalog/catalog-list-view'
import { ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import {
  buildCatalogCardListHref,
  resolveCatalogCardListQuery,
} from '@/features/catalog/catalog-list-query'
import { listCatalogCards } from '@/features/catalog/server/catalog-read'

interface CatalogPageProps {
  readonly searchParams?: Promise<
    Record<string, string | readonly string[] | undefined>
  >
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const query = resolveCatalogCardListQuery((await searchParams) ?? {})
  const result = await listCatalogCards(query)

  if (!result.ok) {
    return (
      <PageContainer
        as="main"
        size="wide"
        className="flex min-h-screen items-center py-14"
      >
        <ErrorState
          title="Catalog is unavailable"
          description="The server-side catalog read flow failed. The UI is still isolated from direct database access, but the data source could not be loaded."
          actionLabel="Back home"
          actionHref="/"
        />
      </PageContainer>
    )
  }

  if (result.data.totalCount > 0 && query.window.page > result.data.pageCount) {
    redirect(
      buildCatalogCardListHref({
        ...query,
        window: {
          ...query.window,
          page: result.data.pageCount,
        },
      }),
    )
  }

  return <CatalogListView query={query} listing={result.data} />
}
