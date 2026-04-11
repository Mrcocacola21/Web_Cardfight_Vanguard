import { notFound } from 'next/navigation'

import { CatalogCardDetailView } from '@/components/catalog/catalog-card-detail-view'
import { ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { getCatalogCardDetail } from '@/features/catalog/server/catalog-read'

interface CatalogCardPageProps {
  readonly params: Promise<{
    cardKey: string
  }>
}

export default async function CatalogCardPage({
  params,
}: CatalogCardPageProps) {
  const { cardKey } = await params
  const result = await getCatalogCardDetail(decodeURIComponent(cardKey))

  if (!result.ok) {
    return (
      <PageContainer
        as="main"
        size="default"
        className="flex min-h-screen items-center py-14"
      >
        <ErrorState
          title="Card detail is unavailable"
          description="The server-side card detail flow failed. Repository mapping kept database internals out of the page, but the read operation did not complete."
          actionLabel="Back to catalog"
          actionHref="/catalog"
        />
      </PageContainer>
    )
  }

  if (!result.data) {
    notFound()
  }

  return <CatalogCardDetailView detail={result.data} />
}
