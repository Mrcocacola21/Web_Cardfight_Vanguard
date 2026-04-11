export const defaultDeckFormatId = 'standard'
export const defaultDeckName = 'Untitled Deck'

export const supportedDeckFormats = [
  {
    id: 'standard',
    label: 'Standard',
    description:
      'Primary D and DZ content track for the current published catalog slice.',
  },
  {
    id: 'v-premium',
    label: 'V Premium',
    description:
      'V-era format path. Support remains narrower than Standard until content expansion catches up.',
  },
  {
    id: 'premium',
    label: 'Premium',
    description:
      'Mixed-era format baseline. This create flow only seeds the deck shell, not full legality.',
  },
] as const

export type SupportedDeckFormatId = (typeof supportedDeckFormats)[number]['id']

export const deckListFormatOptions = [
  {
    value: 'all',
    label: 'All formats',
  },
  ...supportedDeckFormats.map((format) => ({
    value: format.id,
    label: format.label,
  })),
] as const

export function isSupportedDeckFormatId(
  value: string,
): value is SupportedDeckFormatId {
  return supportedDeckFormats.some((format) => format.id === value)
}
