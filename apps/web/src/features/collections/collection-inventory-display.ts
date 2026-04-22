import type { StoredCollectionInventoryItem } from '@/features/collections/application/collection-inventory-repository'
import type { StoredCollectionPrintingPreferenceItem } from '@/features/collections/application/collection-preference-repository'
import { buildCatalogPrintingDetailHref } from '@/features/catalog/catalog-routes'

type CollectionPrintingDisplayItem =
  | StoredCollectionInventoryItem
  | StoredCollectionPrintingPreferenceItem

export function getCollectionInventoryItemTitle(
  item: CollectionPrintingDisplayItem,
) {
  return (
    item.printing?.printedName ??
    item.printing?.card?.name ??
    'Catalog printing unavailable'
  )
}

export function getCollectionInventoryItemPrintingLabel(
  item: CollectionPrintingDisplayItem,
) {
  if (!item.printing) {
    return `Printing reference: ${item.cardPrintingId}`
  }

  return `${item.printing.product?.officialCode ?? 'Unknown set'} #${item.printing.collectorNumber}`
}

export function getCollectionInventoryItemProductLabel(
  item: CollectionPrintingDisplayItem,
) {
  if (!item.printing?.product) {
    return 'Published release metadata is currently unavailable.'
  }

  return `${item.printing.product.name} (${item.printing.product.officialCode})`
}

export function getCollectionInventoryItemCardMeta(
  item: CollectionPrintingDisplayItem,
) {
  if (!item.printing?.card) {
    return 'Printing metadata could not be resolved from the current catalog read model.'
  }

  const card = item.printing.card
  const segments = [
    `Grade ${card.grade}`,
    formatTokenizedLabel(card.cardType),
    card.nation,
  ]

  if (card.clan) {
    segments.push(card.clan)
  }

  if (card.triggerType) {
    segments.push(formatTokenizedLabel(card.triggerType))
  }

  return segments.join(' | ')
}

export function getCollectionInventoryItemVariantLabels(
  item: CollectionPrintingDisplayItem,
) {
  if (!item.printing) {
    return ['Stale catalog link']
  }

  const labels: string[] = []

  if (item.printing.isAlternateArt) {
    labels.push('Alt art')
  }

  if (item.printing.isPromoVariant) {
    labels.push('Promo')
  }

  if (item.printing.artVariant) {
    labels.push(item.printing.artVariant)
  }

  return labels
}

export function getCollectionInventoryItemDetailHref(
  item: CollectionPrintingDisplayItem,
) {
  if (!item.printing?.printingKey) {
    return null
  }

  return buildCatalogPrintingDetailHref(item.printing.printingKey)
}

function formatTokenizedLabel(value: string) {
  return value
    .split('-')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}
