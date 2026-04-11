import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { ItemCard, StatBlock, StatGrid } from '@/components/data-display'
import { DetailPageLayout, PageHeader, PageSection } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { CatalogPrintingDetailViewModel } from '@/features/catalog/catalog-printing-detail.types'
import {
  buildCatalogCardDetailHref,
  buildCatalogPrintingDetailHref,
  buildCatalogProductDetailHref,
} from '@/features/catalog/catalog-routes'

interface CatalogPrintingDetailViewProps {
  readonly detail: CatalogPrintingDetailViewModel
}

export function CatalogPrintingDetailView({
  detail,
}: CatalogPrintingDetailViewProps) {
  const { printing, siblingPrintings } = detail

  return (
    <DetailPageLayout
      containerSize="wide"
      variant="content-aside"
      className="min-h-screen"
      header={
        <PageHeader
          eyebrow={
            <>
              <Badge variant="outline">Catalog</Badge>
              <Badge variant="secondary">Printing</Badge>
              <Badge variant="outline">{printing.rarity}</Badge>
              <Badge variant="outline">{printing.product.officialCode}</Badge>
            </>
          }
          title={printing.printedName ?? printing.card.name}
          description="Printing-centric detail. This page is anchored to one concrete edition and links back to its canonical card entity and release container."
          meta={
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{printing.printingKey}</span>
              <span aria-hidden="true">|</span>
              <span>Collector #{printing.collectorNumber}</span>
              <span aria-hidden="true">|</span>
              <span>{printing.product.releaseDate}</span>
            </div>
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href={buildCatalogProductDetailHref(
                  printing.product.canonicalKey,
                )}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <ArrowLeft className="size-4" />
                Release page
              </Link>
              <Link
                href={buildCatalogCardDetailHref(printing.card.canonicalKey)}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                Canonical card
                <ArrowRight className="size-4" />
              </Link>
            </div>
          }
        />
      }
      main={
        <PageSection className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Printing facts</CardTitle>
              <CardDescription>
                Concrete release-facing metadata for this printed instance.
                These fields do not replace the canonical card identity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{printing.product.name}</Badge>
                <Badge variant="outline">
                  {printing.localeCode.toUpperCase()}
                </Badge>
                {printing.isPromoVariant ? (
                  <Badge variant="accent">Promo</Badge>
                ) : null}
                {printing.isAlternateArt ? (
                  <Badge variant="warning">Alt art</Badge>
                ) : null}
              </div>

              <StatGrid columns={3}>
                <StatBlock label="Collector" value={printing.collectorNumber} />
                <StatBlock label="Rarity" value={printing.rarity} />
                <StatBlock
                  label="Locale"
                  value={printing.localeCode.toUpperCase()}
                />
                <StatBlock
                  label="Region"
                  value={printing.regionCode?.toUpperCase() ?? 'Unspecified'}
                />
                <StatBlock
                  label="Release"
                  value={printing.product.officialCode}
                />
                <StatBlock
                  label="Art"
                  value={printing.artVariant ?? 'Base art'}
                />
              </StatGrid>

              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  Printed name:{' '}
                  {printing.printedName ?? 'Uses the canonical card name.'}
                </p>
                <p>
                  Product category: {printing.product.productCategory} /{' '}
                  {printing.product.productKind}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Release context</CardTitle>
              <CardDescription>
                Product-level context for the release that contains this
                printing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ItemCard
                title={printing.product.name}
                subtitle={printing.product.officialCode}
                badges={
                  <>
                    <Badge variant="secondary">
                      {printing.product.productCategory}
                    </Badge>
                    <Badge variant="outline">
                      {printing.product.productKind}
                    </Badge>
                  </>
                }
                actions={
                  <Link
                    href={buildCatalogProductDetailHref(
                      printing.product.canonicalKey,
                    )}
                    className={buttonVariants({
                      variant: 'outline',
                      size: 'sm',
                    })}
                  >
                    Open release
                    <ArrowRight className="size-4" />
                  </Link>
                }
                contentClassName="text-sm text-muted-foreground"
              >
                <p>Release date: {printing.product.releaseDate}</p>
                {printing.product.regionCode ? (
                  <p>Region: {printing.product.regionCode.toUpperCase()}</p>
                ) : null}
                {printing.product.cycleKey ? (
                  <p>Cycle: {printing.product.cycleKey}</p>
                ) : null}
              </ItemCard>
            </CardContent>
          </Card>
        </PageSection>
      }
      aside={
        <PageSection className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Canonical card entity</CardTitle>
              <CardDescription>
                Gameplay-facing identity referenced by this printing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ItemCard
                title={printing.card.name}
                subtitle={printing.card.canonicalKey}
                badges={
                  <>
                    <Badge variant="secondary">
                      Grade {printing.card.grade}
                    </Badge>
                    <Badge variant="outline">
                      {formatCardType(printing.card.cardType)}
                    </Badge>
                    {printing.card.triggerType ? (
                      <Badge variant="accent">
                        {formatToken(printing.card.triggerType)}
                      </Badge>
                    ) : null}
                    {printing.card.clan ? (
                      <Badge variant="outline">{printing.card.clan}</Badge>
                    ) : null}
                  </>
                }
                actions={
                  <Link
                    href={buildCatalogCardDetailHref(
                      printing.card.canonicalKey,
                    )}
                    className={buttonVariants({
                      variant: 'outline',
                      size: 'sm',
                    })}
                  >
                    Card detail
                    <ArrowRight className="size-4" />
                  </Link>
                }
                contentClassName="text-sm text-muted-foreground"
              >
                <p>
                  Nation: {printing.card.nation}
                  {printing.card.clan ? ` / ${printing.card.clan}` : ''}
                </p>
                {printing.card.race ? <p>Race: {printing.card.race}</p> : null}
                <StatGrid columns={3}>
                  <StatBlock
                    label="Power"
                    value={printing.card.basePower ?? '-'}
                  />
                  <StatBlock
                    label="Critical"
                    value={printing.card.baseCritical ?? '-'}
                  />
                  <StatBlock
                    label="Shield"
                    value={printing.card.baseShield ?? '-'}
                  />
                </StatGrid>
              </ItemCard>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Other printings of this card</CardTitle>
              <CardDescription>
                Nearby concrete editions linked to the same canonical card.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {siblingPrintings.length > 0 ? (
                siblingPrintings.map((sibling) => (
                  <ItemCard
                    key={sibling.id}
                    title={sibling.product.name}
                    subtitle={`#${sibling.collectorNumber}`}
                    badges={
                      <>
                        <Badge variant="outline">{sibling.rarity}</Badge>
                        <Badge variant="secondary">
                          {sibling.product.officialCode}
                        </Badge>
                      </>
                    }
                    actions={
                      <Link
                        href={buildCatalogPrintingDetailHref(
                          sibling.printingKey,
                        )}
                        className={buttonVariants({
                          variant: 'outline',
                          size: 'sm',
                        })}
                      >
                        Open printing
                        <ArrowRight className="size-4" />
                      </Link>
                    }
                    className="bg-background-elevated/40"
                    contentClassName="text-sm text-muted-foreground"
                  >
                    <p>
                      Printed name:{' '}
                      {sibling.printedName ?? 'Uses the canonical card name.'}
                    </p>
                    <p>{sibling.printingKey}</p>
                  </ItemCard>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No additional printings are currently published for this
                  canonical card.
                </p>
              )}
            </CardContent>
          </Card>
        </PageSection>
      }
    />
  )
}

function formatCardType(cardType: string): string {
  return cardType
    .split('-')
    .map((part) => formatToken(part))
    .join(' ')
}

function formatToken(value: string): string {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
