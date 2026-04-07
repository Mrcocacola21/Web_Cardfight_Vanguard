import { describe, expect, it } from 'vitest'
import { expectTypeOf } from 'vitest'

import * as entry from './index'
import type { CardId, EffectRef, EffectRefId, FormatId } from '@web-vg/shared'
import type {
  CardInstance,
  EffectRegistry,
  GameContext,
  GameState,
  GameplayCard,
  GameplayFormatProjection,
} from './index'

describe('@web-vg/rules-core', () => {
  it('exposes an importable package entrypoint', () => {
    expect(entry).toBeDefined()
    expect(entry.projectionEnablesZone).toBeTypeOf('function')
  })

  it('keeps gameplay runtime inputs projection-based', () => {
    expectTypeOf<
      GameplayFormatProjection['formatId']
    >().toEqualTypeOf<FormatId>()
    expectTypeOf<GameplayCard['effectRefs']>().toEqualTypeOf<
      readonly EffectRef[]
    >()
    expectTypeOf<GameState['formatId']>().toEqualTypeOf<FormatId>()
    expectTypeOf<CardInstance['cardId']>().toEqualTypeOf<CardId>()
    expectTypeOf<
      GameContext['format']
    >().toEqualTypeOf<GameplayFormatProjection>()
    expectTypeOf<
      EffectRegistry['registrations'][number]['effectRefId']
    >().toEqualTypeOf<EffectRefId>()
  })
})
