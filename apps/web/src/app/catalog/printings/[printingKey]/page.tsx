import { notFound } from 'next/navigation'

import { CatalogPrintingDetailView } from '@/components/catalog/catalog-printing-detail-view'
import { ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { getCatalogPrintingDetail } from '@/features/catalog/server/catalog-printing-read'

interface CatalogPrintingPageProps {
  readonly params: Promise<{
    printingKey: string
  }>
}

export default async function CatalogPrintingPage({
  params,
}: CatalogPrintingPageProps) {
  const { printingKey } = await params
  const result = await getCatalogPrintingDetail(decodeURIComponent(printingKey))

  if (!result.ok) {
    return (
      <PageContainer
        as="main"
        size="default"
        className="flex min-h-screen items-center py-14"
      >
        <ErrorState
          title="Printing detail is unavailable"
          description="The server-side printing detail flow failed. The route stays printing-centric, but the concrete edition could not be loaded."
          actionLabel="Back to catalog"
          actionHref="/catalog"
        />
      </PageContainer>
    )
  }

  if (!result.data) {
    notFound()
  }

  return <CatalogPrintingDetailView detail={result.data} />
}
