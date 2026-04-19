import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CatalogCardEntityRecord,
  CatalogCardLegalityRecord,
} from '@web-vg/db/repositories/catalog'
import type { DeckDetailRecord } from '@web-vg/db/repositories/decks'
import type { DeckBuilderDraft } from './deck-builder-draft'

const mocks = vi.hoisted(() => ({
  createCatalogRepository: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('@web-vg/db', async () => {
  const actual = await vi.importActual('@web-vg/db')

  return {
    ...actual,
    createCatalogRepository: mocks.createCatalogRepository,
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

import { validateDeckBuilderDraft } from './deck-builder-validation'
import { getDeckBuilderValidationData } from './server/deck-builder-validation-read'

describe('deck builder validation runtime hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('hydrates Premium qualification facts through the runtime path and surfaces Premium section validation honestly', async () => {
    const premiumCard = createCatalogCardEntityRecord('card-g-unit', {
      name: 'Chrono Gate Strider',
      canonicalKey: 'card.chrono-gate-strider',
      grade: 4,
      nation: 'Dark Zone',
      clan: 'Gear Chronicle',
      keywords: ['stride'],
    })
    const initialDeck = createDeckDetailRecord('premium', [
      {
        cardEntityId: premiumCard.id,
        sectionKey: 'main',
        quantity: 1,
      },
    ])
    const draft = createDeckBuilderDraftRecord('premium', [
      {
        cardEntityId: premiumCard.id,
        sectionKey: 'main',
        canonicalKey: premiumCard.canonicalKey,
        name: premiumCard.name,
        grade: premiumCard.grade,
        cardType: premiumCard.cardType,
        triggerType: premiumCard.triggerType,
        quantity: 1,
      },
    ])

    mocks.createSupabaseServerClient.mockResolvedValue(
      createFakeSupabaseClient({
        'legality.rule_profiles': [
          createRuleProfileRow({
            id: 'premium-baseline-v1',
            format_id: 'premium',
            display_name: 'Premium Baseline',
            construction_basis: 'clan-based',
            product_eligibility_basis: 'family-membership-with-overrides',
            default_max_copies_per_card: 4,
            restriction_compatibility: 'official-list-with-overrides',
            supports_ride_deck: false,
            supports_g_deck: true,
            supports_stride: true,
            supports_imaginary_gift: true,
            supports_overdress: false,
          }),
        ],
        'legality.rule_profile_sections': [
          {
            rule_profile_id: 'premium-baseline-v1',
            section_key: 'main',
            min_cards: 50,
            max_cards: 50,
            required: true,
            allowed_grades: null,
            allowed_card_types: [
              'normal-unit',
              'trigger-unit',
              'normal-order',
              'blitz-order',
              'set-order',
            ],
          },
          {
            rule_profile_id: 'premium-baseline-v1',
            section_key: 'g',
            min_cards: 0,
            max_cards: 16,
            required: false,
            allowed_grades: [4],
            allowed_card_types: ['normal-unit'],
          },
        ],
        'legality.rule_profile_duplicate_scope_sections': [
          {
            rule_profile_id: 'premium-baseline-v1',
            section_key: 'main',
          },
        ],
        'legality.rule_profile_trigger_rules': [
          {
            rule_profile_id: 'premium-baseline-v1',
            applies_to_section: 'main',
            max_total_triggers: 16,
          },
        ],
        'legality.rule_profile_trigger_type_limits': [
          {
            rule_profile_id: 'premium-baseline-v1',
            trigger_type: 'heal',
            max_copies: 4,
          },
          {
            rule_profile_id: 'premium-baseline-v1',
            trigger_type: 'over',
            max_copies: 1,
          },
        ],
        'legality.rule_profile_gameplay_markers': [
          {
            rule_profile_id: 'premium-baseline-v1',
            marker: 'g-zone',
          },
          {
            rule_profile_id: 'premium-baseline-v1',
            marker: 'stride',
          },
        ],
        'legality.rule_profile_product_families': [
          {
            rule_profile_id: 'premium-baseline-v1',
            product_family_id: 'family-premium',
          },
        ],
        'legality.restriction_lists': [],
      }),
    )
    mocks.createCatalogRepository.mockReturnValue(
      createCatalogRepositoryMock({
        [premiumCard.id]: premiumCard,
      }),
    )

    const validationData = await getDeckBuilderValidationData({
      initialDeck,
      catalogCards: [],
    })
    const validationResult = validateDeckBuilderDraft(draft, validationData)

    expect(
      validationData.formatProfiles.map((profile) => profile.formatId),
    ).toEqual(['premium'])
    expect(validationData.cards).toContainEqual(
      expect.objectContaining({
        cardEntityId: premiumCard.id,
        premiumGDeckEligible: true,
      }),
    )
    expect(validationResult.issues.map((issue) => issue.code)).toContain(
      'premium-main-deck-contains-g-deck-card',
    )
    expect(validationResult.issues.map((issue) => issue.code)).not.toContain(
      'premium-card-section-qualification-missing',
    )
  })

  it('uses runtime format.profile data for baseline deck size and copy-limit behavior', async () => {
    const mainCards = [
      {
        id: 'card-alpha',
        quantity: 4,
      },
      ...Array.from({ length: 45 }, (_, index) => ({
        id: `card-filler-${index + 1}`,
        quantity: 1,
      })),
    ]
    const cardEntities = Object.fromEntries(
      mainCards.map((entry) => [
        entry.id,
        createCatalogCardEntityRecord(entry.id, {
          name: `Royal Unit ${entry.id}`,
          canonicalKey: `card.${entry.id}`,
          nation: 'United Sanctuary',
          clan: 'Royal Paladin',
        }),
      ]),
    ) as Record<string, CatalogCardEntityRecord>
    const initialDeck = createDeckDetailRecord(
      'v-premium',
      mainCards.map((entry) => ({
        cardEntityId: entry.id,
        sectionKey: 'main',
        quantity: entry.quantity,
      })),
    )
    const draft = createDeckBuilderDraftRecord(
      'v-premium',
      mainCards.map((entry) => {
        const card = cardEntities[entry.id]

        if (!card) {
          throw new Error(`Missing catalog card fixture for ${entry.id}.`)
        }

        return {
          cardEntityId: card.id,
          sectionKey: 'main',
          canonicalKey: card.canonicalKey,
          name: card.name,
          grade: card.grade,
          cardType: card.cardType,
          triggerType: card.triggerType,
          quantity: entry.quantity,
        }
      }),
    )

    mocks.createSupabaseServerClient.mockResolvedValue(
      createFakeSupabaseClient({
        'legality.rule_profiles': [
          createRuleProfileRow({
            id: 'v-premium-custom-v1',
            format_id: 'v-premium',
            display_name: 'V Premium Custom Baseline',
            construction_basis: 'clan-based',
            product_eligibility_basis: 'explicit-family-membership',
            default_max_copies_per_card: 3,
            restriction_compatibility: 'official-list',
            supports_ride_deck: false,
            supports_g_deck: false,
            supports_stride: false,
            supports_imaginary_gift: true,
            supports_overdress: false,
          }),
        ],
        'legality.rule_profile_sections': [
          {
            rule_profile_id: 'v-premium-custom-v1',
            section_key: 'main',
            min_cards: 49,
            max_cards: 49,
            required: true,
            allowed_grades: null,
            allowed_card_types: [
              'normal-unit',
              'trigger-unit',
              'normal-order',
              'blitz-order',
              'set-order',
            ],
          },
        ],
        'legality.rule_profile_duplicate_scope_sections': [
          {
            rule_profile_id: 'v-premium-custom-v1',
            section_key: 'main',
          },
        ],
        'legality.rule_profile_trigger_rules': [
          {
            rule_profile_id: 'v-premium-custom-v1',
            applies_to_section: 'main',
            max_total_triggers: 16,
          },
        ],
        'legality.rule_profile_trigger_type_limits': [
          {
            rule_profile_id: 'v-premium-custom-v1',
            trigger_type: 'heal',
            max_copies: 4,
          },
        ],
        'legality.rule_profile_gameplay_markers': [
          {
            rule_profile_id: 'v-premium-custom-v1',
            marker: 'imaginary-gift',
          },
        ],
        'legality.rule_profile_product_families': [
          {
            rule_profile_id: 'v-premium-custom-v1',
            product_family_id: 'family-v',
          },
        ],
        'legality.restriction_lists': [],
      }),
    )
    mocks.createCatalogRepository.mockReturnValue(
      createCatalogRepositoryMock(cardEntities),
    )

    const validationData = await getDeckBuilderValidationData({
      initialDeck,
      catalogCards: [],
    })
    const validationResult = validateDeckBuilderDraft(draft, validationData)

    expect(validationData.formatProfiles).toContainEqual(
      expect.objectContaining({
        formatId: 'v-premium',
        deckStructure: [
          expect.objectContaining({
            section: 'main',
            minCards: 49,
            maxCards: 49,
          }),
        ],
        constructionRules: expect.objectContaining({
          duplicateConstraint: expect.objectContaining({
            defaultMaxCopiesPerCard: 3,
          }) as unknown,
        }) as unknown,
      }),
    )
    expect(validationResult.issues.map((issue) => issue.code)).toContain(
      'copy-limit-exceeded',
    )
    expect(validationResult.issues.map((issue) => issue.code)).not.toContain(
      'main-deck-too-small',
    )
    expect(validationResult.issues).toContainEqual(
      expect.objectContaining({
        code: 'copy-limit-exceeded',
        message:
          'Main deck contains 4 copies of card-alpha, but the format baseline allows only 3.',
      }),
    )
  })
})

function createCatalogRepositoryMock(
  cardsById: Readonly<Record<string, CatalogCardEntityRecord>>,
) {
  return {
    getCardEntityById: vi.fn((cardEntityId: string) =>
      Promise.resolve({
        ok: true as const,
        data: cardsById[cardEntityId] ?? null,
      }),
    ),
    getCardLegalityFacts: vi.fn((cardEntityId: string) =>
      Promise.resolve({
        ok: true as const,
        data: createCardLegalityRecord(cardEntityId),
      }),
    ),
  }
}

function createCardLegalityRecord(
  cardEntityId: string,
): CatalogCardLegalityRecord {
  return {
    eligibilityOverrides: [
      {
        formatId: cardEntityId === 'card-g-unit' ? 'premium' : 'v-premium',
        formatName: cardEntityId === 'card-g-unit' ? 'Premium' : 'V Premium',
        ruleProfileId:
          cardEntityId === 'card-g-unit'
            ? 'premium-baseline-v1'
            : 'v-premium-custom-v1',
        ruleProfileName:
          cardEntityId === 'card-g-unit'
            ? 'Premium Baseline'
            : 'V Premium Custom Baseline',
        eligibilityState: 'allowed',
        rationale: 'Validation test profile allows this card.',
      },
    ],
    restrictions: [],
    choiceRestrictions: [],
  }
}

function createRuleProfileRow(overrides: {
  readonly id: string
  readonly format_id: string
  readonly display_name: string
  readonly construction_basis: string
  readonly product_eligibility_basis: string
  readonly default_max_copies_per_card: number
  readonly restriction_compatibility: string
  readonly supports_ride_deck: boolean
  readonly supports_g_deck: boolean
  readonly supports_stride: boolean
  readonly supports_imaginary_gift: boolean
  readonly supports_overdress: boolean
}) {
  return {
    ...overrides,
    is_active: true,
  }
}

function createFakeSupabaseClient(
  rowsByTable: Readonly<Record<string, readonly Record<string, unknown>[]>>,
) {
  return {
    schema(schema: string) {
      return {
        from(table: string) {
          const key = `${schema}.${table}`
          const sourceRows = rowsByTable[key] ?? []
          const filters: {
            readonly type: 'eq' | 'in'
            readonly column: string
            readonly value: unknown
          }[] = []
          const builder = {
            select() {
              return builder
            },
            eq(column: string, value: unknown) {
              filters.push({
                type: 'eq',
                column,
                value,
              })

              return builder
            },
            in(column: string, value: readonly unknown[]) {
              filters.push({
                type: 'in',
                column,
                value,
              })

              return builder
            },
            then(
              resolve: (value: {
                readonly data: readonly Record<string, unknown>[]
                readonly error: null
              }) => unknown,
              reject?: (reason: unknown) => unknown,
            ) {
              try {
                const data = sourceRows.filter((row) =>
                  filters.every((filter) => {
                    const rowValue = row[filter.column]

                    if (filter.type === 'eq') {
                      return rowValue === filter.value
                    }

                    return Array.isArray(filter.value)
                      ? filter.value.includes(rowValue)
                      : false
                  }),
                )

                return Promise.resolve(
                  resolve({
                    data,
                    error: null,
                  }),
                )
              } catch (error) {
                const reason =
                  error instanceof Error ? error : new Error(String(error))

                if (reject) {
                  reject(reason)
                }

                return Promise.reject(reason)
              }
            },
          }

          return builder
        },
      }
    },
  }
}

function createCatalogCardEntityRecord(
  id: string,
  overrides: Partial<CatalogCardEntityRecord>,
): CatalogCardEntityRecord {
  return {
    id,
    canonicalKey: overrides.canonicalKey ?? `card.${id}`,
    name: overrides.name ?? id,
    normalizedName: (overrides.name ?? id).toLowerCase(),
    grade: overrides.grade ?? 3,
    cardType: overrides.cardType ?? 'normal-unit',
    nation: overrides.nation ?? 'United Sanctuary',
    clan: overrides.clan ?? 'Royal Paladin',
    race: overrides.race ?? 'Human',
    triggerType: overrides.triggerType ?? null,
    basePower: overrides.basePower ?? 13000,
    baseCritical: overrides.baseCritical ?? 1,
    baseShield: overrides.baseShield ?? null,
    keywords: overrides.keywords ?? [],
    effectRefs: overrides.effectRefs ?? [],
  }
}

function createDeckDetailRecord(
  formatId: string,
  cards: readonly {
    readonly cardEntityId: string
    readonly sectionKey: 'main' | 'ride' | 'g'
    readonly quantity: number
  }[],
): DeckDetailRecord {
  return {
    id: 'deck-1',
    ownerProfileId: 'profile-1',
    title: 'Validation Runtime Deck',
    description: null,
    tags: [],
    isFavorite: false,
    visibility: 'private',
    archivedAt: null,
    createdAt: '2026-04-08T00:00:00.000Z',
    updatedAt: '2026-04-08T01:00:00.000Z',
    format: {
      id: formatId,
      displayName: formatId,
      description: null,
    },
    currentVersionId: 'version-1',
    currentVersion: {
      id: 'version-1',
      deckId: 'deck-1',
      versionNumber: 1,
      createdByProfileId: 'profile-1',
      versionNote: null,
      createdAt: '2026-04-08T01:00:00.000Z',
      totalCards: cards.reduce((total, card) => total + card.quantity, 0),
      sectionCounts: {
        main: cards
          .filter((card) => card.sectionKey === 'main')
          .reduce((total, card) => total + card.quantity, 0),
        ride: cards
          .filter((card) => card.sectionKey === 'ride')
          .reduce((total, card) => total + card.quantity, 0),
        g: cards
          .filter((card) => card.sectionKey === 'g')
          .reduce((total, card) => total + card.quantity, 0),
      },
      cards: cards.map((card) => ({
        sectionKey: card.sectionKey,
        cardEntityId: card.cardEntityId,
        canonicalKey: `card.${card.cardEntityId}`,
        name: card.cardEntityId,
        grade: 3,
        cardType: 'normal-unit',
        triggerType: null,
        quantity: card.quantity,
      })),
      sections: [
        {
          key: 'main',
          totalCards: cards
            .filter((card) => card.sectionKey === 'main')
            .reduce((total, card) => total + card.quantity, 0),
          cards: [],
        },
        {
          key: 'ride',
          totalCards: cards
            .filter((card) => card.sectionKey === 'ride')
            .reduce((total, card) => total + card.quantity, 0),
          cards: [],
        },
        {
          key: 'g',
          totalCards: cards
            .filter((card) => card.sectionKey === 'g')
            .reduce((total, card) => total + card.quantity, 0),
          cards: [],
        },
      ],
    },
  }
}

function createDeckBuilderDraftRecord(
  formatId: string,
  cards: DeckBuilderDraft['cards'],
): DeckBuilderDraft {
  return {
    deckId: 'deck-1',
    ownerProfileId: 'profile-1',
    formatId,
    title: 'Validation Runtime Deck',
    description: null,
    tags: [],
    isFavorite: false,
    currentVersionId: 'version-1',
    updatedAt: '2026-04-08T01:00:00.000Z',
    cards,
  }
}
