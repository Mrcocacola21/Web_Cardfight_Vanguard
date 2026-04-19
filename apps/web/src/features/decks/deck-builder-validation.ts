import { createDeck, type Deck, type DeckVersionId } from '@web-vg/decks'
import {
  validateDeck,
  type DeckValidationCardFacts,
  type DeckValidationContext,
  type DeckValidationResult,
} from '@web-vg/deck-validation'
import type { RestrictionList } from '@web-vg/legality'
import type {
  CardId,
  Clan,
  CardType,
  DeckId,
  DeckSection,
  FormatId,
  FormatProfile,
  Grade,
  Nation,
  TriggerType,
  UserId,
} from '@web-vg/shared'

import type { DeckBuilderDraft } from '@/features/decks/deck-builder-draft'

const validationDraftTimestamp = '1970-01-01T00:00:00.000Z'

export interface DeckBuilderValidationCardRecord {
  readonly cardEntityId: string
  readonly canonicalKey: string
  readonly name: string
  readonly grade: number
  readonly cardType: string
  readonly nation: string | null
  readonly clan: string | null
  readonly triggerType: string | null
  readonly legalInFormats: readonly string[] | null
  readonly premiumGDeckEligible: boolean | null
}

export interface DeckBuilderValidationData {
  readonly formatProfiles: readonly FormatProfile[]
  readonly cards: readonly DeckBuilderValidationCardRecord[]
  readonly restrictionLists: readonly RestrictionList[]
}

export function createEmptyDeckBuilderValidationData(): DeckBuilderValidationData {
  return {
    formatProfiles: [],
    cards: [],
    restrictionLists: [],
  }
}

export function validateDeckBuilderDraft(
  draft: DeckBuilderDraft,
  data: DeckBuilderValidationData,
): DeckValidationResult {
  const deck = mapDraftToDomainDeck(draft)
  const context = createDeckBuilderValidationContext(draft, data)

  return validateDeck(
    context
      ? {
          deck,
          context,
        }
      : {
          deck,
        },
  )
}

export function createDeckBuilderValidationCardNameMap(
  draft: DeckBuilderDraft,
  data: DeckBuilderValidationData,
): Readonly<Record<string, string>> {
  const namesByCardId: Record<string, string> = {}

  for (const card of data.cards) {
    namesByCardId[card.cardEntityId] = card.name
  }

  for (const card of draft.cards) {
    if (!(card.cardEntityId in namesByCardId)) {
      namesByCardId[card.cardEntityId] = card.name
    }
  }

  return namesByCardId
}

function mapDraftToDomainDeck(draft: DeckBuilderDraft): Deck {
  return createDeck({
    id: draft.deckId as DeckId,
    ownerId: draft.ownerProfileId as UserId,
    formatId: draft.formatId as FormatId,
    name: draft.title,
    description: draft.description,
    tags: draft.tags,
    isFavorite: draft.isFavorite,
    createdAt: validationDraftTimestamp,
    updatedAt: draft.updatedAt,
    currentVersionId: (draft.currentVersionId ??
      `${draft.deckId}-validation-version`) as DeckVersionId,
    cards: draft.cards.map((card) => ({
      section: card.sectionKey as DeckSection,
      cardEntityId: card.cardEntityId as CardId,
      quantity: card.quantity,
    })),
  })
}

function createDeckBuilderValidationContext(
  draft: DeckBuilderDraft,
  data: DeckBuilderValidationData,
): DeckValidationContext | undefined {
  const formatProfile = selectFormatProfileForFormat(
    draft.formatId,
    data.formatProfiles,
  )
  const cardFacts = createCardFactsMap(data.cards)
  const restrictionList = selectRestrictionListForFormat(
    draft.formatId,
    data.restrictionLists,
  )

  if (cardFacts.size === 0 && !restrictionList && !formatProfile) {
    return undefined
  }

  return {
    ...(formatProfile
      ? {
          format: {
            profile: formatProfile,
          },
        }
      : {}),
    ...(cardFacts.size > 0
      ? {
          cardFacts,
        }
      : {}),
    ...(restrictionList
      ? {
          restrictions: {
            listId: restrictionList.version,
            activeList: restrictionList,
          },
        }
      : {}),
  }
}

function createCardFactsMap(
  cards: readonly DeckBuilderValidationCardRecord[],
): ReadonlyMap<CardId, DeckValidationCardFacts> {
  const cardFacts = new Map<CardId, DeckValidationCardFacts>()

  for (const card of cards) {
    if (!hasNonEmptyValue(card.cardEntityId)) {
      continue
    }

    cardFacts.set(card.cardEntityId as CardId, {
      grade: normalizeGrade(card.grade),
      cardType: normalizeCardType(card.cardType),
      nation: normalizeNation(card.nation),
      clan: normalizeClan(card.clan),
      legalInFormats: normalizeLegalInFormats(card.legalInFormats),
      premiumGDeckEligible: card.premiumGDeckEligible,
      triggerType: normalizeTriggerType(card.triggerType),
    })
  }

  return cardFacts
}

function selectRestrictionListForFormat(
  formatId: string,
  restrictionLists: readonly RestrictionList[],
): RestrictionList | null {
  return (
    restrictionLists.find(
      (entry) => entry.formatId === (formatId as FormatId),
    ) ?? null
  )
}

function selectFormatProfileForFormat(
  formatId: string,
  formatProfiles: readonly FormatProfile[],
): FormatProfile | null {
  return (
    formatProfiles.find((entry) => entry.formatId === (formatId as FormatId)) ??
    null
  )
}

function normalizeGrade(value: number): Grade | null {
  if (!Number.isInteger(value) || value < 0 || value > 10) {
    return null
  }

  return value as Grade
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

function normalizeNation(value: string | null): Nation | null {
  return hasNonEmptyValue(value) ? (value as Nation) : null
}

function normalizeClan(value: string | null): Clan | null {
  return hasNonEmptyValue(value) ? (value as Clan) : null
}

function normalizeTriggerType(value: string | null): TriggerType | null {
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

function normalizeLegalInFormats(
  formats: readonly string[] | null,
): readonly FormatId[] | null {
  if (!formats) {
    return null
  }

  return formats
    .filter((entry) => hasNonEmptyValue(entry))
    .map((entry) => entry as FormatId)
}

function hasNonEmptyValue(value: string | null | undefined): value is string {
  return (value ?? '').trim().length > 0
}
