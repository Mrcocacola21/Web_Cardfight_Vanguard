import type { FormatId } from '@web-vg/shared'

import { createEffectTimingBinding } from '../effects/effect'
import {
  BOOST_KEYWORD_EFFECT_IDENTITY,
  INTERCEPT_KEYWORD_EFFECT_IDENTITY,
  PERSONA_RIDE_KEYWORD_EFFECT_IDENTITY,
  TWIN_DRIVE_KEYWORD_EFFECT_IDENTITY,
} from '../effects/samples'

import {
  createKeyword,
  createKeywordMechanicId,
  createKeywordMechanicTag,
  defineKeywordMechanic,
  type KeywordMechanicDefinition,
} from './keyword'
import { createKeywordMechanicsRegistry } from './registry'

export const BOOST_KEYWORD = createKeyword('boost')
export const INTERCEPT_KEYWORD = createKeyword('intercept')
export const TWIN_DRIVE_KEYWORD = createKeyword('twin-drive')
export const PERSONA_RIDE_KEYWORD = createKeyword('persona-ride')

export const BOOST_KEYWORD_MECHANIC: KeywordMechanicDefinition =
  defineKeywordMechanic({
    id: createKeywordMechanicId(BOOST_KEYWORD),
    keyword: BOOST_KEYWORD,
    applicability: {
      scope: 'global',
    },
    bindings: [
      {
        kind: 'effect',
        effectDefinitionId: BOOST_KEYWORD_EFFECT_IDENTITY.id,
        role: 'grants_action',
        timing: [createEffectTimingBinding('battle.boost', 'on')],
      },
    ],
    tags: [createKeywordMechanicTag('battle')],
  })

export const INTERCEPT_KEYWORD_MECHANIC: KeywordMechanicDefinition =
  defineKeywordMechanic({
    id: createKeywordMechanicId(INTERCEPT_KEYWORD),
    keyword: INTERCEPT_KEYWORD,
    applicability: {
      scope: 'global',
    },
    bindings: [
      {
        kind: 'effect',
        effectDefinitionId: INTERCEPT_KEYWORD_EFFECT_IDENTITY.id,
        role: 'enables_guard_source',
        timing: [createEffectTimingBinding('battle.guard', 'before')],
      },
    ],
    tags: [
      createKeywordMechanicTag('battle'),
      createKeywordMechanicTag('guard'),
    ],
  })

export const TWIN_DRIVE_KEYWORD_MECHANIC: KeywordMechanicDefinition =
  defineKeywordMechanic({
    id: createKeywordMechanicId(TWIN_DRIVE_KEYWORD),
    keyword: TWIN_DRIVE_KEYWORD,
    applicability: {
      scope: 'global',
    },
    bindings: [
      {
        kind: 'effect',
        effectDefinitionId: TWIN_DRIVE_KEYWORD_EFFECT_IDENTITY.id,
        role: 'modifies_check',
        timing: [createEffectTimingBinding('battle.drive_check', 'before')],
      },
    ],
    tags: [
      createKeywordMechanicTag('battle'),
      createKeywordMechanicTag('drive'),
    ],
  })

export const PERSONA_RIDE_KEYWORD_MECHANIC: KeywordMechanicDefinition =
  defineKeywordMechanic({
    id: createKeywordMechanicId(PERSONA_RIDE_KEYWORD),
    keyword: PERSONA_RIDE_KEYWORD,
    applicability: {
      scope: 'format',
      formatIds: ['standard' as FormatId],
    },
    bindings: [
      {
        kind: 'effect',
        effectDefinitionId: PERSONA_RIDE_KEYWORD_EFFECT_IDENTITY.id,
        role: 'triggers_resolution',
      },
    ],
    tags: [createKeywordMechanicTag('ride')],
  })

export const SAMPLE_KEYWORD_MECHANICS: readonly KeywordMechanicDefinition[] = [
  BOOST_KEYWORD_MECHANIC,
  INTERCEPT_KEYWORD_MECHANIC,
  TWIN_DRIVE_KEYWORD_MECHANIC,
  PERSONA_RIDE_KEYWORD_MECHANIC,
]

export const keywordMechanicsRegistry = createKeywordMechanicsRegistry(
  SAMPLE_KEYWORD_MECHANICS,
)
