import type { CardId } from '@web-vg/shared'

import {
  buildChoiceRestrictionRule,
  buildDeck,
  buildMainDeckCards,
  buildPremiumGDeck,
  buildValidationContext,
  createScenarioFixture,
  formatIsolationExpectations,
} from '../shared'

const premiumMainGUnitCardId = 'fixture-premium-main-g-unit' as CardId
const premiumChoiceCardA = 'fixture-premium-choice-card-a' as CardId
const premiumChoiceCardB = 'fixture-premium-choice-card-b' as CardId

const validGDeck = buildPremiumGDeck(4, 'fixture-premium-valid-g')
const oversizedGDeck = buildPremiumGDeck(17, 'fixture-premium-oversized-g')

const validDeck = buildDeck(
  'premium',
  [...buildMainDeckCards(50, 'fixture-premium-main'), ...validGDeck.cards],
  {
    deckId: 'fixture-premium-valid',
    name: 'Premium valid fixture',
  },
)

const mainDeckGUnitFixture = buildDeck(
  'premium',
  [
    ...buildMainDeckCards(49, 'fixture-premium-main-illegal'),
    {
      section: 'main',
      cardEntityId: premiumMainGUnitCardId,
      quantity: 1,
    },
  ],
  {
    deckId: 'fixture-premium-main-g-unit',
    name: 'Premium main deck G unit fixture',
  },
)

const oversizedGDeckFixture = buildDeck(
  'premium',
  [
    ...buildMainDeckCards(50, 'fixture-premium-structure'),
    ...oversizedGDeck.cards,
  ],
  {
    deckId: 'fixture-premium-invalid-g-size',
    name: 'Premium oversized G deck fixture',
  },
)

const restrictedChoiceFixture = buildDeck(
  'premium',
  [
    ...buildMainDeckCards(48, 'fixture-premium-choice-main'),
    {
      section: 'main',
      cardEntityId: premiumChoiceCardA,
      quantity: 1,
    },
    {
      section: 'main',
      cardEntityId: premiumChoiceCardB,
      quantity: 1,
    },
    ...validGDeck.cards,
  ],
  {
    deckId: 'fixture-premium-choice',
    name: 'Premium choice restriction fixture',
  },
)

export const premiumDeckScenarioFixtures = [
  createScenarioFixture({
    id: 'premium-valid',
    name: 'accepts a valid Premium main plus G deck fixture',
    formatId: 'premium',
    deck: validDeck,
    context: buildValidationContext({
      deck: validDeck,
      cardFactOverrides: validGDeck.cardFactOverrides,
    }),
    expectedIssues: [],
    ...formatIsolationExpectations.premium,
  }),
  createScenarioFixture({
    id: 'premium-main-g-unit',
    name: 'flags a Premium G unit placed in the main deck fixture',
    formatId: 'premium',
    deck: mainDeckGUnitFixture,
    context: buildValidationContext({
      deck: mainDeckGUnitFixture,
      cardFactOverrides: {
        [premiumMainGUnitCardId]: {
          grade: 4,
          premiumGDeckEligible: true,
        },
      },
    }),
    expectedIssues: [
      {
        severity: 'error',
        category: 'card',
        code: 'premium-main-deck-contains-g-deck-card',
        target: {
          type: 'card',
          cardEntityId: premiumMainGUnitCardId,
          section: 'main',
        },
      },
    ],
    ...formatIsolationExpectations.premium,
  }),
  createScenarioFixture({
    id: 'premium-invalid-g-size',
    name: 'flags an invalid Premium G deck structure fixture',
    formatId: 'premium',
    deck: oversizedGDeckFixture,
    context: buildValidationContext({
      deck: oversizedGDeckFixture,
      cardFactOverrides: oversizedGDeck.cardFactOverrides,
    }),
    expectedIssues: [
      {
        severity: 'error',
        category: 'section',
        code: 'premium-g-deck-size-invalid',
        target: {
          type: 'section',
          section: 'g',
        },
      },
    ],
    ...formatIsolationExpectations.premium,
  }),
  createScenarioFixture({
    id: 'premium-choice-restriction',
    name: 'flags a Premium choice restriction fixture',
    formatId: 'premium',
    deck: restrictedChoiceFixture,
    context: buildValidationContext({
      deck: restrictedChoiceFixture,
      cardFactOverrides: validGDeck.cardFactOverrides,
      restrictionRules: [
        buildChoiceRestrictionRule('premium', {
          kind: 'choice',
          optionCardIds: [premiumChoiceCardA, premiumChoiceCardB],
          allowedChoices: 1,
        }),
      ],
    }),
    expectedIssues: [
      {
        severity: 'error',
        category: 'restriction',
        code: 'choice-restriction-violated',
        target: {
          type: 'restriction',
          restrictionId:
            'choice:premium-active-list:fixture-premium-choice-card-a|fixture-premium-choice-card-b:1',
        },
      },
    ],
    ...formatIsolationExpectations.premium,
  }),
] as const
