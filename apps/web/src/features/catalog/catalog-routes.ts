export function buildCatalogCardDetailHref(canonicalKey: string): string {
  return `/catalog/${encodeURIComponent(canonicalKey)}`
}

export function buildCatalogPrintingDetailHref(printingKey: string): string {
  return `/catalog/printings/${encodeURIComponent(printingKey)}`
}

export function buildCatalogProductDetailHref(productKey: string): string {
  return `/catalog/products/${encodeURIComponent(productKey)}`
}
