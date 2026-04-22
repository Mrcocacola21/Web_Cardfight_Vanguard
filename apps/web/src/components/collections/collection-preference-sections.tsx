import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { ItemCard } from '@/components/data-display'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import type { StoredCollectionPrintingPreferenceItem } from '@/features/collections/application/collection-preference-repository'
import {
  getCollectionInventoryItemCardMeta,
  getCollectionInventoryItemDetailHref,
  getCollectionInventoryItemPrintingLabel,
  getCollectionInventoryItemProductLabel,
  getCollectionInventoryItemTitle,
  getCollectionInventoryItemVariantLabels,
} from '@/features/collections/collection-inventory-display'
import { setCollectionPrintingPreferenceAction } from '@/features/collections/server/collection-preference-actions'

interface CollectionPreferenceSectionsProps {
  readonly wishlistItems: readonly StoredCollectionPrintingPreferenceItem[]
  readonly favoriteItems: readonly StoredCollectionPrintingPreferenceItem[]
  readonly totalWishlistItems: number
  readonly totalFavoriteItems: number
  readonly returnPath: string
}

export function CollectionPreferenceSections({
  wishlistItems,
  favoriteItems,
  totalWishlistItems,
  totalFavoriteItems,
  returnPath,
}: CollectionPreferenceSectionsProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <CollectionPreferenceSection
        title="Wishlist printings"
        description="Exact printings you want to acquire later."
        preferenceKind="wishlist"
        items={wishlistItems}
        totalItems={totalWishlistItems}
        returnPath={returnPath}
      />
      <CollectionPreferenceSection
        title="Favorite printings"
        description="Exact printings you want bookmarked as collector favorites."
        preferenceKind="favorite"
        items={favoriteItems}
        totalItems={totalFavoriteItems}
        returnPath={returnPath}
      />
    </div>
  )
}

interface CollectionPreferenceSectionProps {
  readonly title: string
  readonly description: string
  readonly preferenceKind: 'wishlist' | 'favorite'
  readonly items: readonly StoredCollectionPrintingPreferenceItem[]
  readonly totalItems: number
  readonly returnPath: string
}

function CollectionPreferenceSection({
  title,
  description,
  preferenceKind,
  items,
  totalItems,
  returnPath,
}: CollectionPreferenceSectionProps) {
  return (
    <Card className="bg-background-elevated/40">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{title}</CardTitle>
          <Badge variant="secondary">{totalItems}</Badge>
          <Badge variant="outline">Owner-only</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length > 0 ? (
          items.map((item) => {
            const detailHref = getCollectionInventoryItemDetailHref(item)
            const variantLabels = getCollectionInventoryItemVariantLabels(item)

            return (
              <ItemCard
                key={item.id}
                title={getCollectionInventoryItemTitle(item)}
                subtitle={getCollectionInventoryItemPrintingLabel(item)}
                badges={
                  <>
                    {item.printing ? (
                      <Badge variant="outline">{item.printing.rarity}</Badge>
                    ) : (
                      <Badge variant="warning">Stale</Badge>
                    )}
                    {item.printing?.product ? (
                      <Badge variant="secondary">
                        {item.printing.product.officialCode}
                      </Badge>
                    ) : null}
                    {variantLabels.map((label) => (
                      <Badge key={`${item.id}-${label}`} variant="accent">
                        {label}
                      </Badge>
                    ))}
                  </>
                }
                actions={
                  <div className="flex flex-wrap gap-2">
                    <form action={setCollectionPrintingPreferenceAction}>
                      <input
                        type="hidden"
                        name="printingId"
                        value={item.cardPrintingId}
                      />
                      <input
                        type="hidden"
                        name="preferenceKind"
                        value={preferenceKind}
                      />
                      <input type="hidden" name="isPresent" value="false" />
                      <input
                        type="hidden"
                        name="returnPath"
                        value={returnPath}
                      />
                      <Button type="submit" variant="outline" size="sm">
                        Remove
                      </Button>
                    </form>

                    {detailHref ? (
                      <Link
                        href={detailHref}
                        className={buttonVariants({
                          variant: 'ghost',
                          size: 'sm',
                        })}
                      >
                        Open printing
                        <ArrowRight className="size-4" />
                      </Link>
                    ) : null}
                  </div>
                }
                className="bg-background-elevated/38"
                contentClassName="space-y-1 text-sm text-muted-foreground"
              >
                <p>{getCollectionInventoryItemProductLabel(item)}</p>
                <p>{getCollectionInventoryItemCardMeta(item)}</p>
              </ItemCard>
            )
          })
        ) : (
          <p className="text-sm text-muted-foreground">
            No printings are currently marked in this section.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
