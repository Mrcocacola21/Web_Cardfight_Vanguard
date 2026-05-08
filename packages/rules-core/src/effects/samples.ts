import type { FormatId } from '@web-vg/shared'

import {
  createEffectDescriptorKey,
  createEffectHandlerKey,
  createEffectIdentity,
  createEffectTag,
  createEffectTimingBinding,
  defineEffectDefinition,
  type EffectDefinition,
} from './effect'
import { createEffectRegistry } from './registry'

export const UNIT_ATTACK_AUTO_EFFECT_IDENTITY = createEffectIdentity(
  'core',
  'auto.when-unit-attacks',
)

export const CHECK_TRIGGER_REVEAL_EFFECT_IDENTITY = createEffectIdentity(
  'core',
  'check.resolve-revealed-triggers',
)

export const CARDS_DRAWN_FINALIZE_EFFECT_IDENTITY = createEffectIdentity(
  'core',
  'draw.finalize-cards-drawn',
)

export const BOOST_KEYWORD_EFFECT_IDENTITY = createEffectIdentity(
  'keyword',
  'boost.commit',
)

export const INTERCEPT_KEYWORD_EFFECT_IDENTITY = createEffectIdentity(
  'keyword',
  'intercept.guard-from-circle',
)

export const TWIN_DRIVE_KEYWORD_EFFECT_IDENTITY = createEffectIdentity(
  'keyword',
  'twin-drive.check-count',
)

export const PERSONA_RIDE_KEYWORD_EFFECT_IDENTITY = createEffectIdentity(
  'keyword',
  'persona-ride.on-ride',
)

export const UNIT_ATTACK_AUTO_EFFECT: EffectDefinition = defineEffectDefinition(
  {
    id: UNIT_ATTACK_AUTO_EFFECT_IDENTITY.id,
    identity: UNIT_ATTACK_AUTO_EFFECT_IDENTITY,
    kind: 'triggered',
    trigger: {
      kind: 'event',
      eventTypes: ['battle.attack_declared'],
    },
    timing: [createEffectTimingBinding('battle.attack', 'after')],
    applicability: {
      scope: 'global',
    },
    resolution: {
      model: 'automatic',
      strategy: {
        kind: 'typed_handler',
        handlerKey: createEffectHandlerKey('core.auto.when-unit-attacks'),
        family: 'auto_ability',
      },
    },
    tags: [createEffectTag('auto'), createEffectTag('battle')],
  },
)

export const CHECK_TRIGGER_REVEAL_EFFECT: EffectDefinition =
  defineEffectDefinition({
    id: CHECK_TRIGGER_REVEAL_EFFECT_IDENTITY.id,
    identity: CHECK_TRIGGER_REVEAL_EFFECT_IDENTITY,
    kind: 'triggered',
    trigger: {
      kind: 'event',
      eventTypes: ['battle.drive_checked', 'battle.damage_checked'],
    },
    timing: [
      createEffectTimingBinding('battle.drive_check', 'after'),
      createEffectTimingBinding('battle.damage_check', 'after'),
    ],
    applicability: {
      scope: 'global',
    },
    resolution: {
      model: 'automatic',
      strategy: {
        kind: 'typed_handler',
        handlerKey: createEffectHandlerKey(
          'core.check.resolve-revealed-triggers',
        ),
        family: 'trigger_resolution',
      },
    },
    tags: [createEffectTag('check'), createEffectTag('trigger')],
  })

export const CARDS_DRAWN_FINALIZE_EFFECT: EffectDefinition =
  defineEffectDefinition({
    id: CARDS_DRAWN_FINALIZE_EFFECT_IDENTITY.id,
    identity: CARDS_DRAWN_FINALIZE_EFFECT_IDENTITY,
    kind: 'triggered',
    trigger: {
      kind: 'event',
      eventTypes: ['cards.drawn'],
    },
    timing: [createEffectTimingBinding('zone.transfer', 'after')],
    applicability: {
      scope: 'global',
    },
    resolution: {
      model: 'automatic',
      strategy: {
        kind: 'typed_handler',
        handlerKey: createEffectHandlerKey('core.draw.finalize-cards-drawn'),
        family: 'draw',
      },
    },
    tags: [createEffectTag('draw')],
  })

export const BOOST_KEYWORD_EFFECT: EffectDefinition = defineEffectDefinition({
  id: BOOST_KEYWORD_EFFECT_IDENTITY.id,
  identity: BOOST_KEYWORD_EFFECT_IDENTITY,
  kind: 'activated',
  trigger: {
    kind: 'manual',
  },
  timing: [createEffectTimingBinding('battle.boost', 'on')],
  applicability: {
    scope: 'keyword',
  },
  resolution: {
    model: 'optional',
    strategy: {
      kind: 'typed_handler',
      handlerKey: createEffectHandlerKey('keyword.boost.commit'),
      family: 'battle_action',
    },
  },
  tags: [createEffectTag('keyword'), createEffectTag('battle')],
})

export const INTERCEPT_KEYWORD_EFFECT: EffectDefinition =
  defineEffectDefinition({
    id: INTERCEPT_KEYWORD_EFFECT_IDENTITY.id,
    identity: INTERCEPT_KEYWORD_EFFECT_IDENTITY,
    kind: 'activated',
    trigger: {
      kind: 'manual',
    },
    timing: [createEffectTimingBinding('battle.guard', 'before')],
    applicability: {
      scope: 'keyword',
    },
    resolution: {
      model: 'optional',
      strategy: {
        kind: 'typed_handler',
        handlerKey: createEffectHandlerKey(
          'keyword.intercept.guard-from-circle',
        ),
        family: 'battle_action',
      },
    },
    tags: [createEffectTag('keyword'), createEffectTag('guard')],
  })

export const TWIN_DRIVE_KEYWORD_EFFECT: EffectDefinition =
  defineEffectDefinition({
    id: TWIN_DRIVE_KEYWORD_EFFECT_IDENTITY.id,
    identity: TWIN_DRIVE_KEYWORD_EFFECT_IDENTITY,
    kind: 'continuous',
    trigger: {
      kind: 'static',
    },
    timing: [createEffectTimingBinding('battle.drive_check', 'before')],
    applicability: {
      scope: 'keyword',
    },
    resolution: {
      model: 'continuous',
      strategy: {
        kind: 'declarative_descriptor',
        descriptorKey: createEffectDescriptorKey(
          'keyword.twin-drive.check-count',
        ),
        operations: [
          {
            kind: 'adjust_check_count',
            check: 'drive',
            mode: 'add',
            amount: 1,
            subject: 'source_unit',
            duration: 'during_current_check',
          },
        ],
      },
    },
    tags: [createEffectTag('keyword'), createEffectTag('drive')],
  })

export const PERSONA_RIDE_KEYWORD_EFFECT: EffectDefinition =
  defineEffectDefinition({
    id: PERSONA_RIDE_KEYWORD_EFFECT_IDENTITY.id,
    identity: PERSONA_RIDE_KEYWORD_EFFECT_IDENTITY,
    kind: 'triggered',
    trigger: {
      kind: 'event',
      eventTypes: ['card.rode'],
    },
    timing: [createEffectTimingBinding('card.ride', 'after')],
    applicability: {
      scope: 'format',
      formatIds: ['standard' as FormatId],
    },
    resolution: {
      model: 'automatic',
      strategy: {
        kind: 'hybrid',
        handlerKey: createEffectHandlerKey('keyword.persona-ride.on-ride'),
        descriptorKey: createEffectDescriptorKey(
          'keyword.persona-ride.on-ride',
        ),
        family: 'ride',
        operations: [
          {
            kind: 'draw_cards',
            count: 1,
            player: 'source_controller',
            duration: 'immediate',
          },
          {
            kind: 'apply_power_modifier',
            amount: 10000,
            target: 'front_row_units',
            duration: 'until_end_of_turn',
          },
        ],
      },
    },
    tags: [createEffectTag('keyword'), createEffectTag('ride')],
  })

export const CORE_EFFECT_DEFINITIONS: readonly EffectDefinition[] = [
  UNIT_ATTACK_AUTO_EFFECT,
  CHECK_TRIGGER_REVEAL_EFFECT,
  CARDS_DRAWN_FINALIZE_EFFECT,
  BOOST_KEYWORD_EFFECT,
  INTERCEPT_KEYWORD_EFFECT,
  TWIN_DRIVE_KEYWORD_EFFECT,
  PERSONA_RIDE_KEYWORD_EFFECT,
]

export const coreEffectRegistry = createEffectRegistry(CORE_EFFECT_DEFINITIONS)
