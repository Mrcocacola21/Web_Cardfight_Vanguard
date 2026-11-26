import type { FormatId } from '@web-vg/shared'

import { resolveGamePieceCardStats } from '../cards/card-stats'
import type {
  ActionId,
  EffectContinuationId,
  EffectDefinitionId,
  EventId,
  PieceId,
  PlayerId,
  RequestId,
  RequestOptionId,
  TransitionId,
  ZoneId,
  ZoneSlotId,
} from '../contracts'
import { coreEffectHandlerRegistry } from '../effects/core-handlers'
import {
  createEffectHandlerKey,
  createEffectIdentity,
  createEffectTag,
  createEffectTimingBinding,
  defineEffectDefinition,
  effectDefinitionMatchesEvent,
  effectDefinitionMatchesTimingWindow,
  type EffectDefinition,
  type EffectHandlerKey,
} from '../effects/effect'
import type {
  EffectHandler,
  EffectHandlerInput,
  EffectHandlerRegistry,
  EffectHandlerResult,
  EffectHandlerResumeInput,
  EffectHandlerResumeResult,
} from '../effects/handler-registry'
import { createEffectRegistry } from '../effects/registry'
import type { EffectResolutionQueueItemSeed } from '../effects/resolution-queue'
import { coreEffectRegistry } from '../effects/samples'
import type { EventTriggeredResolutionEnvironment } from '../effects/triggered-resolution'
import type { GameEvent } from '../events'
import { keywordMechanicsRegistry } from '../keywords/samples'
import type { GameChoiceRequest, GameChoiceResponse } from '../requests'
import { FACE_DOWN_DAMAGE_FLAG } from '../resources/resource-state'
import {
  buildGameStateIndex,
  findOwnedZoneByKind,
  findPieceById,
  findPieceLocation,
  resolvePrimaryOpponentPlayerId,
  type EffectContinuationState,
  type GamePieceState,
  type GamePieceStatusState,
  type GameState,
  type PieceReplacementRule,
  type ScriptContinuationState,
  type ZoneState,
} from '../state'
import type { ZoneTransferIntent, ZoneTransferReason } from '../transfers'
import type { ActivatedEffectRuntimeEnvironment } from '../transitions/activated-effects'
import type { RuntimeTransitionOptions } from '../transitions/reducer'
import {
  createTransitionTimingWindowTriplet,
  type EffectTimingPoint,
  type TransitionTimingWindow,
} from '../transitions/transition'
import {
  createPieceMovedEvents,
  resolveZoneTransferSequence,
} from '../transitions/zone-transfer'

import {
  compileAbility,
  type PrimitiveScriptStep,
  type ScriptInstruction,
} from './compile'
import type {
  CardScript,
  ChooseStep,
  NumberComparison,
  ScriptAbility,
  ScriptAutoTrigger,
  ScriptCardFilter,
  ScriptCondition,
  ScriptPlayer,
  ScriptSubjectFilter,
  ScriptTargetRef,
  ScriptZone,
  ScriptZoneSelector,
} from './format'
import { validateCardScript, type CardScriptIssue } from './validate'

export const CARD_SCRIPT_HANDLER_KEY: EffectHandlerKey = createEffectHandlerKey(
  'card-script.runtime',
)

const SCRIPT_EVENT_SYSTEM = 'card-script'
const SCRIPT_OPERATION_KINDS = ['card_script'] as const
const ONCE_PER_TURN_FLAG_PREFIX = 'script.once-per-turn.'
const ENERGY_COUNTER_KEY = 'energy'
const ENERGY_MAX = 10
const MAIN_PHASE = 'main'
const BOARD_ZONES: readonly string[] = ['vanguard_circle', 'rear_guard_circle']

const AUTO_TRIGGER_BINDINGS: Readonly<
  Record<
    ScriptAutoTrigger,
    { readonly eventType: GameEvent['type']; readonly point: EffectTimingPoint }
  >
> = {
  ride: { eventType: 'card.rode', point: 'card.ride' },
  call: { eventType: 'card.called', point: 'card.call' },
  attack: { eventType: 'battle.attack_declared', point: 'battle.attack' },
  boost: { eventType: 'battle.boost_declared', point: 'battle.boost' },
  guard: { eventType: 'battle.guard_declared', point: 'battle.guard' },
}

export class CardScriptLoadError extends Error {
  readonly issues: readonly (CardScriptIssue & { readonly cardId?: string })[]

  constructor(
    issues: readonly (CardScriptIssue & { readonly cardId?: string })[],
  ) {
    super(
      `Card scripts failed validation:\n${issues
        .map(
          (issue) => `  ${issue.cardId ?? '?'} ${issue.path}: ${issue.message}`,
        )
        .join('\n')}`,
    )
    this.name = 'CardScriptLoadError'
    this.issues = issues
  }
}

export interface CardScriptRuntimeOptions {
  /** Formats the scripted abilities apply to. Omit for every format. */
  readonly formatIds?: readonly FormatId[]
  readonly baseEffectDefinitions?: readonly EffectDefinition[]
  readonly baseEffectHandlers?: EffectHandlerRegistry
  /**
   * Random source for `shuffle`, returning [0, 1). Defaults to the Web Crypto
   * API. Pass a seeded generator for reproducible tests.
   */
  readonly random?: () => number
}

export interface ActivatableScriptAbility {
  readonly pieceId: PieceId
  readonly cardId: string
  readonly abilityId: string
  readonly effectDefinitionId: EffectDefinitionId
  readonly text?: string
}

export interface CardScriptRuntime {
  readonly scripts: readonly CardScript[]
  readonly effectDefinitions: readonly EffectDefinition[]
  readonly handler: EffectHandler
  readonly activatedEffects: ActivatedEffectRuntimeEnvironment
  readonly triggeredEffects: EventTriggeredResolutionEnvironment
  /** Pass to `applyGameAction` / `applyGameChoiceResponse`. */
  readonly transitionOptions: RuntimeTransitionOptions
  effectDefinitionIdsForCard(cardId: string): readonly EffectDefinitionId[]
  /**
   * Binds scripted abilities (and REPLACE rules) to every piece whose card
   * has a script. Idempotent; returns the same state when nothing changes.
   */
  bindCardScripts(state: GameState): GameState
  /** Recomputes CONT modifiers; the reducer also does this after every transition. */
  applyContinuousEffects(state: GameState): GameState
  /** ACT abilities the player can start right now (conditions and costs checked). */
  listActivatableAbilities(
    state: GameState,
    playerId: PlayerId,
  ): readonly ActivatableScriptAbility[]
}

interface CompiledAbility {
  readonly script: CardScript
  readonly ability: ScriptAbility
  readonly definition: EffectDefinition
  readonly program: readonly ScriptInstruction[]
}

/** Validates, compiles and registers card scripts. Throws on invalid scripts. */
export function createCardScriptRuntime(
  scriptInputs: readonly unknown[],
  options: CardScriptRuntimeOptions = {},
): CardScriptRuntime {
  const issues: (CardScriptIssue & { cardId?: string })[] = []
  const scripts: CardScript[] = []

  for (const [index, input] of scriptInputs.entries()) {
    const result = validateCardScript(input)

    if (result.ok) {
      scripts.push(result.script)
    } else {
      const cardId =
        typeof (input as { cardId?: unknown })?.cardId === 'string'
          ? (input as { cardId: string }).cardId
          : `#${index}`
      issues.push(...result.issues.map((issue) => ({ ...issue, cardId })))
    }
  }

  const abilitiesById = new Map<EffectDefinitionId, CompiledAbility>()
  const idsByCard = new Map<string, EffectDefinitionId[]>()
  const staticByCard = new Map<string, ScriptAbility[]>()

  for (const script of scripts) {
    if (idsByCard.has(script.cardId)) {
      issues.push({
        cardId: script.cardId,
        path: 'cardId',
        message: 'Duplicate script for this card.',
      })
      continue
    }

    const ids: EffectDefinitionId[] = []
    const staticAbilities: ScriptAbility[] = []

    for (const ability of script.abilities) {
      if (ability.type === 'CONT' || ability.type === 'REPLACE') {
        // Not effects that resolve: CONT is recomputed after each transition,
        // REPLACE is bound to the piece and applied by zone transfers.
        staticAbilities.push(ability)
        continue
      }

      const definition = defineScriptEffect(script, ability, options.formatIds)

      if (abilitiesById.has(definition.id)) {
        issues.push({
          cardId: script.cardId,
          path: 'cardId',
          message: `Effect id ${definition.id} collides with another card; card ids must stay distinct after normalization.`,
        })
        continue
      }

      abilitiesById.set(definition.id, {
        script,
        ability,
        definition,
        program: compileAbility(ability),
      })
      ids.push(definition.id)
    }

    idsByCard.set(script.cardId, ids)
    staticByCard.set(script.cardId, staticAbilities)
  }

  if (issues.length > 0) {
    throw new CardScriptLoadError(issues)
  }

  const handler = createScriptHandler(
    abilitiesById,
    options.random ?? defaultRandom,
  )
  const watchers = Array.from(abilitiesById.values()).filter(
    (compiled) =>
      compiled.ability.type === 'AUTO' &&
      compiled.ability.subject !== undefined &&
      compiled.ability.subject !== 'this',
  )
  const replacementsByCard = new Map(
    Array.from(staticByCard, ([cardId, abilities]) => [
      cardId,
      abilities
        .filter((ability) => ability.type === 'REPLACE')
        .map(toReplacementRule),
    ]),
  )
  const continuousByCard = new Map(
    Array.from(staticByCard, ([cardId, abilities]) => [
      cardId,
      abilities.filter((ability) => ability.type === 'CONT'),
    ]),
  )
  const continuousEffects = {
    apply: (state: GameState) =>
      applyContinuousEffects(state, continuousByCard),
  }
  const effectDefinitions = Array.from(abilitiesById.values()).map(
    (compiled) => compiled.definition,
  )
  const effectRegistry = createEffectRegistry([
    ...(options.baseEffectDefinitions ?? coreEffectRegistry.listDefinitions()),
    ...effectDefinitions,
  ])
  const effectHandlers = (
    options.baseEffectHandlers ?? coreEffectHandlerRegistry
  ).register(handler)
  const activatedEffects: ActivatedEffectRuntimeEnvironment = {
    effectRegistry,
    effectHandlers,
  }
  const triggeredEffects: EventTriggeredResolutionEnvironment = {
    effectRegistry,
    effectHandlers,
    keywordMechanics: keywordMechanicsRegistry,
    collectAdditionalCandidates: (state, triggerSource) =>
      collectWatcherCandidates(state, triggerSource, watchers),
  }

  return {
    scripts,
    effectDefinitions,
    handler,
    activatedEffects,
    triggeredEffects,
    transitionOptions: {
      activatedEffects,
      triggeredEffects,
      continuousEffects,
    },
    effectDefinitionIdsForCard: (cardId) => idsByCard.get(cardId) ?? [],
    applyContinuousEffects: continuousEffects.apply,
    bindCardScripts(state) {
      let changed = false
      const pieces = state.pieces.map((piece) => {
        const cardId = piece.cardDefinitionId
        const ids = cardId === undefined ? undefined : idsByCard.get(cardId)
        const replacements =
          cardId === undefined ? undefined : replacementsByCard.get(cardId)
        const hasIds = ids !== undefined && ids.length > 0
        const hasReplacements =
          replacements !== undefined && replacements.length > 0
        const missingIds =
          hasIds &&
          ids.some((id) => !(piece.effectDefinitionIds ?? []).includes(id))

        if (
          !missingIds &&
          (!hasReplacements || piece.replacements !== undefined)
        ) {
          return piece
        }

        changed = true

        return {
          ...piece,
          ...(hasIds
            ? {
                effectDefinitionIds: Array.from(
                  new Set([...(piece.effectDefinitionIds ?? []), ...ids]),
                ),
              }
            : {}),
          ...(hasReplacements ? { replacements } : {}),
        }
      })

      // Keep the same object when nothing changed so callers can compare.
      return changed ? { ...state, pieces } : state
    },
    listActivatableAbilities(state, playerId) {
      if (state.status !== 'in_progress') {
        return []
      }

      return state.pieces.flatMap((piece) =>
        (piece.effectDefinitionIds ?? []).flatMap((effectDefinitionId) => {
          const compiled = abilitiesById.get(effectDefinitionId)

          if (
            compiled === undefined ||
            compiled.ability.type !== 'ACT' ||
            (piece.controllerPlayerId ?? piece.ownerPlayerId) !== playerId
          ) {
            return []
          }

          const context = createContext(
            state,
            piece.pieceId,
            compiled,
            undefined,
          )

          if (
            context === undefined ||
            checkStart(state, context) !== undefined
          ) {
            return []
          }

          return [
            {
              pieceId: piece.pieceId,
              cardId: compiled.script.cardId,
              abilityId: compiled.ability.id,
              effectDefinitionId,
              ...(compiled.ability.text === undefined
                ? {}
                : { text: compiled.ability.text }),
            },
          ]
        }),
      )
    },
  }
}

function defineScriptEffect(
  script: CardScript,
  ability: ScriptAbility,
  formatIds: readonly FormatId[] | undefined,
): EffectDefinition {
  const identity = createEffectIdentity(
    'script',
    `${normalizeIdSegment(script.cardId)}.${ability.id}`,
  )
  const applicability =
    formatIds === undefined
      ? { scope: 'card' as const }
      : { scope: 'card' as const, formatIds }
  const resolutionStrategy = {
    kind: 'typed_handler' as const,
    handlerKey: CARD_SCRIPT_HANDLER_KEY,
    family: 'card_script',
  }
  const tags = [createEffectTag('card-script')]

  if (ability.type === 'ACT') {
    return defineEffectDefinition({
      id: identity.id,
      identity,
      kind: 'activated',
      trigger: { kind: 'manual' },
      timing: [],
      applicability,
      resolution: { model: 'optional', strategy: resolutionStrategy },
      tags,
    })
  }

  const binding = AUTO_TRIGGER_BINDINGS[ability.on as ScriptAutoTrigger]

  return defineEffectDefinition({
    id: identity.id,
    identity,
    kind: 'triggered',
    trigger: { kind: 'event', eventTypes: [binding.eventType] },
    timing: [createEffectTimingBinding(binding.point, 'after')],
    applicability,
    // Optional AUTO abilities ask the controller inside the script itself.
    resolution: { model: 'automatic', strategy: resolutionStrategy },
    tags,
  })
}

/** Card ids come from external databases; effect ids allow `[a-z0-9._-]`. */
function normalizeIdSegment(cardId: string): string {
  const normalized = cardId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return /^[a-z]/.test(normalized) ? normalized : `c${normalized || 'card'}`
}

function defaultRandom(): number {
  const buffer = new Uint32Array(1)
  globalThis.crypto.getRandomValues(buffer)
  return buffer[0]! / 2 ** 32
}

function toReplacementRule(ability: ScriptAbility): PieceReplacementRule {
  const destination = ability.instead ?? 'drop'

  return {
    replaces: ability.replaces ?? 'retire',
    toZoneKind:
      destination === 'deck_top' || destination === 'deck_bottom'
        ? 'deck'
        : destination,
    ...(destination === 'deck_top' ? { toPosition: 'top' as const } : {}),
    ...(ability.zones === undefined ? {} : { whileInZoneKinds: ability.zones }),
  }
}

/**
 * AUTO abilities with `subject: "other" | "any"` watch events about other
 * cards. The engine only collects abilities of the event's own cards, so the
 * runtime adds candidates for every watching card on the field.
 */
function collectWatcherCandidates(
  state: GameState,
  triggerSource: {
    readonly event: GameEvent
    readonly timingWindow: TransitionTimingWindow
  },
  watchers: readonly CompiledAbility[],
): readonly EffectResolutionQueueItemSeed[] {
  if (watchers.length === 0) {
    return []
  }

  const subjects = subjectsOfEvent(triggerSource.event)

  if (subjects.length === 0) {
    return []
  }

  return state.pieces.flatMap((piece) =>
    watchers
      .filter(
        (watcher) =>
          piece.effectDefinitionIds?.includes(watcher.definition.id) === true &&
          // Events about the watcher itself come through the normal path.
          !subjects.includes(piece.pieceId) &&
          (watcher.definition.applicability.formatIds === undefined ||
            watcher.definition.applicability.formatIds.includes(
              state.formatId,
            )) &&
          effectDefinitionMatchesEvent(
            watcher.definition,
            triggerSource.event,
          ) &&
          effectDefinitionMatchesTimingWindow(
            watcher.definition,
            triggerSource.timingWindow,
          ),
      )
      .map((watcher) => ({
        sourceKind: 'direct' as const,
        triggerEvent: triggerSource.event,
        timingWindow: triggerSource.timingWindow,
        effectDefinition: watcher.definition,
        sourcePieceId: piece.pieceId,
      })),
  )
}

/**
 * Recomputes every CONT modifier from scratch, so a bonus disappears as soon
 * as its condition stops holding. Returns the same state when nothing moved.
 */
function applyContinuousEffects(
  state: GameState,
  continuousByCard: ReadonlyMap<string, readonly ScriptAbility[]>,
): GameState {
  const totals = new Map<PieceId, { power: number; critical: number }>()
  const index = buildGameStateIndex(state)

  for (const piece of state.pieces) {
    const abilities =
      piece.cardDefinitionId === undefined
        ? undefined
        : continuousByCard.get(piece.cardDefinitionId)
    const controllerId = piece.controllerPlayerId ?? piece.ownerPlayerId

    if (
      abilities === undefined ||
      abilities.length === 0 ||
      controllerId === undefined
    ) {
      continue
    }

    const context: QueryContext = {
      sourcePieceId: piece.pieceId,
      controllerId,
      opponentId: resolvePrimaryOpponentPlayerId(index, controllerId),
    }
    const sourceZoneKind = findPieceLocation(index, piece.pieceId)?.zone.kind

    for (const ability of abilities) {
      const zones: readonly string[] = ability.zones ?? BOARD_ZONES

      if (sourceZoneKind === undefined || !zones.includes(sourceZoneKind)) {
        continue
      }

      if (
        ability.condition !== undefined &&
        !evaluateCondition(state, context, {}, ability.condition)
      ) {
        continue
      }

      for (const step of ability.effect ?? []) {
        if (step.do !== 'power' && step.do !== 'critical') {
          continue
        }

        for (const target of resolveTargetIn(state, context, {}, step.target)) {
          if (!isOnBoard(state, target)) {
            continue
          }

          const total = totals.get(target) ?? { power: 0, critical: 0 }
          totals.set(target, {
            power: total.power + (step.do === 'power' ? step.amount : 0),
            critical:
              total.critical + (step.do === 'critical' ? step.amount : 0),
          })
        }
      }
    }
  }

  let changed = false
  const seen = new Set<PieceId>()
  const pieceStates = state.pieceStates.map((pieceState) => {
    seen.add(pieceState.pieceId)
    const next = withContinuous(pieceState, totals.get(pieceState.pieceId))

    if (next !== pieceState) {
      changed = true
    }

    return next
  })

  for (const [pieceId, total] of totals) {
    if (seen.has(pieceId) || (total.power === 0 && total.critical === 0)) {
      continue
    }

    changed = true
    pieceStates.push(
      withContinuous({ pieceId, orientation: 'stand', flags: [] }, total),
    )
  }

  return changed ? { ...state, pieceStates } : state
}

function withContinuous(
  pieceState: GamePieceStatusState,
  total: { readonly power: number; readonly critical: number } | undefined,
): GamePieceStatusState {
  const power = total?.power ?? 0
  const critical = total?.critical ?? 0

  if (
    (pieceState.continuousPowerModifier ?? 0) === power &&
    (pieceState.continuousCriticalModifier ?? 0) === critical
  ) {
    return pieceState
  }

  const {
    continuousPowerModifier: _power,
    continuousCriticalModifier: _critical,
    ...rest
  } = pieceState

  return {
    ...rest,
    ...(power === 0 ? {} : { continuousPowerModifier: power }),
    ...(critical === 0 ? {} : { continuousCriticalModifier: critical }),
  }
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

/** What board queries need: whose card it is. */
interface QueryContext {
  readonly sourcePieceId: PieceId
  readonly controllerId: PlayerId
  readonly opponentId: PlayerId | undefined
}

interface ScriptContext extends QueryContext {
  readonly compiled: CompiledAbility
  readonly sourceActionId?: ActionId
  readonly triggerEventSequence?: number
}

interface Execution {
  state: GameState
  vars: Record<string, readonly PieceId[]>
  readonly random: () => number
  readonly events: GameEvent[]
  readonly timingWindows: TransitionTimingWindow[]
  nextSequence: number
  nextTimingWindowSequence: number
  readonly transitionId: TransitionId
  readonly context: ScriptContext
}

type ScriptFailure = {
  readonly ok: false
  readonly code:
    | 'invalid_action'
    | 'invalid_action_reference'
    | 'invalid_response'
  readonly message: string
}

type StepOutcome =
  | { readonly kind: 'next'; readonly pc?: number }
  | {
      readonly kind: 'pause'
      readonly request: PendingRequestDraft
      readonly frame?: Readonly<Record<string, number>>
    }
  | ScriptFailure

/** A request without the ids/context the runtime attaches when pausing. */
type PendingRequestDraft = DistributiveOmit<
  GameChoiceRequest,
  'requestId' | 'context'
>

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never

interface ResumeData {
  readonly request: GameChoiceRequest
  readonly response: GameChoiceResponse
  readonly frame?: Readonly<Record<string, number>>
}

function createScriptHandler(
  abilitiesById: ReadonlyMap<EffectDefinitionId, CompiledAbility>,
  random: () => number,
): EffectHandler {
  return {
    key: CARD_SCRIPT_HANDLER_KEY,
    resolve(input: EffectHandlerInput): EffectHandlerResult {
      const compiled = abilitiesById.get(input.queueItem.effectDefinition.id)
      const sourcePieceId = input.queueItem.sourcePieceId

      if (compiled === undefined || sourcePieceId === undefined) {
        return handlerFailure(
          'invalid_action_reference',
          `Card script for ${input.queueItem.effectDefinition.id} is not loaded.`,
        )
      }

      const context = createContext(
        input.currentState,
        sourcePieceId,
        compiled,
        {
          sourceActionId: input.queueItem.triggerEvent.sourceActionId,
          triggerEventSequence: input.queueItem.triggerEvent.sequence,
        },
      )

      if (context === undefined) {
        return handlerFailure(
          'invalid_action_reference',
          `Card script source ${sourcePieceId} has no controller.`,
        )
      }

      const noOp: EffectHandlerResult = {
        ok: true,
        state: input.currentState,
        events: [],
        timingWindows: [],
      }
      const subjects =
        compiled.ability.type === 'AUTO'
          ? resolveTriggerSubjects(
              input.currentState,
              context,
              input.queueItem.triggerEvent,
            )
          : []

      if (subjects === undefined) {
        // The event is not about the card this ability watches.
        return noOp
      }

      const blocked = checkStart(input.currentState, context)

      if (blocked !== undefined) {
        // An AUTO ability that cannot be used simply does not resolve; an ACT
        // ability the player tried to start is an invalid action.
        return compiled.ability.type === 'ACT'
          ? handlerFailure('invalid_action', blocked)
          : noOp
      }

      const result = run(
        {
          state: input.currentState,
          vars: compiled.ability.type === 'AUTO' ? { trigger: subjects } : {},
          random,
          events: [],
          timingWindows: [],
          nextSequence: input.startingSequence,
          nextTimingWindowSequence: input.startingTimingWindowSequence,
          transitionId: input.transitionId,
          context,
        },
        0,
        undefined,
      )

      // `invalid_response` cannot happen without a response.
      return result.ok
        ? result
        : handlerFailure('invalid_action', result.message)
    },
    resume(input: EffectHandlerResumeInput): EffectHandlerResumeResult {
      const saved = input.continuation.script

      if (saved === undefined) {
        return failure(
          'invalid_action_reference',
          'Continuation has no script state.',
        )
      }

      const compiled = abilitiesById.get(input.continuation.effectDefinitionId)

      if (compiled === undefined) {
        return failure(
          'invalid_action_reference',
          `Card script for ${input.continuation.effectDefinitionId} is not loaded.`,
        )
      }

      const context = createContext(
        input.currentState,
        input.continuation.sourcePieceId,
        compiled,
        {
          sourceActionId: input.continuation.sourceActionId,
          triggerEventSequence: saved.triggerEventSequence,
        },
        input.continuation.actorPlayerId,
      )

      if (context === undefined) {
        return failure(
          'invalid_action_reference',
          'Card script source has no controller.',
        )
      }

      return run(
        {
          state: input.currentState,
          vars: { ...saved.vars },
          random,
          events: [],
          timingWindows: [],
          nextSequence: input.startingSequence,
          nextTimingWindowSequence: input.startingTimingWindowSequence,
          transitionId: input.transitionId,
          context,
        },
        saved.pc,
        {
          request: input.request,
          response: input.response,
          ...(saved.frame === undefined ? {} : { frame: saved.frame }),
        },
      )
    },
  }
}

function createContext(
  state: GameState,
  sourcePieceId: PieceId,
  compiled: CompiledAbility,
  trigger:
    | {
        readonly sourceActionId?: ActionId | undefined
        readonly triggerEventSequence?: number | undefined
      }
    | undefined,
  controllerOverride?: PlayerId,
): ScriptContext | undefined {
  const index = buildGameStateIndex(state)
  const piece = findPieceById(index, sourcePieceId)
  const controllerId =
    controllerOverride ?? piece?.controllerPlayerId ?? piece?.ownerPlayerId

  if (controllerId === undefined) {
    return undefined
  }

  const opponentId = resolvePrimaryOpponentPlayerId(index, controllerId)

  return {
    compiled,
    sourcePieceId,
    controllerId,
    opponentId,
    ...(trigger?.sourceActionId === undefined
      ? {}
      : { sourceActionId: trigger.sourceActionId }),
    ...(trigger?.triggerEventSequence === undefined
      ? {}
      : { triggerEventSequence: trigger.triggerEventSequence }),
  }
}

/** Returns why the ability cannot start, or undefined when it can. */
function checkStart(
  state: GameState,
  context: ScriptContext,
): string | undefined {
  const { ability } = context.compiled
  const sourceZone = findPieceLocation(
    buildGameStateIndex(state),
    context.sourcePieceId,
  )?.zone

  if (ability.type === 'ACT') {
    if (
      state.turn.turnPlayerId !== context.controllerId ||
      state.turn.phase !== MAIN_PHASE
    ) {
      return 'ACT abilities can only be used during your main phase.'
    }

    if (state.pendingRequests.length > 0) {
      return 'Resolve the pending choice first.'
    }
  }

  if (
    ability.zones !== undefined &&
    (sourceZone === undefined ||
      !(ability.zones as readonly string[]).includes(sourceZone.kind))
  ) {
    return `This ability works only from ${ability.zones.join(' / ')}.`
  }

  if (ability.oncePerTurn === true && hasOncePerTurnFlag(state, context)) {
    return 'This ability was already used this turn.'
  }

  if (
    ability.condition !== undefined &&
    !evaluateCondition(state, context, {}, ability.condition)
  ) {
    return 'The ability condition is not met.'
  }

  return checkCostPayable(state, context)
}

function checkCostPayable(
  state: GameState,
  context: ScriptContext,
): string | undefined {
  const totals = new Map<string, number>()

  for (const step of context.compiled.ability.cost ?? []) {
    if (step.do === 'choose') {
      const eligible = listEligiblePieces(state, context, step, {})

      if (eligible.length < step.min) {
        return `Cost needs ${step.min} card(s) to choose but only ${eligible.length} are available.`
      }
    }

    if ('count' in step && typeof step.count === 'number') {
      totals.set(step.do, (totals.get(step.do) ?? 0) + step.count)
    }
  }

  const available: Record<string, number> = {
    counter_blast: zonePieces(state, context.controllerId, 'damage').filter(
      (pieceId) => isFaceUp(state, pieceId),
    ).length,
    soul_blast: zonePieces(state, context.controllerId, 'soul').length,
    energy_blast: readEnergy(state, context.controllerId),
  }

  for (const [kind, need] of totals) {
    const have = available[kind]

    if (have !== undefined && have < need) {
      return `Cannot pay ${kind.replace('_', ' ')} ${need} (have ${have}).`
    }
  }

  return undefined
}

function run(
  execution: Execution,
  startPc: number,
  resume: ResumeData | undefined,
): EffectHandlerResumeResult {
  const { program } = execution.context.compiled
  let pc = startPc
  let pendingResume = resume

  while (pc < program.length) {
    const instruction = program[pc]!
    const outcome = executeInstruction(execution, instruction, pendingResume)
    pendingResume = undefined

    if ('ok' in outcome) {
      return outcome
    }

    if (outcome.kind === 'pause') {
      return pause(execution, pc, outcome.request, outcome.frame)
    }

    pc = outcome.pc ?? pc + 1
  }

  return finish(execution)
}

function executeInstruction(
  execution: Execution,
  instruction: ScriptInstruction,
  resume: ResumeData | undefined,
): StepOutcome {
  const { state, context } = execution

  switch (instruction.op) {
    case 'jump':
      return { kind: 'next', pc: instruction.target }
    case 'branch':
      return evaluateCondition(state, context, execution.vars, instruction.cond)
        ? { kind: 'next' }
        : { kind: 'next', pc: instruction.elseTarget }
    case 'mark_once_per_turn':
      execution.state = upsertPieceStatus(state, context.sourcePieceId, {
        addFlags: [oncePerTurnFlag(context)],
      })
      return { kind: 'next' }
    case 'ask': {
      if (resume !== undefined) {
        const answer = readBoolean(resume.response)

        return answer.ok === false
          ? answer
          : answer.value
            ? { kind: 'next' }
            : { kind: 'next', pc: instruction.elseTarget }
      }

      return {
        kind: 'pause',
        request: {
          type: 'confirm.boolean',
          responderPlayerId: context.controllerId,
          purpose: 'effect',
          visibility: 'public',
          defaultAnswer: true,
          ...withPrompt(instruction.prompt, context),
        },
      }
    }
    case 'mode': {
      if (resume !== undefined) {
        const { response } = resume

        if (
          response.type !== 'answer.option' ||
          response.selectedOptionIds.length !== 1
        ) {
          return failure('invalid_response', 'Choose exactly one option.')
        }

        const index = instruction.options.findIndex(
          (option) => optionId(option.key) === response.selectedOptionIds[0],
        )

        return index < 0
          ? failure('invalid_response', 'Unknown option.')
          : { kind: 'next', pc: instruction.targets[index]! }
      }

      return {
        kind: 'pause',
        request: {
          type: 'choose.option',
          responderPlayerId: context.controllerId,
          purpose: 'effect',
          visibility: 'public',
          minSelections: 1,
          maxSelections: 1,
          options: instruction.options.map((option) => ({
            optionId: optionId(option.key),
            key: option.key,
            ...(option.label === undefined ? {} : { label: option.label }),
          })),
          ...withPrompt(instruction.prompt, context),
        },
      }
    }
    case 'step':
      return executeStep(execution, instruction.step, instruction.role, resume)
  }
}

function executeStep(
  execution: Execution,
  step: PrimitiveScriptStep,
  role: 'cost' | 'effect',
  resume: ResumeData | undefined,
): StepOutcome {
  const { context } = execution
  const self = context.controllerId

  switch (step.do) {
    case 'choose':
      return executeChoose(execution, step, role, resume)
    case 'move':
      return movePieces(
        execution,
        resolveTarget(execution, step.target).filter(
          (pieceId) =>
            zoneKindOf(execution.state, pieceId) !== 'vanguard_circle',
        ),
        step.to,
        moveReason(step.to),
      )
    case 'retire':
      return movePieces(
        execution,
        resolveTarget(execution, step.target).filter(
          (pieceId) =>
            zoneKindOf(execution.state, pieceId) === 'rear_guard_circle',
        ),
        'drop',
        'retire',
      )
    case 'call':
      return executeCall(
        execution,
        resolveTarget(execution, step.target),
        resume,
      )
    case 'stand':
    case 'rest':
      for (const pieceId of onBoard(execution, step.target)) {
        execution.state = upsertPieceStatus(execution.state, pieceId, {
          orientation: step.do,
        })
        pushEvent(execution, {
          type: step.do === 'stand' ? 'piece.stood' : 'piece.rested',
          pieceId,
          zoneId: zoneIdOf(execution.state, pieceId)!,
        } as Partial<GameEvent>)
      }
      return { kind: 'next' }
    case 'power':
    case 'critical':
      for (const pieceId of onBoard(execution, step.target)) {
        execution.state = upsertPieceStatus(execution.state, pieceId, {
          [step.do === 'power' ? 'powerDelta' : 'criticalDelta']: step.amount,
        })
      }
      return { kind: 'next' }
    case 'draw': {
      const playerId = resolvePlayer(context, step.player ?? 'self')

      return playerId === undefined
        ? { kind: 'next' }
        : moveTopOfDeck(execution, playerId, 'hand', step.count, 'draw')
    }
    case 'soul_charge':
      return moveTopOfDeck(execution, self, 'soul', step.count, 'soul_charge')
    case 'counter_blast':
    case 'counter_charge': {
      const blasting = step.do === 'counter_blast'
      const eligible = zonePieces(execution.state, self, 'damage').filter(
        (pieceId) => isFaceUp(execution.state, pieceId) === blasting,
      )

      return selectThen(execution, {
        eligible,
        count: step.count,
        exact: blasting,
        zoneKind: 'damage',
        prompt: `${blasting ? 'Counter Blast' : 'Counter Charge'} ${step.count}: choose damage cards.`,
        purpose: role,
        resume,
        apply: (pieceIds) => {
          for (const pieceId of pieceIds) {
            execution.state = upsertPieceStatus(
              execution.state,
              pieceId,
              blasting
                ? { addFlags: [FACE_DOWN_DAMAGE_FLAG] }
                : { removeFlags: [FACE_DOWN_DAMAGE_FLAG] },
            )
          }
          return { kind: 'next' }
        },
      })
    }
    case 'soul_blast':
      return selectThen(execution, {
        eligible: zonePieces(execution.state, self, 'soul'),
        count: step.count,
        exact: true,
        zoneKind: 'soul',
        prompt: `Soul Blast ${step.count}: choose cards from your soul.`,
        purpose: role,
        resume,
        apply: (pieceIds) =>
          movePieces(execution, pieceIds, 'drop', 'soul_blast'),
      })
    case 'energy_blast':
    case 'energy_charge': {
      const current = readEnergy(execution.state, self)

      if (step.do === 'energy_blast' && current < step.count) {
        return failure(
          'invalid_action',
          `Energy Blast ${step.count} needs ${step.count} energy (have ${current}).`,
        )
      }

      const next =
        step.do === 'energy_blast'
          ? current - step.count
          : Math.min(ENERGY_MAX, current + step.count)
      execution.state = writeEnergy(execution.state, self, next)
      return { kind: 'next' }
    }
    case 'look_top':
      execution.vars = {
        ...execution.vars,
        [step.as]: zonePieces(execution.state, self, 'deck').slice(
          0,
          step.count,
        ),
      }
      return { kind: 'next' }
    case 'exclude': {
      const minus = new Set(execution.vars[step.minus.slice(1)] ?? [])
      execution.vars = {
        ...execution.vars,
        [step.as]: (execution.vars[step.from.slice(1)] ?? []).filter(
          (pieceId) => !minus.has(pieceId),
        ),
      }
      return { kind: 'next' }
    }
    case 'shuffle': {
      const playerId = resolvePlayer(context, step.player ?? 'self')
      return playerId === undefined
        ? { kind: 'next' }
        : shuffleDeck(execution, playerId)
    }
  }
}

/** Fisher-Yates with the runtime's random source; emits `zone.shuffled`. */
function shuffleDeck(execution: Execution, playerId: PlayerId): StepOutcome {
  const deck = findOwnedZoneByKind(
    buildGameStateIndex(execution.state),
    playerId,
    'deck',
  )

  if (deck === undefined) {
    return failure(
      'invalid_action_reference',
      `Player ${playerId} has no deck to shuffle.`,
    )
  }

  const occupants = [...deck.occupants]

  for (let index = occupants.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(execution.random() * (index + 1))
    ;[occupants[index], occupants[swap]] = [occupants[swap]!, occupants[index]!]
  }

  execution.state = {
    ...execution.state,
    zones: execution.state.zones.map((zone) =>
      zone.zoneId === deck.zoneId ? { ...zone, occupants } : zone,
    ),
  }
  pushEvent(execution, {
    type: 'zone.shuffled',
    zoneId: deck.zoneId,
    orderedPieceIds: occupants.map((occupant) => occupant.pieceId),
  } as Partial<GameEvent>)

  return { kind: 'next' }
}

function executeChoose(
  execution: Execution,
  step: ChooseStep,
  role: 'cost' | 'effect',
  resume: ResumeData | undefined,
): StepOutcome {
  const eligible = listEligiblePieces(
    execution.state,
    execution.context,
    step,
    execution.vars,
  )

  if (role === 'cost' && eligible.length < step.min) {
    return failure(
      'invalid_action',
      `Cost needs ${step.min} card(s) to choose.`,
    )
  }

  // Effects do as much as possible: "choose 2" with 1 legal card chooses 1.
  const min = Math.min(step.min, eligible.length)
  const max = Math.min(step.max, eligible.length)

  if (resume !== undefined) {
    const selection = readSelection(resume, eligible, min, max)

    if (!selection.ok) {
      return selection
    }

    execution.vars = { ...execution.vars, [step.as]: selection.pieceIds }
    return { kind: 'next' }
  }

  if (max === 0) {
    execution.vars = { ...execution.vars, [step.as]: [] }
    return { kind: 'next' }
  }

  const chooser = resolvePlayer(execution.context, step.chooser ?? 'self')
  const index = buildGameStateIndex(execution.state)
  const zones =
    step.among === undefined
      ? selectorList(step).flatMap((selector) => {
          const zone = resolveZone(execution.state, execution.context, selector)
          return zone === undefined ? [] : [zone]
        })
      : Array.from(
          new Map(
            eligible.flatMap((pieceId) => {
              const zone = findPieceLocation(index, pieceId)?.zone
              return zone === undefined ? [] : [[zone.zoneId, zone] as const]
            }),
          ).values(),
        )

  return {
    kind: 'pause',
    request: {
      type: 'choose.pieces',
      responderPlayerId: chooser ?? execution.context.controllerId,
      purpose: role === 'cost' ? 'cost' : 'target',
      ...withPrompt(step.prompt, execution.context),
      visibility: zones.every((zone) => zone.visibility === 'public')
        ? 'public'
        : 'responder-only',
      minSelections: min,
      maxSelections: max,
      eligiblePieceIds: eligible,
      fromZoneIds: zones.map((zone) => zone.zoneId),
      allowPass: min === 0,
    },
  }
}

/** Calls each target to an open rear-guard circle, asking for the circle when there is a choice. */
function executeCall(
  execution: Execution,
  pieceIds: readonly PieceId[],
  resume: ResumeData | undefined,
): StepOutcome {
  let startIndex = resume?.frame?.callIndex ?? 0

  if (resume !== undefined) {
    const pieceId = pieceIds[startIndex]
    const rearGuard =
      pieceId === undefined
        ? undefined
        : ownerZone(execution.state, pieceId, 'rear_guard_circle')

    if (pieceId === undefined || rearGuard === undefined) {
      return failure(
        'invalid_response',
        'The card to call is no longer available.',
      )
    }

    if (
      resume.response.type !== 'answer.zone' ||
      resume.response.selectedLocations.length !== 1
    ) {
      return failure('invalid_response', 'Choose exactly one circle.')
    }

    const location = resume.response.selectedLocations[0]!

    if (
      location.zoneId !== rearGuard.zoneId ||
      location.slotId === undefined ||
      !openSlots(rearGuard).includes(location.slotId)
    ) {
      return failure('invalid_response', 'That circle is not available.')
    }

    const moved = transfer(execution, [
      callIntent(execution.state, pieceId, rearGuard.zoneId, location.slotId),
    ])

    if (moved !== undefined) {
      return moved
    }

    startIndex += 1
  }

  for (let index = startIndex; index < pieceIds.length; index += 1) {
    const pieceId = pieceIds[index]!
    const rearGuard = ownerZone(execution.state, pieceId, 'rear_guard_circle')
    const slots = rearGuard === undefined ? [] : openSlots(rearGuard)

    if (rearGuard === undefined || slots.length === 0) {
      break
    }

    if (slots.length > 1) {
      return {
        kind: 'pause',
        frame: { callIndex: index },
        request: {
          type: 'choose.zone',
          responderPlayerId: execution.context.controllerId,
          purpose: 'effect',
          visibility: 'public',
          minSelections: 1,
          maxSelections: 1,
          eligibleZones: [
            { zoneId: rearGuard.zoneId, availableSlotIds: slots },
          ],
          prompt: 'Choose a rear-guard circle for the called card.',
        },
      }
    }

    const moved = transfer(execution, [
      callIntent(execution.state, pieceId, rearGuard.zoneId, slots[0]!),
    ])

    if (moved !== undefined) {
      return moved
    }
  }

  return { kind: 'next' }
}

function callIntent(
  state: GameState,
  pieceId: PieceId,
  zoneId: ZoneId,
  slotId: ZoneSlotId,
): ZoneTransferIntent & { readonly call: true } {
  return {
    pieceId,
    from: { zoneId: zoneIdOf(state, pieceId)! },
    to: { zoneId, slotId },
    reason: 'call',
    call: true,
  }
}

/**
 * Shared shape for "pick N cards from a zone, then do something": asks only
 * when the player actually has a choice.
 */
function selectThen(
  execution: Execution,
  options: {
    readonly eligible: readonly PieceId[]
    readonly count: number
    readonly exact: boolean
    readonly zoneKind: string
    readonly prompt: string
    readonly purpose: 'cost' | 'effect'
    readonly resume: ResumeData | undefined
    readonly apply: (pieceIds: readonly PieceId[]) => StepOutcome
  },
): StepOutcome {
  const { eligible, count } = options

  if (options.exact && eligible.length < count) {
    return failure(
      'invalid_action',
      `Needs ${count} card(s) in ${options.zoneKind}, found ${eligible.length}.`,
    )
  }

  const take = Math.min(count, eligible.length)

  if (options.resume !== undefined) {
    const selection = readSelection(options.resume, eligible, take, take)
    return selection.ok ? options.apply(selection.pieceIds) : selection
  }

  if (take === eligible.length) {
    return options.apply(eligible.slice(0, take))
  }

  const zone = findOwnedZoneByKind(
    buildGameStateIndex(execution.state),
    execution.context.controllerId,
    options.zoneKind,
  )

  return {
    kind: 'pause',
    request: {
      type: 'choose.pieces',
      responderPlayerId: execution.context.controllerId,
      purpose: options.purpose,
      visibility: zone?.visibility === 'public' ? 'public' : 'responder-only',
      minSelections: take,
      maxSelections: take,
      eligiblePieceIds: eligible,
      ...(zone === undefined ? {} : { fromZoneIds: [zone.zoneId] }),
      allowPass: false,
      prompt: options.prompt,
    },
  }
}

function readSelection(
  resume: ResumeData,
  eligible: readonly PieceId[],
  min: number,
  max: number,
):
  | { readonly ok: true; readonly pieceIds: readonly PieceId[] }
  | ScriptFailure {
  const { response } = resume

  if (response.type === 'answer.pass') {
    return min === 0
      ? { ok: true, pieceIds: [] }
      : failure('invalid_response', `Choose at least ${min} card(s).`)
  }

  if (response.type !== 'answer.pieces') {
    return failure('invalid_response', 'Expected a card selection.')
  }

  const selected = response.selectedPieceIds
  const allowed = new Set(eligible)

  if (new Set(selected).size !== selected.length) {
    return failure('invalid_response', 'A card was selected twice.')
  }

  if (selected.some((pieceId) => !allowed.has(pieceId))) {
    return failure('invalid_response', 'A selected card is not a legal choice.')
  }

  if (selected.length < min || selected.length > max) {
    return failure(
      'invalid_response',
      min === max
        ? `Choose exactly ${min} card(s).`
        : `Choose between ${min} and ${max} card(s).`,
    )
  }

  return { ok: true, pieceIds: selected }
}

function readBoolean(
  response: GameChoiceResponse,
): { readonly ok: true; readonly value: boolean } | ScriptFailure {
  if (response.type === 'answer.boolean') {
    return { ok: true, value: response.accepted }
  }

  if (response.type === 'answer.pass') {
    return { ok: true, value: false }
  }

  return failure('invalid_response', 'Expected a yes/no answer.')
}

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

function movePieces(
  execution: Execution,
  pieceIds: readonly PieceId[],
  destination: ScriptZone | 'deck_top' | 'deck_bottom',
  reason: ZoneTransferReason,
): StepOutcome {
  const intents: ZoneTransferIntent[] = []

  for (const pieceId of pieceIds) {
    const zoneKind =
      destination === 'deck_top' || destination === 'deck_bottom'
        ? 'deck'
        : destination
    const to = ownerZone(execution.state, pieceId, zoneKind)
    const fromZoneId = zoneIdOf(execution.state, pieceId)

    if (
      to === undefined ||
      fromZoneId === undefined ||
      fromZoneId === to.zoneId
    ) {
      continue
    }

    intents.push({
      pieceId,
      from: { zoneId: fromZoneId },
      to:
        destination === 'deck_top'
          ? { zoneId: to.zoneId, position: 0 }
          : { zoneId: to.zoneId },
      reason,
    })
  }

  return transfer(execution, intents) ?? { kind: 'next' }
}

function moveTopOfDeck(
  execution: Execution,
  playerId: PlayerId,
  destination: string,
  count: number,
  reason: ZoneTransferReason,
): StepOutcome {
  const index = buildGameStateIndex(execution.state)
  const deck = findOwnedZoneByKind(index, playerId, 'deck')
  const to = findOwnedZoneByKind(index, playerId, destination)

  if (deck === undefined || to === undefined) {
    return failure(
      'invalid_action_reference',
      `Player ${playerId} has no deck/${destination} zone.`,
    )
  }

  const intents = deck.occupants.slice(0, count).map((occupant) => ({
    pieceId: occupant.pieceId,
    from: { zoneId: deck.zoneId },
    to: { zoneId: to.zoneId },
    reason,
  }))

  return transfer(execution, intents) ?? { kind: 'next' }
}

/** Applies transfers, emitting `piece.moved` (+ `card.called` for calls). Returns a failure or undefined. */
function transfer(
  execution: Execution,
  intents: readonly (ZoneTransferIntent & { readonly call?: true })[],
): ScriptFailure | undefined {
  if (intents.length === 0) {
    return undefined
  }

  const result = resolveZoneTransferSequence(
    execution.state,
    intents.map(({ pieceId, from, to, reason }) => ({
      pieceId,
      from,
      to,
      reason,
    })),
  )

  if (!result.ok) {
    return failure(
      result.code === 'invalid_action_reference'
        ? 'invalid_action_reference'
        : 'invalid_action',
      result.message,
    )
  }

  const calledIds = new Set(
    intents.filter((intent) => intent.call).map((intent) => intent.pieceId),
  )

  execution.state = {
    ...execution.state,
    zones: result.zones,
    pieceStates: result.pieceStates,
    pieces: execution.state.pieces.map((piece) =>
      calledIds.has(piece.pieceId)
        ? {
            ...piece,
            controllerPlayerId:
              piece.ownerPlayerId ?? execution.context.controllerId,
          }
        : piece,
    ),
  }

  const moved = createPieceMovedEvents(
    execution.transitionId,
    result.transfers,
    { kind: 'system', system: SCRIPT_EVENT_SYSTEM },
    {
      ...(execution.context.sourceActionId === undefined
        ? {}
        : { sourceActionId: execution.context.sourceActionId }),
      startingSequence: execution.nextSequence,
    },
  )
  execution.events.push(...moved)
  execution.nextSequence += moved.length

  for (const record of result.transfers) {
    if (!calledIds.has(record.pieceId)) {
      continue
    }

    // Lets "when placed on (RC)" AUTO abilities of the called card trigger.
    const sequence = pushEvent(execution, {
      type: 'card.called',
      pieceId: record.pieceId,
      from: record.from,
      to: record.to,
    } as Partial<GameEvent>)
    const windows = createTransitionTimingWindowTriplet('card.call', {
      startingSequence: execution.nextTimingWindowSequence,
      relatedEventSequence: sequence,
      pieceId: record.pieceId,
    })
    execution.timingWindows.push(...windows)
    execution.nextTimingWindowSequence += windows.length
  }

  return undefined
}

function moveReason(destination: string): ZoneTransferReason {
  switch (destination) {
    case 'bind':
      return 'bind'
    case 'soul':
      return 'soul'
    case 'hand':
      return 'bounce'
    default:
      return 'generic'
  }
}

// ---------------------------------------------------------------------------
// Pause / finish
// ---------------------------------------------------------------------------

function pause(
  execution: Execution,
  pc: number,
  draft: PendingRequestDraft,
  frame: Readonly<Record<string, number>> | undefined,
): EffectHandlerResumeResult {
  const { context, transitionId } = execution
  const requestId = `${transitionId}:script-request:${pc}` as RequestId
  const continuationId =
    `${transitionId}:script-continuation:${pc}` as EffectContinuationId
  const sourceActionId =
    context.sourceActionId ?? (transitionId as unknown as ActionId)
  const relatedPieceIds =
    'eligiblePieceIds' in draft
      ? Array.from(new Set([context.sourcePieceId, ...draft.eligiblePieceIds]))
      : [context.sourcePieceId]
  const request = {
    ...draft,
    requestId,
    context: {
      sourceActionId,
      effectContinuationId: continuationId,
      relatedPieceIds,
    },
  } as GameChoiceRequest
  const script: ScriptContinuationState = {
    handlerKey: CARD_SCRIPT_HANDLER_KEY,
    pc,
    vars: execution.vars,
    ...(frame === undefined ? {} : { frame }),
    ...(context.triggerEventSequence === undefined
      ? {}
      : { triggerEventSequence: context.triggerEventSequence }),
  }
  const continuation: EffectContinuationState = {
    continuationId,
    requestId,
    sourceActionId,
    sourcePieceId: context.sourcePieceId,
    effectDefinitionId: context.compiled.definition.id,
    actorPlayerId: context.controllerId,
    operationIndex: pc,
    operationKinds: SCRIPT_OPERATION_KINDS,
    script,
  }

  return {
    ok: true,
    state: {
      ...execution.state,
      status: 'awaiting_choice',
      pendingRequests: [request, ...execution.state.pendingRequests],
      effectContinuations: [
        ...(execution.state.effectContinuations ?? []),
        continuation,
      ],
    },
    events: execution.events,
    timingWindows: execution.timingWindows,
  }
}

function finish(execution: Execution): EffectHandlerResumeResult {
  const { context } = execution
  const sequence = execution.nextSequence

  execution.events.push({
    eventId: `${execution.transitionId}:event:${sequence}` as EventId,
    type: 'effect.resolved',
    sequence,
    ...(context.sourceActionId === undefined
      ? {}
      : { sourceActionId: context.sourceActionId }),
    origin: { kind: 'system', system: SCRIPT_EVENT_SYSTEM },
    effectDefinitionId: context.compiled.definition.id,
    sourcePieceId: context.sourcePieceId,
    ...(context.triggerEventSequence === undefined
      ? {}
      : { triggerEventSequence: context.triggerEventSequence }),
    operationKinds: SCRIPT_OPERATION_KINDS,
  })

  const { state } = execution

  return {
    ok: true,
    state:
      state.status === 'completed'
        ? state
        : {
            ...state,
            status:
              state.pendingRequests.length > 0
                ? 'awaiting_choice'
                : 'in_progress',
          },
    events: execution.events,
    timingWindows: execution.timingWindows,
  }
}

function pushEvent(execution: Execution, fields: Partial<GameEvent>): number {
  const sequence = execution.nextSequence

  execution.events.push({
    eventId: `${execution.transitionId}:event:${sequence}` as EventId,
    sequence,
    ...(execution.context.sourceActionId === undefined
      ? {}
      : { sourceActionId: execution.context.sourceActionId }),
    origin: { kind: 'system', system: SCRIPT_EVENT_SYSTEM },
    ...fields,
  } as GameEvent)
  execution.nextSequence += 1

  return sequence
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

function evaluateCondition(
  state: GameState,
  context: QueryContext,
  vars: Readonly<Record<string, readonly PieceId[]>>,
  condition: ScriptCondition,
): boolean {
  if ('all' in condition) {
    return condition.all.every((child) =>
      evaluateCondition(state, context, vars, child),
    )
  }

  if ('any' in condition) {
    return condition.any.some((child) =>
      evaluateCondition(state, context, vars, child),
    )
  }

  if ('not' in condition) {
    return !evaluateCondition(state, context, vars, condition.not)
  }

  if ('count' in condition) {
    const { filter, ...selector } = condition.count
    const pieces = zonePiecesBySelector(state, context, selector).filter(
      (pieceId) => matchesFilter(state, context, pieceId, filter),
    )
    return compare(pieces.length, condition)
  }

  if ('chosen' in condition) {
    return compare((vars[condition.chosen] ?? []).length, condition)
  }

  if ('turn' in condition) {
    return resolvePlayer(context, condition.turn) === state.turn.turnPlayerId
  }

  if ('phase' in condition) {
    return state.turn.phase === condition.phase
  }

  const kind = zoneKindOf(state, context.sourcePieceId)
  return (
    kind !== undefined &&
    (condition.sourceIn as readonly string[]).includes(kind)
  )
}

function compare(value: number, comparison: NumberComparison): boolean {
  return (
    (comparison.eq === undefined || value === comparison.eq) &&
    (comparison.gte === undefined || value >= comparison.gte) &&
    (comparison.lte === undefined || value <= comparison.lte) &&
    (comparison.gt === undefined || value > comparison.gt) &&
    (comparison.lt === undefined || value < comparison.lt)
  )
}

function listEligiblePieces(
  state: GameState,
  context: QueryContext,
  step: ChooseStep,
  vars: Readonly<Record<string, readonly PieceId[]>>,
): readonly PieceId[] {
  const pool =
    step.among === undefined
      ? selectorList(step).flatMap((selector) =>
          zonePiecesBySelector(state, context, selector),
        )
      : (vars[step.among.slice(1)] ?? []).filter(
          (pieceId) => zoneIdOf(state, pieceId) !== undefined,
        )

  return pool.filter((pieceId) =>
    matchesFilter(state, context, pieceId, step.filter),
  )
}

function selectorList(step: ChooseStep): readonly ScriptZoneSelector[] {
  if (step.from === undefined) {
    return []
  }

  return Array.isArray(step.from)
    ? (step.from as readonly ScriptZoneSelector[])
    : [step.from as ScriptZoneSelector]
}

function matchesFilter(
  state: GameState,
  context: QueryContext,
  pieceId: PieceId,
  filter: ScriptCardFilter | undefined,
): boolean {
  if (filter === undefined) {
    return true
  }

  if (filter.excludeSource === true && pieceId === context.sourcePieceId) {
    return false
  }

  const status = state.pieceStates.find(
    (pieceState) => pieceState.pieceId === pieceId,
  )

  if (
    filter.orientation !== undefined &&
    (status?.orientation ?? 'stand') !== filter.orientation
  ) {
    return false
  }

  if (
    filter.faceUp !== undefined &&
    isFaceUp(state, pieceId) !== filter.faceUp
  ) {
    return false
  }

  const needsStats =
    filter.grade !== undefined ||
    filter.power !== undefined ||
    filter.cardType !== undefined ||
    filter.triggerType !== undefined

  if (!needsStats) {
    return true
  }

  const piece = state.pieces.find((candidate) => candidate.pieceId === pieceId)
  const stats =
    piece === undefined ? undefined : resolveGamePieceCardStats(state, piece)

  if (stats === undefined || !stats.ok) {
    return false
  }

  return (
    (filter.grade === undefined ||
      compare(Number(stats.stats.grade), filter.grade)) &&
    (filter.power === undefined ||
      compare(
        stats.stats.power +
          (status?.powerModifier ?? 0) +
          (status?.continuousPowerModifier ?? 0),
        filter.power,
      )) &&
    (filter.cardType === undefined ||
      filter.cardType.includes(stats.stats.cardType)) &&
    (filter.triggerType === undefined ||
      filter.triggerType.includes(stats.stats.triggerType))
  )
}

function resolveTarget(
  execution: Execution,
  target: ScriptTargetRef,
): readonly PieceId[] {
  return resolveTargetIn(
    execution.state,
    execution.context,
    execution.vars,
    target,
  )
}

function resolveTargetIn(
  state: GameState,
  context: QueryContext,
  vars: Readonly<Record<string, readonly PieceId[]>>,
  target: ScriptTargetRef,
): readonly PieceId[] {
  if (typeof target === 'object') {
    const { filter, ...selector } = target
    return zonePiecesBySelector(state, context, selector).filter((pieceId) =>
      matchesFilter(state, context, pieceId, filter),
    )
  }

  switch (target) {
    case 'source':
      return [context.sourcePieceId]
    case 'my_vanguard':
      return zonePieces(state, context.controllerId, 'vanguard_circle').slice(
        0,
        1,
      )
    case 'opponent_vanguard':
      return context.opponentId === undefined
        ? []
        : zonePieces(state, context.opponentId, 'vanguard_circle').slice(0, 1)
    default: {
      const ids = vars[target.slice(1)] ?? []
      return ids.filter((pieceId) => zoneIdOf(state, pieceId) !== undefined)
    }
  }
}

function onBoard(
  execution: Execution,
  target: ScriptTargetRef,
): readonly PieceId[] {
  return resolveTarget(execution, target).filter((pieceId) =>
    isOnBoard(execution.state, pieceId),
  )
}

function isOnBoard(state: GameState, pieceId: PieceId): boolean {
  const kind = zoneKindOf(state, pieceId)
  return kind !== undefined && BOARD_ZONES.includes(kind)
}

/** Pieces the triggering event is about (ride/call/attack/boost/guard). */
function subjectsOfEvent(event: GameEvent): readonly PieceId[] {
  switch (event.type) {
    case 'card.rode':
    case 'card.called':
      return [event.pieceId]
    case 'battle.attack_declared':
      return [event.attackerPieceId]
    case 'battle.boost_declared':
      return [event.boosterPieceId]
    case 'battle.guard_declared':
      return event.guardianPieceIds
    default:
      return []
  }
}

/**
 * For an AUTO ability, the event subjects it reacts to (bound as `$trigger`),
 * or undefined when the event is not one this ability watches.
 */
function resolveTriggerSubjects(
  state: GameState,
  context: ScriptContext,
  event: GameEvent,
): readonly PieceId[] | undefined {
  const { ability } = context.compiled
  const subjects = subjectsOfEvent(event)
  const subjectKind = ability.subject ?? 'this'

  if (subjectKind === 'this') {
    return subjects.includes(context.sourcePieceId)
      ? [context.sourcePieceId]
      : undefined
  }

  const matching = subjects.filter(
    (pieceId) =>
      (subjectKind === 'any' || pieceId !== context.sourcePieceId) &&
      matchesSubjectFilter(state, context, pieceId, ability.subjectFilter),
  )

  return matching.length === 0 ? undefined : matching
}

function matchesSubjectFilter(
  state: GameState,
  context: QueryContext,
  pieceId: PieceId,
  filter: ScriptSubjectFilter | undefined,
): boolean {
  if (filter === undefined) {
    return true
  }

  if (filter.player !== undefined) {
    const piece = state.pieces.find(
      (candidate) => candidate.pieceId === pieceId,
    )
    const controller = piece?.controllerPlayerId ?? piece?.ownerPlayerId

    if (controller !== resolvePlayer(context, filter.player)) {
      return false
    }
  }

  if (filter.zones !== undefined) {
    const kind = zoneKindOf(state, pieceId)

    if (
      kind === undefined ||
      !(filter.zones as readonly string[]).includes(kind)
    ) {
      return false
    }
  }

  return matchesFilter(state, context, pieceId, filter.filter)
}

function resolvePlayer(
  context: QueryContext,
  player: ScriptPlayer,
): PlayerId | undefined {
  return player === 'self' ? context.controllerId : context.opponentId
}

function resolveZone(
  state: GameState,
  context: QueryContext,
  selector: ScriptZoneSelector,
): ZoneState | undefined {
  const playerId = resolvePlayer(context, selector.player)

  return playerId === undefined
    ? undefined
    : findOwnedZoneByKind(buildGameStateIndex(state), playerId, selector.zone)
}

function zonePiecesBySelector(
  state: GameState,
  context: QueryContext,
  selector: ScriptZoneSelector,
): readonly PieceId[] {
  return (
    resolveZone(state, context, selector)?.occupants.map(
      (occupant) => occupant.pieceId,
    ) ?? []
  )
}

function zonePieces(
  state: GameState,
  playerId: PlayerId,
  kind: string,
): readonly PieceId[] {
  return (
    findOwnedZoneByKind(
      buildGameStateIndex(state),
      playerId,
      kind,
    )?.occupants.map((occupant) => occupant.pieceId) ?? []
  )
}

function ownerZone(
  state: GameState,
  pieceId: PieceId,
  kind: string,
): ZoneState | undefined {
  const index = buildGameStateIndex(state)
  const piece: GamePieceState | undefined = findPieceById(index, pieceId)
  const ownerId = piece?.ownerPlayerId

  return ownerId === undefined
    ? undefined
    : findOwnedZoneByKind(index, ownerId, kind)
}

function zoneIdOf(state: GameState, pieceId: PieceId): ZoneId | undefined {
  return findPieceLocation(buildGameStateIndex(state), pieceId)?.zone.zoneId
}

function zoneKindOf(state: GameState, pieceId: PieceId): string | undefined {
  return findPieceLocation(buildGameStateIndex(state), pieceId)?.zone.kind
}

function openSlots(zone: ZoneState): readonly ZoneSlotId[] {
  const occupied = new Set(zone.occupants.map((occupant) => occupant.slotId))
  return (zone.layout.slotIds ?? []).filter((slotId) => !occupied.has(slotId))
}

function isFaceUp(state: GameState, pieceId: PieceId): boolean {
  return !(
    state.pieceStates
      .find((pieceState) => pieceState.pieceId === pieceId)
      ?.flags.includes(FACE_DOWN_DAMAGE_FLAG) ?? false
  )
}

function readEnergy(state: GameState, playerId: PlayerId): number {
  return (
    state.players
      .find((player) => player.playerId === playerId)
      ?.counters.find((counter) => counter.key === ENERGY_COUNTER_KEY)
      ?.amount ?? 0
  )
}

function writeEnergy(
  state: GameState,
  playerId: PlayerId,
  amount: number,
): GameState {
  return {
    ...state,
    players: state.players.map((player) => {
      if (player.playerId !== playerId) {
        return player
      }

      const exists = player.counters.some(
        (counter) => counter.key === ENERGY_COUNTER_KEY,
      )

      return {
        ...player,
        counters: exists
          ? player.counters.map((counter) =>
              counter.key === ENERGY_COUNTER_KEY
                ? { ...counter, amount }
                : counter,
            )
          : [
              ...player.counters,
              { key: ENERGY_COUNTER_KEY, amount, visibility: 'public' },
            ],
      }
    }),
  }
}

function oncePerTurnFlag(
  context: ScriptContext,
): GamePieceStatusState['flags'][number] {
  return `${ONCE_PER_TURN_FLAG_PREFIX}${context.compiled.ability.id}`
}

function hasOncePerTurnFlag(state: GameState, context: ScriptContext): boolean {
  return (
    state.pieceStates
      .find((pieceState) => pieceState.pieceId === context.sourcePieceId)
      ?.flags.includes(oncePerTurnFlag(context)) ?? false
  )
}

function upsertPieceStatus(
  state: GameState,
  pieceId: PieceId,
  patch: {
    readonly orientation?: GamePieceStatusState['orientation']
    readonly addFlags?: readonly string[]
    readonly removeFlags?: readonly string[]
    readonly powerDelta?: number
    readonly criticalDelta?: number
  },
): GameState {
  const current = state.pieceStates.find(
    (pieceState) => pieceState.pieceId === pieceId,
  ) ?? {
    pieceId,
    orientation: 'stand' as const,
    flags: [],
  }
  const remove = new Set(patch.removeFlags ?? [])
  const power = (current.powerModifier ?? 0) + (patch.powerDelta ?? 0)
  const critical = (current.criticalModifier ?? 0) + (patch.criticalDelta ?? 0)
  const next: GamePieceStatusState = {
    pieceId,
    orientation: patch.orientation ?? current.orientation,
    flags: Array.from(
      new Set([...current.flags, ...(patch.addFlags ?? [])]),
    ).filter((flag) => !remove.has(flag)),
    ...(power === 0 ? {} : { powerModifier: power }),
    ...(critical === 0 ? {} : { criticalModifier: critical }),
  }
  const exists = state.pieceStates.some(
    (pieceState) => pieceState.pieceId === pieceId,
  )

  return {
    ...state,
    pieceStates: exists
      ? state.pieceStates.map((pieceState) =>
          pieceState.pieceId === pieceId ? next : pieceState,
        )
      : [...state.pieceStates, next],
  }
}

/** Request text: the step's own prompt, else the ability's rules text. */
function withPrompt(
  prompt: string | undefined,
  context: ScriptContext,
): { readonly prompt?: string } {
  const text = prompt ?? context.compiled.ability.text
  return text === undefined ? {} : { prompt: text }
}

function optionId(key: string): RequestOptionId {
  return `option:${key}` as RequestOptionId
}

function failure(code: ScriptFailure['code'], message: string): ScriptFailure {
  return { ok: false, code, message }
}

function handlerFailure(
  code: 'invalid_action' | 'invalid_action_reference',
  message: string,
): EffectHandlerResult {
  return { ok: false, code, message }
}
