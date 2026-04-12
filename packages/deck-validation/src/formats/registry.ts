import { commonDeckValidators } from '../common-rules'
import type { DeckValidationValidatorRegistry } from '../contracts'
import { restrictionValidators } from '../restrictions'
import { premiumValidators } from './premium'
import { standardValidators } from './standard'
import { vPremiumValidators } from './v-premium'

export const defaultDeckValidationValidatorRegistry: DeckValidationValidatorRegistry =
  {
    commonValidators: commonDeckValidators,
    restrictionValidators,
    formatValidatorsByFormat: {
      standard: standardValidators,
      'v-premium': vPremiumValidators,
      premium: premiumValidators,
    },
  }
