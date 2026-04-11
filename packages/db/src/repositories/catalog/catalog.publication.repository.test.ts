import { afterEach, describe, expect, it } from 'vitest'

import { createSequentialMockDbClient } from '../shared/mock-db-client'
import { createCatalogPublicationRepository } from './catalog.publication.repository'

describe('catalog publication repository', () => {
  const cleanups: Array<() => void> = []

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.()
    }
  })

  it('composes printing publication sources from normalization, raw printing, and raw product records', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('card_printing_normalization_results')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'import_job_id',
              value: 'job-1',
            },
          ])
        },
        response: {
          data: [
            {
              id: 'normalization-bastion',
              import_job_id: 'job-1',
              raw_card_printing_record_id: 'raw-printing-bastion',
              raw_product_record_id: 'raw-product-d-bt01',
              normalization_status: 'auto_resolved',
              proposed_card_entity_id: 'entity-bastion',
            },
            {
              id: 'normalization-liael',
              import_job_id: 'job-1',
              raw_card_printing_record_id: 'raw-printing-liael',
              raw_product_record_id: 'raw-product-dz-bt02',
              normalization_status: 'unresolved',
              proposed_card_entity_id: null,
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('raw_card_printing_records')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'import_job_id',
              value: 'job-1',
            },
            {
              type: 'in',
              column: 'id',
              value: ['raw-printing-bastion', 'raw-printing-liael'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'raw-printing-bastion',
              import_job_id: 'job-1',
              source_printing_id: 'printing-bastion-d-bt01-main',
              raw_product_record_id: 'raw-product-d-bt01',
              raw_card_name: 'Apex Ruler, Bastion',
              raw_printing_code: 'D-BT01/001EN',
              raw_rarity: 'RRR',
              raw_locale_code: 'en',
              raw_region_code: 'en',
            },
            {
              id: 'raw-printing-liael',
              import_job_id: 'job-1',
              source_printing_id: 'printing-liael-amorta-dz-bt02-main',
              raw_product_record_id: 'raw-product-dz-bt02',
              raw_card_name: 'Fated One of Time, Liael=Amorta',
              raw_printing_code: 'DZ-BT02/010EN',
              raw_rarity: 'RRR',
              raw_locale_code: 'en',
              raw_region_code: 'en',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('raw_product_records')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'import_job_id',
              value: 'job-1',
            },
            {
              type: 'in',
              column: 'id',
              value: ['raw-product-d-bt01', 'raw-product-dz-bt02'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'raw-product-d-bt01',
              import_job_id: 'job-1',
              source_product_id: 'product-d-bt01',
              raw_name: 'Genesis of the Five Greats',
              raw_code: 'D-BT01',
              raw_product_category: 'booster',
              raw_product_kind: 'main',
              raw_release_date_text: '2021-05-14',
              raw_region_code: 'en',
            },
            {
              id: 'raw-product-dz-bt02',
              import_job_id: 'job-1',
              source_product_id: 'product-dz-bt02',
              raw_name: 'Illusionless Strife',
              raw_code: 'DZ-BT02',
              raw_product_category: 'booster',
              raw_product_kind: 'main',
              raw_release_date_text: '2024-06-07',
              raw_region_code: 'en',
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCatalogPublicationRepository(mock.client)
    const result = await repository.listPrintingPublicationSourcesByImportJob({
      importJobId: 'job-1',
    })

    expect(result).toEqual({
      ok: true,
      data: [
        {
          importJobId: 'job-1',
          normalizationResultId: 'normalization-bastion',
          rawCardPrintingId: 'raw-printing-bastion',
          rawProductId: 'raw-product-d-bt01',
          normalizationStatus: 'auto_resolved',
          cardEntityId: 'entity-bastion',
          sourcePrintingId: 'printing-bastion-d-bt01-main',
          rawCardName: 'Apex Ruler, Bastion',
          rawPrintingCode: 'D-BT01/001EN',
          rawRarity: 'RRR',
          rawLocaleCode: 'en',
          rawRegionCode: 'en',
          rawProduct: {
            rawProductId: 'raw-product-d-bt01',
            importJobId: 'job-1',
            sourceProductId: 'product-d-bt01',
            rawName: 'Genesis of the Five Greats',
            rawCode: 'D-BT01',
            rawProductCategory: 'booster',
            rawProductKind: 'main',
            rawReleaseDateText: '2021-05-14',
            rawRegionCode: 'en',
          },
        },
        {
          importJobId: 'job-1',
          normalizationResultId: 'normalization-liael',
          rawCardPrintingId: 'raw-printing-liael',
          rawProductId: 'raw-product-dz-bt02',
          normalizationStatus: 'unresolved',
          cardEntityId: null,
          sourcePrintingId: 'printing-liael-amorta-dz-bt02-main',
          rawCardName: 'Fated One of Time, Liael=Amorta',
          rawPrintingCode: 'DZ-BT02/010EN',
          rawRarity: 'RRR',
          rawLocaleCode: 'en',
          rawRegionCode: 'en',
          rawProduct: {
            rawProductId: 'raw-product-dz-bt02',
            importJobId: 'job-1',
            sourceProductId: 'product-dz-bt02',
            rawName: 'Illusionless Strife',
            rawCode: 'DZ-BT02',
            rawProductCategory: 'booster',
            rawProductKind: 'main',
            rawReleaseDateText: '2024-06-07',
            rawRegionCode: 'en',
          },
        },
      ],
    })
  })

  it('upserts catalog products with publication provenance', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('products')
          expect(query.operation).toBe('upsert')
          expect(query.onConflict).toBe('id')
          expect(query.values).toEqual([
            {
              id: 'product-1',
              canonical_key: 'product.d-bt01.genesis-of-the-five-greats',
              family_id: 'family-standard',
              official_code: 'D-BT01',
              name: 'Genesis of the Five Greats',
              product_category: 'booster',
              product_kind: 'main',
              release_date: '2021-05-14',
              region_code: 'en',
              cycle_key: null,
              source_import_job_id: 'job-1',
              source_raw_product_record_id: 'raw-product-d-bt01',
            },
          ])
        },
        response: {
          data: [
            {
              id: 'product-1',
              canonical_key: 'product.d-bt01.genesis-of-the-five-greats',
              family_id: 'family-standard',
              official_code: 'D-BT01',
              name: 'Genesis of the Five Greats',
              region_code: 'en',
              source_import_job_id: 'job-1',
              source_raw_product_record_id: 'raw-product-d-bt01',
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCatalogPublicationRepository(mock.client)
    const result = await repository.upsertCatalogProducts([
      {
        id: 'product-1',
        canonicalKey: 'product.d-bt01.genesis-of-the-five-greats',
        familyId: 'family-standard',
        officialCode: 'D-BT01',
        name: 'Genesis of the Five Greats',
        productCategory: 'booster',
        productKind: 'main',
        releaseDate: '2021-05-14',
        regionCode: 'en',
        cycleKey: null,
        sourceImportJobId: 'job-1',
        sourceRawProductRecordId: 'raw-product-d-bt01',
      },
    ])

    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: 'product-1',
          canonicalKey: 'product.d-bt01.genesis-of-the-five-greats',
          familyId: 'family-standard',
          officialCode: 'D-BT01',
          name: 'Genesis of the Five Greats',
          regionCode: 'en',
          sourceImportJobId: 'job-1',
          sourceRawProductRecordId: 'raw-product-d-bt01',
        },
      ],
    })
  })

  it('upserts catalog printings with normalization and raw provenance', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('card_printings')
          expect(query.operation).toBe('upsert')
          expect(query.onConflict).toBe('printing_key')
          expect(query.values).toEqual([
            {
              id: 'printing-1',
              printing_key:
                'printing.fated-one-of-miracles-rezael.dz-bt01.010.en',
              card_entity_id: 'entity-rezael',
              product_id: 'product-dz-bt01',
              collector_number: '010',
              rarity: 'RRR',
              locale_code: 'en',
              region_code: 'en',
              printed_name: 'Fated One of Miracles, Rezael',
              art_variant: null,
              is_alternate_art: false,
              is_promo_variant: false,
              source_import_job_id: 'job-1',
              source_normalization_result_id: 'normalization-rezael-main',
              source_raw_card_printing_record_id: 'raw-printing-rezael-main',
              source_raw_product_record_id: 'raw-product-dz-bt01',
            },
          ])
        },
        response: {
          data: [
            {
              id: 'printing-1',
              printing_key:
                'printing.fated-one-of-miracles-rezael.dz-bt01.010.en',
              card_entity_id: 'entity-rezael',
              product_id: 'product-dz-bt01',
              source_normalization_result_id: 'normalization-rezael-main',
              source_raw_card_printing_record_id: 'raw-printing-rezael-main',
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCatalogPublicationRepository(mock.client)
    const result = await repository.upsertCatalogPrintings([
      {
        id: 'printing-1',
        printingKey: 'printing.fated-one-of-miracles-rezael.dz-bt01.010.en',
        cardEntityId: 'entity-rezael',
        productId: 'product-dz-bt01',
        collectorNumber: '010',
        rarity: 'RRR',
        localeCode: 'en',
        regionCode: 'en',
        printedName: 'Fated One of Miracles, Rezael',
        artVariant: null,
        isAlternateArt: false,
        isPromoVariant: false,
        sourceImportJobId: 'job-1',
        sourceNormalizationResultId: 'normalization-rezael-main',
        sourceRawCardPrintingRecordId: 'raw-printing-rezael-main',
        sourceRawProductRecordId: 'raw-product-dz-bt01',
      },
    ])

    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: 'printing-1',
          printingKey: 'printing.fated-one-of-miracles-rezael.dz-bt01.010.en',
          cardEntityId: 'entity-rezael',
          productId: 'product-dz-bt01',
          sourceNormalizationResultId: 'normalization-rezael-main',
          sourceRawCardPrintingRecordId: 'raw-printing-rezael-main',
        },
      ],
    })
  })
})
