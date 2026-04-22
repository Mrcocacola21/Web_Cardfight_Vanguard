import Link from 'next/link'

import { FilterBar, FilterSelect } from '@/components/data-display'
import { EmptyState } from '@/components/feedback'
import { DashboardPageLayout, PageHeader } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  buildCollectionPageHref,
  collectionSortOptions,
  type CollectionPageQuery,
} from '@/features/collections/collection-page-query'
import type { StoredCollectionInventoryItem } from '@/features/collections/application/collection-inventory-repository'
import type { StoredCollectionPrintingPreferenceItem } from '@/features/collections/application/collection-preference-repository'

import { CollectionBinderView } from './collection-binder-view'
import { CollectionListView } from './collection-list-view'
import { CollectionPreferenceSections } from './collection-preference-sections'

interface CollectionInventoryViewProps {
  readonly viewerDisplayName: string
  readonly query: CollectionPageQuery
  readonly totalOwnedPrintings: number
  readonly totalOwnedCopies: number
  readonly items: readonly StoredCollectionInventoryItem[]
  readonly totalWishlistItems?: number
  readonly totalFavoriteItems?: number
  readonly wishlistItems?: readonly StoredCollectionPrintingPreferenceItem[]
  readonly favoriteItems?: readonly StoredCollectionPrintingPreferenceItem[]
}

export function CollectionInventoryView({
  viewerDisplayName,
  query,
  totalOwnedPrintings,
  totalOwnedCopies,
  items,
  totalWishlistItems = 0,
  totalFavoriteItems = 0,
  wishlistItems = [],
  favoriteItems = [],
}: CollectionInventoryViewProps) {
  const returnPath = buildCollectionPageHref(query)
  const binderHref = buildCollectionPageHref({
    view: 'binder',
    sort: query.sort,
  })
  const listHref = buildCollectionPageHref({
    view: 'list',
    sort: query.sort,
  })

  return (
    <DashboardPageLayout
      containerSize="wide"
      className="min-h-screen"
      contentClassName="space-y-4"
      header={
        <PageHeader
          eyebrow={
            <>
              <Badge variant="outline">Collection</Badge>
              <Badge variant="secondary">Owner inventory</Badge>
            </>
          }
          title="My Collection"
          description="Collector-facing inventory read surface for owned printings. Binder and list modes both read from the same owner-scoped collection items, keep printing-level ownership visible, and allow the same gameplay card to appear multiple times when owned printings differ."
          meta={
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{viewerDisplayName}</span>
              <span aria-hidden="true">|</span>
              <span>{totalOwnedPrintings} owned printings</span>
              <span aria-hidden="true">|</span>
              <span>{totalOwnedCopies} total copies</span>
              <span aria-hidden="true">|</span>
              <span>Owner-only</span>
            </div>
          }
          actions={
            <Link
              href="/catalog"
              className={buttonVariants({
                variant: 'default',
              })}
            >
              Browse catalog
            </Link>
          }
        />
      }
    >
      <FilterBar className="items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={binderHref}
            className={buttonVariants({
              variant: query.view === 'binder' ? 'default' : 'outline',
              size: 'sm',
            })}
            aria-current={query.view === 'binder' ? 'page' : undefined}
          >
            Binder view
          </Link>
          <Link
            href={listHref}
            className={buttonVariants({
              variant: query.view === 'list' ? 'default' : 'outline',
              size: 'sm',
            })}
            aria-current={query.view === 'list' ? 'page' : undefined}
          >
            List view
          </Link>
        </div>

        <form
          method="get"
          action="/collection"
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="view" value={query.view} />
          <FilterSelect
            name="sort"
            label="Sort"
            defaultValue={query.sort}
            options={collectionSortOptions}
            className="min-w-[12rem]"
          />
          <Button type="submit" variant="outline" size="sm">
            Apply
          </Button>
        </form>
      </FilterBar>

      {totalOwnedPrintings === 0 ? (
        <EmptyState
          title="Your collection is empty"
          description="No owned printings have been added yet. Start from the catalog or a printing detail page, add the first owned printing, and this route becomes your binder/list inventory surface."
          actionLabel="Browse catalog"
          actionHref="/catalog"
        />
      ) : query.view === 'binder' ? (
        <CollectionBinderView items={items} returnPath={returnPath} />
      ) : (
        <CollectionListView items={items} returnPath={returnPath} />
      )}

      <CollectionPreferenceSections
        wishlistItems={wishlistItems}
        favoriteItems={favoriteItems}
        totalWishlistItems={totalWishlistItems}
        totalFavoriteItems={totalFavoriteItems}
        returnPath="/collection"
      />
    </DashboardPageLayout>
  )
}
