import { CatalogListView } from '@/components/catalog/catalog-list-view'
import { CatalogStatusCard } from '@/components/catalog/catalog-status-card'
import { listCatalogCards } from '@/features/catalog/server/catalog-read'

export default async function CatalogPage() {
  const result = await listCatalogCards()

  if (!result.ok) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-14 md:px-10">
        <CatalogStatusCard
          title="Catalog is unavailable"
          description="The server-side catalog read flow failed. The UI is still isolated from direct database access, but the data source could not be loaded."
          actionLabel="Back home"
          actionHref="/"
        />
      </main>
    )
  }

  if (result.data.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-14 md:px-10">
        <CatalogStatusCard
          title="No cards published yet"
          description="The catalog read-side is connected, but the current dataset does not expose any card entities."
          actionLabel="Back home"
          actionHref="/"
        />
      </main>
    )
  }

  return <CatalogListView cards={result.data} />
}
