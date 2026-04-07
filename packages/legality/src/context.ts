import type {
  DeckSnapshot,
  FormatProfile,
  FormatSupportMatrix,
  ValidationTarget,
} from '@web-vg/shared'

import type { RestrictionList } from './restrictions'

export interface ValidationContext {
  readonly target: ValidationTarget
  readonly deck: DeckSnapshot
  readonly formatProfile: FormatProfile
  readonly supportMatrix: FormatSupportMatrix
  readonly restrictionList: RestrictionList
}
