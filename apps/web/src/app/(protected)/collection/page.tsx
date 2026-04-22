import { CollectionInventoryView } from '@/components/collections/collection-inventory-view'
import { EmptyState, ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { resolveCollectionPageQuery } from '@/features/collections/collection-page-query'
import { getCollectionPageState } from '@/features/collections/server/collection-page-read'

interface CollectionPageProps {
  readonly searchParams?: Promise<
    Record<string, string | readonly string[] | undefined>
  >
}

export default async function CollectionPage({
  searchParams,
}: CollectionPageProps) {
  const query = resolveCollectionPageQuery((await searchParams) ?? {})
  const state = await getCollectionPageState(query)

  if (state.kind === 'error') {
    return (
      <PageContainer
        as="section"
        size="wide"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <ErrorState
          title="Collection is unavailable"
          description={state.message}
          actionLabel="Back home"
          actionHref="/"
        />
      </PageContainer>
    )
  }

  if (state.kind === 'profile-unavailable') {
    return (
      <PageContainer
        as="section"
        size="wide"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <EmptyState
          title="Create your profile first"
          description="Collection inventory stays attached to your app-facing profile. Finish creating the profile before opening this owner-owned route."
          actionLabel="Open profile"
          actionHref="/profile"
        />
      </PageContainer>
    )
  }

  return (
    <CollectionInventoryView
      viewerDisplayName={state.viewerDisplayName}
      query={state.query}
      totalOwnedPrintings={state.totalOwnedPrintings}
      totalOwnedCopies={state.totalOwnedCopies}
      items={state.items}
      totalWishlistItems={state.totalWishlistItems}
      totalFavoriteItems={state.totalFavoriteItems}
      wishlistItems={state.wishlistItems}
      favoriteItems={state.favoriteItems}
    />
  )
}
