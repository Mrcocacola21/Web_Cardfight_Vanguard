import { createCatalogRepository, type Tables } from '@web-vg/db'
import type { CatalogCardEntityRecord } from '@web-vg/db/repositories/catalog'
import type { DeckDetailRecord } from '@web-vg/db/repositories/decks'
import type {
  CardRestrictionRule,
  ChoiceRestrictionRule,
  RestrictionList,
  RestrictionType,
} from '@web-vg/legality'
import type { CardId, FormatId } from '@web-vg/shared'

import {
  type DeckBuilderValidationCardRecord,
  type DeckBuilderValidationData,
  createEmptyDeckBuilderValidationData,
} from '@/features/decks/deck-builder-validation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type ActiveRuleProfileRow = Pick<
  Tables<{ schema: 'legality' }, 'rule_profiles'>,
  'id' | 'format_id'
>

type ActiveRestrictionListRow = Pick<
  Tables<{ schema: 'legality' }, 'restriction_lists'>,
  'id' | 'rule_profile_id' | 'version_label'
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
  const cardsById = new Map<string, DeckBuilderValidationCardRecord>()

  for (const card of input.catalogCards) {
    cardsById.set(card.id, createValidationCardRecord(card))
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

      cardsById.set(result.data.id, createValidationCardRecord(result.data))
    }
  }

  const cardIds = Array.from(cardsById.keys()).sort((left, right) =>
    left.localeCompare(right),
  )

  if (cardIds.length === 0) {
    return createEmptyDeckBuilderValidationData()
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
    cards: Array.from(cardsById.values()).sort((left, right) =>
      left.cardEntityId.localeCompare(right.cardEntityId),
    ),
    restrictionLists,
  }
}

function createValidationCardRecord(
  card: CatalogCardEntityRecord,
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
    premiumGDeckEligible: null,
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
    []) as readonly ActiveRuleProfileRow[]

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
