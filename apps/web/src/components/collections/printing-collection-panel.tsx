import Link from 'next/link'

import {
  addCollectionPrintingAction,
  decrementCollectionPrintingAction,
  removeCollectionPrintingAction,
  setCollectionPrintingQuantityAction,
} from '@/features/collections/server/collection-actions'
import type { CurrentPrintingCollectionState } from '@/features/collections/server/current-printing-collection-read'
import { buttonVariants, Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface PrintingCollectionPanelProps {
  readonly printingId: string
  readonly returnPath: string
  readonly state: CurrentPrintingCollectionState
}

export function PrintingCollectionPanel({
  printingId,
  returnPath,
  state,
}: PrintingCollectionPanelProps) {
  const ownedQuantity = state.kind === 'ready' ? (state.item?.quantity ?? 0) : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your collection</CardTitle>
        <CardDescription>
          Private owner-owned inventory for this exact printing. Quantity stays
          attached to the concrete `CardPrinting`, not the canonical gameplay
          card entity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.kind === 'signed-out' ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Sign in to track ownership for this printing.</p>
            <Link
              href="/login"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Sign in
            </Link>
          </div>
        ) : null}

        {state.kind === 'profile-required' ? (
          <p className="text-sm text-muted-foreground">
            Create a persisted profile before using collection inventory.
          </p>
        ) : null}

        {state.kind === 'error' ? (
          <p className="text-sm text-muted-foreground">{state.message}</p>
        ) : null}

        {state.kind === 'ready' ? (
          <>
            <div className="rounded-xl border border-border/70 bg-background-elevated/45 p-3">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Owned copies
              </p>
              <p className="mt-1 text-2xl font-semibold">{ownedQuantity}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <form action={addCollectionPrintingAction}>
                <input type="hidden" name="printingId" value={printingId} />
                <input type="hidden" name="quantity" value="1" />
                <input type="hidden" name="returnPath" value={returnPath} />
                <Button type="submit" size="sm">
                  {ownedQuantity > 0 ? 'Add one' : 'Add to collection'}
                </Button>
              </form>

              {ownedQuantity > 0 ? (
                <>
                  <form action={decrementCollectionPrintingAction}>
                    <input type="hidden" name="printingId" value={printingId} />
                    <input type="hidden" name="quantity" value="1" />
                    <input type="hidden" name="returnPath" value={returnPath} />
                    <Button type="submit" variant="outline" size="sm">
                      Remove one
                    </Button>
                  </form>

                  <form action={removeCollectionPrintingAction}>
                    <input type="hidden" name="printingId" value={printingId} />
                    <input type="hidden" name="returnPath" value={returnPath} />
                    <Button type="submit" variant="destructive" size="sm">
                      Remove all
                    </Button>
                  </form>
                </>
              ) : null}
            </div>

            <form
              action={setCollectionPrintingQuantityAction}
              className="flex flex-wrap items-end gap-2"
            >
              <input type="hidden" name="printingId" value={printingId} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">
                  Set exact quantity
                </span>
                <Input
                  name="quantity"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={ownedQuantity}
                  className="w-32"
                />
              </label>
              <Button type="submit" variant="outline" size="sm">
                Save quantity
              </Button>
            </form>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
