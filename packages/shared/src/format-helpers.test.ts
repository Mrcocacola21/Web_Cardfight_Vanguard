import { describe, expect, it } from 'vitest'

import type { FormatId, ProductFamilyId } from './index'
import {
  formatHasGameplayMarker,
  formatHasSection,
  getDeckSectionConstraint,
  getDuplicateCountingSections,
  getRequiredDeckSections,
  getTriggerTypeLimit,
} from './index'
import type { FormatProfile } from './index'

const standardFamilyId = 'family-standard' as ProductFamilyId
const vFamilyId = 'family-v' as ProductFamilyId
const premiumFamilyId = 'family-premium' as ProductFamilyId

function makeFormatProfile(
  overrides: Partial<FormatProfile> &
    Pick<FormatProfile, 'formatId' | 'displayName'>,
): FormatProfile {
  return {
    formatId: overrides.formatId,
    displayName: overrides.displayName,
    constructionBasis: overrides.constructionBasis ?? 'nation-based',
    productEligibility: overrides.productEligibility ?? {
      basis: 'explicit-family-membership',
      supportedProductFamilies: [standardFamilyId],
    },
    deckStructure: overrides.deckStructure ?? [],
    constructionRules: overrides.constructionRules ?? {
      duplicateConstraint: {
        appliesToSections: ['main'],
        defaultMaxCopiesPerCard: 4,
      },
      triggerConstraint: {
        appliesToSection: 'main',
        maxTotalTriggers: 16,
        perTypeLimits: [
          { triggerType: 'critical', maxCopies: 8 },
          { triggerType: 'heal', maxCopies: 4 },
          { triggerType: 'over', maxCopies: 1 },
        ],
      },
    },
    capabilities: overrides.capabilities ?? {
      supportsRideDeck: false,
      supportsGDeck: false,
      supportsStride: false,
      supportsImaginaryGift: false,
      supportsOverDress: false,
      gameplayMarkers: [],
    },
    restrictionCompatibility:
      overrides.restrictionCompatibility ?? 'official-list',
  }
}

const standardProfile = makeFormatProfile({
  formatId: 'standard' as FormatId,
  displayName: 'Standard',
  productEligibility: {
    basis: 'family-membership-with-overrides',
    supportedProductFamilies: [standardFamilyId],
  },
  deckStructure: [
    { section: 'main', minCards: 50, maxCards: 50, required: true },
    { section: 'ride', minCards: 4, maxCards: 4, required: true },
  ],
  constructionRules: {
    duplicateConstraint: {
      appliesToSections: ['main', 'ride'],
      defaultMaxCopiesPerCard: 4,
    },
    triggerConstraint: {
      appliesToSection: 'main',
      maxTotalTriggers: 16,
      perTypeLimits: [
        { triggerType: 'critical', maxCopies: 8 },
        { triggerType: 'heal', maxCopies: 4 },
        { triggerType: 'over', maxCopies: 1 },
      ],
    },
  },
  capabilities: {
    supportsRideDeck: true,
    supportsGDeck: false,
    supportsStride: false,
    supportsImaginaryGift: false,
    supportsOverDress: true,
    gameplayMarkers: ['ride-deck', 'overdress', 'over-trigger'],
  },
})

const vPremiumProfile = makeFormatProfile({
  formatId: 'v-premium' as FormatId,
  displayName: 'V Premium',
  constructionBasis: 'clan-based',
  productEligibility: {
    basis: 'family-membership-with-overrides',
    supportedProductFamilies: [vFamilyId],
  },
  deckStructure: [
    { section: 'main', minCards: 50, maxCards: 50, required: true },
  ],
  capabilities: {
    supportsRideDeck: false,
    supportsGDeck: false,
    supportsStride: false,
    supportsImaginaryGift: true,
    supportsOverDress: false,
    gameplayMarkers: ['imaginary-gift', 'over-trigger'],
  },
})

const premiumProfile = makeFormatProfile({
  formatId: 'premium' as FormatId,
  displayName: 'Premium',
  constructionBasis: 'clan-based',
  productEligibility: {
    basis: 'broad-english-pool',
    supportedProductFamilies: [standardFamilyId, vFamilyId, premiumFamilyId],
  },
  deckStructure: [
    { section: 'main', minCards: 50, maxCards: 50, required: true },
    { section: 'g', minCards: 0, maxCards: 16, required: false },
  ],
  capabilities: {
    supportsRideDeck: false,
    supportsGDeck: true,
    supportsStride: true,
    supportsImaginaryGift: true,
    supportsOverDress: true,
    gameplayMarkers: ['g-zone', 'stride', 'imaginary-gift', 'over-trigger'],
  },
})

describe('@web-vg/shared format helpers', () => {
  it('keeps Standard, V Premium, and Premium structurally distinct', () => {
    expect(formatHasSection(standardProfile, 'ride')).toBe(true)
    expect(formatHasSection(vPremiumProfile, 'ride')).toBe(false)
    expect(formatHasSection(premiumProfile, 'ride')).toBe(false)

    expect(formatHasSection(standardProfile, 'g')).toBe(false)
    expect(formatHasSection(vPremiumProfile, 'g')).toBe(false)
    expect(formatHasSection(premiumProfile, 'g')).toBe(true)
  })

  it('reads format-owned duplicate and trigger constraints without collapsing profiles', () => {
    expect(getDuplicateCountingSections(standardProfile)).toEqual([
      'main',
      'ride',
    ])
    expect(getDuplicateCountingSections(vPremiumProfile)).toEqual(['main'])
    expect(getDuplicateCountingSections(premiumProfile)).toEqual(['main'])

    expect(getTriggerTypeLimit(standardProfile, 'over')).toBe(1)
    expect(getTriggerTypeLimit(vPremiumProfile, 'critical')).toBe(8)
    expect(getTriggerTypeLimit(premiumProfile, 'heal')).toBe(4)
  })

  it('derives required sections and gameplay markers from profile data', () => {
    expect(getRequiredDeckSections(standardProfile)).toEqual(['main', 'ride'])
    expect(getRequiredDeckSections(premiumProfile)).toEqual(['main'])

    expect(formatHasGameplayMarker(standardProfile, 'ride-deck')).toBe(true)
    expect(formatHasGameplayMarker(vPremiumProfile, 'ride-deck')).toBe(false)
    expect(formatHasGameplayMarker(premiumProfile, 'g-zone')).toBe(true)
  })

  it('returns section constraints only when the format actually owns the section', () => {
    expect(getDeckSectionConstraint(standardProfile, 'ride')).toMatchObject({
      minCards: 4,
      maxCards: 4,
      required: true,
    })
    expect(getDeckSectionConstraint(vPremiumProfile, 'ride')).toBeUndefined()
    expect(getDeckSectionConstraint(premiumProfile, 'g')).toMatchObject({
      maxCards: 16,
      required: false,
    })
  })
})
