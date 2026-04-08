import { notFound } from 'next/navigation'

import { CatalogCardDetailView } from '@/components/catalog/catalog-card-detail-view'
import { CatalogStatusCard } from '@/components/catalog/catalog-status-card'
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
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-14 md:px-10">
        <CatalogStatusCard
          title="Card detail is unavailable"
          description="The server-side card detail flow failed. Repository mapping kept database internals out of the page, but the read operation did not complete."
          actionLabel="Back to catalog"
          actionHref="/catalog"
        />
      </main>
    )
  }

  if (!result.data) {
    notFound()
  }

  return (
    <CatalogCardDetailView
      card={result.data.card}
      printings={result.data.printings}
    />
  )
}
