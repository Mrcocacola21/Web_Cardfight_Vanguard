import Link from 'next/link'
import type { DeckListItemRecord, ProfileRecord } from '@web-vg/db'
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

interface DeckListViewProps {
  readonly decks: readonly DeckListItemRecord[]
  readonly profile: ProfileRecord
}

function formatVisibility(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatDate(value: string) {
  return value.slice(0, 10)
}

export function DeckListView({ decks, profile }: DeckListViewProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-14 md:px-10">
      <header className="space-y-3">
        <Badge variant="outline">Decks Read Baseline</Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            My Decks
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
            Minimal server-rendered deck overview for{' '}
            <span className="font-medium text-foreground">
              {profile.displayName}
            </span>
            . Data flows through the repository layer, format attachment stays
            explicit, and the page does not infer legality or gameplay state.
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {decks.map((deck) => (
          <Card
            key={deck.id}
            className="border-white/50 bg-card/95 shadow-lg shadow-black/5"
          >
            <CardHeader className="gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{deck.format.displayName}</Badge>
                <Badge variant="outline">
                  {formatVisibility(deck.visibility)}
                </Badge>
                {deck.currentVersionNumber ? (
                  <Badge>v{deck.currentVersionNumber}</Badge>
                ) : null}
              </div>
              <div className="space-y-1">
                <CardTitle>{deck.title}</CardTitle>
                <CardDescription>
                  {deck.description ??
                    'No deck description has been saved for this record yet.'}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide">Main</p>
                  <p className="mt-1 font-medium text-foreground">
                    {deck.sectionCounts.main}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide">Ride</p>
                  <p className="mt-1 font-medium text-foreground">
                    {deck.sectionCounts.ride}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide">G</p>
                  <p className="mt-1 font-medium text-foreground">
                    {deck.sectionCounts.g}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide">Total</p>
                  <p className="mt-1 font-medium text-foreground">
                    {deck.totalCards}
                  </p>
                </div>
              </div>
              <p>Updated: {formatDate(deck.updatedAt)}</p>
            </CardContent>
            <CardFooter className="items-center justify-between gap-3">
              <span className="truncate text-xs text-muted-foreground">
                {deck.id}
              </span>
              <Link
                href={`/decks/${encodeURIComponent(deck.id)}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                View deck
                <ArrowRight className="size-4" />
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </main>
  )
}
