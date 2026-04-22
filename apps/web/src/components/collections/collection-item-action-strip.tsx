import Link from 'next/link'
import { ArrowRight, Minus, Plus, Trash2 } from 'lucide-react'

import {
  addCollectionPrintingAction,
  decrementCollectionPrintingAction,
  removeCollectionPrintingAction,
} from '@/features/collections/server/collection-actions'
import { Button, buttonVariants } from '@/components/ui/button'

interface CollectionItemActionStripProps {
  readonly printingId: string
  readonly quantity: number
  readonly returnPath: string
  readonly detailHref?: string | null
  readonly compact?: boolean
}

export function CollectionItemActionStrip({
  printingId,
  quantity,
  returnPath,
  detailHref = null,
  compact = false,
}: CollectionItemActionStripProps) {
  const buttonSize = compact ? 'xs' : 'sm'
  const iconButtonSize = compact ? 'icon-xs' : 'icon-sm'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={addCollectionPrintingAction}>
        <input type="hidden" name="printingId" value={printingId} />
        <input type="hidden" name="quantity" value="1" />
        <input type="hidden" name="returnPath" value={returnPath} />
        <Button type="submit" size={buttonSize} aria-label="Add one copy">
          <Plus className="size-4" />
          {compact ? null : 'Add one'}
        </Button>
      </form>

      {quantity > 0 ? (
        <>
          <form action={decrementCollectionPrintingAction}>
            <input type="hidden" name="printingId" value={printingId} />
            <input type="hidden" name="quantity" value="1" />
            <input type="hidden" name="returnPath" value={returnPath} />
            <Button
              type="submit"
              variant="outline"
              size={compact ? iconButtonSize : buttonSize}
              aria-label="Remove one copy"
            >
              <Minus className="size-4" />
              {compact ? null : 'Remove one'}
            </Button>
          </form>

          <form action={removeCollectionPrintingAction}>
            <input type="hidden" name="printingId" value={printingId} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <Button
              type="submit"
              variant="destructive"
              size={compact ? iconButtonSize : buttonSize}
              aria-label="Remove this printing from collection"
            >
              <Trash2 className="size-4" />
              {compact ? null : 'Remove'}
            </Button>
          </form>
        </>
      ) : null}

      {detailHref ? (
        <Link
          href={detailHref}
          className={buttonVariants({
            variant: 'ghost',
            size: buttonSize,
          })}
        >
          {compact ? 'Open' : 'Open printing'}
          <ArrowRight className="size-4" />
        </Link>
      ) : null}
    </div>
  )
}
