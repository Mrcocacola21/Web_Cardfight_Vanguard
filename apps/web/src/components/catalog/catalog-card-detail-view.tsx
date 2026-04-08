import Link from 'next/link'
import type {
  CatalogCardEntityRecord,
  CatalogCardPrintingRecord,
} from '@web-vg/db'
import { ArrowLeft } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface CatalogCardDetailViewProps {
  readonly card: CatalogCardEntityRecord
  readonly printings: readonly CatalogCardPrintingRecord[]
}

function formatCardType(cardType: string) {
  return cardType.replaceAll('-', ' ')
}

export function CatalogCardDetailView({
  card,
  printings,
}: CatalogCardDetailViewProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-14 md:px-10">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Badge variant="outline">Catalog Detail</Badge>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {card.name}
          </h1>
          <p className="text-sm text-muted-foreground">{card.canonicalKey}</p>
        </div>
        <Link
          href="/catalog"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <ArrowLeft className="size-4" />
          Back to catalog
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
        <Card className="border-white/50 bg-card/95 shadow-lg shadow-black/5">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Grade {card.grade}</Badge>
              <Badge variant="outline">{formatCardType(card.cardType)}</Badge>
              {card.triggerType ? <Badge>{card.triggerType}</Badge> : null}
            </div>
            <div className="space-y-1">
              <CardTitle>Canonical card</CardTitle>
              <CardDescription>
                Gameplay-facing identity, independent from specific printings.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Nation
                </dt>
                <dd className="mt-1 font-medium">{card.nation}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Clan
                </dt>
                <dd className="mt-1 font-medium">{card.clan ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Race
                </dt>
                <dd className="mt-1 font-medium">{card.race ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Trigger
                </dt>
                <dd className="mt-1 font-medium">{card.triggerType ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Power
                </dt>
                <dd className="mt-1 font-medium">{card.basePower ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Shield
                </dt>
                <dd className="mt-1 font-medium">{card.baseShield ?? '-'}</dd>
              </div>
            </dl>

            <Separator />

            <div className="space-y-3">
              <h2 className="text-sm font-medium">Published gameplay tags</h2>
              <div className="flex flex-wrap gap-2">
                {card.keywords.length > 0 ? (
                  card.keywords.map((keyword) => (
                    <Badge key={keyword} variant="secondary">
                      {keyword}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No keyword tags published.
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-medium">Effect references</h2>
              {card.effectRefs.length > 0 ? (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {card.effectRefs.map((effectRef) => (
                    <li key={effectRef}>{effectRef}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No effect references published.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/50 bg-card/95 shadow-lg shadow-black/5">
          <CardHeader>
            <CardTitle>Printings</CardTitle>
            <CardDescription>
              Release-specific printings linked to this canonical card.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {printings.length > 0 ? (
              printings.map((printing) => (
                <div
                  key={printing.id}
                  className="rounded-lg border bg-background/70 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{printing.rarity}</Badge>
                    <Badge variant="secondary">
                      {printing.product.officialCode}
                    </Badge>
                    {printing.isPromoVariant ? <Badge>Promo</Badge> : null}
                    {printing.isAlternateArt ? (
                      <Badge variant="secondary">Alt art</Badge>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <p className="font-medium">{printing.product.name}</p>
                    <p className="text-muted-foreground">
                      #{printing.collectorNumber}
                      {printing.printedName ? ` · ${printing.printedName}` : ''}
                    </p>
                    <p className="text-muted-foreground">
                      Release date: {printing.product.releaseDate}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No printings are currently published for this card.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
