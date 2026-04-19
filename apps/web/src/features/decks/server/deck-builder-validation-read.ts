import { createCatalogRepository, type Tables } from '@web-vg/db'
import type { CatalogCardEntityRecord } from '@web-vg/db/repositories/catalog'
import type { DeckDetailRecord } from '@web-vg/db/repositories/decks'
import type {
  CardRestrictionRule,
  ChoiceRestrictionRule,
  RestrictionList,
  RestrictionType,
} from '@web-vg/legality'
import type {
  CardId,
  CardType,
  ConstructionBasis,
  DeckSection,
  FormatGameplayMarker,
  FormatId,
  FormatProfile,
  Grade,
  ProductFamilyId,
  RestrictionModelCompatibility,
  TriggerType,
} from '@web-vg/shared'

import {
  type DeckBuilderValidationCardRecord,
  type DeckBuilderValidationData,
  createEmptyDeckBuilderValidationData,
} from '@/features/decks/deck-builder-validation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type ActiveRuleProfileRow = Pick<
  Tables<{ schema: 'legality' }, 'rule_profiles'>,
  | 'id'
  | 'format_id'
  | 'display_name'
  | 'construction_basis'
  | 'product_eligibility_basis'
  | 'default_max_copies_per_card'
  | 'restriction_compatibility'
  | 'supports_ride_deck'
  | 'supports_g_deck'
  | 'supports_stride'
  | 'supports_imaginary_gift'
  | 'supports_overdress'
>

type ActiveRestrictionListRow = Pick<
  Tables<{ schema: 'legality' }, 'restriction_lists'>,
  'id' | 'rule_profile_id' | 'version_label'
>

type RestrictionActiveRuleProfileRow = Pick<
  Tables<{ schema: 'legality' }, 'rule_profiles'>,
  'id' | 'format_id'
>

type RuleProfileSectionRow = Pick<
  Tables<{ schema: 'legality' }, 'rule_profile_sections'>,
  | 'rule_profile_id'
  | 'section_key'
  | 'min_cards'
  | 'max_cards'
  | 'required'
  | 'allowed_grades'
  | 'allowed_card_types'
>

type RuleProfileDuplicateScopeRow = Pick<
  Tables<{ schema: 'legality' }, 'rule_profile_duplicate_scope_sections'>,
  'rule_profile_id' | 'section_key'
>

type RuleProfileTriggerRuleRow = Pick<
  Tables<{ schema: 'legality' }, 'rule_profile_trigger_rules'>,
  'rule_profile_id' | 'applies_to_section' | 'max_total_triggers'
>

type RuleProfileTriggerTypeLimitRow = Pick<
  Tables<{ schema: 'legality' }, 'rule_profile_trigger_type_limits'>,
  'rule_profile_id' | 'trigger_type' | 'max_copies'
>

type RuleProfileGameplayMarkerRow = Pick<
  Tables<{ schema: 'legality' }, 'rule_profile_gameplay_markers'>,
  'rule_profile_id' | 'marker'
>

type RuleProfileProductFamilyRow = Pick<
  Tables<{ schema: 'legality' }, 'rule_profile_product_families'>,
  'rule_profile_id' | 'product_family_id'
>

type CardRestrictionRuleRow = Pick<
  Tables<{ schema: 'legality' }, 'card_restriction_rules'>,
  | 'card_entity_id'
  | 'restriction_list_id'
  | 'restriction_type'
  | 'max_copies'
  | 'note'
>

type ChoiceRestrictionRuleRow = Pick<
  Tables<{ schema: 'legality' }, 'choice_restriction_rules'>,
  'id' | 'restriction_list_id' | 'allowed_choices' | 'note'
>

type ChoiceRestrictionRuleCardRow = Pick<
  Tables<{ schema: 'legality' }, 'choice_restriction_rule_cards'>,
  'choice_restriction_rule_id' | 'card_entity_id'
>

export async function getDeckBuilderValidationData(input: {
  readonly initialDeck: DeckDetailRecord
  readonly catalogCards: readonly CatalogCardEntityRecord[]
}): Promise<DeckBuilderValidationData> {
  const client = await createSupabaseServerClient()
  const repository = createCatalogRepository(client)
  const formatProfiles = await loadActiveFormatProfiles(client)
  const premiumProfile =
    formatProfiles.find(
      (profile) => profile.formatId === ('premium' as FormatId),
    ) ?? null
  const cardsById = new Map<string, DeckBuilderValidationCardRecord>()

  for (const card of input.catalogCards) {
    cardsById.set(card.id, createValidationCardRecord(card, premiumProfile))
  }

  const missingDeckCardIds = Array.from(
    new Set(
      (input.initialDeck.currentVersion?.cards ?? [])
        .map((card) => card.cardEntityId)
        .filter((cardEntityId) => !cardsById.has(cardEntityId)),
    ),
  ).sort((left, right) => left.localeCompare(right))

  if (missingDeckCardIds.length > 0) {
    const metadataResults = await Promise.all(
      missingDeckCardIds.map((cardEntityId) =>
        repository.getCardEntityById(cardEntityId),
      ),
    )

    for (const result of metadataResults) {
      if (!result.ok || !result.data) {
        continue
      }

      cardsById.set(
        result.data.id,
        createValidationCardRecord(result.data, premiumProfile),
      )
    }
  }

  const cardIds = Array.from(cardsById.keys()).sort((left, right) =>
    left.localeCompare(right),
  )

  if (cardIds.length === 0) {
    return {
      ...createEmptyDeckBuilderValidationData(),
      formatProfiles,
    }
  }

  const legalityResults = await Promise.all(
    cardIds.map(async (cardEntityId) => ({
      cardEntityId,
      result: await repository.getCardLegalityFacts(cardEntityId),
    })),
  )

  for (const entry of legalityResults) {
    if (!entry.result.ok) {
      continue
    }

    const currentCard = cardsById.get(entry.cardEntityId)

    if (!currentCard) {
      continue
    }

    cardsById.set(entry.cardEntityId, {
      ...currentCard,
      legalInFormats: resolveAllowedFormats(entry.result.data),
    })
  }

  const restrictionLists = await loadRestrictionListsForCardIds(client, cardIds)

  return {
    formatProfiles,
    cards: Array.from(cardsById.values()).sort((left, right) =>
      left.cardEntityId.localeCompare(right.cardEntityId),
    ),
    restrictionLists,
  }
}

function createValidationCardRecord(
  card: CatalogCardEntityRecord,
  premiumProfile: FormatProfile | null,
): DeckBuilderValidationCardRecord {
  return {
    cardEntityId: card.id,
    canonicalKey: card.canonicalKey,
    name: card.name,
    grade: card.grade,
    cardType: card.cardType,
    nation: card.nation,
    clan: card.clan,
    triggerType: card.triggerType,
    legalInFormats: null,
    premiumGDeckEligible: derivePremiumGDeckEligibility(card, premiumProfile),
  }
}

function resolveAllowedFormats(input: {
  readonly eligibilityOverrides: readonly {
    readonly formatId: string
    readonly eligibilityState: string
  }[]
}): readonly string[] {
  return Array.from(
    new Set(
      input.eligibilityOverrides
        .filter((entry) => entry.eligibilityState === 'allowed')
        .map((entry) => entry.formatId),
    ),
  ).sort((left, right) => left.localeCompare(right))
}

async function loadActiveFormatProfiles(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<readonly FormatProfile[]> {
  const activeRuleProfilesResult = await client
    .schema('legality')
    .from('rule_profiles')
    .select(
      [
        'id',
        'format_id',
        'display_name',
        'construction_basis',
        'product_eligibility_basis',
        'default_max_copies_per_card',
        'restriction_compatibility',
        'supports_ride_deck',
        'supports_g_deck',
        'supports_stride',
        'supports_imaginary_gift',
        'supports_overdress',
      ].join(', '),
    )
    .eq('is_active', true)

  if (activeRuleProfilesResult.error) {
    return []
  }

  const activeRuleProfiles = (activeRuleProfilesResult.data ??
    []) as unknown as readonly ActiveRuleProfileRow[]

  if (activeRuleProfiles.length === 0) {
    return []
  }

  const activeRuleProfileIds = activeRuleProfiles.map((row) => row.id)
  const [
    sectionResult,
    duplicateScopeResult,
    triggerRuleResult,
    triggerTypeLimitResult,
    gameplayMarkerResult,
    productFamilyResult,
  ] = await Promise.all([
    client
      .schema('legality')
      .from('rule_profile_sections')
      .select(
        [
          'rule_profile_id',
          'section_key',
          'min_cards',
          'max_cards',
          'required',
          'allowed_grades',
          'allowed_card_types',
        ].join(', '),
      )
      .in('rule_profile_id', activeRuleProfileIds),
    client
      .schema('legality')
      .from('rule_profile_duplicate_scope_sections')
      .select('rule_profile_id, section_key')
      .in('rule_profile_id', activeRuleProfileIds),
    client
      .schema('legality')
      .from('rule_profile_trigger_rules')
      .select('rule_profile_id, applies_to_section, max_total_triggers')
      .in('rule_profile_id', activeRuleProfileIds),
    client
      .schema('legality')
      .from('rule_profile_trigger_type_limits')
      .select('rule_profile_id, trigger_type, max_copies')
      .in('rule_profile_id', activeRuleProfileIds),
    client
      .schema('legality')
      .from('rule_profile_gameplay_markers')
      .select('rule_profile_id, marker')
      .in('rule_profile_id', activeRuleProfileIds),
    client
      .schema('legality')
      .from('rule_profile_product_families')
      .select('rule_profile_id, product_family_id')
      .in('rule_profile_id', activeRuleProfileIds),
  ])

  if (
    sectionResult.error ||
    duplicateScopeResult.error ||
    triggerRuleResult.error ||
    triggerTypeLimitResult.error ||
    gameplayMarkerResult.error ||
    productFamilyResult.error
  ) {
    return []
  }

  const sections = (sectionResult.data ??
    []) as unknown as readonly RuleProfileSectionRow[]
  const duplicateScopes = (duplicateScopeResult.data ??
    []) as unknown as readonly RuleProfileDuplicateScopeRow[]
  const triggerRules = (triggerRuleResult.data ??
    []) as unknown as readonly RuleProfileTriggerRuleRow[]
  const triggerTypeLimits = (triggerTypeLimitResult.data ??
    []) as unknown as readonly RuleProfileTriggerTypeLimitRow[]
  const gameplayMarkers = (gameplayMarkerResult.data ??
    []) as unknown as readonly RuleProfileGameplayMarkerRow[]
  const productFamilies = (productFamilyResult.data ??
    []) as unknown as readonly RuleProfileProductFamilyRow[]

  return activeRuleProfiles
    .flatMap((row) => {
      const constructionBasis = normalizeConstructionBasis(
        row.construction_basis,
      )
      const productEligibilityBasis = normalizeProductEligibilityBasis(
        row.product_eligibility_basis,
      )
      const restrictionCompatibility = normalizeRestrictionCompatibility(
        row.restriction_compatibility,
      )

      if (
        !constructionBasis ||
        !productEligibilityBasis ||
        !restrictionCompatibility
      ) {
        return []
      }

      const triggerConstraint = mapTriggerConstraint(
        row.id,
        triggerRules,
        triggerTypeLimits,
      )

      return [
        {
          formatId: row.format_id as FormatId,
          displayName: row.display_name,
          constructionBasis,
          productEligibility: {
            basis: productEligibilityBasis,
            supportedProductFamilies: productFamilies
              .filter((entry) => entry.rule_profile_id === row.id)
              .map((entry) => entry.product_family_id as ProductFamilyId)
              .sort((left, right) => String(left).localeCompare(String(right))),
          },
          deckStructure: sections
            .filter((entry) => entry.rule_profile_id === row.id)
            .flatMap((entry) => mapRuleProfileSection(entry))
            .sort(compareDeckSections),
          constructionRules: {
            duplicateConstraint: {
              appliesToSections: duplicateScopes
                .filter((entry) => entry.rule_profile_id === row.id)
                .flatMap((entry) => {
                  const section = normalizeDeckSection(entry.section_key)

                  return section ? [section] : []
                })
                .sort(compareSectionKeys),
              defaultMaxCopiesPerCard: row.default_max_copies_per_card,
            },
            ...(triggerConstraint ? { triggerConstraint } : {}),
          },
          capabilities: {
            supportsRideDeck: row.supports_ride_deck,
            supportsGDeck: row.supports_g_deck,
            supportsStride: row.supports_stride,
            supportsImaginaryGift: row.supports_imaginary_gift,
            supportsOverDress: row.supports_overdress,
            gameplayMarkers: gameplayMarkers
              .filter((entry) => entry.rule_profile_id === row.id)
              .flatMap((entry) => {
                const marker = normalizeGameplayMarker(entry.marker)

                return marker ? [marker] : []
              })
              .sort((left, right) => left.localeCompare(right)),
          },
          restrictionCompatibility,
        } satisfies FormatProfile,
      ]
    })
    .sort((left, right) => left.formatId.localeCompare(right.formatId))
}

function mapRuleProfileSection(
  row: RuleProfileSectionRow,
): FormatProfile['deckStructure'] {
  const section = normalizeDeckSection(row.section_key)

  if (!section) {
    return []
  }

  return [
    {
      section,
      minCards: row.min_cards,
      maxCards: row.max_cards,
      required: row.required,
      ...(row.allowed_grades
        ? {
            allowedGrades: row.allowed_grades
              .map((grade) => grade as Grade)
              .sort((left, right) => left - right),
          }
        : {}),
      ...(row.allowed_card_types
        ? {
            allowedCardTypes: row.allowed_card_types
              .flatMap((entry) => {
                const cardType = normalizeCardType(entry)

                return cardType ? [cardType] : []
              })
              .sort((left, right) => left.localeCompare(right)),
          }
        : {}),
    },
  ]
}

function mapTriggerConstraint(
  ruleProfileId: string,
  triggerRules: readonly RuleProfileTriggerRuleRow[],
  triggerTypeLimits: readonly RuleProfileTriggerTypeLimitRow[],
): NonNullable<FormatProfile['constructionRules']['triggerConstraint']> | null {
  const triggerRule = triggerRules.find(
    (entry) => entry.rule_profile_id === ruleProfileId,
  )
  const appliesToSection = triggerRule
    ? normalizeDeckSection(triggerRule.applies_to_section)
    : null

  if (!triggerRule || appliesToSection !== 'main') {
    return null
  }

  return {
    appliesToSection,
    maxTotalTriggers: triggerRule.max_total_triggers,
    perTypeLimits: triggerTypeLimits
      .filter((entry) => entry.rule_profile_id === ruleProfileId)
      .flatMap((entry) => {
        const triggerType = normalizeTriggerType(entry.trigger_type)

        return triggerType
          ? [
              {
                triggerType,
                maxCopies: entry.max_copies,
              },
            ]
          : []
      })
      .sort((left, right) => left.triggerType.localeCompare(right.triggerType)),
  }
}

function derivePremiumGDeckEligibility(
  card: Pick<CatalogCardEntityRecord, 'grade' | 'cardType'>,
  premiumProfile: FormatProfile | null,
): boolean | null {
  if (!premiumProfile || premiumProfile.formatId !== ('premium' as FormatId)) {
    return null
  }

  const gSection = premiumProfile.deckStructure.find(
    (entry) => entry.section === 'g',
  )

  if (!gSection) {
    return null
  }

  const allowedGrades = gSection.allowedGrades ?? null
  const allowedCardTypes = gSection.allowedCardTypes ?? null

  return (
    (!allowedGrades || allowedGrades.includes(card.grade as Grade)) &&
    (!allowedCardTypes || allowedCardTypes.includes(card.cardType as CardType))
  )
}

async function loadRestrictionListsForCardIds(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  cardIds: readonly string[],
): Promise<readonly RestrictionList[]> {
  if (cardIds.length === 0) {
    return []
  }

  const activeRuleProfilesResult = await client
    .schema('legality')
    .from('rule_profiles')
    .select('id, format_id')
    .eq('is_active', true)

  if (activeRuleProfilesResult.error) {
    return []
  }

  const activeRuleProfiles = (activeRuleProfilesResult.data ??
    []) as unknown as readonly RestrictionActiveRuleProfileRow[]

  if (activeRuleProfiles.length === 0) {
    return []
  }

  const formatIdByRuleProfileId = new Map<string, FormatId>(
    activeRuleProfiles.map((row) => [row.id, row.format_id as FormatId]),
  )
  const activeRuleProfileIds = Array.from(formatIdByRuleProfileId.keys())

  const activeRestrictionListsResult = await client
    .schema('legality')
    .from('restriction_lists')
    .select('id, rule_profile_id, version_label')
    .eq('is_active', true)
    .in('rule_profile_id', activeRuleProfileIds)

  if (activeRestrictionListsResult.error) {
    return []
  }

  const activeRestrictionLists = (activeRestrictionListsResult.data ??
    []) as readonly ActiveRestrictionListRow[]

  if (activeRestrictionLists.length === 0) {
    return []
  }

  const restrictionListMetaById = new Map<
    string,
    {
      readonly formatId: FormatId
      readonly version: string
    }
  >()
  const restrictionListsByFormat = new Map<
    FormatId,
    {
      readonly formatId: FormatId
      readonly version: string
      readonly rules: (CardRestrictionRule | ChoiceRestrictionRule)[]
    }
  >()

  for (const list of activeRestrictionLists) {
    const formatId = formatIdByRuleProfileId.get(list.rule_profile_id)

    if (!formatId) {
      continue
    }

    restrictionListMetaById.set(list.id, {
      formatId,
      version: list.version_label,
    })

    if (!restrictionListsByFormat.has(formatId)) {
      restrictionListsByFormat.set(formatId, {
        formatId,
        version: list.version_label,
        rules: [],
      })
    }
  }

  const activeRestrictionListIds = Array.from(restrictionListMetaById.keys())

  if (activeRestrictionListIds.length === 0) {
    return []
  }

  const cardRestrictionRulesResult = await client
    .schema('legality')
    .from('card_restriction_rules')
    .select(
      'card_entity_id, restriction_list_id, restriction_type, max_copies, note',
    )
    .in('card_entity_id', cardIds)
    .in('restriction_list_id', activeRestrictionListIds)

  if (!cardRestrictionRulesResult.error) {
    const cardRestrictionRules = (cardRestrictionRulesResult.data ??
      []) as readonly CardRestrictionRuleRow[]

    for (const rule of cardRestrictionRules) {
      const restrictionType = normalizeRestrictionType(rule.restriction_type)
      const metadata = restrictionListMetaById.get(rule.restriction_list_id)
      const list = metadata
        ? restrictionListsByFormat.get(metadata.formatId)
        : undefined

      if (!restrictionType || !metadata || !list) {
        continue
      }

      list.rules.push({
        kind: 'card',
        type: restrictionType,
        formatId: metadata.formatId,
        cardId: rule.card_entity_id as CardId,
        ...(rule.max_copies != null ? { limit: rule.max_copies } : {}),
        ...(rule.note ? { note: rule.note } : {}),
      })
    }
  }

  const touchedChoiceMembershipsResult = await client
    .schema('legality')
    .from('choice_restriction_rule_cards')
    .select('choice_restriction_rule_id, card_entity_id')
    .in('card_entity_id', cardIds)

  if (!touchedChoiceMembershipsResult.error) {
    const touchedChoiceMemberships = (touchedChoiceMembershipsResult.data ??
      []) as readonly ChoiceRestrictionRuleCardRow[]
    const touchedChoiceRuleIds = Array.from(
      new Set(
        touchedChoiceMemberships.map((row) => row.choice_restriction_rule_id),
      ),
    )

    if (touchedChoiceRuleIds.length > 0) {
      const choiceRulesResult = await client
        .schema('legality')
        .from('choice_restriction_rules')
        .select('id, restriction_list_id, allowed_choices, note')
        .in('id', touchedChoiceRuleIds)
        .in('restriction_list_id', activeRestrictionListIds)

      if (!choiceRulesResult.error) {
        const choiceRules = (choiceRulesResult.data ??
          []) as readonly ChoiceRestrictionRuleRow[]
        const choiceRuleIds = choiceRules.map((rule) => rule.id)

        if (choiceRuleIds.length > 0) {
          const allChoiceMembershipsResult = await client
            .schema('legality')
            .from('choice_restriction_rule_cards')
            .select('choice_restriction_rule_id, card_entity_id')
            .in('choice_restriction_rule_id', choiceRuleIds)

          if (!allChoiceMembershipsResult.error) {
            const allChoiceMemberships = (allChoiceMembershipsResult.data ??
              []) as readonly ChoiceRestrictionRuleCardRow[]
            const optionCardIdsByChoiceRuleId = new Map<
              string,
              readonly CardId[]
            >()

            for (const membership of allChoiceMemberships) {
              const existing = optionCardIdsByChoiceRuleId.get(
                membership.choice_restriction_rule_id,
              )

              optionCardIdsByChoiceRuleId.set(
                membership.choice_restriction_rule_id,
                existing
                  ? sortUniqueCardIds([
                      ...existing,
                      membership.card_entity_id as CardId,
                    ])
                  : [membership.card_entity_id as CardId],
              )
            }

            for (const rule of choiceRules) {
              const metadata = restrictionListMetaById.get(
                rule.restriction_list_id,
              )
              const list = metadata
                ? restrictionListsByFormat.get(metadata.formatId)
                : undefined
              const optionCardIds =
                optionCardIdsByChoiceRuleId.get(rule.id) ?? []

              if (!metadata || !list || optionCardIds.length === 0) {
                continue
              }

              list.rules.push({
                kind: 'choice',
                formatId: metadata.formatId,
                optionCardIds,
                allowedChoices: rule.allowed_choices,
                ...(rule.note ? { note: rule.note } : {}),
              })
            }
          }
        }
      }
    }
  }

  return Array.from(restrictionListsByFormat.values())
    .map((list) => ({
      formatId: list.formatId,
      version: list.version,
      rules: sortRestrictionRules(list.rules),
    }))
    .sort((left, right) => left.formatId.localeCompare(right.formatId))
}

function normalizeRestrictionType(value: string): RestrictionType | null {
  if (
    value === 'unrestricted' ||
    value === 'banned' ||
    value === 'limited' ||
    value === 'semi-limited' ||
    value === 'maximum-copies'
  ) {
    return value
  }

  return null
}

function sortUniqueCardIds(cardIds: readonly CardId[]): readonly CardId[] {
  return Array.from(new Set(cardIds)).sort((left, right) =>
    String(left).localeCompare(String(right)),
  )
}

function sortRestrictionRules(
  rules: readonly (CardRestrictionRule | ChoiceRestrictionRule)[],
): readonly (CardRestrictionRule | ChoiceRestrictionRule)[] {
  return rules.slice().sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind.localeCompare(right.kind)
    }

    if (left.kind === 'card' && right.kind === 'card') {
      return String(left.cardId).localeCompare(String(right.cardId))
    }

    if (left.kind === 'choice' && right.kind === 'choice') {
      return left.optionCardIds
        .join('|')
        .localeCompare(right.optionCardIds.join('|'))
    }

    return 0
  })
}

function normalizeConstructionBasis(value: string): ConstructionBasis | null {
  if (value === 'nation-based' || value === 'clan-based' || value === 'open') {
    return value
  }

  return null
}

function normalizeProductEligibilityBasis(
  value: string,
): FormatProfile['productEligibility']['basis'] | null {
  if (
    value === 'explicit-family-membership' ||
    value === 'family-membership-with-overrides' ||
    value === 'broad-english-pool'
  ) {
    return value
  }

  return null
}

function normalizeRestrictionCompatibility(
  value: string,
): RestrictionModelCompatibility | null {
  if (value === 'official-list' || value === 'official-list-with-overrides') {
    return value
  }

  return null
}

function normalizeDeckSection(value: string): DeckSection | null {
  if (value === 'main' || value === 'ride' || value === 'g') {
    return value
  }

  return null
}

function normalizeCardType(value: string): CardType | null {
  if (
    value === 'normal-unit' ||
    value === 'trigger-unit' ||
    value === 'normal-order' ||
    value === 'blitz-order' ||
    value === 'set-order' ||
    value === 'token'
  ) {
    return value
  }

  return null
}

function normalizeTriggerType(value: string): TriggerType | null {
  if (
    value === 'critical' ||
    value === 'draw' ||
    value === 'front' ||
    value === 'heal' ||
    value === 'stand' ||
    value === 'over'
  ) {
    return value
  }

  return null
}

function normalizeGameplayMarker(value: string): FormatGameplayMarker | null {
  if (
    value === 'ride-deck' ||
    value === 'g-zone' ||
    value === 'stride' ||
    value === 'imaginary-gift' ||
    value === 'overdress' ||
    value === 'over-trigger'
  ) {
    return value
  }

  return null
}

function compareSectionKeys(left: DeckSection, right: DeckSection): number {
  return getSectionSortOrder(left) - getSectionSortOrder(right)
}

function compareDeckSections(
  left: FormatProfile['deckStructure'][number],
  right: FormatProfile['deckStructure'][number],
): number {
  return compareSectionKeys(left.section, right.section)
}

function getSectionSortOrder(section: DeckSection): number {
  if (section === 'main') {
    return 0
  }

  if (section === 'ride') {
    return 1
  }

  return 2
}
