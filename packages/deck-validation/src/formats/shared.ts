import type { FormatId } from '@web-vg/shared'
import type {
  DeckValidationInput,
  DeckValidationIssue,
  DeckValidationRuleId,
  DeckValidator,
  SupportedDeckValidationFormatId,
} from '../contracts'

const formatDisplayNames: Readonly<
  Record<SupportedDeckValidationFormatId, string>
> = {
  standard: 'Standard',
  'v-premium': 'V Premium',
  premium: 'Premium',
}

export function createFormatSectionValidator(config: {
  readonly id: DeckValidationRuleId
  readonly formatId: SupportedDeckValidationFormatId
  readonly allowedSections: readonly string[]
}): DeckValidator {
  return {
    id: config.id,
    validate(input: DeckValidationInput): readonly DeckValidationIssue[] {
      const allowedSections = resolveAllowedSections(
        input,
        config.allowedSections,
      )

      return input.deck.currentVersion.cards
        .filter((card) => !allowedSections.has(String(card.section)))
        .map((card) => ({
          severity: 'error',
          category: 'format',
          code: 'section-not-allowed-for-format',
          message: `Deck entry for ${String(card.cardEntityId)} is placed in section "${String(card.section)}", which is not allowed for ${getDeckValidationFormatDisplayName(config.formatId)}.`,
          target: {
            type: 'card',
            cardEntityId: card.cardEntityId,
            section: String(card.section) as never,
          },
        }))
    },
  }
}

export function getDeckValidationFormatDisplayName(
  formatId: SupportedDeckValidationFormatId,
): string {
  return formatDisplayNames[formatId]
}

export function isSupportedDeckValidationFormatId(
  value: string,
): value is SupportedDeckValidationFormatId {
  return value === 'standard' || value === 'v-premium' || value === 'premium'
}

export function normalizeDeckValidationFormatId(
  formatId: FormatId,
): FormatId | null {
  return formatId.trim().length > 0 ? formatId : null
}

function resolveAllowedSections(
  input: DeckValidationInput,
  fallbackAllowedSections: readonly string[],
): ReadonlySet<string> {
  const profileSections =
    input.context?.format?.profile?.deckStructure.map(
      (entry) => entry.section,
    ) ?? fallbackAllowedSections

  return new Set(profileSections.map((section) => String(section)))
}
