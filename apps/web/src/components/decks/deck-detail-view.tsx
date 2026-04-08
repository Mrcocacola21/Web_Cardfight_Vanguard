import Link from 'next/link'
import type { DeckDetailRecord, DeckSectionKey } from '@web-vg/db'
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

interface DeckDetailViewProps {
  readonly deck: DeckDetailRecord
}

function formatVisibility(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatSectionLabel(value: DeckSectionKey) {
  if (value === 'g') {
    return 'G deck'
  }

  if (value === 'ride') {
    return 'Ride deck'
  }

  return 'Main deck'
}

function formatCardType(value: string) {
  return value.replaceAll('-', ' ')
}

function formatDate(value: string) {
  return value.slice(0, 10)
}

export function DeckDetailView({ deck }: DeckDetailViewProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-14 md:px-10">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Deck Detail</Badge>
            <Badge variant="secondary">{deck.format.displayName}</Badge>
            <Badge variant="outline">{formatVisibility(deck.visibility)}</Badge>
            {deck.currentVersion ? (
              <Badge>v{deck.currentVersion.versionNumber}</Badge>
            ) : null}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {deck.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Format attachment stays explicit on the persisted deck record.
          </p>
        </div>
        <Link
          href="/decks"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <ArrowLeft className="size-4" />
          Back to decks
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="border-white/50 bg-card/95 shadow-lg shadow-black/5">
          <CardHeader>
            <CardTitle>Persisted deck metadata</CardTitle>
            <CardDescription>
              User-owned deck record with attached format. This page does not
              infer legality or gameplay state.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Format
                </dt>
                <dd className="mt-1 font-medium">{deck.format.displayName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Visibility
                </dt>
                <dd className="mt-1 font-medium">
                  {formatVisibility(deck.visibility)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Created
                </dt>
                <dd className="mt-1 font-medium">
                  {formatDate(deck.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Updated
                </dt>
                <dd className="mt-1 font-medium">
                  {formatDate(deck.updatedAt)}
                </dd>
              </div>
            </dl>

            <Separator />

            <div className="space-y-2">
              <h2 className="text-sm font-medium">Description</h2>
              <p className="text-sm text-muted-foreground">
                {deck.description ??
                  'No deck description has been persisted for this record yet.'}
              </p>
            </div>

            {deck.format.description ? (
              <div className="space-y-2">
                <h2 className="text-sm font-medium">Format note</h2>
                <p className="text-sm text-muted-foreground">
                  {deck.format.description}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-white/50 bg-card/95 shadow-lg shadow-black/5">
          <CardHeader>
            <CardTitle>Current composition</CardTitle>
            <CardDescription>
              Persisted canonical card composition from the current deck
              version.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {deck.currentVersion ? (
              <>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className="rounded-lg border bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Main
                    </p>
                    <p className="mt-1 font-medium">
                      {deck.currentVersion.sectionCounts.main}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Ride
                    </p>
                    <p className="mt-1 font-medium">
                      {deck.currentVersion.sectionCounts.ride}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      G
                    </p>
                    <p className="mt-1 font-medium">
                      {deck.currentVersion.sectionCounts.g}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Total
                    </p>
                    <p className="mt-1 font-medium">
                      {deck.currentVersion.totalCards}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  This read-side uses canonical card identity for composition.
                  It does not switch to printing-level ownership or legality
                  state.
                </p>

                <div className="space-y-4">
                  {deck.currentVersion.sections.map((section) => (
                    <div key={section.key} className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-medium">
                          {formatSectionLabel(section.key)}
                        </h2>
                        <Badge variant="outline">
                          {section.totalCards} cards
                        </Badge>
                      </div>
                      {section.cards.length > 0 ? (
                        <div className="space-y-2">
                          {section.cards.map((card) => (
                            <div
                              key={`${section.key}-${card.cardEntityId}`}
                              className="rounded-lg border bg-background/70 p-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">
                                  x{card.quantity}
                                </Badge>
                                <Badge variant="outline">
                                  Grade {card.grade}
                                </Badge>
                                <Badge variant="outline">
                                  {formatCardType(card.cardType)}
                                </Badge>
                                {card.triggerType ? (
                                  <Badge>{card.triggerType}</Badge>
                                ) : null}
                              </div>
                              <div className="mt-3 space-y-1 text-sm">
                                <p className="font-medium">{card.name}</p>
                                <p className="text-muted-foreground">
                                  {card.canonicalKey}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No cards are currently persisted in this section.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No current deck version is attached to this record yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
