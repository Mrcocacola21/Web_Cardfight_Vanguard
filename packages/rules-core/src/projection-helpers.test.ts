import { describe, expect, it } from 'vitest'

import type { FormatId } from '@web-vg/shared'
import {
  projectionEnablesSection,
  projectionEnablesZone,
  projectionHasMarker,
} from './index'
import type { GameplayFormatProjection } from './index'

function makeProjection(
  projection: GameplayFormatProjection,
): GameplayFormatProjection {
  return projection
}

const standardProjection = makeProjection({
  formatId: 'standard' as FormatId,
  enabledSections: ['main', 'ride'],
  activeMarkers: ['ride-deck', 'overdress', 'over-trigger'],
  zones: ['deck', 'hand', 'drop', 'damage', 'soul', 'field', 'ride-deck'],
})

const vPremiumProjection = makeProjection({
  formatId: 'v-premium' as FormatId,
  enabledSections: ['main'],
  activeMarkers: ['imaginary-gift', 'over-trigger'],
  zones: ['deck', 'hand', 'drop', 'damage', 'soul', 'field'],
})

const premiumProjection = makeProjection({
  formatId: 'premium' as FormatId,
  enabledSections: ['main', 'g'],
  activeMarkers: ['g-zone', 'stride', 'imaginary-gift', 'over-trigger'],
  zones: ['deck', 'hand', 'drop', 'damage', 'soul', 'field', 'g-zone'],
})

describe('@web-vg/rules-core projection helpers', () => {
  it('keeps gameplay format projections distinct across Standard, V Premium, and Premium', () => {
    expect(projectionEnablesSection(standardProjection, 'ride')).toBe(true)
    expect(projectionEnablesSection(vPremiumProjection, 'ride')).toBe(false)
    expect(projectionEnablesSection(premiumProjection, 'ride')).toBe(false)

    expect(projectionEnablesSection(standardProjection, 'g')).toBe(false)
    expect(projectionEnablesSection(vPremiumProjection, 'g')).toBe(false)
    expect(projectionEnablesSection(premiumProjection, 'g')).toBe(true)
  })

  it('exposes runtime markers without collapsing them into one generic format behavior', () => {
    expect(projectionHasMarker(standardProjection, 'ride-deck')).toBe(true)
    expect(projectionHasMarker(vPremiumProjection, 'ride-deck')).toBe(false)
    expect(projectionHasMarker(premiumProjection, 'g-zone')).toBe(true)
    expect(projectionHasMarker(standardProjection, 'g-zone')).toBe(false)
  })

  it('enables only the runtime zones declared by the gameplay-facing format projection', () => {
    expect(projectionEnablesZone(standardProjection, 'ride-deck')).toBe(true)
    expect(projectionEnablesZone(standardProjection, 'g-zone')).toBe(false)
    expect(projectionEnablesZone(vPremiumProjection, 'ride-deck')).toBe(false)
    expect(projectionEnablesZone(premiumProjection, 'g-zone')).toBe(true)
  })
})
