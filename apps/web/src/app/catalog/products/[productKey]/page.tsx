import { notFound } from 'next/navigation'

import { CatalogProductDetailView } from '@/components/catalog/catalog-product-detail-view'
import { ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { getCatalogProductDetail } from '@/features/catalog/server/catalog-product-read'

interface CatalogProductPageProps {
  readonly params: Promise<{
    productKey: string
  }>
}

export default async function CatalogProductPage({
  params,
}: CatalogProductPageProps) {
  const { productKey } = await params
  const result = await getCatalogProductDetail(decodeURIComponent(productKey))

  if (!result.ok) {
    return (
      <PageContainer
        as="main"
        size="default"
        className="flex min-h-screen items-center py-14"
      >
        <ErrorState
          title="Product detail is unavailable"
          description="The server-side product detail flow failed. Repository mapping kept persistence internals out of the page, but the release read could not complete."
          actionLabel="Back to catalog"
          actionHref="/catalog"
        />
      </PageContainer>
    )
  }

  if (!result.data) {
    notFound()
  }

  return <CatalogProductDetailView detail={result.data} />
}
