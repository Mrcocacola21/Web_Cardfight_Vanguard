import { describe, expect, it } from 'vitest'

import {
  createProductIdentityKey,
  resolveCatalogProductFamilyId,
} from './catalog-publication-identity'

describe('catalog publication identity', () => {
  it('resolves product families from publication-era code prefixes', () => {
    expect(resolveCatalogProductFamilyId('D-BT01')).toBe('family-standard')
    expect(resolveCatalogProductFamilyId(' dz-bt02 ')).toBe('family-standard')
    expect(resolveCatalogProductFamilyId('V-BT03')).toBe('family-v')
    expect(resolveCatalogProductFamilyId('G-BT13')).toBe('family-premium')
    expect(resolveCatalogProductFamilyId('PR-0001')).toBe('family-premium')
    expect(resolveCatalogProductFamilyId('EB-01')).toBeNull()
  })

  it('builds stable product identity keys independently of official-code casing', () => {
    expect(
      createProductIdentityKey({
        familyId: 'family-standard',
        officialCode: 'dz-bt01',
        regionCode: 'en',
      }),
    ).toBe('family-standard::DZ-BT01::en')

    expect(
      createProductIdentityKey({
        familyId: 'family-standard',
        officialCode: 'DZ-BT01',
        regionCode: null,
      }),
    ).toBe('family-standard::DZ-BT01::')
  })
})
