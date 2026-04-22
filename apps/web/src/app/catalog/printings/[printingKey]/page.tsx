import { notFound } from 'next/navigation'

import { CatalogPrintingDetailView } from '@/components/catalog/catalog-printing-detail-view'
import { PrintingCollectionPanel } from '@/components/collections/printing-collection-panel'
import { PrintingPreferencePanel } from '@/components/collections/printing-preference-panel'
import { ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { buildCatalogPrintingDetailHref } from '@/features/catalog/catalog-routes'
import { getCatalogPrintingDetail } from '@/features/catalog/server/catalog-printing-read'
import { getCurrentPrintingCollectionState } from '@/features/collections/server/current-printing-collection-read'
import { getCurrentPrintingPreferenceState } from '@/features/collections/server/current-printing-preference-read'

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

  const returnPath = buildCatalogPrintingDetailHref(
    result.data.printing.printingKey,
  )
  const [collectionState, preferenceState] = await Promise.all([
    getCurrentPrintingCollectionState(result.data.printing.id),
    getCurrentPrintingPreferenceState(result.data.printing.id),
  ])

  return (
    <CatalogPrintingDetailView
      detail={result.data}
      collectionPanel={
        <PrintingCollectionPanel
          printingId={result.data.printing.id}
          returnPath={returnPath}
          state={collectionState}
        />
      }
      preferencePanel={
        <PrintingPreferencePanel
          printingId={result.data.printing.id}
          returnPath={returnPath}
          state={preferenceState}
        />
      }
    />
  )
}
