import { describe, expect, it } from 'vitest'

import {
  mapCardEntityRow,
  mapCardPrintingRow,
  mapProductRow,
} from './catalog.mappers'

describe('catalog mappers', () => {
  it('maps canonical card rows without printing-only fields', () => {
    const row = {
      id: 'card-1',
      canonical_key: 'card.azure-vanguard-dragon',
      name: 'Azure Vanguard Dragon',
      normalized_name: 'azure vanguard dragon',
      grade: 3,
      card_type: 'normal-unit',
      nation: 'Dragon Empire',
      clan: null,
      race: 'Cosmo Dragon',
      trigger_type: null,
      base_power: 13000,
      base_critical: 1,
      base_shield: 0,
      keywords: ['twin-drive'],
      effect_refs: ['effect.ref.dev.dragon'],
    }

    expect(mapCardEntityRow(row)).toEqual({
      id: 'card-1',
      canonicalKey: 'card.azure-vanguard-dragon',
      name: 'Azure Vanguard Dragon',
      normalizedName: 'azure vanguard dragon',
      grade: 3,
      cardType: 'normal-unit',
      nation: 'Dragon Empire',
      clan: null,
      race: 'Cosmo Dragon',
      triggerType: null,
      basePower: 13000,
      baseCritical: 1,
      baseShield: 0,
      keywords: ['twin-drive'],
      effectRefs: ['effect.ref.dev.dragon'],
    })
  })

  it('maps printing rows with nested product data', () => {
    const product = mapProductRow({
      id: 'product-1',
      canonical_key: 'product.d-bt01.genesis-of-azure',
      family_id: 'family-standard',
      official_code: 'D-BT01',
      name: 'Genesis of Azure',
      product_category: 'booster',
      product_kind: 'main',
      release_date: '2021-05-14',
      region_code: 'en',
      cycle_key: 'dev-standard-wave-1',
    })

    const printing = mapCardPrintingRow({
      id: 'printing-1',
      printing_key: 'printing.azure-vanguard-dragon.d-sd01.004.en',
      card_entity_id: 'card-1',
      collector_number: '004',
      rarity: 'RRR',
      locale_code: 'en',
      region_code: 'en',
      printed_name: 'Azure Vanguard Dragon',
      art_variant: 'starter-art',
      is_alternate_art: false,
      is_promo_variant: false,
      product: {
        id: 'product-1',
        canonical_key: 'product.d-bt01.genesis-of-azure',
        family_id: 'family-standard',
        official_code: 'D-BT01',
        name: 'Genesis of Azure',
        product_category: 'booster',
        product_kind: 'main',
        release_date: '2021-05-14',
        region_code: 'en',
        cycle_key: 'dev-standard-wave-1',
      },
    })

    expect(printing.product).toEqual(product)
    expect(printing.cardEntityId).toBe('card-1')
    expect(printing.printingKey).toContain('printing.azure-vanguard-dragon')
  })
})
