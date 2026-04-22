import { Badge } from '@/components/ui/badge'
import { ItemCard } from '@/components/data-display'
import type { StoredCollectionInventoryItem } from '@/features/collections/application/collection-inventory-repository'
import {
  getCollectionInventoryItemCardMeta,
  getCollectionInventoryItemDetailHref,
  getCollectionInventoryItemPrintingLabel,
  getCollectionInventoryItemProductLabel,
  getCollectionInventoryItemTitle,
  getCollectionInventoryItemVariantLabels,
} from '@/features/collections/collection-inventory-display'

import { CollectionItemActionStrip } from './collection-item-action-strip'

interface CollectionBinderViewProps {
  readonly items: readonly StoredCollectionInventoryItem[]
  readonly returnPath: string
}

export function CollectionBinderView({
  items,
  returnPath,
}: CollectionBinderViewProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const detailHref = getCollectionInventoryItemDetailHref(item)
        const variantLabels = getCollectionInventoryItemVariantLabels(item)

        return (
          <ItemCard
            key={item.id}
            title={getCollectionInventoryItemTitle(item)}
            subtitle={getCollectionInventoryItemPrintingLabel(item)}
            badges={
              <>
                <Badge variant="secondary">x{item.quantity}</Badge>
                {item.printing ? (
                  <Badge variant="outline">{item.printing.rarity}</Badge>
                ) : (
                  <Badge variant="warning">Stale</Badge>
                )}
                {item.printing?.product ? (
                  <Badge variant="outline">
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
            className="bg-background-elevated/38"
            contentClassName="text-sm text-muted-foreground"
            footer={
              <CollectionItemActionStrip
                printingId={item.cardPrintingId}
                quantity={item.quantity}
                returnPath={returnPath}
                detailHref={detailHref}
                compact
              />
            }
          >
            <div className="space-y-2">
              <p>{getCollectionInventoryItemProductLabel(item)}</p>
              <p>{getCollectionInventoryItemCardMeta(item)}</p>
              {item.printing ? (
                <p>
                  Locale: {item.printing.localeCode.toUpperCase()}
                  {item.printing.regionCode
                    ? ` | Region: ${item.printing.regionCode.toUpperCase()}`
                    : ''}
                </p>
              ) : (
                <p>
                  This inventory row is still valid, but the linked catalog
                  printing summary is currently unavailable.
                </p>
              )}
            </div>
          </ItemCard>
        )
      })}
    </div>
  )
}
