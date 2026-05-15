import type { FormatId } from '@web-vg/shared'

import type { ActionId, EventId, PieceId, TransitionId } from '../contracts'
import type { EffectResolvedEvent, GameEvent } from '../events'
import type {
  BattleState,
  GamePieceFlagKey,
  GamePieceStatusState,
  GameState,
} from '../state'
import {
  buildGameStateIndex,
  findOwnedZoneByKind,
  findPieceById,
  findPlayerById,
  listOwnedZonesByKind,
} from '../state'
import { drawTopPiecesBetweenZones } from '../transitions/ordered-zone-operations'
import { createPieceMovedEvents } from '../transitions/zone-transfer'
import {
  PERSONA_RIDE_KEYWORD,
  TWIN_DRIVE_KEYWORD,
  keywordMechanicsRegistry,
} from '../keywords/samples'
import type { KeywordMechanicsRegistry } from '../keywords/registry'

import {
  effectDefinitionMatchesEvent,
  effectDefinitionMatchesTimingWindow,
  getDeclarativeEffectOperations,
  type DeclarativeEffectOperation,
  type EffectDefinition,
} from './effect'
import { type EffectRegistry } from './registry'
import { coreEffectRegistry } from './samples'

const AUTOMATIC_FLOW_SYSTEM = 'automatic-flow' as const
export const PERSONA_RIDE_POWER_FLAG =
  'effect.persona_ride.power_plus_10000.until_end_of_turn' as GamePieceFlagKey

export interface FirstEffectEnvironment {
  readonly effectRegistry: EffectRegistry
  readonly keywordMechanics: KeywordMechanicsRegistry
}

const FIRST_EFFECT_ENVIRONMENT: FirstEffectEnvironment = {
  effectRegistry: coreEffectRegistry,
  keywordMechanics: keywordMechanicsRegistry,
}

export interface DriveCheckEffectResolutionInput {
  readonly currentState: GameState
  readonly battle: BattleState
  readonly baseCount: number
  readonly transitionId: TransitionId
  readonly sourceActionId: ActionId
  readonly startingSequence?: number
  readonly environment?: FirstEffectEnvironment
}

export interface DriveCheckEffectResolution {
  readonly count: number
  readonly events: readonly GameEvent[]
}

export function resolveDriveCheckCountEffects(
  input: DriveCheckEffectResolutionInput,
): DriveCheckEffectResolution {
  const environment = input.environment ?? FIRST_EFFECT_ENVIRONMENT
  const effectDefinitions = resolveKeywordEffectDefinitions(
    input.currentState,
    input.battle.attackerPieceId,
    [TWIN_DRIVE_KEYWORD],
    environment,
  ).filter((definition) =>
    effectDefinitionMatchesTimingWindow(definition, {
      point: 'battle.drive_check',
      window: 'before',
    }),
  )
  let count = input.baseCount
  const events: GameEvent[] = []

  for (const effectDefinition of effectDefinitions) {
    const operations = getDeclarativeEffectOperations(effectDefinition).filter(
      (operation) =>
        operation.kind === 'adjust_check_count' && operation.check === 'drive',
    )

    if (operations.length === 0) {
      continue
    }

    for (const operation of operations) {
      if (operation.kind === 'adjust_check_count') {
        count += operation.amount
      }
    }

    events.push(
      createEffectResolvedEvent({
        transitionId: input.transitionId,
        sequence: (input.startingSequence ?? 0) + events.length,
        sourceActionId: input.sourceActionId,
        effectDefinition,
        sourcePieceId: input.battle.attackerPieceId,
        operationKinds: operations.map((operation) => operation.kind),
      }),
    )
  }

  return {
    count,
    events,
  }
}

export interface PostRideEffectResolutionInput {
  readonly currentState: GameState
  readonly transitionId: TransitionId
  readonly sourceActionId: ActionId
  readonly rideEvent: Extract<GameEvent, { readonly type: 'card.rode' }>
  readonly startingSequence?: number
  readonly environment?: FirstEffectEnvironment
}

export type PostRideEffectResolution =
  | {
      readonly ok: true
      readonly state: GameState
      readonly events: readonly GameEvent[]
    }
  | {
      readonly ok: false
      readonly code: 'invalid_action' | 'invalid_action_reference'
      readonly message: string
    }

export interface PersonaRideEffectResolutionInput {
  readonly currentState: GameState
  readonly transitionId: TransitionId
  readonly sourceActionId: ActionId
  readonly rideEvent: Extract<GameEvent, { readonly type: 'card.rode' }>
  readonly effectDefinition: EffectDefinition
  readonly startingSequence?: number
}

export function resolvePostRideEffects(
  input: PostRideEffectResolutionInput,
): PostRideEffectResolution {
  const environment = input.environment ?? FIRST_EFFECT_ENVIRONMENT
  const effectDefinitions = resolveKeywordEffectDefinitions(
    input.currentState,
    input.rideEvent.pieceId,
    [PERSONA_RIDE_KEYWORD],
    environment,
  ).filter(
    (definition) =>
      effectDefinitionMatchesEvent(definition, input.rideEvent) &&
      effectDefinitionMatchesTimingWindow(definition, {
        point: 'card.ride',
        window: 'after',
      }),
  )
  let workingState = input.currentState
  const events: GameEvent[] = []

  for (const effectDefinition of effectDefinitions) {
    const effectResult = resolvePersonaRideEffect({
      currentState: workingState,
      transitionId: input.transitionId,
      sourceActionId: input.sourceActionId,
      rideEvent: input.rideEvent,
      effectDefinition,
      startingSequence: (input.startingSequence ?? 0) + events.length,
    })

    if (!effectResult.ok) {
      return effectResult
    }

    workingState = effectResult.state
    events.push(...effectResult.events)
  }

  return {
    ok: true,
    state: workingState,
    events,
  }
}

export function resolvePersonaRideEffect(
  input: PersonaRideEffectResolutionInput,
): PostRideEffectResolution {
  if (
    !canResolvePersonaRideEffect(
      input.currentState,
      input.rideEvent.pieceId,
      input.rideEvent.ridingOverPieceId,
    )
  ) {
    return {
      ok: true,
      state: input.currentState,
      events: [],
    }
  }

  const operations = getDeclarativeEffectOperations(input.effectDefinition)
  const effectResolvedEvent = createEffectResolvedEvent({
    transitionId: input.transitionId,
    sequence: input.startingSequence ?? 0,
    sourceActionId: input.sourceActionId,
    effectDefinition: input.effectDefinition,
    sourcePieceId: input.rideEvent.pieceId,
    triggerEventSequence: input.rideEvent.sequence,
    operationKinds: operations.map((operation) => operation.kind),
  })
  const operationResult = applyDeclarativeOperations(input.currentState, {
    transitionId: input.transitionId,
    sourceActionId: input.sourceActionId,
    sourcePieceId: input.rideEvent.pieceId,
    startingSequence: (input.startingSequence ?? 0) + 1,
    operations,
  })

  if (!operationResult.ok) {
    return operationResult
  }

  return {
    ok: true,
    state: operationResult.state,
    events: [effectResolvedEvent, ...operationResult.events],
  }
}

function resolveKeywordEffectDefinitions(
  currentState: GameState,
  sourcePieceId: PieceId,
  supportedKeywords: readonly (typeof TWIN_DRIVE_KEYWORD)[],
  environment: FirstEffectEnvironment,
): readonly EffectDefinition[]
function resolveKeywordEffectDefinitions(
  currentState: GameState,
  sourcePieceId: PieceId,
  supportedKeywords: readonly (typeof PERSONA_RIDE_KEYWORD)[],
  environment: FirstEffectEnvironment,
): readonly EffectDefinition[]
function resolveKeywordEffectDefinitions(
  currentState: GameState,
  sourcePieceId: PieceId,
  supportedKeywords: readonly string[],
  environment: FirstEffectEnvironment,
): readonly EffectDefinition[] {
  const stateIndex = buildGameStateIndex(currentState)
  const sourcePiece = findPieceById(stateIndex, sourcePieceId)

  if (sourcePiece?.keywords === undefined) {
    return []
  }

  const keywordInputs = sourcePiece.keywords.filter((keyword) =>
    supportedKeywords.includes(keyword),
  )

  return environment.keywordMechanics
    .resolveEffectDefinitionsForKeywords(
      keywordInputs,
      environment.effectRegistry,
      {
        formatId: currentState.formatId,
      },
    )
    .map((resolved) => resolved.effectDefinition)
}

function canResolvePersonaRideEffect(
  currentState: GameState,
  rodePieceId: PieceId,
  ridingOverPieceId: PieceId | undefined,
): boolean {
  if (currentState.formatId !== ('standard' as FormatId)) {
    return false
  }

  if (ridingOverPieceId === undefined) {
    return false
  }

  const stateIndex = buildGameStateIndex(currentState)
  const rodePiece = findPieceById(stateIndex, rodePieceId)
  const rodeOverPiece = findPieceById(stateIndex, ridingOverPieceId)

  return (
    rodePiece?.cardDefinitionId !== undefined &&
    rodePiece.cardDefinitionId === rodeOverPiece?.cardDefinitionId
  )
}

interface ApplyDeclarativeOperationsInput {
  readonly transitionId: TransitionId
  readonly sourceActionId: ActionId
  readonly sourcePieceId: PieceId
  readonly startingSequence: number
  readonly operations: readonly DeclarativeEffectOperation[]
}

type ApplyDeclarativeOperationsResult =
  | {
      readonly ok: true
      readonly state: GameState
      readonly events: readonly GameEvent[]
    }
  | {
      readonly ok: false
      readonly code: 'invalid_action' | 'invalid_action_reference'
      readonly message: string
    }

function applyDeclarativeOperations(
  currentState: GameState,
  input: ApplyDeclarativeOperationsInput,
): ApplyDeclarativeOperationsResult {
  let workingState = currentState
  const events: GameEvent[] = []

  for (const operation of input.operations) {
    switch (operation.kind) {
      case 'draw_cards': {
        const result = applyDrawCardsOperation(workingState, input, operation, {
          startingSequence: input.startingSequence + events.length,
        })

        if (!result.ok) {
          return result
        }

        workingState = result.state
        events.push(...result.events)
        break
      }
      case 'apply_power_modifier':
        workingState = applyPowerModifierOperation(
          workingState,
          input.sourcePieceId,
        )
        break
      case 'adjust_check_count':
        break
    }
  }

  return {
    ok: true,
    state: workingState,
    events,
  }
}

function applyDrawCardsOperation(
  currentState: GameState,
  input: ApplyDeclarativeOperationsInput,
  operation: Extract<
    DeclarativeEffectOperation,
    { readonly kind: 'draw_cards' }
  >,
  options: { readonly startingSequence: number },
): ApplyDeclarativeOperationsResult {
  const stateIndex = buildGameStateIndex(currentState)
  const sourcePiece = findPieceById(stateIndex, input.sourcePieceId)
  const controllerPlayerId = sourcePiece?.controllerPlayerId

  if (controllerPlayerId === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Effect draw operation requires source piece ${input.sourcePieceId} to have a controller.`,
    }
  }

  const player = findPlayerById(stateIndex, controllerPlayerId)
  const deckZone =
    player === undefined
      ? undefined
      : findOwnedZoneByKind(stateIndex, player, 'deck')
  const handZone =
    player === undefined
      ? undefined
      : findOwnedZoneByKind(stateIndex, player, 'hand')

  if (
    player === undefined ||
    deckZone === undefined ||
    handZone === undefined
  ) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Effect draw operation requires controller ${controllerPlayerId} to own deck and hand zones.`,
    }
  }

  const drawResult = drawTopPiecesBetweenZones(
    currentState,
    deckZone.zoneId,
    handZone.zoneId,
    operation.count,
    'effect',
  )

  if (!drawResult.ok) {
    return drawResult
  }

  const movedEvents = createPieceMovedEvents(
    input.transitionId,
    drawResult.movedPieces,
    {
      kind: 'system',
      system: AUTOMATIC_FLOW_SYSTEM,
    },
    {
      sourceActionId: input.sourceActionId,
      startingSequence: options.startingSequence,
    },
  )
  const cardsDrawnEvent: Extract<GameEvent, { readonly type: 'cards.drawn' }> =
    {
      eventId: createEventId(
        input.transitionId,
        options.startingSequence + movedEvents.length,
      ),
      type: 'cards.drawn',
      sequence: options.startingSequence + movedEvents.length,
      sourceActionId: input.sourceActionId,
      origin: {
        kind: 'system',
        system: AUTOMATIC_FLOW_SYSTEM,
      },
      playerId: player.playerId,
      fromZoneId: deckZone.zoneId,
      toZoneId: handZone.zoneId,
      pieceIds: drawResult.movedPieces.map((movement) => movement.pieceId),
    }

  return {
    ok: true,
    state: {
      ...currentState,
      zones: drawResult.zones,
      pieceStates: drawResult.pieceStates,
    },
    events: [...movedEvents, cardsDrawnEvent],
  }
}

function applyPowerModifierOperation(
  currentState: GameState,
  sourcePieceId: PieceId,
): GameState {
  const stateIndex = buildGameStateIndex(currentState)
  const sourcePiece = findPieceById(stateIndex, sourcePieceId)
  const controllerPlayerId = sourcePiece?.controllerPlayerId

  if (controllerPlayerId === undefined) {
    return currentState
  }

  const frontRowPieceIds = [
    ...listOwnedZonesByKind(stateIndex, controllerPlayerId, 'vanguard_circle'),
    ...listOwnedZonesByKind(
      stateIndex,
      controllerPlayerId,
      'rear_guard_circle',
    ),
  ].flatMap((zone) => zone.occupants.map((occupant) => occupant.pieceId))

  return {
    ...currentState,
    pieceStates: upsertPieceFlags(
      currentState.pieceStates,
      frontRowPieceIds,
      PERSONA_RIDE_POWER_FLAG,
    ),
  }
}

function upsertPieceFlags(
  pieceStates: readonly GamePieceStatusState[],
  pieceIds: readonly PieceId[],
  flag: GamePieceFlagKey,
): readonly GamePieceStatusState[] {
  const nextPieceStates = [...pieceStates]

  for (const pieceId of pieceIds) {
    const existingIndex = nextPieceStates.findIndex(
      (pieceState) => pieceState.pieceId === pieceId,
    )

    if (existingIndex === -1) {
      nextPieceStates.push({
        pieceId,
        orientation: 'stand',
        flags: [flag],
      })
      continue
    }

    const existingState = nextPieceStates[existingIndex]

    if (existingState === undefined || existingState.flags.includes(flag)) {
      continue
    }

    nextPieceStates[existingIndex] = {
      ...existingState,
      flags: [...existingState.flags, flag],
    }
  }

  return nextPieceStates
}

function createEffectResolvedEvent(input: {
  readonly transitionId: TransitionId
  readonly sequence: number
  readonly sourceActionId: ActionId
  readonly effectDefinition: EffectDefinition
  readonly sourcePieceId: PieceId
  readonly triggerEventSequence?: number
  readonly operationKinds: readonly string[]
}): EffectResolvedEvent {
  return {
    eventId: createEventId(input.transitionId, input.sequence),
    type: 'effect.resolved',
    sequence: input.sequence,
    sourceActionId: input.sourceActionId,
    origin: {
      kind: 'system',
      system: AUTOMATIC_FLOW_SYSTEM,
    },
    effectDefinitionId: input.effectDefinition.id,
    sourcePieceId: input.sourcePieceId,
    ...(input.triggerEventSequence === undefined
      ? {}
      : {
          triggerEventSequence: input.triggerEventSequence,
        }),
    operationKinds: input.operationKinds,
  }
}

function createEventId(transitionId: TransitionId, sequence: number): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}
