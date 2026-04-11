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
import type { CatalogProductDetailViewModel } from '@/features/catalog/catalog-product-detail.types'
import {
  buildCatalogCardDetailHref,
  buildCatalogPrintingDetailHref,
} from '@/features/catalog/catalog-routes'

interface CatalogProductDetailViewProps {
  readonly detail: CatalogProductDetailViewModel
}

export function CatalogProductDetailView({
  detail,
}: CatalogProductDetailViewProps) {
  const { printings, product, summary } = detail

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
              <Badge variant="secondary">Product / set</Badge>
              <Badge variant="outline">{product.officialCode}</Badge>
            </>
          }
          title={product.name}
          description="Release-centric catalog page. This product groups published concrete printings; canonical cards are referenced from those printings without replacing the product as the page identity."
          meta={
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{product.canonicalKey}</span>
              <span aria-hidden="true">|</span>
              <span>{product.releaseDate}</span>
              <span aria-hidden="true">|</span>
              <span>{summary.printingCount} published printings</span>
            </div>
          }
          actions={
            <Link
              href="/catalog"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ArrowLeft className="size-4" />
              Back to catalog
            </Link>
          }
        />
      }
      main={
        <PageSection className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Printing list</CardTitle>
              <CardDescription>
                Concrete printings published in this release. Canonical card
                entities stay linked from each printing instead of replacing the
                printing identity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {printings.length > 0 ? (
                printings.map((printing) => (
                  <ItemCard
                    key={printing.id}
                    title={printing.printedName ?? printing.card.name}
                    subtitle={`Collector #${printing.collectorNumber}`}
                    badges={
                      <>
                        <Badge variant="outline">{printing.rarity}</Badge>
                        <Badge variant="secondary">
                          {formatCardType(printing.card.cardType)}
                        </Badge>
                        <Badge variant="outline">
                          {printing.localeCode.toUpperCase()}
                        </Badge>
                        {printing.card.triggerType ? (
                          <Badge variant="accent">
                            {formatToken(printing.card.triggerType)}
                          </Badge>
                        ) : null}
                        {printing.isPromoVariant ? (
                          <Badge variant="accent">Promo</Badge>
                        ) : null}
                        {printing.isAlternateArt ? (
                          <Badge variant="warning">Alt art</Badge>
                        ) : null}
                      </>
                    }
                    actions={
                      <>
                        <Link
                          href={buildCatalogPrintingDetailHref(
                            printing.printingKey,
                          )}
                          className={buttonVariants({
                            variant: 'outline',
                            size: 'sm',
                          })}
                        >
                          Printing detail
                          <ArrowRight className="size-4" />
                        </Link>
                        <Link
                          href={buildCatalogCardDetailHref(
                            printing.card.canonicalKey,
                          )}
                          className={buttonVariants({
                            variant: 'ghost',
                            size: 'sm',
                          })}
                        >
                          Card detail
                          <ArrowRight className="size-4" />
                        </Link>
                      </>
                    }
                    className="bg-background-elevated/40"
                    contentClassName="text-sm text-muted-foreground"
                    footer={
                      <>
                        <span>{printing.printingKey}</span>
                        <span>Grade {printing.card.grade}</span>
                      </>
                    }
                  >
                    <p>Canonical card: {printing.card.name}</p>
                    <p>
                      Nation: {printing.card.nation}
                      {printing.card.clan ? ` / ${printing.card.clan}` : ''}
                    </p>
                    {printing.regionCode ? (
                      <p>Region: {printing.regionCode.toUpperCase()}</p>
                    ) : null}
                  </ItemCard>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No concrete printings are currently published for this
                  product.
                </p>
              )}
            </CardContent>
          </Card>
        </PageSection>
      }
      aside={
        <PageSection className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Release info</CardTitle>
              <CardDescription>
                Product-level metadata for this release container.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{product.productCategory}</Badge>
                <Badge variant="outline">{product.productKind}</Badge>
                <Badge variant="outline">{product.family.displayName}</Badge>
              </div>
              <StatGrid columns={2}>
                <StatBlock label="Code" value={product.officialCode} />
                <StatBlock label="Release" value={product.releaseDate} />
                <StatBlock
                  label="Family"
                  value={product.family.displayName}
                  hint={product.family.lineage}
                />
                <StatBlock
                  label="Region"
                  value={product.regionCode?.toUpperCase() ?? 'Unspecified'}
                />
              </StatGrid>
              {product.cycleKey ? (
                <p className="text-sm text-muted-foreground">
                  Cycle: {product.cycleKey}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Release summary</CardTitle>
              <CardDescription>
                Compact counts derived from the product printing list.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatGrid columns={2}>
                <StatBlock label="Printings" value={summary.printingCount} />
                <StatBlock
                  label="Unique cards"
                  value={summary.uniqueCardCount}
                />
                <StatBlock
                  label="Promo printings"
                  value={summary.promoPrintingCount}
                />
                <StatBlock
                  label="Alt art printings"
                  value={summary.alternateArtPrintingCount}
                />
              </StatGrid>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Locales:{' '}
                  {summary.localeCodes.length > 0
                    ? summary.localeCodes.join(', ').toUpperCase()
                    : 'None published'}
                </p>
                <p>
                  Rarities:{' '}
                  {summary.rarities.length > 0
                    ? summary.rarities.join(', ')
                    : 'None published'}
                </p>
              </div>
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
