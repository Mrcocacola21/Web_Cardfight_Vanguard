import {
  catalogEraFilterProfiles,
  catalogFormatFilterProfiles,
} from '@web-vg/catalog'

interface CatalogFilterOption {
  readonly value: string
  readonly label: string
}

export const catalogFormatOptions = [
  { value: '', label: 'All formats' },
  ...catalogFormatFilterProfiles.map((profile) => ({
    value: profile.id,
    label: profile.label,
  })),
] as const satisfies readonly CatalogFilterOption[]

export const catalogEraOptions = [
  { value: '', label: 'All eras' },
  ...catalogEraFilterProfiles.map((profile) => ({
    value: profile.id,
    label: profile.label,
  })),
] as const satisfies readonly CatalogFilterOption[]

export const catalogNationOptions = [
  { value: '', label: 'All nations' },
  { value: 'dragon empire', label: 'Dragon Empire' },
  { value: 'dark states', label: 'Dark States' },
  { value: 'keter sanctuary', label: 'Keter Sanctuary' },
  { value: 'stoicheia', label: 'Stoicheia' },
  { value: 'brandt gate', label: 'Brandt Gate' },
  { value: 'lyrical monasterio', label: 'Lyrical Monasterio' },
] as const satisfies readonly CatalogFilterOption[]

export const catalogClanOptions = [
  { value: '', label: 'All clans' },
  { value: 'royal paladin', label: 'Royal Paladin' },
  { value: 'gear chronicle', label: 'Gear Chronicle' },
] as const satisfies readonly CatalogFilterOption[]

export const catalogCardTypeOptions = [
  { value: '', label: 'All types' },
  { value: 'normal-unit', label: 'Normal Unit' },
  { value: 'trigger-unit', label: 'Trigger Unit' },
  { value: 'normal-order', label: 'Normal Order' },
  { value: 'blitz-order', label: 'Blitz Order' },
  { value: 'set-order', label: 'Set Order' },
] as const satisfies readonly CatalogFilterOption[]

export const catalogTriggerOptions = [
  { value: '', label: 'All triggers' },
  { value: 'critical', label: 'Critical' },
  { value: 'draw', label: 'Draw' },
  { value: 'front', label: 'Front' },
  { value: 'heal', label: 'Heal' },
  { value: 'stand', label: 'Stand' },
  { value: 'over', label: 'Over' },
] as const satisfies readonly CatalogFilterOption[]

export const catalogRarityOptions = [
  { value: '', label: 'All rarities' },
  { value: 'c', label: 'C' },
  { value: 'r', label: 'R' },
  { value: 'rr', label: 'RR' },
  { value: 'rrr', label: 'RRR' },
  { value: 'sp', label: 'SP' },
  { value: 'pr', label: 'PR' },
] as const satisfies readonly CatalogFilterOption[]

export const catalogSetOptions = [
  { value: '', label: 'All sets' },
  {
    value: 'product.d-bt01.genesis-of-azure',
    label: 'Genesis of Azure (D-BT01)',
  },
  {
    value: 'product.d-sd01.azure-vanguard-start-deck',
    label: 'Azure Vanguard Start Deck (D-SD01)',
  },
  {
    value: 'product.v-bt01.crimson-vanguard',
    label: 'Crimson Vanguard (V-BT01)',
  },
  {
    value: 'product.pr-g01.premium-anniversary-pack',
    label: 'Premium Anniversary Promo Pack (PR-G01)',
  },
] as const satisfies readonly CatalogFilterOption[]

export function withCurrentCatalogFilterOption(
  options: readonly CatalogFilterOption[],
  currentValue: string,
): readonly CatalogFilterOption[] {
  if (currentValue.length === 0) {
    return options
  }

  if (options.some((option) => option.value === currentValue)) {
    return options
  }

  return [
    ...options,
    {
      value: currentValue,
      label: currentValue,
    },
  ]
}
