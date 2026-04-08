import { CatalogStatusCard } from '@/components/catalog/catalog-status-card'

export default function CatalogCardNotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-14 md:px-10">
      <CatalogStatusCard
        title="Card not found"
        description="No published canonical card matches this catalog route."
        actionLabel="Back to catalog"
        actionHref="/catalog"
      />
    </main>
  )
}
