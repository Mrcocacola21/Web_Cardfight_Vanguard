import type { FormatId } from '@web-vg/shared'

import type {
  EventId,
  PieceId,
  PlayerId,
  TransitionId,
  ZoneSlotId,
} from '../contracts'
import type { EffectResolvedEvent, GameEvent } from '../events'
import { resolveResourceEffectDefinition } from '../resources'
import { DRIVE_MINUS_TWO_FLAG as DRIVE_MINUS_TWO_FLAG_KEY } from './drive-modifiers'
import type {
  GamePieceState,
  GamePieceStatusState,
  GameState,
  PlayerState,
  ZoneState,
} from '../state'
import {
  buildGameStateIndex,
  findOwnedZoneByKind,
  findPieceById,
  findPieceLocation,
  findPlayerById,
  resolvePrimaryOpponentPlayerId,
} from '../state'
import type { ZoneTransferIntent, ZoneTransferReason } from '../transfers'
import {
  createPieceMovedEvents,
  resolveZoneTransferSequence,
} from '../transitions/zone-transfer'

import {
  createEffectDescriptorKey,
  createEffectHandlerKey,
  createEffectIdentity,
  createEffectTag,
  createEffectTimingBinding,
  defineEffectDefinition,
  type DeclarativeEffectOperation,
  type EffectDefinition,
  type EffectHandlerKey,
  type ResourceEffectOperation,
} from './effect'
import type {
  EffectHandler,
  EffectHandlerInput,
  EffectHandlerResult,
} from './handler-registry'

const AUTOMATIC_FLOW_SYSTEM = 'automatic-flow' as const
const STANDARD_FORMAT_ID = 'standard' as FormatId
const POWER_SMALL = 5000
const POWER_LARGE = 10000
const CRITICAL_ONE = 1
// Read by the drive check count (effects/drive-modifiers.ts).
const DRIVE_MINUS_TWO_FLAG = DRIVE_MINUS_TWO_FLAG_KEY

export const REGUREGNUS_CALL_OF_DEEP_LANDS_EFFECT_IDENTITY =
  createEffectIdentity('standard-slice', 'reguregnus.call-of-deep-lands')
export const REGUREGNUS_DROP_CALL_EFFECT_IDENTITY = createEffectIdentity(
  'standard-slice',
  'reguregnus.drop-call',
)
export const REGUREGNUS_BATTLE_REPLACE_EFFECT_IDENTITY = createEffectIdentity(
  'standard-slice',
  'reguregnus.battle-replace',
)

export const HEARTLURU_SOUL_CALL_EFFECT_IDENTITY = createEffectIdentity(
  'standard-slice',
  'heartluru.soul-call',
)
export const HEARTLURU_ATTACK_THRESHOLDS_EFFECT_IDENTITY = createEffectIdentity(
  'standard-slice',
  'heartluru.attack-thresholds',
)

export const YOUTHBERK_REVOLDRESS_EFFECT_IDENTITY = createEffectIdentity(
  'standard-slice',
  'youthberk.revoldress',
)

export const PRISON_CAPTURE_EFFECT_IDENTITY = createEffectIdentity(
  'standard-slice',
  'prison.capture',
)
export const PRISON_RELEASE_EFFECT_IDENTITY = createEffectIdentity(
  'standard-slice',
  'prison.release',
)
export const PRISON_SERAPH_ATTACK_EFFECT_IDENTITY = createEffectIdentity(
  'standard-slice',
  'prison.seraph-attack',
)

export const VYRGILLA_REWRITE_EFFECT_IDENTITY = createEffectIdentity(
  'standard-slice',
  'vyrgilla.rewrite',
)

export const KAIRI_ATTACK_SEQUENCE_EFFECT_IDENTITY = createEffectIdentity(
  'standard-slice',
  'kairi.attack-sequence',
)
export const KAIRI_CHOICE_BOUNCE_EFFECT_IDENTITY = createEffectIdentity(
  'standard-slice',
  'kairi.choice-bounce',
)
export const KAIRI_REPLAY_EFFECT_IDENTITY = createEffectIdentity(
  'standard-slice',
  'kairi.replay',
)
export const KAIRI_PLACED_POWER_EFFECT_IDENTITY = createEffectIdentity(
  'standard-slice',
  'kairi.placed-power',
)

export const REGUREGNUS_BATTLE_REPLACE_HANDLER_KEY = createEffectHandlerKey(
  'standard-slice.reguregnus.battle-replace',
)
export const HEARTLURU_ATTACK_THRESHOLDS_HANDLER_KEY = createEffectHandlerKey(
  'standard-slice.heartluru.attack-thresholds',
)
export const YOUTHBERK_REVOLDRESS_HANDLER_KEY = createEffectHandlerKey(
  'standard-slice.youthberk.revoldress',
)
export const PRISON_RELEASE_HANDLER_KEY = createEffectHandlerKey(
  'standard-slice.prison.release',
)
export const PRISON_SERAPH_ATTACK_HANDLER_KEY = createEffectHandlerKey(
  'standard-slice.prison.seraph-attack',
)
export const VYRGILLA_REWRITE_HANDLER_KEY = createEffectHandlerKey(
  'standard-slice.vyrgilla.rewrite',
)
export const KAIRI_ATTACK_SEQUENCE_HANDLER_KEY = createEffectHandlerKey(
  'standard-slice.kairi.attack-sequence',
)
export const KAIRI_PLACED_POWER_HANDLER_KEY = createEffectHandlerKey(
  'standard-slice.kairi.placed-power',
)

export const REGUREGNUS_CALL_OF_DEEP_LANDS_EFFECT =
  defineActivatedDeclarativeEffect(
    REGUREGNUS_CALL_OF_DEEP_LANDS_EFFECT_IDENTITY,
    [
      {
        kind: 'call',
        from: {
          player: 'source_controller',
          kind: 'drop',
        },
        selection: 'request',
        minSelections: 0,
        maxSelections: 2,
        destination: 'first_open_rear_guard',
      },
      {
        kind: 'move_source_to_order_zone',
        mode: 'place',
      },
    ],
    ['reguregnus', 'order'],
  )

export const REGUREGNUS_DROP_CALL_EFFECT = defineActivatedDeclarativeEffect(
  REGUREGNUS_DROP_CALL_EFFECT_IDENTITY,
  [
    energyBlast(1),
    {
      kind: 'call',
      from: {
        player: 'source_controller',
        kind: 'drop',
      },
      selection: 'request',
      minSelections: 0,
      maxSelections: 1,
      destination: 'first_open_rear_guard',
    },
  ],
  ['reguregnus'],
)

export const REGUREGNUS_BATTLE_REPLACE_EFFECT = defineActivatedTypedEffect(
  REGUREGNUS_BATTLE_REPLACE_EFFECT_IDENTITY,
  REGUREGNUS_BATTLE_REPLACE_HANDLER_KEY,
  ['reguregnus', 'battle'],
)

export const HEARTLURU_SOUL_CALL_EFFECT = defineActivatedDeclarativeEffect(
  HEARTLURU_SOUL_CALL_EFFECT_IDENTITY,
  [
    energyBlast(1),
    {
      kind: 'call',
      from: {
        player: 'source_controller',
        kind: 'soul',
      },
      selection: 'request',
      minSelections: 0,
      maxSelections: 2,
      destination: 'first_open_rear_guard',
    },
  ],
  ['heartluru'],
)

export const HEARTLURU_ATTACK_THRESHOLDS_EFFECT = defineTriggeredTypedEffect(
  HEARTLURU_ATTACK_THRESHOLDS_EFFECT_IDENTITY,
  ['battle.attack_declared'],
  'battle.attack',
  HEARTLURU_ATTACK_THRESHOLDS_HANDLER_KEY,
  ['heartluru', 'battle'],
)

export const YOUTHBERK_REVOLDRESS_EFFECT = defineActivatedTypedEffect(
  YOUTHBERK_REVOLDRESS_EFFECT_IDENTITY,
  YOUTHBERK_REVOLDRESS_HANDLER_KEY,
  ['youthberk', 'battle'],
)

export const PRISON_CAPTURE_EFFECT = defineActivatedDeclarativeEffect(
  PRISON_CAPTURE_EFFECT_IDENTITY,
  [
    {
      kind: 'imprison',
      from: {
        player: 'opponent',
        kind: 'hand',
      },
      selection: 'request',
      minSelections: 0,
      maxSelections: 1,
    },
  ],
  ['prison'],
)

export const PRISON_RELEASE_EFFECT = defineActivatedTypedEffect(
  PRISON_RELEASE_EFFECT_IDENTITY,
  PRISON_RELEASE_HANDLER_KEY,
  ['prison'],
)

export const PRISON_SERAPH_ATTACK_EFFECT = defineTriggeredTypedEffect(
  PRISON_SERAPH_ATTACK_EFFECT_IDENTITY,
  ['battle.attack_declared'],
  'battle.attack',
  PRISON_SERAPH_ATTACK_HANDLER_KEY,
  ['prison', 'battle'],
)

export const VYRGILLA_REWRITE_EFFECT = defineActivatedTypedEffect(
  VYRGILLA_REWRITE_EFFECT_IDENTITY,
  VYRGILLA_REWRITE_HANDLER_KEY,
  ['vyrgilla', 'battle'],
)

export const KAIRI_ATTACK_SEQUENCE_EFFECT = defineActivatedTypedEffect(
  KAIRI_ATTACK_SEQUENCE_EFFECT_IDENTITY,
  KAIRI_ATTACK_SEQUENCE_HANDLER_KEY,
  ['kairi', 'battle'],
)

export const KAIRI_CHOICE_BOUNCE_EFFECT = defineActivatedDeclarativeEffect(
  KAIRI_CHOICE_BOUNCE_EFFECT_IDENTITY,
  [
    {
      kind: 'bounce',
      from: {
        player: 'source_controller',
        kind: 'rear_guard_circle',
      },
      selection: 'request',
      minSelections: 0,
      maxSelections: 2,
    },
  ],
  ['kairi'],
)

export const KAIRI_REPLAY_EFFECT = defineActivatedDeclarativeEffect(
  KAIRI_REPLAY_EFFECT_IDENTITY,
  [
    energyBlast(1),
    {
      kind: 'call',
      from: {
        player: 'source_controller',
        kind: 'hand',
      },
      selection: 'request',
      minSelections: 0,
      maxSelections: 2,
      destination: 'first_open_rear_guard',
    },
  ],
  ['kairi'],
)

export const KAIRI_PLACED_POWER_EFFECT = defineTriggeredTypedEffect(
  KAIRI_PLACED_POWER_EFFECT_IDENTITY,
  ['card.rode'],
  'card.ride',
  KAIRI_PLACED_POWER_HANDLER_KEY,
  ['kairi'],
)

export const STANDARD_SLICE_EFFECT_DEFINITIONS: readonly EffectDefinition[] = [
  REGUREGNUS_CALL_OF_DEEP_LANDS_EFFECT,
  REGUREGNUS_DROP_CALL_EFFECT,
  REGUREGNUS_BATTLE_REPLACE_EFFECT,
  HEARTLURU_SOUL_CALL_EFFECT,
  HEARTLURU_ATTACK_THRESHOLDS_EFFECT,
  YOUTHBERK_REVOLDRESS_EFFECT,
  PRISON_CAPTURE_EFFECT,
  PRISON_RELEASE_EFFECT,
  PRISON_SERAPH_ATTACK_EFFECT,
  VYRGILLA_REWRITE_EFFECT,
  KAIRI_ATTACK_SEQUENCE_EFFECT,
  KAIRI_CHOICE_BOUNCE_EFFECT,
  KAIRI_REPLAY_EFFECT,
  KAIRI_PLACED_POWER_EFFECT,
]

export const STANDARD_SLICE_EFFECT_HANDLERS: readonly EffectHandler[] = [
  standardSliceHandler(
    REGUREGNUS_BATTLE_REPLACE_HANDLER_KEY,
    resolveReguregnusBattleReplace,
  ),
  standardSliceHandler(
    HEARTLURU_ATTACK_THRESHOLDS_HANDLER_KEY,
    resolveHeartluruAttackThresholds,
  ),
  standardSliceHandler(
    YOUTHBERK_REVOLDRESS_HANDLER_KEY,
    resolveYouthberkRevoldress,
  ),
  standardSliceHandler(PRISON_RELEASE_HANDLER_KEY, resolvePrisonRelease),
  standardSliceHandler(
    PRISON_SERAPH_ATTACK_HANDLER_KEY,
    resolvePrisonSeraphAttack,
  ),
  standardSliceHandler(VYRGILLA_REWRITE_HANDLER_KEY, resolveVyrgillaRewrite),
  standardSliceHandler(
    KAIRI_ATTACK_SEQUENCE_HANDLER_KEY,
    resolveKairiAttackSequence,
  ),
  standardSliceHandler(KAIRI_PLACED_POWER_HANDLER_KEY, resolveKairiPlacedPower),
]

type StandardSliceResolver = (input: EffectHandlerInput) => EffectHandlerResult
type HandlerFailure = Extract<EffectHandlerResult, { readonly ok: false }>
type HandlerSuccess = Extract<EffectHandlerResult, { readonly ok: true }>
type ControllerResolution =
  | {
      readonly ok: true
      readonly player: PlayerState
    }
  | HandlerFailure
type MoveSelectionResult =
  | (HandlerSuccess & {
      readonly movedPieceIds: readonly PieceId[]
    })
  | HandlerFailure

function standardSliceHandler(
  key: EffectHandlerKey,
  resolve: StandardSliceResolver,
): EffectHandler {
  return {
    key,
    resolve,
  }
}

function resolveReguregnusBattleReplace(
  input: EffectHandlerInput,
): EffectHandlerResult {
  const source = resolveBoundSource(input)

  if (!source.ok) {
    return source
  }

  const controller = resolveController(input.currentState, source.piece)

  if (!controller.ok) {
    return controller
  }

  const costResult = applyResourceOperations(input.currentState, input, [
    counterBlast(1),
  ])

  if (!costResult.ok) {
    return costResult
  }

  const retired = moveFirstRearGuardsToDrop(costResult.state, input, {
    playerId: controller.player.playerId,
    count: 2,
    reason: 'retire',
    startingSequence: resolveNextEventSequence(
      input.startingSequence,
      costResult.events,
    ),
  })

  if (!retired.ok) {
    return retired
  }

  const replacement = findFirstPieceInOwnedZone(
    retired.state,
    controller.player,
    'drop',
    (piece) => piece.pieceId !== source.piece.pieceId,
  )

  if (replacement === undefined) {
    return fail(
      'invalid_action_reference',
      `Reguregnus battle replacement requires a grade 3 replacement in drop.`,
    )
  }

  const rideResult = replaceVanguard(retired.state, input, {
    player: controller.player,
    newVanguardPieceId: replacement.pieceId,
    oldVanguardDestinationKind: 'soul',
    reason: 'ride',
    startingSequence: resolveNextEventSequence(
      input.startingSequence,
      costResult.events,
      retired.events,
    ),
  })

  if (!rideResult.ok) {
    return rideResult
  }

  const sourceStatus = resolvePieceStatus(
    input.currentState,
    source.piece.pieceId,
  )
  const replacementStatus: Partial<GamePieceStatusState> = {
    orientation: 'stand',
    flags: [DRIVE_MINUS_TWO_FLAG],
    ...(sourceStatus.powerModifier === undefined
      ? {}
      : {
          powerModifier: sourceStatus.powerModifier,
        }),
    ...(sourceStatus.criticalModifier === undefined
      ? {}
      : {
          criticalModifier: sourceStatus.criticalModifier,
        }),
  }

  return {
    ok: true,
    state: upsertPieceStatus(
      rideResult.state,
      replacement.pieceId,
      replacementStatus,
    ),
    events: [
      ...costResult.events,
      ...retired.events,
      ...rideResult.events,
      createEffectResolvedEvent(input, {
        sequence: resolveNextEventSequence(
          input.startingSequence,
          costResult.events,
          retired.events,
          rideResult.events,
        ),
        sourcePieceId: source.piece.pieceId,
        operationKinds: ['counter_blast', 'retire', 'ride'],
      }),
    ],
    timingWindows: [],
  }
}

function resolveHeartluruAttackThresholds(
  input: EffectHandlerInput,
): EffectHandlerResult {
  const source = resolveBoundSource(input)

  if (!source.ok) {
    return source.noop ?? source
  }

  const controller = resolveController(input.currentState, source.piece)

  if (!controller.ok) {
    return controller
  }

  const orderZone = findOwnedZoneByKind(
    buildGameStateIndex(input.currentState),
    controller.player,
    'order_zone',
  )
  const orderCount = orderZone?.occupants.length ?? 0

  if (orderCount < 2) {
    return noOp(input.currentState)
  }

  let workingState = addModifiers(input.currentState, source.piece.pieceId, {
    power: POWER_SMALL,
    critical: orderCount >= 4 ? CRITICAL_ONE : 0,
  })

  if (orderCount >= 3) {
    workingState = standFirstRearGuard(workingState, controller.player.playerId)
  }

  return resolveWithEvent(workingState, input, source.piece.pieceId, [
    'order_threshold',
  ])
}

function resolveYouthberkRevoldress(
  input: EffectHandlerInput,
): EffectHandlerResult {
  const source = resolveBoundSource(input)

  if (!source.ok) {
    return source
  }

  const controller = resolveController(input.currentState, source.piece)

  if (!controller.ok) {
    return controller
  }

  const rideResult = replaceVanguard(input.currentState, input, {
    player: controller.player,
    newVanguardPieceId: source.piece.pieceId,
    oldVanguardDestinationKind: 'bind',
    reason: 'ride',
    startingSequence: input.startingSequence,
  })

  if (!rideResult.ok) {
    return rideResult
  }

  const nextState = addModifiers(
    upsertPieceStatus(rideResult.state, source.piece.pieceId, {
      orientation: 'stand',
      flags: [DRIVE_MINUS_TWO_FLAG],
    }),
    source.piece.pieceId,
    {
      power: POWER_LARGE,
      critical: CRITICAL_ONE,
    },
  )

  return {
    ok: true,
    state: nextState,
    events: [
      ...rideResult.events,
      createEffectResolvedEvent(input, {
        sequence: resolveNextEventSequence(
          input.startingSequence,
          rideResult.events,
        ),
        sourcePieceId: source.piece.pieceId,
        operationKinds: ['revoldress', 'bind', 'ride', 'power', 'critical'],
      }),
    ],
    timingWindows: [],
  }
}

function resolvePrisonRelease(input: EffectHandlerInput): EffectHandlerResult {
  const source = resolveBoundSource(input)

  if (!source.ok) {
    return source
  }

  const stateIndex = buildGameStateIndex(input.currentState)
  const location = findPieceLocation(stateIndex, source.piece.pieceId)
  const owner =
    source.piece.ownerPlayerId === undefined
      ? undefined
      : findPlayerById(stateIndex, source.piece.ownerPlayerId)

  if (location?.zone.kind !== 'prison' || owner === undefined) {
    return fail(
      'invalid_action_reference',
      `Prison release requires the source card to be in a prison zone and have an owner.`,
    )
  }

  const rearGuard = findOwnedZoneByKind(stateIndex, owner, 'rear_guard_circle')
  const slotId = rearGuard === undefined ? undefined : firstOpenSlot(rearGuard)

  if (rearGuard === undefined || slotId === undefined) {
    return fail(
      'invalid_action_reference',
      `Prison release requires an open rear-guard circle for ${owner.playerId}.`,
    )
  }

  return moveAndResolve(input.currentState, input, {
    transfers: [
      {
        pieceId: source.piece.pieceId,
        from: {
          zoneId: location.zone.zoneId,
        },
        to: {
          zoneId: rearGuard.zoneId,
          slotId,
        },
        reason: 'call',
      },
    ],
    sourcePieceId: source.piece.pieceId,
    operationKinds: ['prison_release', 'call'],
  })
}

function resolvePrisonSeraphAttack(
  input: EffectHandlerInput,
): EffectHandlerResult {
  const source = resolveBoundSource(input)

  if (!source.ok) {
    return source.noop ?? source
  }

  const controller = resolveController(input.currentState, source.piece)

  if (!controller.ok) {
    return controller
  }

  const prisonZone = findOwnedZoneByKind(
    buildGameStateIndex(input.currentState),
    controller.player,
    'prison',
  )
  const imprisonedCount = prisonZone?.occupants.length ?? 0

  if (imprisonedCount === 0) {
    return noOp(input.currentState)
  }

  const nextState = addModifiers(input.currentState, source.piece.pieceId, {
    power: imprisonedCount * POWER_SMALL,
    critical: imprisonedCount >= 2 ? CRITICAL_ONE : 0,
  })

  return resolveWithEvent(nextState, input, source.piece.pieceId, [
    'prison_count',
    'power',
    ...(imprisonedCount >= 2 ? ['critical'] : []),
  ])
}

function resolveVyrgillaRewrite(
  input: EffectHandlerInput,
): EffectHandlerResult {
  const source = resolveBoundSource(input)

  if (!source.ok) {
    return source
  }

  const controller = resolveController(input.currentState, source.piece)

  if (!controller.ok) {
    return controller
  }

  const rideResult = replaceVanguard(input.currentState, input, {
    player: controller.player,
    newVanguardPieceId: source.piece.pieceId,
    oldVanguardDestinationKind: 'bind',
    reason: 'ride',
    startingSequence: input.startingSequence,
  })

  if (!rideResult.ok) {
    return rideResult
  }

  const opponentBind = bindFirstOpponentRearGuard(rideResult.state, input, {
    playerId: controller.player.playerId,
    startingSequence: resolveNextEventSequence(
      input.startingSequence,
      rideResult.events,
    ),
  })

  if (!opponentBind.ok) {
    return opponentBind
  }

  let workingState = addModifiers(
    upsertPieceStatus(opponentBind.state, source.piece.pieceId, {
      orientation: 'stand',
      flags: [DRIVE_MINUS_TWO_FLAG],
    }),
    source.piece.pieceId,
    {
      power: POWER_LARGE,
      critical: 0,
    },
  )
  workingState = standAllRearGuards(workingState, controller.player.playerId)

  return {
    ok: true,
    state: workingState,
    events: [
      ...rideResult.events,
      ...opponentBind.events,
      createEffectResolvedEvent(input, {
        sequence: resolveNextEventSequence(
          input.startingSequence,
          rideResult.events,
          opponentBind.events,
        ),
        sourcePieceId: source.piece.pieceId,
        operationKinds: ['rewrite', 'bind', 'ride', 'stand'],
      }),
    ],
    timingWindows: [],
  }
}

function resolveKairiAttackSequence(
  input: EffectHandlerInput,
): EffectHandlerResult {
  const source = resolveBoundSource(input)

  if (!source.ok) {
    return source
  }

  const controller = resolveController(input.currentState, source.piece)

  if (!controller.ok) {
    return controller
  }

  const bounced = bounceFirstRearGuards(input.currentState, input, {
    playerId: controller.player.playerId,
    count: 2,
    startingSequence: input.startingSequence,
  })

  if (!bounced.ok) {
    return bounced
  }

  const replayed = callFirstCardsFromHand(bounced.state, input, {
    playerId: controller.player.playerId,
    count: bounced.movedPieceIds.length,
    excludedPieceIds: [source.piece.pieceId],
    startingSequence: resolveNextEventSequence(
      input.startingSequence,
      bounced.events,
    ),
  })

  if (!replayed.ok) {
    return replayed
  }

  let workingState = replayed.state

  for (const pieceId of replayed.movedPieceIds) {
    workingState = addModifiers(workingState, pieceId, {
      power: POWER_SMALL,
      critical: 0,
    })
  }

  return {
    ok: true,
    state: workingState,
    events: [
      ...bounced.events,
      ...replayed.events,
      createEffectResolvedEvent(input, {
        sequence: resolveNextEventSequence(
          input.startingSequence,
          bounced.events,
          replayed.events,
        ),
        sourcePieceId: source.piece.pieceId,
        operationKinds: ['bounce', 'call', 'power'],
      }),
    ],
    timingWindows: [],
  }
}

function resolveKairiPlacedPower(
  input: EffectHandlerInput,
): EffectHandlerResult {
  const source = resolveBoundSource(input)

  if (!source.ok) {
    return source.noop ?? source
  }

  const nextState = addModifiers(input.currentState, source.piece.pieceId, {
    power: POWER_SMALL,
    critical: 0,
  })

  return resolveWithEvent(nextState, input, source.piece.pieceId, [
    'placed_this_turn',
    'power',
  ])
}

function defineActivatedDeclarativeEffect(
  identity: ReturnType<typeof createEffectIdentity>,
  operations: readonly DeclarativeEffectOperation[],
  tags: readonly string[],
): EffectDefinition {
  return defineEffectDefinition({
    id: identity.id,
    identity,
    kind: 'activated',
    trigger: {
      kind: 'manual',
    },
    timing: [],
    applicability: {
      scope: 'format',
      formatIds: [STANDARD_FORMAT_ID],
    },
    resolution: {
      model: 'optional',
      strategy: {
        kind: 'declarative_descriptor',
        descriptorKey: createEffectDescriptorKey(identity.key),
        operations,
      },
    },
    tags: tags.map(createEffectTag),
  })
}

function defineActivatedTypedEffect(
  identity: ReturnType<typeof createEffectIdentity>,
  handlerKey: EffectHandlerKey,
  tags: readonly string[],
): EffectDefinition {
  return defineEffectDefinition({
    id: identity.id,
    identity,
    kind: 'activated',
    trigger: {
      kind: 'manual',
    },
    timing: [],
    applicability: {
      scope: 'format',
      formatIds: [STANDARD_FORMAT_ID],
    },
    resolution: {
      model: 'optional',
      strategy: {
        kind: 'typed_handler',
        handlerKey,
        family: 'standard_slice',
      },
    },
    tags: tags.map(createEffectTag),
  })
}

function defineTriggeredTypedEffect(
  identity: ReturnType<typeof createEffectIdentity>,
  eventTypes: readonly GameEvent['type'][],
  timingPoint: Parameters<typeof createEffectTimingBinding>[0],
  handlerKey: EffectHandlerKey,
  tags: readonly string[],
): EffectDefinition {
  return defineEffectDefinition({
    id: identity.id,
    identity,
    kind: 'triggered',
    trigger: {
      kind: 'event',
      eventTypes,
    },
    timing: [createEffectTimingBinding(timingPoint, 'after')],
    applicability: {
      scope: 'format',
      formatIds: [STANDARD_FORMAT_ID],
    },
    resolution: {
      model: 'automatic',
      strategy: {
        kind: 'typed_handler',
        handlerKey,
        family: 'standard_slice',
      },
    },
    tags: tags.map(createEffectTag),
  })
}

function energyBlast(count: number): ResourceEffectOperation {
  return {
    kind: 'energy_blast',
    count,
    player: 'source_controller',
    role: 'cost',
    duration: 'immediate',
  }
}

function counterBlast(count: number): ResourceEffectOperation {
  return {
    kind: 'counter_blast',
    count,
    player: 'source_controller',
    selection: 'deterministic_first',
    role: 'cost',
    duration: 'immediate',
  }
}

type BoundSourceResult =
  | {
      readonly ok: true
      readonly piece: GamePieceState & { readonly kind: 'card' }
    }
  | {
      readonly ok: false
      readonly code: 'invalid_action' | 'invalid_action_reference'
      readonly message: string
      readonly noop?: EffectHandlerResult
    }

function resolveBoundSource(input: EffectHandlerInput): BoundSourceResult {
  const sourcePieceId = input.queueItem.sourcePieceId

  if (sourcePieceId === undefined) {
    return {
      ok: false,
      noop: noOp(input.currentState),
      code: 'invalid_action_reference',
      message: `Standard slice effect ${input.queueItem.effectDefinition.id} requires a source piece.`,
    }
  }

  const piece = findPieceById(
    buildGameStateIndex(input.currentState),
    sourcePieceId,
  )

  if (piece === undefined || piece.kind !== 'card') {
    return fail(
      'invalid_action_reference',
      `Standard slice effect ${input.queueItem.effectDefinition.id} requires a runtime card source ${sourcePieceId}.`,
    )
  }

  if (
    piece.effectDefinitionIds?.includes(input.queueItem.effectDefinition.id) !==
    true
  ) {
    return {
      ok: false,
      noop: noOp(input.currentState),
      code: 'invalid_action',
      message: `Source ${sourcePieceId} is not bound to effect ${input.queueItem.effectDefinition.id}.`,
    }
  }

  return {
    ok: true,
    piece: piece as GamePieceState & { readonly kind: 'card' },
  }
}

function resolveController(
  currentState: GameState,
  piece: GamePieceState,
): ControllerResolution {
  const controllerPlayerId = piece.controllerPlayerId ?? piece.ownerPlayerId
  const player =
    controllerPlayerId === undefined
      ? undefined
      : findPlayerById(buildGameStateIndex(currentState), controllerPlayerId)

  if (player === undefined) {
    return fail(
      'invalid_action_reference',
      `Standard slice source ${piece.pieceId} requires a controller.`,
    )
  }

  return {
    ok: true,
    player,
  }
}

function applyResourceOperations(
  currentState: GameState,
  input: EffectHandlerInput,
  operations: readonly ResourceEffectOperation[],
): EffectHandlerResult {
  const sourcePieceId = input.queueItem.sourcePieceId

  if (sourcePieceId === undefined) {
    return fail(
      'invalid_action_reference',
      `Resource operation requires a source piece.`,
    )
  }

  const result = resolveResourceEffectDefinition({
    currentState,
    transitionId: input.transitionId,
    ...(input.queueItem.triggerEvent.sourceActionId === undefined
      ? {}
      : {
          sourceActionId: input.queueItem.triggerEvent.sourceActionId,
        }),
    sourcePieceId,
    effectDefinition: {
      ...input.queueItem.effectDefinition,
      resolution: {
        model: 'automatic',
        strategy: {
          kind: 'declarative_descriptor',
          descriptorKey: createEffectDescriptorKey(
            `${input.queueItem.effectDefinition.identity.key}.resource`,
          ),
          operations,
        },
      },
    },
    startingSequence: input.startingSequence,
  })

  if (!result.ok) {
    return result
  }

  return {
    ok: true,
    state: result.state,
    events: result.events.filter((event) => event.type !== 'effect.resolved'),
    timingWindows: [],
  }
}

function replaceVanguard(
  currentState: GameState,
  input: EffectHandlerInput,
  options: {
    readonly player: PlayerState
    readonly newVanguardPieceId: PieceId
    readonly oldVanguardDestinationKind: 'bind' | 'soul'
    readonly reason: ZoneTransferReason
    readonly startingSequence: number
  },
): EffectHandlerResult {
  const stateIndex = buildGameStateIndex(currentState)
  const vanguardZone = findOwnedZoneByKind(
    stateIndex,
    options.player,
    'vanguard_circle',
  )
  const destinationZone = findOwnedZoneByKind(
    stateIndex,
    options.player,
    options.oldVanguardDestinationKind,
  )
  const newLocation = findPieceLocation(stateIndex, options.newVanguardPieceId)
  const currentVanguardPieceId = vanguardZone?.occupants[0]?.pieceId

  if (
    vanguardZone === undefined ||
    destinationZone === undefined ||
    newLocation === undefined ||
    currentVanguardPieceId === undefined
  ) {
    return fail(
      'invalid_action_reference',
      `Vanguard replacement requires current vanguard, source location, and destination zones.`,
    )
  }

  const result = movePieces(currentState, input, {
    transfers: [
      {
        pieceId: currentVanguardPieceId,
        from: {
          zoneId: vanguardZone.zoneId,
        },
        to: {
          zoneId: destinationZone.zoneId,
        },
        reason: 'ride_displacement',
      },
      {
        pieceId: options.newVanguardPieceId,
        from: {
          zoneId: newLocation.zone.zoneId,
        },
        to: {
          zoneId: vanguardZone.zoneId,
        },
        reason: options.reason,
      },
    ],
    startingSequence: options.startingSequence,
    updateControllerPieceIds: [options.newVanguardPieceId],
    controllerPlayerId: options.player.playerId,
  })

  if (
    !result.ok ||
    result.state.battle?.attackerPieceId !== currentVanguardPieceId
  ) {
    return result
  }

  return {
    ...result,
    state: {
      ...result.state,
      battle: {
        ...result.state.battle,
        attackerPieceId: options.newVanguardPieceId,
      },
    },
  }
}

function moveFirstRearGuardsToDrop(
  currentState: GameState,
  input: EffectHandlerInput,
  options: {
    readonly playerId: PlayerId
    readonly count: number
    readonly reason: ZoneTransferReason
    readonly startingSequence: number
  },
): EffectHandlerResult {
  const stateIndex = buildGameStateIndex(currentState)
  const player = findPlayerById(stateIndex, options.playerId)
  const rearGuard = player
    ? findOwnedZoneByKind(stateIndex, player, 'rear_guard_circle')
    : undefined
  const drop = player
    ? findOwnedZoneByKind(stateIndex, player, 'drop')
    : undefined

  if (player === undefined || rearGuard === undefined || drop === undefined) {
    return fail(
      'invalid_action_reference',
      `Retire cost requires rear-guard and drop zones.`,
    )
  }

  const pieceIds = rearGuard.occupants
    .slice(0, options.count)
    .map((occupant) => occupant.pieceId)

  if (pieceIds.length < options.count) {
    return fail(
      'invalid_action',
      `Retire cost requires ${options.count} rear-guards.`,
    )
  }

  return movePieces(currentState, input, {
    transfers: pieceIds.map((pieceId) => ({
      pieceId,
      from: {
        zoneId: rearGuard.zoneId,
      },
      to: {
        zoneId: drop.zoneId,
      },
      reason: options.reason,
    })),
    startingSequence: options.startingSequence,
  })
}

function bindFirstOpponentRearGuard(
  currentState: GameState,
  input: EffectHandlerInput,
  options: {
    readonly playerId: PlayerId
    readonly startingSequence: number
  },
): EffectHandlerResult {
  const stateIndex = buildGameStateIndex(currentState)
  const opponentPlayerId = resolvePrimaryOpponentPlayerId(
    stateIndex,
    options.playerId,
  )
  const opponent =
    opponentPlayerId === undefined
      ? undefined
      : findPlayerById(stateIndex, opponentPlayerId)
  const opponentRear = opponent
    ? findOwnedZoneByKind(stateIndex, opponent, 'rear_guard_circle')
    : undefined
  const opponentBind = opponent
    ? findOwnedZoneByKind(stateIndex, opponent, 'bind')
    : undefined
  const targetPieceId = opponentRear?.occupants[0]?.pieceId

  if (
    opponent === undefined ||
    opponentRear === undefined ||
    opponentBind === undefined ||
    targetPieceId === undefined
  ) {
    return noOp(currentState)
  }

  return movePieces(currentState, input, {
    transfers: [
      {
        pieceId: targetPieceId,
        from: {
          zoneId: opponentRear.zoneId,
        },
        to: {
          zoneId: opponentBind.zoneId,
        },
        reason: 'bind',
      },
    ],
    startingSequence: options.startingSequence,
  })
}

function bounceFirstRearGuards(
  currentState: GameState,
  input: EffectHandlerInput,
  options: {
    readonly playerId: PlayerId
    readonly count: number
    readonly startingSequence: number
  },
): MoveSelectionResult {
  const stateIndex = buildGameStateIndex(currentState)
  const player = findPlayerById(stateIndex, options.playerId)
  const rearGuard = player
    ? findOwnedZoneByKind(stateIndex, player, 'rear_guard_circle')
    : undefined
  const hand = player
    ? findOwnedZoneByKind(stateIndex, player, 'hand')
    : undefined

  if (player === undefined || rearGuard === undefined || hand === undefined) {
    return fail(
      'invalid_action_reference',
      `Bounce sequence requires rear-guard and hand zones.`,
    )
  }

  const pieceIds = rearGuard.occupants
    .slice(0, options.count)
    .map((occupant) => occupant.pieceId)

  if (pieceIds.length === 0) {
    return {
      ok: true,
      state: currentState,
      events: [],
      timingWindows: [],
      movedPieceIds: [],
    }
  }

  const result = movePieces(currentState, input, {
    transfers: pieceIds.map((pieceId) => ({
      pieceId,
      from: {
        zoneId: rearGuard.zoneId,
      },
      to: {
        zoneId: hand.zoneId,
      },
      reason: 'bounce',
    })),
    startingSequence: options.startingSequence,
  })

  return result.ok
    ? {
        ...result,
        movedPieceIds: pieceIds,
      }
    : result
}

function callFirstCardsFromHand(
  currentState: GameState,
  input: EffectHandlerInput,
  options: {
    readonly playerId: PlayerId
    readonly count: number
    readonly excludedPieceIds?: readonly PieceId[]
    readonly startingSequence: number
  },
): MoveSelectionResult {
  const stateIndex = buildGameStateIndex(currentState)
  const player = findPlayerById(stateIndex, options.playerId)
  const hand = player
    ? findOwnedZoneByKind(stateIndex, player, 'hand')
    : undefined
  const rearGuard = player
    ? findOwnedZoneByKind(stateIndex, player, 'rear_guard_circle')
    : undefined

  if (player === undefined || hand === undefined || rearGuard === undefined) {
    return fail(
      'invalid_action_reference',
      `Replay sequence requires hand and rear-guard zones.`,
    )
  }

  const excluded = new Set(options.excludedPieceIds ?? [])
  const pieceIds = hand.occupants
    .map((occupant) => occupant.pieceId)
    .filter((pieceId) => !excluded.has(pieceId))
    .slice(0, options.count)
  const openSlots = resolveOpenSlots(rearGuard).slice(0, pieceIds.length)

  if (openSlots.length < pieceIds.length) {
    return fail(
      'invalid_action',
      `Replay sequence requires ${pieceIds.length} open rear-guard circles.`,
    )
  }

  if (pieceIds.length === 0) {
    return {
      ok: true,
      state: currentState,
      events: [],
      timingWindows: [],
      movedPieceIds: [],
    }
  }

  const result = movePieces(currentState, input, {
    transfers: pieceIds.map((pieceId, index) => ({
      pieceId,
      from: {
        zoneId: hand.zoneId,
      },
      to: {
        zoneId: rearGuard.zoneId,
        slotId: openSlots[index]!,
      },
      reason: 'call',
    })),
    startingSequence: options.startingSequence,
    updateControllerPieceIds: pieceIds,
    controllerPlayerId: player.playerId,
  })

  return result.ok
    ? {
        ...result,
        movedPieceIds: pieceIds,
      }
    : result
}

function moveAndResolve(
  currentState: GameState,
  input: EffectHandlerInput,
  options: {
    readonly transfers: readonly ZoneTransferIntent[]
    readonly sourcePieceId: PieceId
    readonly operationKinds: readonly string[]
  },
): EffectHandlerResult {
  const moveResult = movePieces(currentState, input, {
    transfers: options.transfers,
    startingSequence: input.startingSequence,
  })

  if (!moveResult.ok) {
    return moveResult
  }

  return {
    ok: true,
    state: moveResult.state,
    events: [
      ...moveResult.events,
      createEffectResolvedEvent(input, {
        sequence: resolveNextEventSequence(
          input.startingSequence,
          moveResult.events,
        ),
        sourcePieceId: options.sourcePieceId,
        operationKinds: options.operationKinds,
      }),
    ],
    timingWindows: [],
  }
}

function movePieces(
  currentState: GameState,
  input: EffectHandlerInput,
  options: {
    readonly transfers: readonly ZoneTransferIntent[]
    readonly startingSequence: number
    readonly updateControllerPieceIds?: readonly PieceId[]
    readonly controllerPlayerId?: PlayerId
  },
): EffectHandlerResult {
  if (options.transfers.length === 0) {
    return noOp(currentState)
  }

  const transferResult = resolveZoneTransferSequence(
    currentState,
    options.transfers,
  )

  if (!transferResult.ok) {
    return transferResult
  }

  const updateControllerPieceIds = new Set(
    options.updateControllerPieceIds ?? [],
  )
  const controllerPlayerId = options.controllerPlayerId
  const pieces =
    controllerPlayerId === undefined
      ? currentState.pieces
      : currentState.pieces.map((piece) =>
          updateControllerPieceIds.has(piece.pieceId)
            ? {
                ...piece,
                controllerPlayerId,
              }
            : piece,
        )

  return {
    ok: true,
    state: {
      ...currentState,
      zones: transferResult.zones,
      pieceStates: transferResult.pieceStates,
      pieces,
    },
    events: createPieceMovedEvents(
      input.transitionId,
      transferResult.transfers,
      {
        kind: 'system',
        system: AUTOMATIC_FLOW_SYSTEM,
      },
      {
        ...(input.queueItem.triggerEvent.sourceActionId === undefined
          ? {}
          : {
              sourceActionId: input.queueItem.triggerEvent.sourceActionId,
            }),
        startingSequence: options.startingSequence,
      },
    ),
    timingWindows: [],
  }
}

function findFirstPieceInOwnedZone(
  currentState: GameState,
  player: PlayerState,
  zoneKind: string,
  predicate: (piece: GamePieceState) => boolean,
): GamePieceState | undefined {
  const stateIndex = buildGameStateIndex(currentState)
  const zone = findOwnedZoneByKind(stateIndex, player, zoneKind)

  return zone?.occupants
    .map((occupant) => findPieceById(stateIndex, occupant.pieceId))
    .find(
      (piece): piece is GamePieceState =>
        piece !== undefined && predicate(piece),
    )
}

function standFirstRearGuard(
  currentState: GameState,
  playerId: PlayerId,
): GameState {
  const stateIndex = buildGameStateIndex(currentState)
  const player = findPlayerById(stateIndex, playerId)
  const rearGuard = player
    ? findOwnedZoneByKind(stateIndex, player, 'rear_guard_circle')
    : undefined
  const pieceId = rearGuard?.occupants[0]?.pieceId

  return pieceId === undefined
    ? currentState
    : upsertPieceStatus(currentState, pieceId, {
        orientation: 'stand',
      })
}

function standAllRearGuards(
  currentState: GameState,
  playerId: PlayerId,
): GameState {
  const stateIndex = buildGameStateIndex(currentState)
  const player = findPlayerById(stateIndex, playerId)
  const rearGuard = player
    ? findOwnedZoneByKind(stateIndex, player, 'rear_guard_circle')
    : undefined
  let workingState = currentState

  for (const occupant of rearGuard?.occupants ?? []) {
    workingState = upsertPieceStatus(workingState, occupant.pieceId, {
      orientation: 'stand',
    })
  }

  return workingState
}

function addModifiers(
  currentState: GameState,
  pieceId: PieceId,
  modifiers: {
    readonly power: number
    readonly critical: number
  },
): GameState {
  const current = resolvePieceStatus(currentState, pieceId)

  return upsertPieceStatus(currentState, pieceId, {
    orientation: current.orientation,
    flags: current.flags,
    powerModifier: (current.powerModifier ?? 0) + modifiers.power,
    criticalModifier: (current.criticalModifier ?? 0) + modifiers.critical,
  })
}

function upsertPieceStatus(
  currentState: GameState,
  pieceId: PieceId,
  patch: Partial<GamePieceStatusState>,
): GameState {
  const current = resolvePieceStatus(currentState, pieceId)
  const next: GamePieceStatusState = {
    pieceId,
    orientation: patch.orientation ?? current.orientation,
    flags: Array.from(
      new Set([...(current.flags ?? []), ...(patch.flags ?? [])]),
    ),
    ...((patch.powerModifier ?? current.powerModifier) === undefined
      ? {}
      : {
          powerModifier: patch.powerModifier ?? current.powerModifier,
        }),
    ...((patch.criticalModifier ?? current.criticalModifier) === undefined
      ? {}
      : {
          criticalModifier: patch.criticalModifier ?? current.criticalModifier,
        }),
  }
  const exists = currentState.pieceStates.some(
    (pieceState) => pieceState.pieceId === pieceId,
  )

  return {
    ...currentState,
    pieceStates: exists
      ? currentState.pieceStates.map((pieceState) =>
          pieceState.pieceId === pieceId ? next : pieceState,
        )
      : [...currentState.pieceStates, next],
  }
}

function resolvePieceStatus(
  currentState: GameState,
  pieceId: PieceId,
): GamePieceStatusState {
  return (
    currentState.pieceStates.find(
      (pieceState) => pieceState.pieceId === pieceId,
    ) ?? {
      pieceId,
      orientation: 'stand',
      flags: [],
    }
  )
}

function firstOpenSlot(zone: ZoneState): ZoneSlotId | undefined {
  return resolveOpenSlots(zone)[0]
}

function resolveOpenSlots(zone: ZoneState): readonly ZoneSlotId[] {
  const occupied = new Set(
    zone.occupants
      .map((occupant) => occupant.slotId)
      .filter(
        (slotId): slotId is NonNullable<typeof slotId> => slotId !== undefined,
      ),
  )

  return (zone.layout.slotIds ?? []).filter((slotId) => !occupied.has(slotId))
}

function resolveWithEvent(
  state: GameState,
  input: EffectHandlerInput,
  sourcePieceId: PieceId,
  operationKinds: readonly string[],
): EffectHandlerResult {
  return {
    ok: true,
    state,
    events: [
      createEffectResolvedEvent(input, {
        sequence: input.startingSequence,
        sourcePieceId,
        operationKinds,
      }),
    ],
    timingWindows: [],
  }
}

function resolveNextEventSequence(
  startingSequence: number,
  ...eventGroups: readonly (readonly GameEvent[])[]
): number {
  const eventSequences = eventGroups.flatMap((events) =>
    events.map((event) => event.sequence),
  )

  return eventSequences.length === 0
    ? startingSequence
    : Math.max(...eventSequences) + 1
}

function createEffectResolvedEvent(
  input: EffectHandlerInput,
  options: {
    readonly sequence: number
    readonly sourcePieceId: PieceId
    readonly operationKinds: readonly string[]
  },
): EffectResolvedEvent {
  return {
    eventId: createEventId(input.transitionId, options.sequence),
    type: 'effect.resolved',
    sequence: options.sequence,
    ...(input.queueItem.triggerEvent.sourceActionId === undefined
      ? {}
      : {
          sourceActionId: input.queueItem.triggerEvent.sourceActionId,
        }),
    origin: {
      kind: 'system',
      system: AUTOMATIC_FLOW_SYSTEM,
    },
    effectDefinitionId: input.queueItem.effectDefinition.id,
    sourcePieceId: options.sourcePieceId,
    triggerEventSequence: input.queueItem.triggerEvent.sequence,
    operationKinds: options.operationKinds,
  }
}

function noOp(state: GameState): EffectHandlerResult {
  return {
    ok: true,
    state,
    events: [],
    timingWindows: [],
  }
}

function fail(
  code: 'invalid_action' | 'invalid_action_reference',
  message: string,
): EffectHandlerResult & { readonly ok: false } {
  return {
    ok: false,
    code,
    message,
  }
}

function createEventId(transitionId: TransitionId, sequence: number): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}
