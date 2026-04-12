import Link from 'next/link'
import type {
  DeckDetailRecord,
  DeckSectionKey,
} from '@web-vg/db/repositories/decks'
import { ArrowLeft } from 'lucide-react'

import { ItemCard, StatBlock, StatGrid } from '@/components/data-display'
import { DetailPageLayout, PageHeader } from '@/components/layout'
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
    <DetailPageLayout
      containerSize="wide"
      variant="split"
      header={
        <PageHeader
          eyebrow={
            <>
              <Badge variant="outline">Deck Detail</Badge>
              <Badge variant="secondary">{deck.format.displayName}</Badge>
              <Badge variant="outline">
                {formatVisibility(deck.visibility)}
              </Badge>
              {deck.currentVersion ? (
                <Badge>v{deck.currentVersion.versionNumber}</Badge>
              ) : null}
            </>
          }
          title={deck.title}
          description="Format attachment stays explicit on the persisted deck record."
          actions={
            <Link
              href="/decks"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ArrowLeft className="size-4" />
              Back to decks
            </Link>
          }
        />
      }
      main={
        <Card>
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
      }
      aside={
        <ItemCard
          title="Current composition"
          subtitle="Persisted canonical card composition from the current deck version."
          contentClassName="space-y-4"
        >
          {deck.currentVersion ? (
            <>
              <StatGrid columns={4}>
                <StatBlock
                  label="Main"
                  value={deck.currentVersion.sectionCounts.main}
                />
                <StatBlock
                  label="Ride"
                  value={deck.currentVersion.sectionCounts.ride}
                />
                <StatBlock
                  label="G"
                  value={deck.currentVersion.sectionCounts.g}
                />
                <StatBlock
                  label="Total"
                  value={deck.currentVersion.totalCards}
                  tone="accent"
                />
              </StatGrid>

              <p className="text-sm text-muted-foreground">
                This read-side uses canonical card identity for composition. It
                does not switch to printing-level ownership or legality state.
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
                            className="rounded-lg border border-border/70 bg-background-elevated/76 p-3"
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
        </ItemCard>
      }
    />
  )
}
