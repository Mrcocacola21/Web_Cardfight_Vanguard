import type { ReactNode } from 'react'
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
import { Separator } from '@/components/ui/separator'
import type { CatalogCardDetailViewModel } from '@/features/catalog/catalog-detail.types'
import {
  buildCatalogPrintingDetailHref,
  buildCatalogProductDetailHref,
} from '@/features/catalog/catalog-routes'

interface CatalogCardDetailViewProps {
  readonly detail: CatalogCardDetailViewModel
}

export function CatalogCardDetailView({ detail }: CatalogCardDetailViewProps) {
  const { card, legality, printings, relatedProducts, rules } = detail

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
              <Badge variant="secondary">Card entity</Badge>
            </>
          }
          title={card.name}
          description="Canonical card detail. Printings, legality facts, and related products are shown as linked catalog facts beneath the card entity."
          meta={
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{card.canonicalKey}</span>
              <span aria-hidden="true">|</span>
              <span>{printings.length} printings</span>
              <span aria-hidden="true">|</span>
              <span>{relatedProducts.length} related products</span>
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
            <CardHeader className="gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Grade {card.grade}</Badge>
                <Badge variant="outline">{formatCardType(card.cardType)}</Badge>
                {card.triggerType ? (
                  <Badge variant="accent">
                    {formatToken(card.triggerType)}
                  </Badge>
                ) : null}
                {card.clan ? (
                  <Badge variant="outline">{card.clan}</Badge>
                ) : null}
              </div>
              <div className="space-y-1">
                <CardTitle>Canonical card entity</CardTitle>
                <CardDescription>
                  This page is centered on the gameplay-facing card identity.
                  Concrete printings and products stay in their own sections.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <StatGrid columns={4}>
                <StatBlock label="Nation" value={card.nation} />
                <StatBlock label="Race" value={card.race ?? '-'} />
                <StatBlock label="Power" value={card.basePower ?? '-'} />
                <StatBlock label="Critical" value={card.baseCritical ?? '-'} />
                <StatBlock label="Shield" value={card.baseShield ?? '-'} />
                <StatBlock
                  label="Trigger"
                  value={card.triggerType ? formatToken(card.triggerType) : '-'}
                />
                <StatBlock
                  label="Keywords"
                  value={card.keywords.length}
                  hint={
                    card.keywords.length > 0
                      ? card.keywords.join(', ')
                      : 'No keyword tags'
                  }
                />
                <StatBlock
                  label="Rules refs"
                  value={rules.effectReferences.length}
                  hint="Current catalog truth publishes effect references rather than literal oracle text."
                />
              </StatGrid>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rules & references</CardTitle>
              <CardDescription>
                Literal oracle text is not modeled in the current catalog truth
                yet. This screen shows the published rules-facing references
                that currently back the canonical card record.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {rules.effectReferences.length > 0 ? (
                <ul className="space-y-2">
                  {rules.effectReferences.map((effectReference) => (
                    <li
                      key={effectReference}
                      className="rounded-xl border border-border/70 bg-background-elevated/76 px-3 py-2 font-mono text-sm text-foreground-secondary"
                    >
                      {effectReference}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No published rules references are attached to this canonical
                  card yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Legality facts</CardTitle>
              <CardDescription>
                Card-level eligibility and restriction facts derived from the
                legality data layer. This section does not run deck legality
                validation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <LegalitySection
                title="Format eligibility"
                emptyCopy="No published format eligibility facts are available for this card."
                items={legality.eligibilityOverrides.map((entry) => (
                  <ItemCard
                    key={`${entry.ruleProfileId}:${entry.eligibilityState}`}
                    title={entry.formatName}
                    subtitle={entry.ruleProfileName}
                    badges={
                      <Badge
                        variant={getEligibilityBadgeVariant(
                          entry.eligibilityState,
                        )}
                      >
                        {formatToken(entry.eligibilityState)}
                      </Badge>
                    }
                    className="bg-background-elevated/40"
                    contentClassName="text-sm text-muted-foreground"
                  >
                    <p>
                      {entry.rationale ??
                        'No rationale is currently published for this eligibility override.'}
                    </p>
                  </ItemCard>
                ))}
              />

              <Separator />

              <LegalitySection
                title="Restriction lists"
                emptyCopy="No active card restriction entries are published for this card."
                items={legality.restrictions.map((entry) => (
                  <ItemCard
                    key={`${entry.ruleProfileId}:${entry.restrictionType}:${entry.versionLabel}`}
                    title={entry.formatName}
                    subtitle={entry.ruleProfileName}
                    badges={
                      <>
                        <Badge
                          variant={getRestrictionBadgeVariant(
                            entry.restrictionType,
                          )}
                        >
                          {formatToken(entry.restrictionType)}
                        </Badge>
                        {entry.maxCopies !== null ? (
                          <Badge variant="outline">
                            Max {entry.maxCopies} copies
                          </Badge>
                        ) : null}
                      </>
                    }
                    className="bg-background-elevated/40"
                    contentClassName="text-sm text-muted-foreground"
                    footer={
                      <>
                        <span>{entry.versionLabel}</span>
                        <span>{entry.effectiveFrom}</span>
                      </>
                    }
                  >
                    <p>
                      {entry.note ??
                        'No additional note is published for this restriction.'}
                    </p>
                    {entry.sourceReference ? (
                      <p>Source: {entry.sourceReference}</p>
                    ) : null}
                  </ItemCard>
                ))}
              />

              <Separator />

              <LegalitySection
                title="Choice restrictions"
                emptyCopy="No active choice restriction groups include this card."
                items={legality.choiceRestrictions.map((entry) => (
                  <ItemCard
                    key={`${entry.ruleProfileId}:${entry.versionLabel}:${entry.allowedChoices}`}
                    title={entry.formatName}
                    subtitle={entry.ruleProfileName}
                    badges={
                      <Badge variant="warning">
                        Choose {entry.allowedChoices}
                      </Badge>
                    }
                    className="bg-background-elevated/40"
                    contentClassName="text-sm text-muted-foreground"
                    footer={
                      <>
                        <span>{entry.versionLabel}</span>
                        <span>{entry.effectiveFrom}</span>
                      </>
                    }
                  >
                    <p>
                      {entry.note ??
                        'This card participates in an active choice restriction group.'}
                    </p>
                    {entry.sourceReference ? (
                      <p>Source: {entry.sourceReference}</p>
                    ) : null}
                  </ItemCard>
                ))}
              />
            </CardContent>
          </Card>
        </PageSection>
      }
      aside={
        <PageSection className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Printings</CardTitle>
              <CardDescription>
                Concrete editions tied to this canonical card entity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {printings.length > 0 ? (
                printings.map((printing) => (
                  <ItemCard
                    key={printing.id}
                    title={printing.product.name}
                    subtitle={`#${printing.collectorNumber}`}
                    badges={
                      <>
                        <Badge variant="outline">{printing.rarity}</Badge>
                        <Badge variant="secondary">
                          {printing.product.officialCode}
                        </Badge>
                        <Badge variant="outline">
                          {printing.localeCode.toUpperCase()}
                        </Badge>
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
                          href={buildCatalogProductDetailHref(
                            printing.product.canonicalKey,
                          )}
                          className={buttonVariants({
                            variant: 'ghost',
                            size: 'sm',
                          })}
                        >
                          Release page
                          <ArrowRight className="size-4" />
                        </Link>
                      </>
                    }
                    className="bg-background-elevated/40"
                    contentClassName="text-sm text-muted-foreground"
                    footer={
                      <>
                        <span>{printing.printingKey}</span>
                        <span>{printing.product.releaseDate}</span>
                      </>
                    }
                  >
                    <p>
                      Printed name:{' '}
                      {printing.printedName ?? 'Uses the canonical card name.'}
                    </p>
                    <p>
                      Product category: {printing.product.productCategory} /{' '}
                      {printing.product.productKind}
                    </p>
                    {printing.regionCode ? (
                      <p>Region: {printing.regionCode.toUpperCase()}</p>
                    ) : null}
                  </ItemCard>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No concrete printings are currently published for this card.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Related products</CardTitle>
              <CardDescription>
                Product appearances derived from the published printing list.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {relatedProducts.length > 0 ? (
                relatedProducts.map((product) => (
                  <ItemCard
                    key={product.id}
                    title={product.name}
                    subtitle={product.officialCode}
                    badges={
                      <>
                        <Badge variant="secondary">
                          {product.productCategory}
                        </Badge>
                        <Badge variant="outline">{product.productKind}</Badge>
                      </>
                    }
                    actions={
                      <Link
                        href={buildCatalogProductDetailHref(
                          product.canonicalKey,
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
                    className="bg-background-elevated/40"
                    contentClassName="text-sm text-muted-foreground"
                    footer={
                      <>
                        <span>{product.printingCount} printings</span>
                        <span>{product.releaseDate}</span>
                      </>
                    }
                  >
                    <p>
                      Rarities: {product.rarities.join(', ') || 'Unspecified'}
                    </p>
                    <p>
                      Locales: {product.localeCodes.join(', ').toUpperCase()}
                    </p>
                  </ItemCard>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No related products can be derived until at least one printing
                  is published.
                </p>
              )}
            </CardContent>
          </Card>
        </PageSection>
      }
    />
  )
}

interface LegalitySectionProps {
  readonly title: string
  readonly emptyCopy: string
  readonly items: readonly ReactNode[]
}

function LegalitySection({ title, emptyCopy, items }: LegalitySectionProps) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">{title}</h2>
      </div>
      {items.length > 0 ? (
        <div className="grid gap-3">{items}</div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyCopy}</p>
      )}
    </section>
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

function getRestrictionBadgeVariant(
  restrictionType: string,
): 'destructive' | 'warning' | 'success' | 'outline' {
  if (restrictionType === 'banned') {
    return 'destructive'
  }

  if (restrictionType === 'limited' || restrictionType === 'semi-limited') {
    return 'warning'
  }

  if (restrictionType === 'unrestricted') {
    return 'success'
  }

  return 'outline'
}

function getEligibilityBadgeVariant(
  eligibilityState: string,
): 'success' | 'warning' | 'destructive' | 'outline' {
  if (eligibilityState === 'allowed' || eligibilityState === 'eligible') {
    return 'success'
  }

  if (eligibilityState === 'disallowed' || eligibilityState === 'ineligible') {
    return 'destructive'
  }

  return 'outline'
}
