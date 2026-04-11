import { afterEach, describe, expect, it } from 'vitest'

import { createSequentialMockDbClient } from '../shared/mock-db-client'
import { createCatalogRepository } from './catalog.repository'

describe('catalog repository', () => {
  const cleanups: Array<() => void> = []

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.()
    }
  })

  it('lists catalog card entities through mapped read models', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('card_entities')
          expect(query.operation).toBe('select')
          expect(query.cardinality).toBe('many')
          expect(query.count).toBe('exact')
          expect(query.orders).toEqual([
            {
              column: 'normalized_name',
              ascending: true,
            },
          ])
          expect(query.range).toEqual({
            from: 0,
            to: 23,
          })
        },
        response: {
          data: [
            {
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
            },
          ],
          count: 1,
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCatalogRepository(mock.client)
    const result = await repository.listCardEntities()

    expect(result).toEqual({
      ok: true,
      data: {
        items: [
          {
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
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 24,
        pageCount: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    })
  })

  it('applies search, supported filters, sorting, and pagination windowing', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('card_entities')
          expect(query.filters).toEqual([
            {
              type: 'ilike',
              column: 'normalized_name',
              value: '%vanguard%',
            },
            {
              type: 'in',
              column: 'nation',
              value: ['Dragon Empire'],
            },
            {
              type: 'in',
              column: 'card_type',
              value: ['normal-unit'],
            },
            {
              type: 'in',
              column: 'trigger_type',
              value: ['critical'],
            },
          ])
          expect(query.orders).toEqual([
            {
              column: 'grade',
              ascending: true,
            },
            {
              column: 'normalized_name',
              ascending: true,
            },
          ])
          expect(query.range).toEqual({
            from: 24,
            to: 47,
          })
        },
        response: {
          data: [
            {
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
            },
          ],
          count: 31,
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCatalogRepository(mock.client)
    const result = await repository.listCardEntities({
      searchText: ' Vanguard ',
      filters: {
        formatIds: [],
        eras: [],
        nations: ['dragon empire'],
        clans: [],
        cardTypes: ['normal-unit'],
        triggerTypes: ['critical'],
        rarities: [],
        productKeys: [],
      },
      sort: 'grade-asc',
      page: 2,
      pageSize: 24,
    })

    expect(result).toEqual({
      ok: true,
      data: {
        items: [
          {
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
          },
        ],
        totalCount: 31,
        page: 2,
        pageSize: 24,
        pageCount: 2,
        hasPreviousPage: true,
        hasNextPage: false,
      },
    })
  })

  it('resolves format-aware entity filters through active rule profiles and product families', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('legality')
          expect(query.table).toBe('rule_profiles')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'is_active',
              value: true,
            },
            {
              type: 'in',
              column: 'format_id',
              value: ['v-premium'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'v-premium-baseline-v1',
              format_id: 'v-premium',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('legality')
          expect(query.table).toBe('rule_profile_product_families')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'rule_profile_id',
              value: ['v-premium-baseline-v1'],
            },
          ])
        },
        response: {
          data: [
            {
              product_family_id: 'family-v',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('products')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'family_id',
              value: ['family-v'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'product-v-1',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('card_printings')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'product_id',
              value: ['product-v-1'],
            },
          ])
        },
        response: {
          data: [
            {
              card_entity_id: 'card-v-1',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('card_entities')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'id',
              value: ['card-v-1'],
            },
            {
              type: 'in',
              column: 'clan',
              value: ['Royal Paladin'],
            },
          ])
          expect(query.orders).toEqual([
            {
              column: 'normalized_name',
              ascending: true,
            },
          ])
        },
        response: {
          data: [
            {
              id: 'card-v-1',
              canonical_key: 'card.crimson-v-blaster',
              name: 'Crimson V Blaster',
              normalized_name: 'crimson v blaster',
              grade: 3,
              card_type: 'normal-unit',
              nation: 'United Sanctuary',
              clan: 'Royal Paladin',
              race: 'Human',
              trigger_type: null,
              base_power: 12000,
              base_critical: 1,
              base_shield: 0,
              keywords: ['imaginary-gift'],
              effect_refs: ['effect.ref.dev.v-blaster'],
            },
          ],
          count: 1,
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCatalogRepository(mock.client)
    const result = await repository.listCardEntities({
      filters: {
        formatIds: ['v-premium'],
        eras: [],
        nations: [],
        clans: ['royal paladin'],
        cardTypes: [],
        triggerTypes: [],
        rarities: [],
        productKeys: [],
      },
    })

    expect(result).toEqual({
      ok: true,
      data: {
        items: [
          {
            id: 'card-v-1',
            canonicalKey: 'card.crimson-v-blaster',
            name: 'Crimson V Blaster',
            normalizedName: 'crimson v blaster',
            grade: 3,
            cardType: 'normal-unit',
            nation: 'United Sanctuary',
            clan: 'Royal Paladin',
            race: 'Human',
            triggerType: null,
            basePower: 12000,
            baseCritical: 1,
            baseShield: 0,
            keywords: ['imaginary-gift'],
            effectRefs: ['effect.ref.dev.v-blaster'],
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 24,
        pageCount: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    })
  })

  it('treats era, rarity, and set as printing-side filters while keeping entity results canonical', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('legality')
          expect(query.table).toBe('rule_profiles')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'is_active',
              value: true,
            },
            {
              type: 'in',
              column: 'format_id',
              value: ['standard'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'standard-baseline-v1',
              format_id: 'standard',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('legality')
          expect(query.table).toBe('rule_profile_product_families')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'rule_profile_id',
              value: ['standard-baseline-v1'],
            },
          ])
        },
        response: {
          data: [
            {
              product_family_id: 'family-standard',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('product_families')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'lineage',
              value: ['standard-lineage'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'family-standard',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('products')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'family_id',
              value: ['family-standard'],
            },
            {
              type: 'in',
              column: 'canonical_key',
              value: ['product.d-bt01.genesis-of-azure'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'product-standard-1',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('card_printings')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'product_id',
              value: ['product-standard-1'],
            },
            {
              type: 'in',
              column: 'rarity',
              value: ['RRR'],
            },
          ])
        },
        response: {
          data: [
            {
              card_entity_id: 'card-standard-1',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('card_entities')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'id',
              value: ['card-standard-1'],
            },
            {
              type: 'in',
              column: 'nation',
              value: ['Dragon Empire'],
            },
            {
              type: 'in',
              column: 'card_type',
              value: ['normal-unit'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'card-standard-1',
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
            },
          ],
          count: 1,
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCatalogRepository(mock.client)
    const result = await repository.listCardEntities({
      filters: {
        formatIds: ['standard'],
        eras: ['d'],
        nations: ['dragon empire'],
        clans: [],
        cardTypes: ['normal-unit'],
        triggerTypes: [],
        rarities: ['rrr'],
        productKeys: ['product.d-bt01.genesis-of-azure'],
      },
    })

    expect(result).toEqual({
      ok: true,
      data: {
        items: [
          {
            id: 'card-standard-1',
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
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 24,
        pageCount: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    })
  })

  it('returns null when a canonical key is not found', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('card_entities')
          expect(query.cardinality).toBe('maybeSingle')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'canonical_key',
              value: 'card.missing',
            },
          ])
        },
        response: {
          data: null,
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCatalogRepository(mock.client)
    const result = await repository.getCardEntityByCanonicalKey('card.missing')

    expect(result).toEqual({
      ok: true,
      data: null,
    })
  })

  it('loads a specific card printing without collapsing it into a canonical-only card read', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('card_printings')
          expect(query.cardinality).toBe('maybeSingle')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'printing_key',
              value: 'printing.azure-vanguard-dragon.d-sd01.004.en',
            },
          ])
        },
        response: {
          data: {
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
              canonical_key: 'product.d-sd01.azure-vanguard-start-deck',
              family_id: 'family-standard',
              official_code: 'D-SD01',
              name: 'Azure Vanguard Start Deck',
              product_category: 'deck',
              product_kind: 'start',
              release_date: '2021-05-28',
              region_code: 'en',
              cycle_key: 'dev-standard-wave-1',
            },
            card: {
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
            },
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCatalogRepository(mock.client)
    const result = await repository.getCardPrintingByPrintingKey(
      'printing.azure-vanguard-dragon.d-sd01.004.en',
    )

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'printing-1',
        printingKey: 'printing.azure-vanguard-dragon.d-sd01.004.en',
        cardEntityId: 'card-1',
        collectorNumber: '004',
        rarity: 'RRR',
        localeCode: 'en',
        regionCode: 'en',
        printedName: 'Azure Vanguard Dragon',
        artVariant: 'starter-art',
        isAlternateArt: false,
        isPromoVariant: false,
        product: {
          id: 'product-1',
          canonicalKey: 'product.d-sd01.azure-vanguard-start-deck',
          familyId: 'family-standard',
          officialCode: 'D-SD01',
          name: 'Azure Vanguard Start Deck',
          productCategory: 'deck',
          productKind: 'start',
          releaseDate: '2021-05-28',
          regionCode: 'en',
          cycleKey: 'dev-standard-wave-1',
        },
        card: {
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
        },
      },
    })
  })

  it('loads card legality facts through active formats and restriction lists', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('legality')
          expect(query.table).toBe('rule_profiles')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'is_active',
              value: true,
            },
          ])
        },
        response: {
          data: [
            {
              id: 'standard-baseline-v1',
              display_name: 'Standard Baseline',
              format_id: 'standard',
            },
            {
              id: 'v-premium-baseline-v1',
              display_name: 'V Premium Baseline',
              format_id: 'v-premium',
            },
            {
              id: 'premium-baseline-v1',
              display_name: 'Premium Baseline',
              format_id: 'premium',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('legality')
          expect(query.table).toBe('formats')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'id',
              value: ['standard', 'v-premium', 'premium'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'standard',
              display_name: 'Standard',
            },
            {
              id: 'v-premium',
              display_name: 'V Premium',
            },
            {
              id: 'premium',
              display_name: 'Premium',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('card_printings')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'card_entity_id',
              value: 'card-1',
            },
          ])
        },
        response: {
          data: [
            {
              product_id: 'product-standard-1',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('products')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'id',
              value: ['product-standard-1'],
            },
          ])
        },
        response: {
          data: [
            {
              family_id: 'family-standard',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('legality')
          expect(query.table).toBe('rule_profile_product_families')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'rule_profile_id',
              value: [
                'standard-baseline-v1',
                'v-premium-baseline-v1',
                'premium-baseline-v1',
              ],
            },
          ])
        },
        response: {
          data: [
            {
              rule_profile_id: 'standard-baseline-v1',
              product_family_id: 'family-standard',
            },
            {
              rule_profile_id: 'v-premium-baseline-v1',
              product_family_id: 'family-v',
            },
            {
              rule_profile_id: 'premium-baseline-v1',
              product_family_id: 'family-standard',
            },
            {
              rule_profile_id: 'premium-baseline-v1',
              product_family_id: 'family-v',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.table).toBe('rule_profile_card_eligibility_overrides')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'card_entity_id',
              value: 'card-1',
            },
            {
              type: 'in',
              column: 'rule_profile_id',
              value: [
                'standard-baseline-v1',
                'v-premium-baseline-v1',
                'premium-baseline-v1',
              ],
            },
          ])
        },
        response: {
          data: [
            {
              rule_profile_id: 'standard-baseline-v1',
              eligibility_state: 'allowed',
              rationale: 'Explicit Standard support published for this card.',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.table).toBe('restriction_lists')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'is_active',
              value: true,
            },
            {
              type: 'in',
              column: 'rule_profile_id',
              value: [
                'standard-baseline-v1',
                'v-premium-baseline-v1',
                'premium-baseline-v1',
              ],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'list-1',
              rule_profile_id: 'standard-baseline-v1',
              version_label: '2026-04',
              effective_from: '2026-04-08',
              source_reference: 'dev-seed',
            },
            {
              id: 'list-2',
              rule_profile_id: 'premium-baseline-v1',
              version_label: '2026-04',
              effective_from: '2026-04-08',
              source_reference: 'dev-seed',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.table).toBe('card_restriction_rules')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'card_entity_id',
              value: 'card-1',
            },
            {
              type: 'in',
              column: 'restriction_list_id',
              value: ['list-1', 'list-2'],
            },
          ])
        },
        response: {
          data: [
            {
              restriction_list_id: 'list-1',
              restriction_type: 'limited',
              max_copies: 1,
              note: 'Synthetic dev restriction.',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.table).toBe('choice_restriction_rule_cards')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'card_entity_id',
              value: 'card-1',
            },
          ])
        },
        response: {
          data: [
            {
              choice_restriction_rule_id: 'choice-1',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.table).toBe('choice_restriction_rules')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'id',
              value: ['choice-1'],
            },
            {
              type: 'in',
              column: 'restriction_list_id',
              value: ['list-1', 'list-2'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'choice-1',
              restriction_list_id: 'list-2',
              allowed_choices: 1,
              note: 'Choose one from this pairing.',
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCatalogRepository(mock.client)
    const result = await repository.getCardLegalityFacts('card-1')

    expect(result).toEqual({
      ok: true,
      data: {
        eligibilityOverrides: [
          {
            formatId: 'premium',
            formatName: 'Premium',
            ruleProfileId: 'premium-baseline-v1',
            ruleProfileName: 'Premium Baseline',
            eligibilityState: 'allowed',
            rationale:
              'Published printings exist in product families supported by this format profile.',
          },
          {
            formatId: 'standard',
            formatName: 'Standard',
            ruleProfileId: 'standard-baseline-v1',
            ruleProfileName: 'Standard Baseline',
            eligibilityState: 'allowed',
            rationale: 'Explicit Standard support published for this card.',
          },
          {
            formatId: 'v-premium',
            formatName: 'V Premium',
            ruleProfileId: 'v-premium-baseline-v1',
            ruleProfileName: 'V Premium Baseline',
            eligibilityState: 'disallowed',
            rationale:
              'No published printings for this card exist in product families supported by this format profile.',
          },
        ],
        restrictions: [
          {
            formatId: 'standard',
            formatName: 'Standard',
            ruleProfileId: 'standard-baseline-v1',
            ruleProfileName: 'Standard Baseline',
            restrictionType: 'limited',
            maxCopies: 1,
            note: 'Synthetic dev restriction.',
            sourceReference: 'dev-seed',
            effectiveFrom: '2026-04-08',
            versionLabel: '2026-04',
          },
        ],
        choiceRestrictions: [
          {
            formatId: 'premium',
            formatName: 'Premium',
            ruleProfileId: 'premium-baseline-v1',
            ruleProfileName: 'Premium Baseline',
            allowedChoices: 1,
            note: 'Choose one from this pairing.',
            sourceReference: 'dev-seed',
            effectiveFrom: '2026-04-08',
            versionLabel: '2026-04',
          },
        ],
      },
    })
  })

  it('does not infer catalog-facing legality facts for a card with no published printings', async () => {
    const mock = createSequentialMockDbClient([
      {
        response: {
          data: [
            {
              id: 'standard-baseline-v1',
              display_name: 'Standard Baseline',
              format_id: 'standard',
            },
          ],
          error: null,
        },
      },
      {
        response: {
          data: [
            {
              id: 'standard',
              display_name: 'Standard',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('card_printings')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'card_entity_id',
              value: 'card-unpublished',
            },
          ])
        },
        response: {
          data: [],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('legality')
          expect(query.table).toBe('rule_profile_product_families')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'rule_profile_id',
              value: ['standard-baseline-v1'],
            },
          ])
        },
        response: {
          data: [
            {
              rule_profile_id: 'standard-baseline-v1',
              product_family_id: 'family-standard',
            },
          ],
          error: null,
        },
      },
      {
        response: {
          data: [],
          error: null,
        },
      },
      {
        response: {
          data: [],
          error: null,
        },
      },
      {
        response: {
          data: [],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCatalogRepository(mock.client)
    const result = await repository.getCardLegalityFacts('card-unpublished')

    expect(result).toEqual({
      ok: true,
      data: {
        eligibilityOverrides: [],
        restrictions: [],
        choiceRestrictions: [],
      },
    })
  })

  it('lists structured keyword tags for a published wave-1 card entity', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('card_entity_keyword_tags')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'card_entity_id',
              value: 'entity-rezael',
            },
          ])
        },
        response: {
          data: [
            {
              card_entity_id: 'entity-rezael',
              keyword: {
                id: 'divine-skill',
                display_name: 'Divine Skill',
                category: 'mechanic',
                description: 'A DZ-era Fated One gameplay mechanic.',
                sort_order: 30,
              },
            },
            {
              card_entity_id: 'entity-rezael',
              keyword: {
                id: 'twin-drive',
                display_name: 'Twin Drive',
                category: 'mechanic',
                description:
                  'A drive mechanic that resolves two drive checks during battle.',
                sort_order: 10,
              },
            },
            {
              card_entity_id: 'entity-rezael',
              keyword: {
                id: 'persona-ride',
                display_name: 'Persona Ride',
                category: 'mechanic',
                description:
                  'A Standard-era ride mechanic enabled by the persona ride icon on grade 3 units.',
                sort_order: 20,
              },
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCatalogRepository(mock.client)
    const result = await repository.listCardEntityKeywordTags('entity-rezael')

    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: 'twin-drive',
          displayName: 'Twin Drive',
          category: 'mechanic',
          description:
            'A drive mechanic that resolves two drive checks during battle.',
          sortOrder: 10,
        },
        {
          id: 'persona-ride',
          displayName: 'Persona Ride',
          category: 'mechanic',
          description:
            'A Standard-era ride mechanic enabled by the persona ride icon on grade 3 units.',
          sortOrder: 20,
        },
        {
          id: 'divine-skill',
          displayName: 'Divine Skill',
          category: 'mechanic',
          description: 'A DZ-era Fated One gameplay mechanic.',
          sortOrder: 30,
        },
      ],
    })
  })

  it('returns no structured keyword tags for an unpublished or unmapped card entity', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('card_entity_keyword_tags')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'card_entity_id',
              value: 'entity-liael',
            },
          ])
        },
        response: {
          data: [],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCatalogRepository(mock.client)
    const result = await repository.listCardEntityKeywordTags('entity-liael')

    expect(result).toEqual({
      ok: true,
      data: [],
    })
  })

  it('loads catalog product detail with release-family metadata', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('products')
          expect(query.cardinality).toBe('maybeSingle')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'canonical_key',
              value: 'product.d-bt01.genesis-of-azure',
            },
          ])
        },
        response: {
          data: {
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
            family: {
              id: 'family-standard',
              display_name: 'Standard Lineage',
              lineage: 'standard-lineage',
            },
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCatalogRepository(mock.client)
    const result = await repository.getProductDetailByCanonicalKey(
      'product.d-bt01.genesis-of-azure',
    )

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'product-1',
        canonicalKey: 'product.d-bt01.genesis-of-azure',
        familyId: 'family-standard',
        officialCode: 'D-BT01',
        name: 'Genesis of Azure',
        productCategory: 'booster',
        productKind: 'main',
        releaseDate: '2021-05-14',
        regionCode: 'en',
        cycleKey: 'dev-standard-wave-1',
        family: {
          id: 'family-standard',
          displayName: 'Standard Lineage',
          lineage: 'standard-lineage',
        },
      },
    })
  })

  it('lists product printings with canonical card references', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('card_printings')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'product_id',
              value: 'product-1',
            },
          ])
          expect(query.orders).toEqual([
            {
              column: 'collector_number',
              ascending: true,
            },
          ])
        },
        response: {
          data: [
            {
              id: 'printing-1',
              printing_key: 'printing.azure-vanguard-dragon.d-sd01.004.en',
              collector_number: '004',
              rarity: 'RRR',
              locale_code: 'en',
              region_code: 'en',
              printed_name: 'Azure Vanguard Dragon',
              art_variant: 'starter-art',
              is_alternate_art: false,
              is_promo_variant: false,
              card: {
                id: 'card-1',
                canonical_key: 'card.azure-vanguard-dragon',
                name: 'Azure Vanguard Dragon',
                grade: 3,
                card_type: 'normal-unit',
                trigger_type: null,
                nation: 'Dragon Empire',
                clan: null,
              },
            },
            {
              id: 'printing-2',
              printing_key: 'printing.azure-critical-pulse.d-sd01.010.en',
              collector_number: '010',
              rarity: 'C',
              locale_code: 'en',
              region_code: 'en',
              printed_name: 'Azure Critical Pulse',
              art_variant: 'starter-reprint',
              is_alternate_art: false,
              is_promo_variant: false,
              card: {
                id: 'card-2',
                canonical_key: 'card.azure-critical-pulse',
                name: 'Azure Critical Pulse',
                grade: 0,
                card_type: 'trigger-unit',
                trigger_type: 'critical',
                nation: 'Dragon Empire',
                clan: null,
              },
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCatalogRepository(mock.client)
    const result = await repository.listProductPrintings('product-1')

    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: 'printing-1',
          printingKey: 'printing.azure-vanguard-dragon.d-sd01.004.en',
          collectorNumber: '004',
          rarity: 'RRR',
          localeCode: 'en',
          regionCode: 'en',
          printedName: 'Azure Vanguard Dragon',
          artVariant: 'starter-art',
          isAlternateArt: false,
          isPromoVariant: false,
          card: {
            id: 'card-1',
            canonicalKey: 'card.azure-vanguard-dragon',
            name: 'Azure Vanguard Dragon',
            grade: 3,
            cardType: 'normal-unit',
            triggerType: null,
            nation: 'Dragon Empire',
            clan: null,
          },
        },
        {
          id: 'printing-2',
          printingKey: 'printing.azure-critical-pulse.d-sd01.010.en',
          collectorNumber: '010',
          rarity: 'C',
          localeCode: 'en',
          regionCode: 'en',
          printedName: 'Azure Critical Pulse',
          artVariant: 'starter-reprint',
          isAlternateArt: false,
          isPromoVariant: false,
          card: {
            id: 'card-2',
            canonicalKey: 'card.azure-critical-pulse',
            name: 'Azure Critical Pulse',
            grade: 0,
            cardType: 'trigger-unit',
            triggerType: 'critical',
            nation: 'Dragon Empire',
            clan: null,
          },
        },
      ],
    })
  })
})
