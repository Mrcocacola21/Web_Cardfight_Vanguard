import { describe, expect, it } from 'vitest'

import { createDeck, type Deck, type DeckVersionId } from '@web-vg/decks'
import type {
  CardRestrictionRule,
  ChoiceRestrictionRule,
  RestrictionList,
  RestrictionRule,
} from '@web-vg/legality'
import type {
  CardId,
  CardType,
  Clan,
  DeckId,
  DeckSection,
  FormatId,
  FormatProfile,
  Grade,
  Nation,
  UserId,
} from '@web-vg/shared'

import {
  createDeckValidationPipeline,
  defaultDeckValidationValidatorRegistry,
  validateDeck,
  type DeckValidationCardFacts,
  type DeckValidationContext,
  type DeckValidationIssue,
  type DeckValidationValidatorRegistry,
} from './index'

const deckId = 'deck-validation-1' as DeckId
const ownerId = 'user-validation-1' as UserId
const versionId = 'deck-validation-version-1' as DeckVersionId
const alphaCardId = 'card-alpha' as CardId
const betaCardId = 'card-beta' as CardId
const gammaCardId = 'card-gamma' as CardId
const mainCard0Id = 'main-card-0' as CardId
const mainCard49Id = 'main-card-49' as CardId
const rideGrade0CardId = 'ride-grade-0' as CardId
const rideGrade1CardId = 'ride-grade-1' as CardId
const rideGrade2CardId = 'ride-grade-2' as CardId
const rideGrade3CardId = 'ride-grade-3' as CardId
const gUnit0CardId = 'g-unit-0' as CardId
const gUnit1CardId = 'g-unit-1' as CardId
const gUnit2CardId = 'g-unit-2' as CardId
const gUnit3CardId = 'g-unit-3' as CardId
const keterSanctuary = 'Keter Sanctuary' as Nation
const dragonEmpire = 'Dragon Empire' as Nation
const royalPaladin = 'Royal Paladin' as Clan
const shadowPaladin = 'Shadow Paladin' as Clan

const standardRideCards = [
  {
    section: 'ride' as const,
    cardEntityId: rideGrade0CardId,
    quantity: 1,
  },
  {
    section: 'ride' as const,
    cardEntityId: rideGrade1CardId,
    quantity: 1,
  },
  {
    section: 'ride' as const,
    cardEntityId: rideGrade2CardId,
    quantity: 1,
  },
  {
    section: 'ride' as const,
    cardEntityId: rideGrade3CardId,
    quantity: 1,
  },
] as const

const standardRideGradeByCardId = new Map<CardId, Grade>([
  [rideGrade0CardId, 0],
  [rideGrade1CardId, 1],
  [rideGrade2CardId, 2],
  [rideGrade3CardId, 3],
])

const premiumGDeckCards = [
  {
    section: 'g' as const,
    cardEntityId: gUnit0CardId,
    quantity: 1,
  },
  {
    section: 'g' as const,
    cardEntityId: gUnit1CardId,
    quantity: 1,
  },
  {
    section: 'g' as const,
    cardEntityId: gUnit2CardId,
    quantity: 1,
  },
  {
    section: 'g' as const,
    cardEntityId: gUnit3CardId,
    quantity: 1,
  },
] as const

function buildDeck(
  formatId: FormatId,
  cards: readonly {
    readonly section: DeckSection | (string & {})
    readonly cardEntityId: CardId
    readonly quantity: number
  }[],
): Deck {
  return createDeck({
    id: deckId,
    ownerId,
    formatId,
    name: 'Bastion Core',
    createdAt: '2026-04-11T10:00:00.000Z',
    currentVersionId: versionId,
    cards: cards.map((card) => ({
      section: card.section as DeckSection,
      cardEntityId: card.cardEntityId,
      quantity: card.quantity,
    })),
  })
}

function buildFormatProfile(formatId: FormatId): FormatProfile {
  if (formatId === ('standard' as FormatId)) {
    return {
      formatId,
      displayName: 'Standard',
      constructionBasis: 'nation-based',
      productEligibility: {
        basis: 'explicit-family-membership',
        supportedProductFamilies: [],
      },
      deckStructure: [
        {
          section: 'main',
          minCards: 50,
          maxCards: 50,
          required: true,
        },
        {
          section: 'ride',
          minCards: 4,
          maxCards: 4,
          required: true,
        },
      ],
      constructionRules: {
        duplicateConstraint: {
          appliesToSections: ['main', 'ride'],
          defaultMaxCopiesPerCard: 4,
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
      restrictionCompatibility: 'official-list',
    }
  }

  if (formatId === ('v-premium' as FormatId)) {
    return {
      formatId,
      displayName: 'V Premium',
      constructionBasis: 'clan-based',
      productEligibility: {
        basis: 'explicit-family-membership',
        supportedProductFamilies: [],
      },
      deckStructure: [
        {
          section: 'main',
          minCards: 50,
          maxCards: 50,
          required: true,
        },
      ],
      constructionRules: {
        duplicateConstraint: {
          appliesToSections: ['main'],
          defaultMaxCopiesPerCard: 4,
        },
      },
      capabilities: {
        supportsRideDeck: false,
        supportsGDeck: false,
        supportsStride: false,
        supportsImaginaryGift: true,
        supportsOverDress: false,
        gameplayMarkers: ['imaginary-gift'],
      },
      restrictionCompatibility: 'official-list',
    }
  }

  return {
    formatId,
    displayName: 'Premium',
    constructionBasis: 'clan-based',
    productEligibility: {
      basis: 'family-membership-with-overrides',
      supportedProductFamilies: [],
    },
    deckStructure: [
      {
        section: 'main',
        minCards: 50,
        maxCards: 50,
        required: true,
      },
      {
        section: 'g',
        minCards: 0,
        maxCards: 16,
        required: false,
      },
    ],
    constructionRules: {
      duplicateConstraint: {
        appliesToSections: ['main'],
        defaultMaxCopiesPerCard: 4,
      },
    },
    capabilities: {
      supportsRideDeck: false,
      supportsGDeck: true,
      supportsStride: true,
      supportsImaginaryGift: true,
      supportsOverDress: false,
      gameplayMarkers: ['g-zone', 'stride', 'imaginary-gift'],
    },
    restrictionCompatibility: 'official-list-with-overrides',
  }
}

function buildRegistryForRoutingTests(): DeckValidationValidatorRegistry {
  return {
    commonValidators: [
      {
        id: 'common-marker',
        validate: () => [
          {
            severity: 'info',
            category: 'deck',
            code: 'common-marker',
            message: 'common',
            target: {
              type: 'deck',
              deckId,
            },
          },
        ],
      },
    ],
    restrictionValidators: [],
    formatValidatorsByFormat: {
      standard: [
        {
          id: 'standard-marker',
          validate: () => [
            {
              severity: 'info',
              category: 'format',
              code: 'standard-marker',
              message: 'standard',
              target: {
                type: 'format',
                field: 'formatId',
                formatId: 'standard' as FormatId,
              },
            },
          ],
        },
      ],
      'v-premium': [
        {
          id: 'v-premium-marker',
          validate: () => [
            {
              severity: 'info',
              category: 'format',
              code: 'v-premium-marker',
              message: 'v-premium',
              target: {
                type: 'format',
                field: 'formatId',
                formatId: 'v-premium' as FormatId,
              },
            },
          ],
        },
      ],
      premium: [
        {
          id: 'premium-marker',
          validate: () => [
            {
              severity: 'info',
              category: 'format',
              code: 'premium-marker',
              message: 'premium',
              target: {
                type: 'format',
                field: 'formatId',
                formatId: 'premium' as FormatId,
              },
            },
          ],
        },
      ],
    },
  }
}

function buildMainDeckCards(
  totalCards: number,
  prefix = 'main-card',
): readonly {
  readonly section: 'main'
  readonly cardEntityId: CardId
  readonly quantity: number
}[] {
  return Array.from({ length: totalCards }, (_, index) => ({
    section: 'main' as const,
    cardEntityId: `${prefix}-${index}` as CardId,
    quantity: 1,
  }))
}

function buildMainDeckWithCopies(
  totalCards: number,
  cardEntityId: CardId,
  copies: number,
): readonly {
  readonly section: 'main'
  readonly cardEntityId: CardId
  readonly quantity: number
}[] {
  return [
    {
      section: 'main',
      cardEntityId,
      quantity: copies,
    },
    ...buildMainDeckCards(totalCards - copies, 'filler-main'),
  ]
}

function buildValidStandardDeck(): Deck {
  return buildDeck('standard' as FormatId, [
    ...buildMainDeckCards(50),
    ...standardRideCards,
  ])
}

function buildValidVPremiumDeck(): Deck {
  return buildDeck('v-premium' as FormatId, buildMainDeckCards(50))
}

function buildValidPremiumDeck(): Deck {
  return buildDeck('premium' as FormatId, [
    ...buildMainDeckCards(50),
    ...premiumGDeckCards,
  ])
}

function buildRestrictionList(
  formatId: FormatId,
  rules: readonly RestrictionRule[] = [],
): RestrictionList {
  return {
    formatId,
    version: `${String(formatId)}-active-list`,
    rules,
  }
}

function buildCardRestrictionRule(
  rule: Omit<CardRestrictionRule, 'formatId'> & {
    readonly formatId?: FormatId
  },
): CardRestrictionRule {
  return {
    ...rule,
    formatId: rule.formatId ?? ('standard' as FormatId),
  }
}

function buildChoiceRestrictionRule(
  rule: Omit<ChoiceRestrictionRule, 'formatId'> & {
    readonly formatId?: FormatId
  },
): ChoiceRestrictionRule {
  return {
    ...rule,
    formatId: rule.formatId ?? ('standard' as FormatId),
  }
}

function buildStandardValidationContext(
  deck: Deck,
  overrides: Readonly<
    Record<string, Partial<DeckValidationCardFacts> | null>
  > = {},
  restrictionRules: readonly RestrictionRule[] = [],
): DeckValidationContext {
  const cardFacts = new Map<CardId, DeckValidationCardFacts>()

  for (const card of deck.currentVersion.cards) {
    if (!String(card.cardEntityId).trim()) {
      continue
    }

    if (cardFacts.has(card.cardEntityId)) {
      continue
    }

    const override = overrides[String(card.cardEntityId)]

    if (override === null) {
      continue
    }

    cardFacts.set(card.cardEntityId, {
      grade: standardRideGradeByCardId.get(card.cardEntityId) ?? 1,
      cardType: 'normal-unit',
      nation: keterSanctuary,
      ...override,
    })
  }

  const activeList = buildRestrictionList(
    'standard' as FormatId,
    restrictionRules,
  )

  return {
    format: {
      profile: buildFormatProfile('standard' as FormatId),
    },
    cardFacts,
    restrictions: {
      listId: activeList.version,
      activeList,
    },
  }
}

function buildCardFactsEntry(
  overrides: Partial<DeckValidationCardFacts> = {},
): DeckValidationCardFacts {
  return {
    grade: 1,
    cardType: 'normal-unit' as CardType,
    clan: royalPaladin,
    nation: keterSanctuary,
    legalInFormats: [
      'standard' as FormatId,
      'v-premium' as FormatId,
      'premium' as FormatId,
    ],
    premiumGDeckEligible: false,
    ...overrides,
  }
}

function buildVPremiumValidationContext(
  deck: Deck,
  overrides: Readonly<
    Record<string, Partial<DeckValidationCardFacts> | null>
  > = {},
  restrictionRules: readonly RestrictionRule[] = [],
): DeckValidationContext {
  const cardFacts = new Map<CardId, DeckValidationCardFacts>()

  for (const card of deck.currentVersion.cards) {
    if (!String(card.cardEntityId).trim()) {
      continue
    }

    if (cardFacts.has(card.cardEntityId)) {
      continue
    }

    const override = overrides[String(card.cardEntityId)]

    if (override === null) {
      continue
    }

    cardFacts.set(card.cardEntityId, {
      grade: 1,
      cardType: 'normal-unit',
      clan: royalPaladin,
      nation: keterSanctuary,
      legalInFormats: ['v-premium' as FormatId, 'premium' as FormatId],
      ...override,
    })
  }

  const activeList = buildRestrictionList(
    'v-premium' as FormatId,
    restrictionRules,
  )

  return {
    format: {
      profile: buildFormatProfile('v-premium' as FormatId),
    },
    cardFacts,
    restrictions: {
      listId: activeList.version,
      activeList,
    },
  }
}

function buildPremiumValidationContext(
  deck: Deck,
  overrides: Readonly<
    Record<string, Partial<DeckValidationCardFacts> | null>
  > = {},
  profile: FormatProfile = buildFormatProfile('premium' as FormatId),
  restrictionRules: readonly RestrictionRule[] = [],
): DeckValidationContext {
  const cardFacts = new Map<CardId, DeckValidationCardFacts>()

  for (const card of deck.currentVersion.cards) {
    if (!String(card.cardEntityId).trim()) {
      continue
    }

    if (cardFacts.has(card.cardEntityId)) {
      continue
    }

    const override = overrides[String(card.cardEntityId)]

    if (override === null) {
      continue
    }

    cardFacts.set(card.cardEntityId, {
      grade: card.section === 'g' ? 4 : 1,
      cardType: 'normal-unit',
      clan: royalPaladin,
      nation: keterSanctuary,
      legalInFormats: ['premium' as FormatId],
      premiumGDeckEligible: card.section === 'g',
      ...override,
    })
  }

  const activeList = buildRestrictionList(
    'premium' as FormatId,
    restrictionRules,
  )

  return {
    format: {
      profile,
    },
    cardFacts,
    restrictions: {
      listId: activeList.version,
      activeList,
    },
  }
}

describe('@web-vg/deck-validation common and format-aware pipeline', () => {
  it('returns a stable unified result for a deck that passes common rules and the Standard branch', () => {
    const deck = buildValidStandardDeck()
    const result = validateDeck({
      deck,
      context: buildStandardValidationContext(deck),
    })

    expect(result).toEqual({
      formatId: 'standard',
      isValid: true,
      validatorGroups: ['common', 'standard', 'restriction'],
      evaluatedRules: [
        'require-deck-format',
        'validate-deck-entry-shape',
        'validate-deck-duplicates',
        'validate-deck-size',
        'validate-copy-limits',
        'validate-deck-consistency',
        'select-format-validator-group',
        'validate-standard-sections',
        'validate-standard-card-facts',
        'validate-standard-ride-deck',
        'validate-standard-nation-constraints',
        'validate-restriction-list-context',
        'validate-restriction-card-rules',
        'validate-restriction-choice-rules',
      ],
      issues: [],
      summary: {
        totalIssues: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      },
    })
  })

  it('always runs common validators before the Standard group when routing a Standard deck', () => {
    const pipeline = createDeckValidationPipeline(
      buildRegistryForRoutingTests(),
    )
    const result = pipeline.validate({
      deck: buildDeck('standard' as FormatId, [
        {
          section: 'main',
          cardEntityId: alphaCardId,
          quantity: 1,
        },
      ]),
    })

    expect(
      pipeline.createPlan({ deck: buildDeck('standard' as FormatId, []) }),
    ).toMatchObject({
      formatId: 'standard',
      validatorGroups: ['common', 'standard'],
    })
    expect(result.validatorGroups).toEqual(['common', 'standard'])
    expect(result.evaluatedRules).toEqual([
      'common-marker',
      'select-format-validator-group',
      'standard-marker',
    ])
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'common-marker',
      'standard-marker',
    ])
  })

  it('selects the V Premium group only for V Premium decks', () => {
    const pipeline = createDeckValidationPipeline(
      buildRegistryForRoutingTests(),
    )
    const result = pipeline.validate({
      deck: buildDeck('v-premium' as FormatId, [
        {
          section: 'main',
          cardEntityId: alphaCardId,
          quantity: 1,
        },
      ]),
    })

    expect(result.formatId).toBe('v-premium')
    expect(result.validatorGroups).toEqual(['common', 'v-premium'])
    expect(result.evaluatedRules).toEqual([
      'common-marker',
      'select-format-validator-group',
      'v-premium-marker',
    ])
  })

  it('selects the Premium group only for Premium decks', () => {
    const pipeline = createDeckValidationPipeline(
      buildRegistryForRoutingTests(),
    )
    const result = pipeline.validate({
      deck: buildDeck('premium' as FormatId, [
        {
          section: 'main',
          cardEntityId: alphaCardId,
          quantity: 1,
        },
      ]),
    })

    expect(result.formatId).toBe('premium')
    expect(result.validatorGroups).toEqual(['common', 'premium'])
    expect(result.evaluatedRules).toEqual([
      'common-marker',
      'select-format-validator-group',
      'premium-marker',
    ])
  })

  it('handles a missing format honestly and does not pretend a format branch ran', () => {
    const baseDeck = buildValidStandardDeck()
    const result = validateDeck({
      deck: {
        ...baseDeck,
        formatId: '' as FormatId,
        currentVersion: {
          ...baseDeck.currentVersion,
          formatId: '' as FormatId,
          snapshot: {
            ...baseDeck.currentVersion.snapshot,
            formatId: '' as FormatId,
          },
        },
      },
    })

    expect(result.formatId).toBeNull()
    expect(result.validatorGroups).toEqual(['common'])
    expect(result.evaluatedRules).toEqual([
      'require-deck-format',
      'validate-deck-entry-shape',
      'validate-deck-duplicates',
      'validate-deck-size',
      'validate-copy-limits',
      'validate-deck-consistency',
      'select-format-validator-group',
    ])
    expect(result.issues.map((issue) => issue.code)).toContain('missing-format')
  })

  it('handles an unsupported format honestly and preserves the unified result shape', () => {
    const unsupportedFormatId = 'chronojet-duel' as FormatId
    const result = validateDeck({
      deck: buildDeck(unsupportedFormatId, buildMainDeckCards(50)),
    })

    expect(result).toMatchObject({
      formatId: unsupportedFormatId,
      isValid: false,
      validatorGroups: ['common'],
      summary: {
        totalIssues: 1,
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
      },
    })
    expect(result.issues).toEqual([
      {
        severity: 'error',
        category: 'format',
        code: 'unsupported-format',
        message:
          'Deck format chronojet-duel is not supported by the validation pipeline.',
        target: {
          type: 'format',
          field: 'formatId',
          formatId: unsupportedFormatId,
        },
      },
    ])
  })

  it('fails honestly when the supplied format profile does not match the deck format', () => {
    const result = validateDeck({
      deck: buildDeck('standard' as FormatId, buildMainDeckCards(50)),
      context: {
        format: {
          profile: buildFormatProfile('premium' as FormatId),
        },
      },
    })

    expect(result.formatId).toBe('standard')
    expect(result.validatorGroups).toEqual(['common'])
    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'format',
      code: 'format-profile-mismatch',
      message:
        'Validation received a format profile for premium but the deck format is standard.',
      target: {
        type: 'format',
        field: 'formatId',
        formatId: 'standard' as FormatId,
      },
    })
  })

  it('applies minimal format-aware behavior by rejecting disallowed sections per format', () => {
    const standardResult = validateDeck({
      deck: buildDeck('standard' as FormatId, [
        ...buildMainDeckCards(50),
        {
          section: 'g',
          cardEntityId: alphaCardId,
          quantity: 1,
        },
      ]),
    })
    const vPremiumResult = validateDeck({
      deck: buildDeck('v-premium' as FormatId, [
        ...buildMainDeckCards(50),
        {
          section: 'ride',
          cardEntityId: betaCardId,
          quantity: 1,
        },
      ]),
    })
    const premiumResult = validateDeck({
      deck: buildDeck('premium' as FormatId, [
        ...buildMainDeckCards(50),
        {
          section: 'ride',
          cardEntityId: gammaCardId,
          quantity: 1,
        },
      ]),
    })

    expect(standardResult.issues).toContainEqual({
      severity: 'error',
      category: 'format',
      code: 'section-not-allowed-for-format',
      message:
        'Deck entry for card-alpha is placed in section "g", which is not allowed for Standard.',
      target: {
        type: 'card',
        cardEntityId: alphaCardId,
        section: 'g',
      },
    })
    expect(vPremiumResult.issues).toContainEqual({
      severity: 'error',
      category: 'format',
      code: 'section-not-allowed-for-format',
      message:
        'Deck entry for card-beta is placed in section "ride", which is not allowed for V Premium.',
      target: {
        type: 'card',
        cardEntityId: betaCardId,
        section: 'ride',
      },
    })
    expect(premiumResult.issues).toContainEqual({
      severity: 'error',
      category: 'format',
      code: 'section-not-allowed-for-format',
      message:
        'Deck entry for card-gamma is placed in section "ride", which is not allowed for Premium.',
      target: {
        type: 'card',
        cardEntityId: gammaCardId,
        section: 'ride',
      },
    })
  })

  it('fails honestly when Standard validation does not receive catalog card facts', () => {
    const deck = buildValidStandardDeck()
    const result = validateDeck({
      deck,
      context: {
        format: {
          profile: buildFormatProfile('standard' as FormatId),
        },
      },
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'input',
      code: 'standard-card-facts-missing',
      message:
        'Standard validation requires catalog card facts for ride deck and nation checks.',
      target: {
        type: 'deck',
        deckId,
      },
    })
  })

  it('reports a missing Standard ride deck as a section-level format issue', () => {
    const deck = buildDeck('standard' as FormatId, buildMainDeckCards(50))
    const result = validateDeck({
      deck,
      context: buildStandardValidationContext(deck),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'section',
      code: 'standard-ride-deck-missing',
      message:
        'Standard decks must contain a ride deck with the baseline grade 0, 1, 2, and 3 line.',
      target: {
        type: 'section',
        section: 'ride',
      },
    })
  })

  it('reports an invalid Standard ride deck size when the ride line is incomplete', () => {
    const deck = buildDeck('standard' as FormatId, [
      ...buildMainDeckCards(50),
      ...standardRideCards.slice(0, 3),
    ])
    const result = validateDeck({
      deck,
      context: buildStandardValidationContext(deck),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'section',
      code: 'standard-ride-deck-size-invalid',
      message:
        'Standard ride deck contains 3 cards, but the baseline Standard validation requires exactly 4.',
      target: {
        type: 'section',
        section: 'ride',
      },
    })
  })

  it('rejects Standard ride deck cards that are not unit cards', () => {
    const deck = buildValidStandardDeck()
    const result = validateDeck({
      deck,
      context: buildStandardValidationContext(deck, {
        [rideGrade1CardId]: buildCardFactsEntry({
          grade: 1,
          cardType: 'normal-order',
        }),
      }),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'card',
      code: 'standard-ride-deck-card-type-invalid',
      message:
        'Standard ride deck card ride-grade-1 must be a unit card, but card type is normal-order.',
      target: {
        type: 'card',
        cardEntityId: rideGrade1CardId,
        section: 'ride',
      },
    })
  })

  it('reports an invalid Standard ride deck grade progression', () => {
    const deck = buildValidStandardDeck()
    const result = validateDeck({
      deck,
      context: buildStandardValidationContext(deck, {
        [rideGrade2CardId]: buildCardFactsEntry({
          grade: 3,
        }),
      }),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'section',
      code: 'standard-ride-deck-grade-sequence-invalid',
      message:
        'Standard ride deck must contain exactly one card each for grades 0, 1, 2, and 3.',
      target: {
        type: 'section',
        section: 'ride',
      },
    })
  })

  it('reports conflicting nations inside a Standard deck', () => {
    const deck = buildValidStandardDeck()
    const result = validateDeck({
      deck,
      context: buildStandardValidationContext(deck, {
        [mainCard0Id]: buildCardFactsEntry({
          nation: dragonEmpire,
        }),
      }),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'card',
      code: 'standard-nation-mismatch',
      message:
        'Standard deck nation is Keter Sanctuary, but main-card-0 belongs to Dragon Empire.',
      target: {
        type: 'card',
        cardEntityId: mainCard0Id,
        section: 'main',
      },
    })
  })

  it('reports missing nation facts honestly for Standard nation validation', () => {
    const deck = buildValidStandardDeck()
    const result = validateDeck({
      deck,
      context: buildStandardValidationContext(deck, {
        [rideGrade2CardId]: {
          nation: null,
        },
      }),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'input',
      code: 'standard-card-nation-missing',
      message:
        'Standard nation validation requires nation facts for ride-grade-2.',
      target: {
        type: 'card',
        cardEntityId: rideGrade2CardId,
        section: 'ride',
      },
    })
  })

  it('keeps common and Standard-specific issues together in one unified result', () => {
    const deck = buildDeck('standard' as FormatId, [
      ...buildMainDeckCards(49),
      ...standardRideCards.slice(0, 3),
    ])
    const result = validateDeck({
      deck,
      context: buildStandardValidationContext(deck),
    })

    expect(result.issues.map((issue) => issue.code)).toContain(
      'main-deck-too-small',
    )
    expect(result.issues.map((issue) => issue.code)).toContain(
      'standard-ride-deck-size-invalid',
    )
    expect(result.validatorGroups).toEqual([
      'common',
      'standard',
      'restriction',
    ])
  })

  it('does not run Standard validators for V Premium or Premium decks', () => {
    const results = [
      validateDeck({
        deck: buildDeck('v-premium' as FormatId, buildMainDeckCards(50)),
      }),
      validateDeck({
        deck: buildDeck('premium' as FormatId, buildMainDeckCards(50)),
      }),
    ]

    for (const result of results) {
      expect(result.evaluatedRules).not.toContain(
        'validate-standard-card-facts',
      )
      expect(result.evaluatedRules).not.toContain('validate-standard-ride-deck')
      expect(result.evaluatedRules).not.toContain(
        'validate-standard-nation-constraints',
      )
      expect(
        result.issues.some((issue) =>
          String(issue.code).startsWith('standard-'),
        ),
      ).toBe(false)
    }
  })

  it('returns a valid unified result for a V Premium deck with one clan and legal cards', () => {
    const deck = buildValidVPremiumDeck()
    const result = validateDeck({
      deck,
      context: buildVPremiumValidationContext(deck),
    })

    expect(result).toMatchObject({
      formatId: 'v-premium',
      isValid: true,
      validatorGroups: ['common', 'v-premium', 'restriction'],
      issues: [],
      summary: {
        totalIssues: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      },
    })
    expect(result.evaluatedRules).toEqual([
      'require-deck-format',
      'validate-deck-entry-shape',
      'validate-deck-duplicates',
      'validate-deck-size',
      'validate-copy-limits',
      'validate-deck-consistency',
      'select-format-validator-group',
      'validate-v-premium-sections',
      'validate-v-premium-card-facts',
      'validate-v-premium-clan-constraints',
      'validate-v-premium-card-legality',
      'validate-restriction-list-context',
      'validate-restriction-card-rules',
      'validate-restriction-choice-rules',
    ])
  })

  it('fails honestly when V Premium validation does not receive prepared card facts', () => {
    const deck = buildValidVPremiumDeck()
    const result = validateDeck({
      deck,
      context: {
        format: {
          profile: buildFormatProfile('v-premium' as FormatId),
        },
      },
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'input',
      code: 'v-premium-card-facts-missing',
      message:
        'V Premium validation requires prepared card facts for clan and baseline legality checks.',
      target: {
        type: 'deck',
        deckId,
      },
    })
  })

  it('reports conflicting clans inside a V Premium deck', () => {
    const deck = buildValidVPremiumDeck()
    const result = validateDeck({
      deck,
      context: buildVPremiumValidationContext(deck, {
        [mainCard49Id]: buildCardFactsEntry({
          clan: shadowPaladin,
          legalInFormats: ['v-premium' as FormatId, 'premium' as FormatId],
        }),
      }),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'card',
      code: 'v-premium-clan-mismatch',
      message:
        'V Premium deck clan is Royal Paladin, but main-card-49 belongs to Shadow Paladin.',
      target: {
        type: 'card',
        cardEntityId: mainCard49Id,
        section: 'main',
      },
    })
  })

  it('reports cards that are not legal in V Premium under provided legality facts', () => {
    const deck = buildValidVPremiumDeck()
    const result = validateDeck({
      deck,
      context: buildVPremiumValidationContext(deck, {
        [mainCard0Id]: buildCardFactsEntry({
          clan: royalPaladin,
          legalInFormats: ['standard' as FormatId, 'premium' as FormatId],
        }),
      }),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'format',
      code: 'v-premium-card-legality-invalid',
      message:
        'Card main-card-0 is not legal in V Premium under the provided baseline legality facts.',
      target: {
        type: 'card',
        cardEntityId: mainCard0Id,
        section: 'main',
      },
    })
  })

  it('reports missing clan facts honestly for V Premium clan validation', () => {
    const deck = buildValidVPremiumDeck()
    const result = validateDeck({
      deck,
      context: buildVPremiumValidationContext(deck, {
        [mainCard0Id]: {
          clan: null,
        },
      }),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'input',
      code: 'v-premium-card-clan-missing',
      message: 'V Premium clan validation requires clan facts for main-card-0.',
      target: {
        type: 'card',
        cardEntityId: mainCard0Id,
        section: 'main',
      },
    })
  })

  it('reports missing legality facts honestly for V Premium legality validation', () => {
    const deck = buildValidVPremiumDeck()
    const result = validateDeck({
      deck,
      context: buildVPremiumValidationContext(deck, {
        [mainCard0Id]: {
          legalInFormats: null,
        },
      }),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'input',
      code: 'v-premium-card-legality-missing',
      message:
        'V Premium legality validation requires format legality facts for main-card-0.',
      target: {
        type: 'card',
        cardEntityId: mainCard0Id,
        section: 'main',
      },
    })
  })

  it('does not run V Premium validators for Standard or Premium decks', () => {
    const standardDeck = buildValidStandardDeck()
    const results = [
      validateDeck({
        deck: standardDeck,
        context: buildStandardValidationContext(standardDeck),
      }),
      validateDeck({
        deck: buildDeck('premium' as FormatId, buildMainDeckCards(50)),
      }),
    ]

    for (const result of results) {
      expect(result.evaluatedRules).not.toContain(
        'validate-v-premium-card-facts',
      )
      expect(result.evaluatedRules).not.toContain(
        'validate-v-premium-clan-constraints',
      )
      expect(result.evaluatedRules).not.toContain(
        'validate-v-premium-card-legality',
      )
      expect(
        result.issues.some((issue) =>
          String(issue.code).startsWith('v-premium-'),
        ),
      ).toBe(false)
    }
  })

  it('returns a valid unified result for a Premium deck with separated main and G deck cards', () => {
    const deck = buildValidPremiumDeck()
    const result = validateDeck({
      deck,
      context: buildPremiumValidationContext(deck),
    })

    expect(result).toMatchObject({
      formatId: 'premium',
      isValid: true,
      validatorGroups: ['common', 'premium', 'restriction'],
      issues: [],
      summary: {
        totalIssues: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
      },
    })
    expect(result.evaluatedRules).toEqual([
      'require-deck-format',
      'validate-deck-entry-shape',
      'validate-deck-duplicates',
      'validate-deck-size',
      'validate-copy-limits',
      'validate-deck-consistency',
      'select-format-validator-group',
      'validate-premium-sections',
      'validate-premium-card-facts',
      'validate-premium-g-deck-structure',
      'validate-premium-section-qualification',
      'validate-premium-card-legality',
      'validate-restriction-list-context',
      'validate-restriction-card-rules',
      'validate-restriction-choice-rules',
    ])
  })

  it('fails honestly when Premium validation does not receive prepared card facts', () => {
    const deck = buildValidPremiumDeck()
    const result = validateDeck({
      deck,
      context: {
        format: {
          profile: buildFormatProfile('premium' as FormatId),
        },
      },
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'input',
      code: 'premium-card-facts-missing',
      message:
        'Premium validation requires prepared card facts for G deck qualification and baseline legality checks.',
      target: {
        type: 'deck',
        deckId,
      },
    })
  })

  it('reports G-deck-qualified cards placed in the Premium main deck', () => {
    const deck = buildValidPremiumDeck()
    const result = validateDeck({
      deck,
      context: buildPremiumValidationContext(deck, {
        [mainCard0Id]: buildCardFactsEntry({
          legalInFormats: ['premium' as FormatId],
          premiumGDeckEligible: true,
        }),
      }),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'card',
      code: 'premium-main-deck-contains-g-deck-card',
      message:
        'Premium main deck cannot contain G deck cards such as main-card-0.',
      target: {
        type: 'card',
        cardEntityId: mainCard0Id,
        section: 'main',
      },
    })
  })

  it('reports invalid non-G cards placed in the Premium G deck', () => {
    const deck = buildValidPremiumDeck()
    const result = validateDeck({
      deck,
      context: buildPremiumValidationContext(deck, {
        [gUnit0CardId]: buildCardFactsEntry({
          legalInFormats: ['premium' as FormatId],
          premiumGDeckEligible: false,
        }),
      }),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'card',
      code: 'premium-g-deck-invalid-card',
      message:
        'Premium G deck card g-unit-0 does not satisfy the supplied G deck qualification facts.',
      target: {
        type: 'card',
        cardEntityId: gUnit0CardId,
        section: 'g',
      },
    })
  })

  it('reports a missing Premium G deck when the supplied profile requires one', () => {
    const deck = buildDeck('premium' as FormatId, buildMainDeckCards(50))
    const requiredGDeckProfile: FormatProfile = {
      ...buildFormatProfile('premium' as FormatId),
      deckStructure: [
        {
          section: 'main',
          minCards: 50,
          maxCards: 50,
          required: true,
        },
        {
          section: 'g',
          minCards: 1,
          maxCards: 16,
          required: true,
        },
      ],
    }
    const result = validateDeck({
      deck,
      context: buildPremiumValidationContext(deck, {}, requiredGDeckProfile),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'section',
      code: 'premium-g-deck-missing',
      message:
        'Premium deck is missing the required G deck for the supplied format profile.',
      target: {
        type: 'section',
        section: 'g',
      },
    })
  })

  it('reports an oversized Premium G deck against the supplied profile bounds', () => {
    const deck = buildDeck('premium' as FormatId, [
      ...buildMainDeckCards(50),
      ...Array.from({ length: 17 }, (_, index) => ({
        section: 'g' as const,
        cardEntityId: `g-overflow-${index}` as CardId,
        quantity: 1,
      })),
    ])
    const result = validateDeck({
      deck,
      context: buildPremiumValidationContext(deck),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'section',
      code: 'premium-g-deck-size-invalid',
      message:
        'Premium G deck contains 17 cards, but the supplied Premium baseline allows 0 to 16.',
      target: {
        type: 'section',
        section: 'g',
      },
    })
  })

  it('reports missing G-deck qualification facts honestly for Premium section validation', () => {
    const deck = buildValidPremiumDeck()
    const result = validateDeck({
      deck,
      context: buildPremiumValidationContext(deck, {
        [gUnit0CardId]: {
          premiumGDeckEligible: null,
        },
      }),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'input',
      code: 'premium-card-section-qualification-missing',
      message:
        'Premium section validation requires G deck qualification facts for g-unit-0.',
      target: {
        type: 'card',
        cardEntityId: gUnit0CardId,
        section: 'g',
      },
    })
  })

  it('reports cards that are not legal in Premium under provided legality facts', () => {
    const deck = buildValidPremiumDeck()
    const result = validateDeck({
      deck,
      context: buildPremiumValidationContext(deck, {
        [gUnit0CardId]: buildCardFactsEntry({
          legalInFormats: ['v-premium' as FormatId],
          premiumGDeckEligible: true,
        }),
      }),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'format',
      code: 'premium-card-legality-invalid',
      message:
        'Card g-unit-0 is not legal in Premium under the provided baseline legality facts.',
      target: {
        type: 'card',
        cardEntityId: gUnit0CardId,
        section: 'g',
      },
    })
  })

  it('reports missing legality facts honestly for Premium legality validation', () => {
    const deck = buildValidPremiumDeck()
    const result = validateDeck({
      deck,
      context: buildPremiumValidationContext(deck, {
        [gUnit0CardId]: {
          legalInFormats: null,
        },
      }),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'input',
      code: 'premium-card-legality-missing',
      message:
        'Premium legality validation requires format legality facts for g-unit-0.',
      target: {
        type: 'card',
        cardEntityId: gUnit0CardId,
        section: 'g',
      },
    })
  })

  it('does not run Premium validators for Standard or V Premium decks', () => {
    const standardDeck = buildValidStandardDeck()
    const vPremiumDeck = buildValidVPremiumDeck()
    const results = [
      validateDeck({
        deck: standardDeck,
        context: buildStandardValidationContext(standardDeck),
      }),
      validateDeck({
        deck: vPremiumDeck,
        context: buildVPremiumValidationContext(vPremiumDeck),
      }),
    ]

    for (const result of results) {
      expect(result.evaluatedRules).not.toContain('validate-premium-card-facts')
      expect(result.evaluatedRules).not.toContain(
        'validate-premium-g-deck-structure',
      )
      expect(result.evaluatedRules).not.toContain(
        'validate-premium-section-qualification',
      )
      expect(result.evaluatedRules).not.toContain(
        'validate-premium-card-legality',
      )
      expect(
        result.issues.some((issue) =>
          String(issue.code).startsWith('premium-'),
        ),
      ).toBe(false)
    }
  })

  it('reports banned canonical cards through the restriction layer', () => {
    const deck = buildValidStandardDeck()
    const result = validateDeck({
      deck,
      context: buildStandardValidationContext(deck, {}, [
        buildCardRestrictionRule({
          kind: 'card',
          type: 'banned',
          cardId: mainCard0Id,
          formatId: 'standard' as FormatId,
        }),
      ]),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'restriction',
      code: 'card-banned-in-format',
      message:
        'Card main-card-0 is banned by restriction list standard-active-list for standard.',
      target: {
        type: 'card',
        cardEntityId: mainCard0Id,
      },
    })
  })

  it('accepts limited cards when the deck stays within the restriction cap', () => {
    const deck = buildValidStandardDeck()
    const result = validateDeck({
      deck,
      context: buildStandardValidationContext(deck, {}, [
        buildCardRestrictionRule({
          kind: 'card',
          type: 'limited',
          cardId: mainCard0Id,
          formatId: 'standard' as FormatId,
        }),
      ]),
    })

    expect(result.issues.map((issue) => issue.code)).not.toContain(
      'card-exceeds-restricted-copies',
    )
  })

  it('reports cards that exceed a stricter restriction copy limit', () => {
    const deck = buildDeck('standard' as FormatId, [
      {
        section: 'main',
        cardEntityId: mainCard0Id,
        quantity: 2,
      },
      ...buildMainDeckCards(48, 'restricted-filler'),
      ...standardRideCards,
    ])
    const result = validateDeck({
      deck,
      context: buildStandardValidationContext(deck, {}, [
        buildCardRestrictionRule({
          kind: 'card',
          type: 'limited',
          cardId: mainCard0Id,
          formatId: 'standard' as FormatId,
        }),
      ]),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'restriction',
      code: 'card-exceeds-restricted-copies',
      message:
        'Card main-card-0 is limited to 1 copies by restriction list standard-active-list, but the deck contains 2.',
      target: {
        type: 'card',
        cardEntityId: mainCard0Id,
      },
    })
  })

  it('accepts a satisfied choice restriction group', () => {
    const deck = buildValidStandardDeck()
    const result = validateDeck({
      deck,
      context: buildStandardValidationContext(deck, {}, [
        buildChoiceRestrictionRule({
          kind: 'choice',
          optionCardIds: [mainCard0Id, 'not-present-card' as CardId],
          allowedChoices: 1,
          formatId: 'standard' as FormatId,
        }),
      ]),
    })

    expect(result.issues.map((issue) => issue.code)).not.toContain(
      'choice-restriction-violated',
    )
  })

  it('reports violated choice restrictions as restriction-level issues', () => {
    const deck = buildValidStandardDeck()
    const result = validateDeck({
      deck,
      context: buildStandardValidationContext(deck, {}, [
        buildChoiceRestrictionRule({
          kind: 'choice',
          optionCardIds: [mainCard0Id, mainCard49Id],
          allowedChoices: 1,
          formatId: 'standard' as FormatId,
        }),
      ]),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'restriction',
      code: 'choice-restriction-violated',
      message:
        'Restriction choice group choice:standard-active-list:main-card-0|main-card-49:1 allows 1 card choices, but the deck contains 2: main-card-0, main-card-49.',
      target: {
        type: 'restriction',
        restrictionId: 'choice:standard-active-list:main-card-0|main-card-49:1',
      },
    })
  })

  it('applies restriction lists only when they match the deck format', () => {
    const deck = buildValidVPremiumDeck()
    const mismatchedList = buildRestrictionList('standard' as FormatId, [
      buildCardRestrictionRule({
        kind: 'card',
        type: 'banned',
        cardId: mainCard0Id,
        formatId: 'standard' as FormatId,
      }),
    ])
    const result = validateDeck({
      deck,
      context: {
        ...buildVPremiumValidationContext(deck),
        restrictions: {
          listId: mismatchedList.version,
          activeList: mismatchedList,
        },
      },
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'restriction',
      code: 'restriction-list-format-mismatch',
      message:
        'Restriction list standard-active-list targets standard, but the deck format is v-premium.',
      target: {
        type: 'restriction',
        restrictionId: 'standard-active-list',
      },
    })
    expect(result.issues.map((issue) => issue.code)).not.toContain(
      'card-banned-in-format',
    )
  })

  it('handles partial restriction context honestly when a list id is supplied without an active list', () => {
    const deck = buildValidStandardDeck()
    const context = buildStandardValidationContext(deck)
    const result = validateDeck({
      deck,
      context: {
        ...context,
        restrictions: {
          listId: 'standard-active-list',
        },
      },
    })

    expect(result.issues).toContainEqual({
      severity: 'warning',
      category: 'restriction',
      code: 'restriction-list-missing',
      message:
        'Restriction validation did not receive an active restriction list, so restriction checks were skipped.',
      target: {
        type: 'restriction',
        restrictionId: 'standard-active-list',
      },
    })
  })

  it('keeps structural and restriction issues aggregated in one result', () => {
    const deck = buildDeck('standard' as FormatId, [
      ...buildMainDeckCards(49),
      ...standardRideCards,
    ])
    const result = validateDeck({
      deck,
      context: buildStandardValidationContext(deck, {}, [
        buildCardRestrictionRule({
          kind: 'card',
          type: 'banned',
          cardId: mainCard0Id,
          formatId: 'standard' as FormatId,
        }),
      ]),
    })

    expect(result.issues.map((issue) => issue.code)).toContain(
      'main-deck-too-small',
    )
    expect(result.issues.map((issue) => issue.code)).toContain(
      'card-banned-in-format',
    )
    expect(result.validatorGroups).toEqual([
      'common',
      'standard',
      'restriction',
    ])
  })

  it('reports an empty deck as a deck-level common issue', () => {
    const result = validateDeck({
      deck: buildDeck('standard' as FormatId, []),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'deck',
      code: 'empty-deck',
      message:
        'Deck must contain at least one card before validation can succeed.',
      target: {
        type: 'deck',
        deckId,
      },
    })
    expect(result.issues.map((issue) => issue.code)).not.toContain(
      'main-deck-too-small',
    )
  })

  it('reports a main deck that is too small across all supported formats', () => {
    const results = [
      validateDeck({
        deck: buildDeck('standard' as FormatId, buildMainDeckCards(49)),
      }),
      validateDeck({
        deck: buildDeck('v-premium' as FormatId, buildMainDeckCards(49)),
      }),
      validateDeck({
        deck: buildDeck('premium' as FormatId, buildMainDeckCards(49)),
      }),
    ]

    expect(
      results.map((result) =>
        result.issues.find((issue) => issue.code === 'main-deck-too-small'),
      ),
    ).toEqual([
      {
        severity: 'error',
        category: 'section',
        code: 'main-deck-too-small',
        message:
          'Main deck contains 49 cards, but the common validation baseline requires 50.',
        target: {
          type: 'section',
          section: 'main',
        },
      },
      {
        severity: 'error',
        category: 'section',
        code: 'main-deck-too-small',
        message:
          'Main deck contains 49 cards, but the common validation baseline requires 50.',
        target: {
          type: 'section',
          section: 'main',
        },
      },
      {
        severity: 'error',
        category: 'section',
        code: 'main-deck-too-small',
        message:
          'Main deck contains 49 cards, but the common validation baseline requires 50.',
        target: {
          type: 'section',
          section: 'main',
        },
      },
    ])
  })

  it('reports a main deck that is too large as a section-level common issue', () => {
    const result = validateDeck({
      deck: buildDeck('premium' as FormatId, buildMainDeckCards(51)),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'section',
      code: 'main-deck-too-large',
      message:
        'Main deck contains 51 cards, but the common validation baseline allows only 50.',
      target: {
        type: 'section',
        section: 'main',
      },
    })
  })

  it('reports main-deck copy limits against canonical card entities', () => {
    const result = validateDeck({
      deck: buildDeck(
        'standard' as FormatId,
        buildMainDeckWithCopies(50, alphaCardId, 5),
      ),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'card',
      code: 'copy-limit-exceeded',
      message:
        'Main deck contains 5 copies of card-alpha, but the common validation baseline allows only 4.',
      target: {
        type: 'card',
        cardEntityId: alphaCardId,
        section: 'main',
      },
    })
  })

  it('reports duplicate deck rows for the same canonical card entity', () => {
    const baseDeck = buildDeck('standard' as FormatId, buildMainDeckCards(50))
    const result = validateDeck({
      deck: {
        ...baseDeck,
        currentVersion: {
          ...baseDeck.currentVersion,
          cards: [
            {
              section: 'main',
              cardEntityId: alphaCardId,
              quantity: 2,
            },
            {
              section: 'main',
              cardEntityId: alphaCardId,
              quantity: 1,
            },
            ...buildMainDeckCards(47),
          ],
        },
      },
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'card',
      code: 'duplicate-card-entry',
      message: 'Deck contains duplicate rows for card-alpha in section main.',
      target: {
        type: 'card',
        cardEntityId: alphaCardId,
        section: 'main',
      },
    })
  })

  it('reports structurally invalid quantities without depending on builder guards', () => {
    const baseDeck = buildValidStandardDeck()
    const result = validateDeck({
      deck: {
        ...baseDeck,
        currentVersion: {
          ...baseDeck.currentVersion,
          cards: [
            ...baseDeck.currentVersion.cards,
            {
              section: 'ride',
              cardEntityId: betaCardId,
              quantity: 0,
            },
          ],
        },
      },
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'card',
      code: 'invalid-card-quantity',
      message: 'Deck entry quantity for card-beta must be a positive integer.',
      target: {
        type: 'card',
        cardEntityId: betaCardId,
        section: 'ride',
      },
    })
  })

  it('reports impossible canonical card references inside the current input shape', () => {
    const result = validateDeck({
      deck: buildDeck('standard' as FormatId, [
        ...buildMainDeckCards(49),
        {
          section: 'main',
          cardEntityId: '' as CardId,
          quantity: 1,
        },
      ]),
    })

    expect(result.issues).toContainEqual({
      severity: 'error',
      category: 'card',
      code: 'missing-card-entity-id',
      message:
        'Deck entry in section "main" must reference a canonical card entity id.',
      target: {
        type: 'card',
        cardEntityId: '' as CardId,
        section: 'main',
      },
    })
  })

  it('does not mutate the input deck while validating', () => {
    const deck = buildValidPremiumDeck()
    const beforeValidation = JSON.parse(JSON.stringify(deck)) as Deck

    const result = validateDeck({
      deck,
      context: buildPremiumValidationContext(deck),
    })

    expect(result.isValid).toBe(true)
    expect(deck).toEqual(beforeValidation)
  })

  it('keeps issue accumulation stable across common and format-specific phases', () => {
    const registry: DeckValidationValidatorRegistry = {
      commonValidators: [
        {
          id: 'common-error',
          validate: () =>
            [
              {
                severity: 'error',
                category: 'deck',
                code: 'common-error',
                message: 'common error',
                target: {
                  type: 'deck',
                  deckId,
                },
              },
            ] satisfies readonly DeckValidationIssue[],
        },
      ],
      restrictionValidators: [],
      formatValidatorsByFormat: {
        standard: [
          {
            id: 'standard-warning',
            validate: () =>
              [
                {
                  severity: 'warning',
                  category: 'format',
                  code: 'standard-warning',
                  message: 'standard warning',
                  target: {
                    type: 'format',
                    field: 'formatId',
                    formatId: 'standard' as FormatId,
                  },
                },
              ] satisfies readonly DeckValidationIssue[],
          },
        ],
        'v-premium': [],
        premium: [],
      },
    }

    const result = validateDeck(
      {
        deck: buildDeck('standard' as FormatId, [
          {
            section: 'main',
            cardEntityId: alphaCardId,
            quantity: 1,
          },
        ]),
      },
      registry,
    )

    expect(result.evaluatedRules).toEqual([
      'common-error',
      'select-format-validator-group',
      'standard-warning',
    ])
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'common-error',
      'standard-warning',
    ])
    expect(result.summary).toEqual({
      totalIssues: 2,
      errorCount: 1,
      warningCount: 1,
      infoCount: 0,
    })
  })

  it('keeps the result shape consistent across Standard, V Premium, and Premium', () => {
    const results = [
      validateDeck({
        deck: buildDeck('standard' as FormatId, []),
      }),
      validateDeck({
        deck: buildDeck('v-premium' as FormatId, []),
      }),
      validateDeck({
        deck: buildDeck('premium' as FormatId, []),
      }),
    ]

    expect(results.map((result) => Object.keys(result))).toEqual([
      [
        'formatId',
        'isValid',
        'validatorGroups',
        'evaluatedRules',
        'issues',
        'summary',
      ],
      [
        'formatId',
        'isValid',
        'validatorGroups',
        'evaluatedRules',
        'issues',
        'summary',
      ],
      [
        'formatId',
        'isValid',
        'validatorGroups',
        'evaluatedRules',
        'issues',
        'summary',
      ],
    ])
  })

  it('exposes the default common and format validator groups through the registry', () => {
    expect(defaultDeckValidationValidatorRegistry.commonValidators.length).toBe(
      6,
    )
    expect(
      defaultDeckValidationValidatorRegistry.commonValidators.map(
        (validator) => validator.id,
      ),
    ).toEqual([
      'require-deck-format',
      'validate-deck-entry-shape',
      'validate-deck-duplicates',
      'validate-deck-size',
      'validate-copy-limits',
      'validate-deck-consistency',
    ])
    expect(
      defaultDeckValidationValidatorRegistry.restrictionValidators.map(
        (validator) => validator.id,
      ),
    ).toEqual([
      'validate-restriction-list-context',
      'validate-restriction-card-rules',
      'validate-restriction-choice-rules',
    ])
    expect(
      defaultDeckValidationValidatorRegistry.formatValidatorsByFormat.standard.map(
        (validator) => validator.id,
      ),
    ).toEqual([
      'validate-standard-sections',
      'validate-standard-card-facts',
      'validate-standard-ride-deck',
      'validate-standard-nation-constraints',
    ])
    expect(
      defaultDeckValidationValidatorRegistry.formatValidatorsByFormat[
        'v-premium'
      ].map((validator) => validator.id),
    ).toEqual([
      'validate-v-premium-sections',
      'validate-v-premium-card-facts',
      'validate-v-premium-clan-constraints',
      'validate-v-premium-card-legality',
    ])
    expect(
      defaultDeckValidationValidatorRegistry.formatValidatorsByFormat.premium.map(
        (validator) => validator.id,
      ),
    ).toEqual([
      'validate-premium-sections',
      'validate-premium-card-facts',
      'validate-premium-g-deck-structure',
      'validate-premium-section-qualification',
      'validate-premium-card-legality',
    ])
  })
})
