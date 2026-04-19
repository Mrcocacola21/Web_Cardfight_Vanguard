import type { CardId, FormatId } from '@web-vg/shared'

import {
  buildCardRestrictionRule,
  buildDeck,
  buildFormatProfile,
  buildMainDeckCards,
  buildMainDeckWithCopies,
  buildValidationContext,
  createScenarioFixture,
  formatIsolationExpectations,
  shadowPaladin,
} from '../shared'

const mixedClanCardId = 'fixture-v-premium-shadow-card' as CardId
const illegalCardId = 'fixture-v-premium-illegal-card' as CardId
const limitedCardId = 'fixture-v-premium-limited-card' as CardId
const profiledCardId = 'fixture-v-premium-profiled-card' as CardId

const validDeck = buildDeck(
  'v-premium',
  buildMainDeckCards(50, 'fixture-v-premium-main'),
  {
    deckId: 'fixture-v-premium-valid',
    name: 'V Premium valid fixture',
  },
)

const mixedClanDeck = buildDeck(
  'v-premium',
  [
    ...buildMainDeckCards(49, 'fixture-v-premium-clan-main'),
    {
      section: 'main',
      cardEntityId: mixedClanCardId,
      quantity: 1,
    },
  ],
  {
    deckId: 'fixture-v-premium-mixed-clan',
    name: 'V Premium mixed clan fixture',
  },
)

const illegalDeck = buildDeck(
  'v-premium',
  [
    ...buildMainDeckCards(49, 'fixture-v-premium-legal-main'),
    {
      section: 'main',
      cardEntityId: illegalCardId,
      quantity: 1,
    },
  ],
  {
    deckId: 'fixture-v-premium-illegal',
    name: 'V Premium legality fixture',
  },
)

const limitedDeck = buildDeck(
  'v-premium',
  buildMainDeckWithCopies(50, limitedCardId, 2, 'fixture-v-premium-limited'),
  {
    deckId: 'fixture-v-premium-limited',
    name: 'V Premium limited fixture',
  },
)

const profileDrivenDeck = buildDeck(
  'v-premium',
  buildMainDeckWithCopies(49, profiledCardId, 4, 'fixture-v-premium-profile'),
  {
    deckId: 'fixture-v-premium-profile-driven',
    name: 'V Premium profile-driven fixture',
  },
)

export const vPremiumDeckScenarioFixtures = [
  createScenarioFixture({
    id: 'v-premium-valid',
    name: 'accepts a valid V Premium clan deck fixture',
    formatId: 'v-premium',
    deck: validDeck,
    context: buildValidationContext({
      deck: validDeck,
    }),
    expectedIssues: [],
    ...formatIsolationExpectations['v-premium'],
  }),
  createScenarioFixture({
    id: 'v-premium-mixed-clan',
    name: 'flags a mixed-clan V Premium deck fixture',
    formatId: 'v-premium',
    deck: mixedClanDeck,
    context: buildValidationContext({
      deck: mixedClanDeck,
      cardFactOverrides: {
        [mixedClanCardId]: {
          clan: shadowPaladin,
        },
      },
    }),
    expectedIssues: [
      {
        severity: 'error',
        category: 'card',
        code: 'v-premium-clan-mismatch',
        target: {
          type: 'card',
          cardEntityId: mixedClanCardId,
          section: 'main',
        },
      },
    ],
    ...formatIsolationExpectations['v-premium'],
  }),
  createScenarioFixture({
    id: 'v-premium-illegal-card',
    name: 'flags a V Premium legality violation fixture',
    formatId: 'v-premium',
    deck: illegalDeck,
    context: buildValidationContext({
      deck: illegalDeck,
      cardFactOverrides: {
        [illegalCardId]: {
          legalInFormats: ['premium' as FormatId],
        },
      },
    }),
    expectedIssues: [
      {
        severity: 'error',
        category: 'format',
        code: 'v-premium-card-legality-invalid',
        target: {
          type: 'card',
          cardEntityId: illegalCardId,
          section: 'main',
        },
      },
    ],
    ...formatIsolationExpectations['v-premium'],
  }),
  createScenarioFixture({
    id: 'v-premium-limited-card',
    name: 'flags a V Premium restricted-copy fixture',
    formatId: 'v-premium',
    deck: limitedDeck,
    context: buildValidationContext({
      deck: limitedDeck,
      restrictionRules: [
        buildCardRestrictionRule('v-premium', {
          kind: 'card',
          type: 'limited',
          cardId: limitedCardId,
        }),
      ],
    }),
    expectedIssues: [
      {
        severity: 'error',
        category: 'restriction',
        code: 'card-exceeds-restricted-copies',
        target: {
          type: 'card',
          cardEntityId: limitedCardId,
        },
      },
    ],
    ...formatIsolationExpectations['v-premium'],
  }),
] as const

export const vPremiumProfileDrivenScenarioFixture = createScenarioFixture({
  id: 'v-premium-profile-driven',
  name: 'uses a custom V Premium profile for deck size and copy limits',
  formatId: 'v-premium',
  deck: profileDrivenDeck,
  context: buildValidationContext({
    deck: profileDrivenDeck,
    profile: buildFormatProfile('v-premium', {
      displayName: 'V Premium Custom Fixture Profile',
      deckStructure: [
        {
          section: 'main',
          minCards: 49,
          maxCards: 49,
          required: true,
        },
      ],
      defaultMaxCopiesPerCard: 3,
    }),
  }),
  expectedIssues: [
    {
      severity: 'error',
      category: 'card',
      code: 'copy-limit-exceeded',
      target: {
        type: 'card',
        cardEntityId: profiledCardId,
        section: 'main',
      },
    },
  ],
  ...formatIsolationExpectations['v-premium'],
})
