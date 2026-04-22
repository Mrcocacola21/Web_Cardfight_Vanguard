import { Badge } from '@/components/ui/badge'
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

interface CollectionListViewProps {
  readonly items: readonly StoredCollectionInventoryItem[]
  readonly returnPath: string
}

export function CollectionListView({
  items,
  returnPath,
}: CollectionListViewProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-background-elevated/52">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/70 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <th className="px-4 py-3 font-medium">Card</th>
            <th className="px-4 py-3 font-medium">Owned printing</th>
            <th className="px-4 py-3 font-medium">Release</th>
            <th className="px-4 py-3 font-medium">Qty</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const detailHref = getCollectionInventoryItemDetailHref(item)
            const variantLabels = getCollectionInventoryItemVariantLabels(item)

            return (
              <tr
                key={item.id}
                className="border-b border-border/60 align-top last:border-b-0"
              >
                <td className="space-y-1 px-4 py-4">
                  <p className="font-medium text-foreground">
                    {getCollectionInventoryItemTitle(item)}
                  </p>
                  <p className="text-muted-foreground">
                    {getCollectionInventoryItemCardMeta(item)}
                  </p>
                </td>
                <td className="space-y-2 px-4 py-4">
                  <p className="text-foreground">
                    {getCollectionInventoryItemPrintingLabel(item)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {item.printing ? (
                      <Badge variant="outline">{item.printing.rarity}</Badge>
                    ) : (
                      <Badge variant="warning">Stale</Badge>
                    )}
                    {variantLabels.map((label) => (
                      <Badge key={`${item.id}-${label}`} variant="accent">
                        {label}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-4 text-muted-foreground">
                  {getCollectionInventoryItemProductLabel(item)}
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex min-w-12 justify-center rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-sm font-medium text-primary">
                    {item.quantity}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <CollectionItemActionStrip
                    printingId={item.cardPrintingId}
                    quantity={item.quantity}
                    returnPath={returnPath}
                    detailHref={detailHref}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
