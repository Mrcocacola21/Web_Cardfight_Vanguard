import type { CardId, ProductId } from '@web-vg/shared'

import type { CardPrintingKey } from './catalog-identifiers'
import type { LocaleCode, Rarity, RegionCode } from './products'

export type CatalogPublicationNormalizationStatus =
  | 'auto_resolved'
  | 'manually_resolved'
  | 'unresolved'
  | 'ambiguous'
  | 'blocked_for_review'
  | 'superseded'

export type PublishableCatalogPublicationNormalizationStatus =
  | 'auto_resolved'
  | 'manually_resolved'

export interface CatalogPublicationTraceability {
  readonly importJobId: string
  readonly normalizationResultId: string
  readonly rawCardPrintingId: string
  readonly rawProductId: string | null
}

export interface CatalogPublicationCandidate {
  readonly importJobId: string
  readonly normalizationResultId: string
  readonly rawCardPrintingId: string
  readonly rawProductId: string | null
  readonly normalizationStatus: CatalogPublicationNormalizationStatus
  readonly cardEntityId: string | null
}

export interface PublishableCatalogPublicationCandidate extends CatalogPublicationCandidate {
  readonly normalizationStatus: PublishableCatalogPublicationNormalizationStatus
  readonly cardEntityId: string
}

export interface CatalogPrintingPublicationUnit {
  readonly printingKey: CardPrintingKey
  readonly cardId: CardId
  readonly productId: ProductId
  readonly collectorNumber: string
  readonly rarity: Rarity
  readonly locale: LocaleCode
  readonly region: RegionCode | null
  readonly printedName: string | null
  readonly artVariant: string | null
  readonly isAlternateArt: boolean
  readonly isPromoVariant: boolean
  readonly traceability: CatalogPublicationTraceability
}

export type CatalogPublicationSkipReason =
  | 'non_publishable_status'
  | 'missing_card_entity'
  | 'missing_catalog_product'
  | 'missing_printing_identity'

export interface CatalogPublicationSkippedResult {
  readonly normalizationResultId: string
  readonly reason: CatalogPublicationSkipReason
}

export interface CatalogPublicationRequest {
  readonly importJobId: string
  readonly normalizationResultIds?: readonly string[]
  readonly dryRun?: boolean
}

export interface CatalogPublicationError {
  readonly code: 'publication-failed'
  readonly message: string
  readonly details?: string
}

export type CatalogPublicationResult<TData = CatalogPublicationSummary> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: CatalogPublicationError
    }

export interface CatalogPublicationSummary {
  readonly importJobId: string
  readonly attemptedCount: number
  readonly publishableCount: number
  readonly publishedProductCount: number
  readonly publishedPrintingCount: number
  readonly skippedResults: readonly CatalogPublicationSkippedResult[]
}

export interface CatalogPublicationService {
  publishImportJob(
    importJobId: string,
  ): Promise<CatalogPublicationResult<CatalogPublicationSummary>>
}

export function isNormalizationResultPublishable(
  candidate: CatalogPublicationCandidate,
): candidate is PublishableCatalogPublicationCandidate {
  if (
    candidate.normalizationStatus !== 'auto_resolved' &&
    candidate.normalizationStatus !== 'manually_resolved'
  ) {
    return false
  }

  return candidate.cardEntityId !== null
}
