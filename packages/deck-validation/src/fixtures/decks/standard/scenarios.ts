import type { CardId } from '@web-vg/shared'

import {
  buildCardRestrictionRule,
  buildDeck,
  buildMainDeckCards,
  buildRideDeckLine,
  buildStandardRideDeckLine,
  buildValidationContext,
  createScenarioFixture,
  dragonEmpire,
  formatIsolationExpectations,
  mergeCardFactOverrides,
} from '../shared'

const validRideDeck = buildStandardRideDeckLine('fixture-standard-valid-ride')
const invalidRideDeck = buildRideDeckLine(
  [0, 1, 2] as const,
  'fixture-standard-invalid-ride',
)
const offNationCardId = 'fixture-standard-off-nation' as CardId
const bannedCardId = 'fixture-standard-banned-card' as CardId

const validDeck = buildDeck(
  'standard',
  [...buildMainDeckCards(50, 'fixture-standard-main'), ...validRideDeck.cards],
  {
    deckId: 'fixture-standard-valid',
    name: 'Standard valid fixture',
  },
)

const invalidSizeDeck = buildDeck(
  'standard',
  [
    ...buildMainDeckCards(49, 'fixture-standard-size-main'),
    ...validRideDeck.cards,
  ],
  {
    deckId: 'fixture-standard-invalid-size',
    name: 'Standard undersized fixture',
  },
)

const invalidRideDeckFixture = buildDeck(
  'standard',
  [
    ...buildMainDeckCards(50, 'fixture-standard-ride-main'),
    ...invalidRideDeck.cards,
  ],
  {
    deckId: 'fixture-standard-invalid-ride',
    name: 'Standard invalid ride fixture',
  },
)

const nationMismatchDeck = buildDeck(
  'standard',
  [
    ...buildMainDeckCards(49, 'fixture-standard-nation-main'),
    {
      section: 'main',
      cardEntityId: offNationCardId,
      quantity: 1,
    },
    ...validRideDeck.cards,
  ],
  {
    deckId: 'fixture-standard-invalid-nation',
    name: 'Standard nation mismatch fixture',
  },
)

const bannedUndersizedDeck = buildDeck(
  'standard',
  [
    {
      section: 'main',
      cardEntityId: bannedCardId,
      quantity: 1,
    },
    ...buildMainDeckCards(48, 'fixture-standard-restriction-main'),
    ...validRideDeck.cards,
  ],
  {
    deckId: 'fixture-standard-banned-undersized',
    name: 'Standard banned plus undersized fixture',
  },
)

export const standardDeckScenarioFixtures = [
  createScenarioFixture({
    id: 'standard-valid',
    name: 'accepts a valid Standard deck fixture',
    formatId: 'standard',
    deck: validDeck,
    context: buildValidationContext({
      deck: validDeck,
      cardFactOverrides: validRideDeck.cardFactOverrides,
    }),
    expectedIssues: [],
    ...formatIsolationExpectations.standard,
  }),
  createScenarioFixture({
    id: 'standard-invalid-size',
    name: 'flags an undersized Standard main deck fixture',
    formatId: 'standard',
    deck: invalidSizeDeck,
    context: buildValidationContext({
      deck: invalidSizeDeck,
      cardFactOverrides: validRideDeck.cardFactOverrides,
    }),
    expectedIssues: [
      {
        severity: 'error',
        category: 'section',
        code: 'main-deck-too-small',
        target: {
          type: 'section',
          section: 'main',
        },
      },
    ],
    ...formatIsolationExpectations.standard,
  }),
  createScenarioFixture({
    id: 'standard-invalid-ride',
    name: 'flags an invalid Standard ride deck fixture',
    formatId: 'standard',
    deck: invalidRideDeckFixture,
    context: buildValidationContext({
      deck: invalidRideDeckFixture,
      cardFactOverrides: invalidRideDeck.cardFactOverrides,
    }),
    expectedIssues: [
      {
        severity: 'error',
        category: 'section',
        code: 'standard-ride-deck-size-invalid',
        target: {
          type: 'section',
          section: 'ride',
        },
      },
    ],
    ...formatIsolationExpectations.standard,
  }),
  createScenarioFixture({
    id: 'standard-invalid-nation',
    name: 'flags a mixed-nation Standard deck fixture',
    formatId: 'standard',
    deck: nationMismatchDeck,
    context: buildValidationContext({
      deck: nationMismatchDeck,
      cardFactOverrides: mergeCardFactOverrides(
        validRideDeck.cardFactOverrides,
        {
          [offNationCardId]: {
            nation: dragonEmpire,
          },
        },
      ),
    }),
    expectedIssues: [
      {
        severity: 'error',
        category: 'card',
        code: 'standard-nation-mismatch',
        target: {
          type: 'card',
          cardEntityId: offNationCardId,
          section: 'main',
        },
      },
    ],
    ...formatIsolationExpectations.standard,
  }),
  createScenarioFixture({
    id: 'standard-banned-and-undersized',
    name: 'keeps Standard restriction and baseline issues aggregated',
    formatId: 'standard',
    deck: bannedUndersizedDeck,
    context: buildValidationContext({
      deck: bannedUndersizedDeck,
      cardFactOverrides: validRideDeck.cardFactOverrides,
      restrictionRules: [
        buildCardRestrictionRule('standard', {
          kind: 'card',
          type: 'banned',
          cardId: bannedCardId,
        }),
      ],
    }),
    expectedIssues: [
      {
        severity: 'error',
        category: 'section',
        code: 'main-deck-too-small',
        target: {
          type: 'section',
          section: 'main',
        },
      },
      {
        severity: 'error',
        category: 'restriction',
        code: 'card-banned-in-format',
        target: {
          type: 'card',
          cardEntityId: bannedCardId,
        },
      },
    ],
    ...formatIsolationExpectations.standard,
  }),
] as const
