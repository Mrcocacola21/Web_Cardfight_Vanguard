import Link from 'next/link'
import type { CatalogCardEntityRecord } from '@web-vg/db'
import { ArrowRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface CatalogListViewProps {
  readonly cards: readonly CatalogCardEntityRecord[]
}

function formatCardType(cardType: string) {
  return cardType.replaceAll('-', ' ')
}

export function CatalogListView({ cards }: CatalogListViewProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-14 md:px-10">
      <header className="space-y-3">
        <Badge variant="outline">Catalog Read Baseline</Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Card Catalog
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
            Minimal server-rendered catalog overview. Data is loaded through the
            repository layer, not through UI-level Supabase queries.
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card
            key={card.id}
            className="border-white/50 bg-card/95 shadow-lg shadow-black/5"
          >
            <CardHeader className="gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Grade {card.grade}</Badge>
                <Badge variant="outline">{formatCardType(card.cardType)}</Badge>
                {card.triggerType ? <Badge>{card.triggerType}</Badge> : null}
              </div>
              <div className="space-y-1">
                <CardTitle>{card.name}</CardTitle>
                <CardDescription>{card.nation}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Canonical key: {card.canonicalKey}</p>
              <div className="grid grid-cols-3 gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <span>Power</span>
                <span>Critical</span>
                <span>Shield</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm font-medium">
                <span>{card.basePower ?? '-'}</span>
                <span>{card.baseCritical ?? '-'}</span>
                <span>{card.baseShield ?? '-'}</span>
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <span className="text-xs text-muted-foreground">{card.id}</span>
              <Link
                href={`/catalog/${encodeURIComponent(card.canonicalKey)}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                View card
                <ArrowRight className="size-4" />
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </main>
  )
}
