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

import type {
  DeckValidationCardFacts,
  DeckValidationContext,
  DeckValidationInput,
  DeckValidationIssue,
  DeckValidationValidatorGroupId,
  SupportedDeckValidationFormatId,
} from '../../contracts'

const defaultDeckName = 'Validation Scenario Deck'
const defaultOwnerId = 'validation-scenario-owner' as UserId
const defaultCreatedAt = '2026-04-16T00:00:00.000Z'

export const keterSanctuary = 'Keter Sanctuary' as Nation
export const dragonEmpire = 'Dragon Empire' as Nation
export const royalPaladin = 'Royal Paladin' as Clan
export const shadowPaladin = 'Shadow Paladin' as Clan

export interface DeckFixtureCardRow {
  readonly section: DeckSection
  readonly cardEntityId: CardId
  readonly quantity: number
}

export type CardFactOverrideMap = Readonly<
  Record<string, Partial<DeckValidationCardFacts> | null>
>

export type ScenarioIssueExpectation = Pick<
  DeckValidationIssue,
  'code' | 'severity' | 'category' | 'target'
>

export interface DeckValidationScenarioFixture {
  readonly id: string
  readonly name: string
  readonly formatId: SupportedDeckValidationFormatId
  readonly input: DeckValidationInput
  readonly expectedIssues: readonly ScenarioIssueExpectation[]
  readonly expectedValidatorGroups: readonly DeckValidationValidatorGroupId[]
  readonly requiredEvaluatedRules: readonly string[]
  readonly forbiddenEvaluatedRules: readonly string[]
  readonly forbiddenIssueCodePrefixes: readonly string[]
}

export const formatIsolationExpectations: Readonly<
  Record<
    SupportedDeckValidationFormatId,
    Pick<
      DeckValidationScenarioFixture,
      | 'requiredEvaluatedRules'
      | 'forbiddenEvaluatedRules'
      | 'forbiddenIssueCodePrefixes'
    >
  >
> = {
  standard: {
    requiredEvaluatedRules: [
      'validate-standard-sections',
      'validate-standard-card-facts',
      'validate-standard-ride-deck',
      'validate-standard-nation-constraints',
    ],
    forbiddenEvaluatedRules: [
      'validate-v-premium-sections',
      'validate-v-premium-card-facts',
      'validate-v-premium-clan-constraints',
      'validate-v-premium-card-legality',
      'validate-premium-sections',
      'validate-premium-card-facts',
      'validate-premium-g-deck-structure',
      'validate-premium-section-qualification',
      'validate-premium-card-legality',
    ],
    forbiddenIssueCodePrefixes: ['v-premium-', 'premium-'],
  },
  'v-premium': {
    requiredEvaluatedRules: [
      'validate-v-premium-sections',
      'validate-v-premium-card-facts',
      'validate-v-premium-clan-constraints',
      'validate-v-premium-card-legality',
    ],
    forbiddenEvaluatedRules: [
      'validate-standard-sections',
      'validate-standard-card-facts',
      'validate-standard-ride-deck',
      'validate-standard-nation-constraints',
      'validate-premium-sections',
      'validate-premium-card-facts',
      'validate-premium-g-deck-structure',
      'validate-premium-section-qualification',
      'validate-premium-card-legality',
    ],
    forbiddenIssueCodePrefixes: ['standard-', 'premium-'],
  },
  premium: {
    requiredEvaluatedRules: [
      'validate-premium-sections',
      'validate-premium-card-facts',
      'validate-premium-g-deck-structure',
      'validate-premium-section-qualification',
      'validate-premium-card-legality',
    ],
    forbiddenEvaluatedRules: [
      'validate-standard-sections',
      'validate-standard-card-facts',
      'validate-standard-ride-deck',
      'validate-standard-nation-constraints',
      'validate-v-premium-sections',
      'validate-v-premium-card-facts',
      'validate-v-premium-clan-constraints',
      'validate-v-premium-card-legality',
    ],
    forbiddenIssueCodePrefixes: ['standard-', 'v-premium-'],
  },
}

export function buildDeck(
  formatId: SupportedDeckValidationFormatId,
  cards: readonly DeckFixtureCardRow[],
  options: {
    readonly deckId?: string
    readonly name?: string
  } = {},
): Deck {
  const deckId = options.deckId ?? `fixture-${formatId}-deck`

  return createDeck({
    id: deckId as DeckId,
    ownerId: defaultOwnerId,
    formatId: formatId as FormatId,
    name: options.name ?? defaultDeckName,
    createdAt: defaultCreatedAt,
    updatedAt: defaultCreatedAt,
    currentVersionId: `${deckId}-version` as DeckVersionId,
    cards: cards.map((card) => ({
      section: card.section,
      cardEntityId: card.cardEntityId,
      quantity: card.quantity,
    })),
  })
}

export function buildMainDeckCards(
  totalCards: number,
  prefix: string,
): readonly DeckFixtureCardRow[] {
  return Array.from({ length: totalCards }, (_, index) => ({
    section: 'main' as const,
    cardEntityId: `${prefix}-${String(index + 1).padStart(2, '0')}` as CardId,
    quantity: 1,
  }))
}

export function buildMainDeckWithCopies(
  totalCards: number,
  repeatedCardId: CardId,
  copies: number,
  fillerPrefix: string,
): readonly DeckFixtureCardRow[] {
  return [
    {
      section: 'main',
      cardEntityId: repeatedCardId,
      quantity: copies,
    },
    ...buildMainDeckCards(totalCards - copies, fillerPrefix),
  ]
}

export function buildRideDeckLine(
  grades: readonly Grade[],
  prefix: string,
): {
  readonly cards: readonly DeckFixtureCardRow[]
  readonly cardFactOverrides: CardFactOverrideMap
} {
  const cards = grades.map((grade) => ({
    section: 'ride' as const,
    cardEntityId: `${prefix}-grade-${grade}` as CardId,
    quantity: 1,
  }))

  return {
    cards,
    cardFactOverrides: Object.fromEntries(
      cards.map((card, index) => [
        String(card.cardEntityId),
        {
          grade: grades[index]!,
          cardType: 'normal-unit' as CardType,
          nation: keterSanctuary,
        },
      ]),
    ),
  }
}

export function buildStandardRideDeckLine(prefix = 'standard-ride'): {
  readonly cards: readonly DeckFixtureCardRow[]
  readonly cardFactOverrides: CardFactOverrideMap
} {
  return buildRideDeckLine([0, 1, 2, 3] as const, prefix)
}

export function buildPremiumGDeck(
  totalCards: number,
  prefix: string,
): {
  readonly cards: readonly DeckFixtureCardRow[]
  readonly cardFactOverrides: CardFactOverrideMap
} {
  const cards = Array.from({ length: totalCards }, (_, index) => ({
    section: 'g' as const,
    cardEntityId: `${prefix}-${String(index + 1).padStart(2, '0')}` as CardId,
    quantity: 1,
  }))

  return {
    cards,
    cardFactOverrides: Object.fromEntries(
      cards.map((card) => [
        String(card.cardEntityId),
        {
          grade: 4,
          cardType: 'normal-unit' as CardType,
          premiumGDeckEligible: true,
          legalInFormats: ['premium' as FormatId],
        },
      ]),
    ),
  }
}

export function mergeCardFactOverrides(
  ...sources: readonly CardFactOverrideMap[]
): CardFactOverrideMap {
  const merged: Record<string, Partial<DeckValidationCardFacts> | null> = {}

  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      merged[key] = value
    }
  }

  return merged
}

export function buildFormatProfile(
  formatId: SupportedDeckValidationFormatId,
  overrides: {
    readonly deckStructure?: FormatProfile['deckStructure']
    readonly duplicateSections?: readonly DeckSection[]
    readonly defaultMaxCopiesPerCard?: number
    readonly displayName?: string
  } = {},
): FormatProfile {
  const baseProfile = createBaseFormatProfile(formatId)

  return {
    ...baseProfile,
    ...(overrides.displayName
      ? {
          displayName: overrides.displayName,
        }
      : {}),
    deckStructure: overrides.deckStructure ?? baseProfile.deckStructure,
    constructionRules: {
      ...baseProfile.constructionRules,
      duplicateConstraint: {
        appliesToSections:
          overrides.duplicateSections ??
          baseProfile.constructionRules.duplicateConstraint.appliesToSections,
        defaultMaxCopiesPerCard:
          overrides.defaultMaxCopiesPerCard ??
          baseProfile.constructionRules.duplicateConstraint
            .defaultMaxCopiesPerCard,
      },
    },
  }
}

export function buildValidationContext(input: {
  readonly deck: Deck
  readonly profile?: FormatProfile
  readonly cardFactOverrides?: CardFactOverrideMap
  readonly restrictionRules?: readonly RestrictionRule[]
}): DeckValidationContext {
  const formatId = input.deck.formatId as SupportedDeckValidationFormatId
  const profile = input.profile ?? buildFormatProfile(formatId)
  const cardFactOverrides = input.cardFactOverrides ?? {}
  const cardFacts = new Map<CardId, DeckValidationCardFacts>()

  for (const card of input.deck.currentVersion.cards) {
    if (cardFacts.has(card.cardEntityId)) {
      continue
    }

    const override = cardFactOverrides[String(card.cardEntityId)]

    if (override === null) {
      continue
    }

    cardFacts.set(card.cardEntityId, {
      ...buildDefaultCardFacts(formatId, card),
      ...override,
    })
  }

  const activeList =
    input.restrictionRules && input.restrictionRules.length > 0
      ? buildRestrictionList(formatId, input.restrictionRules)
      : null

  return {
    format: {
      profile,
    },
    cardFacts,
    ...(activeList
      ? {
          restrictions: {
            listId: activeList.version,
            activeList,
          },
        }
      : {}),
  }
}

export function buildRestrictionList(
  formatId: SupportedDeckValidationFormatId,
  rules: readonly RestrictionRule[],
): RestrictionList {
  return {
    formatId: formatId as FormatId,
    version: `${formatId}-active-list`,
    rules,
  }
}

export function buildCardRestrictionRule(
  formatId: SupportedDeckValidationFormatId,
  rule: Omit<CardRestrictionRule, 'formatId'>,
): CardRestrictionRule {
  return {
    ...rule,
    formatId: formatId as FormatId,
  }
}

export function buildChoiceRestrictionRule(
  formatId: SupportedDeckValidationFormatId,
  rule: Omit<ChoiceRestrictionRule, 'formatId'>,
): ChoiceRestrictionRule {
  return {
    ...rule,
    formatId: formatId as FormatId,
  }
}

export function createScenarioFixture(input: {
  readonly id: string
  readonly name: string
  readonly formatId: SupportedDeckValidationFormatId
  readonly deck: Deck
  readonly context: DeckValidationContext
  readonly expectedIssues: readonly ScenarioIssueExpectation[]
  readonly requiredEvaluatedRules: readonly string[]
  readonly forbiddenEvaluatedRules: readonly string[]
  readonly forbiddenIssueCodePrefixes: readonly string[]
}): DeckValidationScenarioFixture {
  return {
    id: input.id,
    name: input.name,
    formatId: input.formatId,
    input: {
      deck: input.deck,
      context: input.context,
    },
    expectedIssues: input.expectedIssues,
    expectedValidatorGroups: ['common', input.formatId, 'restriction'],
    requiredEvaluatedRules: input.requiredEvaluatedRules,
    forbiddenEvaluatedRules: input.forbiddenEvaluatedRules,
    forbiddenIssueCodePrefixes: input.forbiddenIssueCodePrefixes,
  }
}

function createBaseFormatProfile(
  formatId: SupportedDeckValidationFormatId,
): FormatProfile {
  if (formatId === 'standard') {
    return {
      formatId: 'standard' as FormatId,
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

  if (formatId === 'v-premium') {
    return {
      formatId: 'v-premium' as FormatId,
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
    formatId: 'premium' as FormatId,
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
        allowedGrades: [4],
        allowedCardTypes: ['normal-unit'],
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

function buildDefaultCardFacts(
  formatId: SupportedDeckValidationFormatId,
  card: {
    readonly section: DeckSection
  },
): DeckValidationCardFacts {
  if (formatId === 'standard') {
    return {
      grade: card.section === 'ride' ? 0 : 1,
      cardType: 'normal-unit',
      clan: royalPaladin,
      nation: keterSanctuary,
      legalInFormats: [
        'standard' as FormatId,
        'v-premium' as FormatId,
        'premium' as FormatId,
      ],
      premiumGDeckEligible: false,
    }
  }

  if (formatId === 'v-premium') {
    return {
      grade: 1,
      cardType: 'normal-unit',
      clan: royalPaladin,
      nation: keterSanctuary,
      legalInFormats: ['v-premium' as FormatId, 'premium' as FormatId],
      premiumGDeckEligible: false,
    }
  }

  return {
    grade: card.section === 'g' ? 4 : 1,
    cardType: 'normal-unit',
    clan: royalPaladin,
    nation: keterSanctuary,
    legalInFormats: ['premium' as FormatId],
    premiumGDeckEligible: card.section === 'g',
  }
}
