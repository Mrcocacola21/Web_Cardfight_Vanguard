import Link from 'next/link'
import {
  defaultCatalogPageSize,
  getCatalogActiveFormatFilterProfile,
  getCatalogApplicableFilterKeys,
  getDefaultCatalogSort,
  type CatalogQuery,
} from '@web-vg/catalog'
import type { CatalogCardEntityListRecord } from '@web-vg/db/repositories/catalog'
import { ArrowLeft, ArrowRight, FilterX } from 'lucide-react'

import {
  FilterBar,
  FilterSelect,
  ItemCard,
  SearchBar,
  StatBlock,
  StatGrid,
} from '@/components/data-display'
import { EmptyState } from '@/components/feedback'
import { DashboardPageLayout, PageHeader } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  catalogCardTypeOptions,
  catalogClanOptions,
  catalogEraOptions,
  catalogFormatOptions,
  catalogNationOptions,
  catalogRarityOptions,
  catalogSetOptions,
  catalogTriggerOptions,
  withCurrentCatalogFilterOption,
} from '@/features/catalog/catalog-filter-options'
import {
  buildCatalogCardListHref,
  hasActiveCatalogCardListQuery,
} from '@/features/catalog/catalog-list-query'

interface CatalogListViewProps {
  readonly query: CatalogQuery
  readonly listing: CatalogCardEntityListRecord
}

export function CatalogListView({ query, listing }: CatalogListViewProps) {
  const hasActiveQuery = hasActiveCatalogCardListQuery(query)
  const currentFormatId = query.filters.formatIds[0] ?? ''
  const currentEra = query.filters.eras[0] ?? ''
  const currentNation = query.filters.nations[0] ?? ''
  const currentClan = query.filters.clans[0] ?? ''
  const currentCardType = query.filters.cardTypes[0] ?? ''
  const currentTriggerType = query.filters.triggerTypes[0] ?? ''
  const currentRarity = query.filters.rarities[0] ?? ''
  const currentSetKey = query.filters.productKeys[0] ?? ''
  const defaultSort = getDefaultCatalogSort('card-entity', query.searchText)
  const activeFormatProfile = getCatalogActiveFormatFilterProfile(
    query.filters.formatIds,
  )
  const applicableFilterKeys = getCatalogApplicableFilterKeys(
    query.filters.formatIds,
  )
  const nationFilterEnabled = applicableFilterKeys.includes('nation')
  const clanFilterEnabled = applicableFilterKeys.includes('clan')
  const sortOptions = query.searchText
    ? [
        { value: 'relevance', label: 'Best match' },
        { value: 'name-asc', label: 'Name A-Z' },
        { value: 'grade-asc', label: 'Grade ascending' },
      ]
    : [
        { value: 'name-asc', label: 'Name A-Z' },
        { value: 'grade-asc', label: 'Grade ascending' },
      ]

  return (
    <DashboardPageLayout
      containerSize="wide"
      className="min-h-screen"
      header={
        <PageHeader
          eyebrow={
            <>
              <Badge variant="outline">Catalog</Badge>
              <Badge variant="secondary">Card entities</Badge>
            </>
          }
          title="Card Catalog"
          description="Server-rendered card list flow driven by the catalog query module. Search, filters, sorting, and pagination all round-trip through the URL."
          meta={
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{listing.totalCount} total matches</span>
              <span aria-hidden="true">|</span>
              <span>
                Page {listing.page} of {listing.pageCount}
              </span>
              <span aria-hidden="true">|</span>
              <span>Entity-centric list</span>
            </div>
          }
        />
      }
      contentClassName="flex flex-col gap-6"
    >
      <form action="/catalog" className="grid gap-4">
        {query.window.pageSize !== defaultCatalogPageSize ? (
          <input
            type="hidden"
            name="pageSize"
            value={String(query.window.pageSize)}
          />
        ) : null}

        <FilterBar>
          <FilterSelect
            label="Format"
            name="format"
            defaultValue={currentFormatId}
            options={withCurrentCatalogFilterOption(
              catalogFormatOptions,
              currentFormatId,
            )}
            className="min-w-44"
          />

          <SearchBar
            label="Search cards"
            name="q"
            defaultValue={query.searchText ?? ''}
            placeholder="Search by card name"
            className="min-w-0 flex-1 sm:min-w-72"
          />

          <FilterSelect
            label="Era"
            name="era"
            defaultValue={currentEra}
            options={withCurrentCatalogFilterOption(
              catalogEraOptions,
              currentEra,
            )}
            className="min-w-40"
          />

          <FilterSelect
            label="Sort"
            name="sort"
            defaultValue={query.sort === defaultSort ? defaultSort : query.sort}
            options={sortOptions}
            className="min-w-44"
          />

          <div className="flex items-end gap-2 sm:ml-auto">
            <Button type="submit" size="sm">
              Apply
            </Button>
            {hasActiveQuery ? (
              <Link
                href="/catalog"
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                <FilterX className="size-4" />
                Reset
              </Link>
            ) : null}
          </div>
        </FilterBar>

        <FilterBar className="items-start">
          <FilterSelect
            label="Set"
            name="set"
            defaultValue={currentSetKey}
            options={withCurrentCatalogFilterOption(
              catalogSetOptions,
              currentSetKey,
            )}
            className="min-w-60"
          />

          <FilterSelect
            label="Nation"
            name="nation"
            defaultValue={currentNation}
            options={withCurrentCatalogFilterOption(
              catalogNationOptions,
              currentNation,
            )}
            className="min-w-44"
            disabled={!nationFilterEnabled}
          />

          <FilterSelect
            label="Clan"
            name="clan"
            defaultValue={currentClan}
            options={withCurrentCatalogFilterOption(
              catalogClanOptions,
              currentClan,
            )}
            className="min-w-44"
            disabled={!clanFilterEnabled}
          />

          <FilterSelect
            label="Type"
            name="type"
            defaultValue={currentCardType}
            options={withCurrentCatalogFilterOption(
              catalogCardTypeOptions,
              currentCardType,
            )}
            className="min-w-44"
          />

          <FilterSelect
            label="Trigger"
            name="trigger"
            defaultValue={currentTriggerType}
            options={withCurrentCatalogFilterOption(
              catalogTriggerOptions,
              currentTriggerType,
            )}
            className="min-w-40"
          />

          <FilterSelect
            label="Rarity"
            name="rarity"
            defaultValue={currentRarity}
            options={withCurrentCatalogFilterOption(
              catalogRarityOptions,
              currentRarity,
            )}
            className="min-w-40"
          />
        </FilterBar>

        <p className="text-xs leading-5 text-muted-foreground">
          Era, rarity, and set filters stay entity-centric by matching
          printings/products first, then surfacing canonical cards whose
          published printings satisfy that scope.
        </p>
      </form>

      <StatGrid columns={3}>
        <StatBlock label="Matches" value={listing.totalCount} />
        <StatBlock
          label="Format"
          value={activeFormatProfile?.label ?? 'Any format'}
          hint={
            activeFormatProfile
              ? activeFormatProfile.preferredIdentityFilter === 'nation'
                ? 'Nation-led filtering for this format profile.'
                : 'Clan-led filtering for this format profile.'
              : 'Format selection is optional, but it drives filter applicability when present.'
          }
        />
        <StatBlock
          label="Scope"
          value="Card entities"
          hint="Set and rarity filters stay printing-derived, but the visible results remain canonical cards."
        />
      </StatGrid>

      {listing.items.length === 0 ? (
        <EmptyState
          title={
            hasActiveQuery
              ? 'No cards match this query'
              : 'No cards published yet'
          }
          description={
            hasActiveQuery
              ? 'Try clearing the current search or filters. The list route is working, but the current entity-centric query returned no results.'
              : 'The catalog read-side is connected, but the current dataset does not expose any canonical card entities.'
          }
          actionLabel={hasActiveQuery ? 'Clear filters' : 'Back home'}
          actionHref={hasActiveQuery ? '/catalog' : '/'}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {listing.items.map((card) => (
              <ItemCard
                key={card.id}
                title={card.name}
                subtitle={
                  card.clan ? `${card.nation} / ${card.clan}` : card.nation
                }
                badges={
                  <>
                    <Badge variant="secondary">Grade {card.grade}</Badge>
                    <Badge variant="outline">
                      {formatCardType(card.cardType)}
                    </Badge>
                    {card.triggerType ? (
                      <Badge variant="accent">
                        {formatTriggerType(card.triggerType)}
                      </Badge>
                    ) : null}
                  </>
                }
                contentClassName="text-sm text-muted-foreground"
                footer={
                  <>
                    <span className="truncate text-xs text-muted-foreground">
                      {card.canonicalKey}
                    </span>
                    <Link
                      href={`/catalog/${encodeURIComponent(card.canonicalKey)}`}
                      className={buttonVariants({
                        variant: 'outline',
                        size: 'sm',
                      })}
                    >
                      View card
                      <ArrowRight className="size-4" />
                    </Link>
                  </>
                }
              >
                <div className="space-y-1">
                  <p>Canonical key: {card.canonicalKey}</p>
                  {card.race ? <p>Race: {card.race}</p> : null}
                </div>
                <StatGrid columns={3}>
                  <StatBlock label="Power" value={card.basePower ?? '-'} />
                  <StatBlock
                    label="Critical"
                    value={card.baseCritical ?? '-'}
                  />
                  <StatBlock label="Shield" value={card.baseShield ?? '-'} />
                </StatGrid>
              </ItemCard>
            ))}
          </div>

          {listing.pageCount > 1 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background-elevated/72 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing page {listing.page} of {listing.pageCount}. Total
                matches: {listing.totalCount}.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {listing.hasPreviousPage ? (
                  <Link
                    href={buildCatalogCardListHref({
                      ...query,
                      window: {
                        ...query.window,
                        page: listing.page - 1,
                      },
                    })}
                    className={buttonVariants({
                      variant: 'outline',
                      size: 'sm',
                    })}
                  >
                    <ArrowLeft className="size-4" />
                    Previous
                  </Link>
                ) : (
                  <span
                    className={buttonVariants({
                      variant: 'outline',
                      size: 'sm',
                    })}
                    aria-disabled="true"
                  >
                    <ArrowLeft className="size-4" />
                    Previous
                  </span>
                )}

                <span className="rounded-lg border border-border/70 bg-background px-3 py-1.5 text-sm text-foreground-secondary">
                  Page {listing.page}
                </span>

                {listing.hasNextPage ? (
                  <Link
                    href={buildCatalogCardListHref({
                      ...query,
                      window: {
                        ...query.window,
                        page: listing.page + 1,
                      },
                    })}
                    className={buttonVariants({
                      variant: 'outline',
                      size: 'sm',
                    })}
                  >
                    Next
                    <ArrowRight className="size-4" />
                  </Link>
                ) : (
                  <span
                    className={buttonVariants({
                      variant: 'outline',
                      size: 'sm',
                    })}
                    aria-disabled="true"
                  >
                    Next
                    <ArrowRight className="size-4" />
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </DashboardPageLayout>
  )
}

function formatCardType(cardType: string): string {
  return cardType
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatTriggerType(triggerType: string): string {
  return triggerType.charAt(0).toUpperCase() + triggerType.slice(1)
}
