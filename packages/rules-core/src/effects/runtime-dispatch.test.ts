import type { CardId, FormatId } from '@web-vg/shared'
import { describe, expect, it } from 'vitest'

import type {
  EventId,
  PieceId,
  PlayerId,
  TransitionId,
  ZoneId,
} from '../contracts'
import type { EffectResolvedEvent, GameEvent } from '../events'
import { createKeywordMechanicsRegistry } from '../keywords'
import type { GameState, ZoneState } from '../state'
import {
  createTransitionResult,
  isAppliedTransitionResult,
  isInvalidTransitionResult,
} from '../transitions'

import {
  createEffectHandlerKey,
  createEffectHandlerRegistry,
  createEffectIdentity,
  createEffectRegistry,
  createEffectTimingBinding,
  defineEffectDefinition,
  resolveEventTriggeredEffects,
  type EffectDefinition,
  type EffectHandler,
  type EffectHandlerKey,
} from './index'

const PLAYER_1 = 'player-1' as PlayerId
const PLAYER_2 = 'player-2' as PlayerId
const ATTACKER = 'piece-attacker' as PieceId

function makeState(): GameState {
  const zones: readonly ZoneState[] = [
    {
      zoneId: 'p1-vg' as ZoneId,
      kind: 'vanguard_circle',
      scope: 'player',
      ownerPlayerId: PLAYER_1,
      visibility: 'public',
      layout: {
        ordering: 'unordered',
        occupancy: 'single',
      },
      occupants: [{ pieceId: ATTACKER }],
    },
    {
      zoneId: 'p2-vg' as ZoneId,
      kind: 'vanguard_circle',
      scope: 'player',
      ownerPlayerId: PLAYER_2,
      visibility: 'public',
      layout: {
        ordering: 'unordered',
        occupancy: 'single',
      },
      occupants: [],
    },
  ]

  return {
    gameId: 'game-runtime-dispatch' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status: 'in_progress',
    revision: 0,
    turn: {
      turnNumber: 1,
      turnPlayerId: PLAYER_1,
      priorityPlayerId: PLAYER_1,
      phase: 'battle',
      step: 'attack',
    },
    players: [
      {
        playerId: PLAYER_1,
        seat: 0,
        status: 'active',
        ownedZoneIds: ['p1-vg' as ZoneId],
        counters: [],
        flags: [],
      },
      {
        playerId: PLAYER_2,
        seat: 1,
        status: 'waiting',
        ownedZoneIds: ['p2-vg' as ZoneId],
        counters: [],
        flags: [],
      },
    ],
    zones,
    pieces: [
      {
        pieceId: ATTACKER,
        kind: 'card',
        cardDefinitionId: 'card-attacker' as CardId,
        ownerPlayerId: PLAYER_1,
        controllerPlayerId: PLAYER_1,
      },
    ],
    pieceStates: [],
    flags: [],
    pendingRequests: [],
  }
}

function makeAttackDeclaredEvent(): Extract<
  GameEvent,
  { readonly type: 'battle.attack_declared' }
> {
  return {
    eventId: 'transition-runtime-dispatch:event:0' as EventId,
    type: 'battle.attack_declared',
    sequence: 0,
    origin: {
      kind: 'player',
      playerId: PLAYER_1,
    },
    battleId: 'battle-runtime-dispatch' as Extract<
      GameEvent,
      { readonly type: 'battle.attack_declared' }
    >['battleId'],
    attackerPieceId: ATTACKER,
    target: {
      kind: 'player',
      playerId: PLAYER_2,
    },
  }
}

function makeBaseResult(state: GameState) {
  return createTransitionResult(
    'transition-runtime-dispatch' as TransitionId,
    state,
    [makeAttackDeclaredEvent()],
    {
      timingWindows: [
        {
          sequence: 0,
          point: 'battle.attack',
          window: 'after',
          relatedEventSequence: 0,
          battleId: 'battle-runtime-dispatch' as Extract<
            GameEvent,
            { readonly type: 'battle.attack_declared' }
          >['battleId'],
          pieceId: ATTACKER,
        },
      ],
    },
  )
}

function makeTypedEffectDefinition(
  key: string,
  handlerKey: EffectHandlerKey,
): EffectDefinition {
  const identity = createEffectIdentity('test', key)

  return defineEffectDefinition({
    id: identity.id,
    identity,
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
        handlerKey,
      },
    },
  })
}

function makeResolvedEventHandler(
  key: EffectHandlerKey,
  operationKind: string,
): EffectHandler {
  return {
    key,
    resolve(input) {
      return {
        ok: true,
        state: input.currentState,
        events: [
          createEffectResolvedEvent({
            transitionId: input.transitionId,
            sequence: input.startingSequence,
            effectDefinition: input.queueItem.effectDefinition,
            triggerEventSequence: input.queueItem.triggerEvent.sequence,
            operationKinds: [operationKind],
            ...(input.queueItem.sourcePieceId === undefined
              ? {}
              : {
                  sourcePieceId: input.queueItem.sourcePieceId,
                }),
          }),
        ],
        timingWindows: [],
      }
    },
  }
}

function createEffectResolvedEvent(input: {
  readonly transitionId: TransitionId
  readonly sequence: number
  readonly effectDefinition: EffectDefinition
  readonly sourcePieceId?: PieceId
  readonly triggerEventSequence?: number
  readonly operationKinds: readonly string[]
}): EffectResolvedEvent {
  return {
    eventId: `${input.transitionId}:event:${input.sequence}` as EventId,
    type: 'effect.resolved',
    sequence: input.sequence,
    origin: {
      kind: 'system',
      system: 'automatic-flow',
    },
    effectDefinitionId: input.effectDefinition.id,
    ...(input.sourcePieceId === undefined
      ? {}
      : {
          sourcePieceId: input.sourcePieceId,
        }),
    ...(input.triggerEventSequence === undefined
      ? {}
      : {
          triggerEventSequence: input.triggerEventSequence,
        }),
    operationKinds: input.operationKinds,
  }
}

describe('@web-vg/rules-core effect runtime dispatch', () => {
  it('dispatches a typed triggered effect through handlerKey instead of effect id', () => {
    const handlerKey = createEffectHandlerKey('test.runtime.dispatch-one')
    const definition = makeTypedEffectDefinition(
      'runtime-dispatch-one',
      handlerKey,
    )
    const state = makeState()
    const result = resolveEventTriggeredEffects({
      currentState: state,
      result: makeBaseResult(state),
      environment: {
        effectRegistry: createEffectRegistry([definition]),
        effectHandlers: createEffectHandlerRegistry([
          makeResolvedEventHandler(handlerKey, 'test_typed_handler'),
        ]),
        keywordMechanics: createKeywordMechanicsRegistry([]),
      },
    })

    expect(isAppliedTransitionResult(result)).toBe(true)

    if (!isAppliedTransitionResult(result)) {
      throw new Error(`Expected applied result, received ${result.status}.`)
    }

    expect(result.events.map((event) => event.type)).toEqual([
      'battle.attack_declared',
      'effect.resolved',
    ])
    expect(result.events[1]).toMatchObject({
      type: 'effect.resolved',
      effectDefinitionId: definition.id,
      sourcePieceId: ATTACKER,
      triggerEventSequence: 0,
      operationKinds: ['test_typed_handler'],
    })
  })

  it('dispatches additional typed effects by registration without changing the resolver', () => {
    const betaHandlerKey = createEffectHandlerKey('test.runtime.beta')
    const alphaHandlerKey = createEffectHandlerKey('test.runtime.alpha')
    const betaDefinition = makeTypedEffectDefinition(
      'runtime-dispatch-beta',
      betaHandlerKey,
    )
    const alphaDefinition = makeTypedEffectDefinition(
      'runtime-dispatch-alpha',
      alphaHandlerKey,
    )
    const state = makeState()
    const result = resolveEventTriggeredEffects({
      currentState: state,
      result: makeBaseResult(state),
      environment: {
        effectRegistry: createEffectRegistry([betaDefinition, alphaDefinition]),
        effectHandlers: createEffectHandlerRegistry([
          makeResolvedEventHandler(betaHandlerKey, 'beta_handler'),
          makeResolvedEventHandler(alphaHandlerKey, 'alpha_handler'),
        ]),
        keywordMechanics: createKeywordMechanicsRegistry([]),
      },
    })

    expect(isAppliedTransitionResult(result)).toBe(true)

    if (!isAppliedTransitionResult(result)) {
      throw new Error(`Expected applied result, received ${result.status}.`)
    }

    expect(
      result.events
        .filter((event) => event.type === 'effect.resolved')
        .map((event) => event.effectDefinitionId),
    ).toEqual([alphaDefinition.id, betaDefinition.id])
    expect(result.events.map((event) => event.sequence)).toEqual([0, 1, 2])
  })

  it('fails explicitly when a typed effect has no registered runtime handler', () => {
    const handlerKey = createEffectHandlerKey('test.runtime.missing')
    const definition = makeTypedEffectDefinition(
      'runtime-dispatch-missing',
      handlerKey,
    )
    const state = makeState()
    const result = resolveEventTriggeredEffects({
      currentState: state,
      result: makeBaseResult(state),
      environment: {
        effectRegistry: createEffectRegistry([definition]),
        effectHandlers: createEffectHandlerRegistry([]),
        keywordMechanics: createKeywordMechanicsRegistry([]),
      },
    })

    expect(isInvalidTransitionResult(result)).toBe(true)

    if (!isInvalidTransitionResult(result)) {
      throw new Error(`Expected invalid result, received ${result.status}.`)
    }

    expect(result.code).toBe('invalid_action')
    expect(result.message).toContain(`requires runtime handler ${handlerKey}`)
    expect(result.message).toContain(definition.id)
  })
})
