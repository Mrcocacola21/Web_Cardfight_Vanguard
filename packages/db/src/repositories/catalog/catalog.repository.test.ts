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
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createCatalogRepository(mock.client)
    const result = await repository.listCardEntities()

    expect(result).toEqual({
      ok: true,
      data: [
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
})
