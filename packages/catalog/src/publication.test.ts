import { describe, expect, it } from 'vitest'

import { isNormalizationResultPublishable } from './publication'

describe('catalog publication foundation', () => {
  it('treats auto-resolved and manually-resolved results with canonical entity references as publishable', () => {
    expect(
      isNormalizationResultPublishable({
        importJobId: 'job-1',
        normalizationResultId: 'normalization-1',
        rawCardPrintingId: 'raw-printing-1',
        rawProductId: 'raw-product-1',
        normalizationStatus: 'auto_resolved',
        cardEntityId: 'entity-1',
      }),
    ).toBe(true)

    expect(
      isNormalizationResultPublishable({
        importJobId: 'job-1',
        normalizationResultId: 'normalization-2',
        rawCardPrintingId: 'raw-printing-2',
        rawProductId: 'raw-product-1',
        normalizationStatus: 'manually_resolved',
        cardEntityId: 'entity-2',
      }),
    ).toBe(true)
  })

  it('treats unresolved and review-blocked outcomes as non-publishable', () => {
    expect(
      isNormalizationResultPublishable({
        importJobId: 'job-1',
        normalizationResultId: 'normalization-1',
        rawCardPrintingId: 'raw-printing-1',
        rawProductId: 'raw-product-1',
        normalizationStatus: 'unresolved',
        cardEntityId: null,
      }),
    ).toBe(false)

    expect(
      isNormalizationResultPublishable({
        importJobId: 'job-1',
        normalizationResultId: 'normalization-2',
        rawCardPrintingId: 'raw-printing-2',
        rawProductId: 'raw-product-1',
        normalizationStatus: 'ambiguous',
        cardEntityId: null,
      }),
    ).toBe(false)

    expect(
      isNormalizationResultPublishable({
        importJobId: 'job-1',
        normalizationResultId: 'normalization-3',
        rawCardPrintingId: 'raw-printing-3',
        rawProductId: 'raw-product-1',
        normalizationStatus: 'blocked_for_review',
        cardEntityId: null,
      }),
    ).toBe(false)
  })

  it('rejects outcomes that claim to be resolved but still lack a canonical entity id', () => {
    expect(
      isNormalizationResultPublishable({
        importJobId: 'job-1',
        normalizationResultId: 'normalization-1',
        rawCardPrintingId: 'raw-printing-1',
        rawProductId: 'raw-product-1',
        normalizationStatus: 'auto_resolved',
        cardEntityId: null,
      }),
    ).toBe(false)
  })
})
