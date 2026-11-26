import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type {
  ActionId,
  GameChoiceRequest,
  GameChoiceResponse,
  GameState,
  PieceId,
  PlayerId,
  TransitionResult,
  ZoneId,
  ZoneSlotId,
} from '../index'
import {
  applyGameAction,
  applyGameChoiceResponse,
  buildEngineCardStatsSnapshot,
  CardScriptLoadError,
  createCardScriptRuntime,
  FACE_DOWN_DAMAGE_FLAG,
  resolveCombatPieceModifiers,
  resolveNextMandatoryBattleAction,
  validateCardScript,
} from '../index'

import { TEST_CARD_SCRIPTS } from './examples/test-cards'

const P1 = 'p1' as PlayerId
const P2 = 'p2' as PlayerId

const piece = (id: string) => id as PieceId
const zone = (player: PlayerId, kind: string) => `${player}-${kind}` as ZoneId
/** Board slots need front/back + left/center/right in their id. */
const SLOT_NAMES: Readonly<Record<string, string>> = {
  left: 'front-left',
  right: 'front-right',
  back: 'back-center',
}
const slot = (player: PlayerId, name: string) =>
  `${player}-rc-${SLOT_NAMES[name] ?? name}` as ZoneSlotId

const SOVEREIGN = piece('p1-sovereign')
const SQUIRE = piece('p1-squire')
const ADEPT = piece('p1-adept')
const SPRITE = piece('p1-sprite')
const HEAVY = piece('p1-heavy')
const SOUL_CARD = piece('p1-soul-1')
const DAMAGE = [piece('p1-dmg-1'), piece('p1-dmg-2'), piece('p1-dmg-3')]
const DECK = [piece('p1-deck-1'), piece('p1-deck-2'), piece('p1-deck-3')]
const FOE_VANGUARD = piece('p2-vanguard')
const FOE_REAR = piece('p2-rear')
const FOE_DECK = piece('p2-deck-1')

/** Deterministic random source so shuffles are reproducible in tests. */
function seededRandom(seed: number): () => number {
  let value = seed

  return () => {
    value = (value * 1103515245 + 12345) % 2 ** 31
    return value / 2 ** 31
  }
}

const runtime = createCardScriptRuntime(TEST_CARD_SCRIPTS, {
  random: seededRandom(42),
})

describe('card script validation', () => {
  it('accepts the bundled example scripts', () => {
    for (const script of TEST_CARD_SCRIPTS) {
      expect(validateCardScript(script)).toMatchObject({ ok: true })
    }
  })

  it('reports every authoring mistake with a JSON path', () => {
    const result = validateCardScript({
      format: 'vg-card-script/1',
      cardId: 'broken',
      abilities: [
        {
          id: 'Bad Id',
          type: 'AUTO',
          on: 'call',
          cost: [{ do: 'counter_blast', count: 1 }],
          effect: [
            { do: 'teleport' },
            { do: 'retire', target: '$never_chosen' },
            {
              do: 'choose',
              as: 'x',
              from: { player: 'self', zone: 'moon' },
              min: 2,
              max: 1,
            },
          ],
        },
      ],
    })

    expect(result.ok).toBe(false)
    expect(result.ok ? [] : result.issues.map((issue) => issue.path)).toEqual([
      'abilities[0].id',
      'abilities[0].optional',
      'abilities[0].effect[0].do',
      'abilities[0].effect[1].target',
      'abilities[0].effect[2].from.zone',
      'abilities[0].effect[2]',
    ])
  })

  it('refuses to build a runtime from invalid scripts', () => {
    expect(() =>
      createCardScriptRuntime([
        { format: 'vg-card-script/1', cardId: 'x', abilities: [] },
      ]),
    ).toThrow(CardScriptLoadError)
  })
})

describe('AUTO ability with optional cost (Ember Squire)', () => {
  it('asks, lets the player pick which damage to flip, rejects illegal picks, then draws', () => {
    const called = act(baseState(), callFromHand(SQUIRE, 'left'))

    // The call itself happened; the AUTO paused on "use it?".
    expect(zoneOf(called, SQUIRE)).toBe(zone(P1, 'rear_guard_circle'))
    expect(called.status).toBe('awaiting_choice')
    expect(called.pendingRequests[0]).toMatchObject({
      type: 'confirm.boolean',
      responderPlayerId: P1,
    })

    const accepted = answer(called, { type: 'answer.boolean', accepted: true })
    const costRequest = accepted.pendingRequests[0]!

    expect(costRequest).toMatchObject({
      type: 'choose.pieces',
      purpose: 'cost',
      minSelections: 1,
      maxSelections: 1,
      eligiblePieceIds: DAMAGE,
    })

    // A card that is not a legal choice is rejected and the request stays.
    const illegal = respond(accepted, {
      type: 'answer.pieces',
      selectedPieceIds: [SOVEREIGN],
    })
    expect(illegal.status).toBe('invalid')
    expect(illegal.status === 'invalid' ? illegal.code : '').toMatch(
      /^(invalid_response|request_response_mismatch)$/,
    )
    expect(accepted.pendingRequests[0]).toBe(costRequest)

    const paid = answer(accepted, {
      type: 'answer.pieces',
      selectedPieceIds: [DAMAGE[1]!],
    })

    expect(paid.status).toBe('in_progress')
    expect(paid.pendingRequests).toEqual([])
    expect(isFaceDown(paid, DAMAGE[1]!)).toBe(true)
    expect(isFaceDown(paid, DAMAGE[0]!)).toBe(false)
    expect(zoneOf(paid, DECK[0]!)).toBe(zone(P1, 'hand'))
  })

  it('does nothing when the player declines', () => {
    const called = act(baseState(), callFromHand(SQUIRE, 'left'))
    const declined = answer(called, { type: 'answer.boolean', accepted: false })

    expect(declined.status).toBe('in_progress')
    expect(DAMAGE.some((id) => isFaceDown(declined, id))).toBe(false)
    expect(zoneOf(declined, DECK[0]!)).toBe(zone(P1, 'deck'))
  })
})

describe('ACT ability with nested AUTO (Tide Adept -> Glimmer Sprite)', () => {
  it('pays the cost, pauses for target and circle, survives JSON persistence, and triggers the called card', () => {
    const state = baseState({ adeptOnBoard: true })

    expect(
      runtime
        .listActivatableAbilities(state, P1)
        .map((ability) => ability.abilityId),
    ).toEqual(['drop-call'])

    const activated = act(state, activate(ADEPT, 'test-tide-adept'))

    // Soul Blast 1 with exactly one soul card is automatic; then target choice.
    expect(zoneOf(activated, SOUL_CARD)).toBe(zone(P1, 'drop'))
    expect(activated.pendingRequests[0]).toMatchObject({
      type: 'choose.pieces',
      minSelections: 0,
      maxSelections: 1,
      // Grade 3 card and the soul-blasted grade 3 card are filtered out.
      eligiblePieceIds: [SPRITE],
    })

    // Persist and reload between requests, like the match server does.
    const reloaded = JSON.parse(JSON.stringify(activated)) as GameState
    const targeted = answer(reloaded, {
      type: 'answer.pieces',
      selectedPieceIds: [SPRITE],
    })

    expect(targeted.pendingRequests[0]).toMatchObject({
      type: 'choose.zone',
      eligibleZones: [
        {
          zoneId: zone(P1, 'rear_guard_circle'),
          availableSlotIds: [slot(P1, 'right'), slot(P1, 'back')],
        },
      ],
    })

    const placed = answer(targeted, {
      type: 'answer.zone',
      selectedLocations: [
        { zoneId: zone(P1, 'rear_guard_circle'), slotId: slot(P1, 'back') },
      ],
    })

    expect(placed.status).toBe('in_progress')
    expect(slotOf(placed, SPRITE)).toBe(slot(P1, 'back'))
    // Glimmer Sprite's own "when placed" AUTO resolved from the script call.
    expect(powerModifier(placed, SPRITE)).toBe(5000)

    // [1/Turn]: the second activation is refused and no longer listed.
    expect(runtime.listActivatableAbilities(placed, P1)).toEqual([])
    const again = respondAction(placed, activate(ADEPT, 'test-tide-adept'))
    expect(again.status).toBe('invalid')
  })

  it('refuses to start when the cost cannot be paid', () => {
    const state = baseState({ adeptOnBoard: true, soul: [] })
    const result = respondAction(state, activate(ADEPT, 'test-tide-adept'))

    expect(result.status).toBe('invalid')
    expect(result.status === 'invalid' ? result.message : '').toMatch(
      /soul blast 1/i,
    )
    expect(runtime.listActivatableAbilities(state, P1)).toEqual([])
  })
})

describe('AUTO ability with condition and modes (Gale Sovereign)', () => {
  it('offers two modes on attack and lets the attacker retire a chosen rear-guard', () => {
    const attacked = act(battleState(), declareAttack())

    expect(attacked.pendingRequests[0]).toMatchObject({
      type: 'choose.option',
      options: [{ key: 'power' }, { key: 'retire' }],
    })

    const request = attacked.pendingRequests[0] as Extract<
      GameChoiceRequest,
      { type: 'choose.option' }
    >
    const retireMode = request.options.find(
      (option) => option.key === 'retire',
    )!
    const chosenMode = answer(attacked, {
      type: 'answer.option',
      selectedOptionIds: [retireMode.optionId],
    })

    expect(chosenMode.pendingRequests[0]).toMatchObject({
      type: 'choose.pieces',
      responderPlayerId: P1,
      eligiblePieceIds: [FOE_REAR],
    })

    const retired = answer(chosenMode, {
      type: 'answer.pieces',
      selectedPieceIds: [FOE_REAR],
    })

    expect(zoneOf(retired, FOE_REAR)).toBe(zone(P2, 'drop'))
  })

  it('does not trigger below three damage', () => {
    const attacked = act(
      battleState({ damage: DAMAGE.slice(0, 2) }),
      declareAttack(),
    )

    expect(
      attacked.pendingRequests.some(
        (request) => request.type === 'choose.option',
      ),
    ).toBe(false)
  })

  it('carries mode labels and the ability text to the client', () => {
    const attacked = act(battleState(), declareAttack())

    expect(attacked.pendingRequests[0]).toMatchObject({
      prompt: expect.stringContaining('When this unit attacks') as unknown,
      options: [
        { key: 'power', label: '+10000 power' },
        { key: 'retire', label: 'Retire a rear-guard' },
      ],
    })
  })
})

describe('one event, several AUTO abilities (pending trigger queue)', () => {
  it('resolves the second ability after the first finishes, even across persistence', () => {
    const HERALD = piece('p1-herald')
    let state = act(
      baseState({ rearGuards: [[HERALD, 'test-banner-herald', 'right']] }),
      callFromHand(SQUIRE, 'left'),
    )

    // Ember Squire (own call) and Banner Herald (watching an ally's call)
    // both trigger. One asks now; the other waits in the state.
    expect(state.pendingRequests).toHaveLength(1)
    expect(state.pendingTriggers).toHaveLength(1)

    const prompts: string[] = []

    for (
      let guard = 0;
      state.pendingRequests.length > 0 && guard < 10;
      guard += 1
    ) {
      const request = state.pendingRequests[0]!
      prompts.push(request.prompt ?? '')
      state = JSON.parse(JSON.stringify(state)) as GameState

      state =
        request.type === 'confirm.boolean'
          ? answer(state, { type: 'answer.boolean', accepted: true })
          : answer(state, {
              type: 'answer.pieces',
              selectedPieceIds: [
                (
                  request as Extract<
                    GameChoiceRequest,
                    { type: 'choose.pieces' }
                  >
                ).eligiblePieceIds[0]!,
              ],
            })
    }

    expect(
      prompts.filter((prompt) => prompt.startsWith('[AUTO]')),
    ).toHaveLength(2)
    expect(state.status).toBe('in_progress')
    expect(state.pendingTriggers ?? []).toEqual([])
    // Ember Squire paid and drew; Banner Herald powered the called unit.
    expect(zoneOf(state, DECK[0]!)).toBe(zone(P1, 'hand'))
    expect(powerModifier(state, SQUIRE)).toBe(2000)
    // The herald does not react to its own placement.
    expect(powerModifier(state, HERALD)).toBe(0)
  })
})

describe('deck manipulation', () => {
  it('looks at the top cards, takes one, and puts the rest on the bottom', () => {
    const ORACLE = piece('p1-oracle')
    const state = baseState({
      rearGuards: [[ORACLE, 'test-oracle-seeker', 'right']],
    })
    const activated = act(state, activate(ORACLE, 'test-oracle-seeker'))

    expect(activated.pendingRequests[0]).toMatchObject({
      type: 'choose.pieces',
      visibility: 'responder-only',
      minSelections: 0,
      maxSelections: 1,
      eligiblePieceIds: DECK,
    })

    const done = answer(activated, {
      type: 'answer.pieces',
      selectedPieceIds: [DECK[1]!],
    })

    expect(zoneOf(done, DECK[1]!)).toBe(zone(P1, 'hand'))
    expect(zonePieceIds(done, zone(P1, 'deck'))).toEqual([DECK[0], DECK[2]])
  })

  it('searches the deck with a filter and shuffles with the runtime random source', () => {
    const SCOUT = piece('p1-scout')
    const called = act(
      baseState({ hand: [[SCOUT, 'test-dawn-scout']] }),
      callFromHand(SCOUT, 'right'),
    )

    // Only the grade 0 card is a legal search result.
    expect(called.pendingRequests[0]).toMatchObject({
      type: 'choose.pieces',
      eligiblePieceIds: [DECK[0]],
      visibility: 'responder-only',
    })

    const result = respond(called, {
      type: 'answer.pieces',
      selectedPieceIds: [DECK[0]!],
    })

    expect(result.status).toBe('applied')

    if (result.status !== 'applied') {
      return
    }

    expect(zoneOf(result.nextState, DECK[0]!)).toBe(zone(P1, 'hand'))
    expect(
      [...zonePieceIds(result.nextState, zone(P1, 'deck'))].sort(),
    ).toEqual([DECK[1], DECK[2]].sort())
    expect(result.events.map((event) => event.type)).toContain('zone.shuffled')
  })
})

describe('CONT and REPLACE abilities', () => {
  it('applies a CONT bonus only while its condition holds', () => {
    const BASTION = piece('p1-bastion')
    const ownTurn = baseState({
      rearGuards: [[BASTION, 'test-iron-bastion', 'right']],
    })

    expect(
      continuousPower(runtime.applyContinuousEffects(ownTurn), BASTION),
    ).toBe(0)

    const opponentTurn = runtime.applyContinuousEffects({
      ...ownTurn,
      turn: { ...ownTurn.turn, turnPlayerId: P2, priorityPlayerId: P2 },
    })

    expect(continuousPower(opponentTurn, BASTION)).toBe(5000)
    expect(resolveCombatPieceModifiers(opponentTurn, BASTION)).toMatchObject({
      ok: true,
      modifiers: { powerModifier: 5000 },
    })
  })

  it('recomputes group CONT bonuses after every transition', () => {
    const called = act(
      baseState({ vanguardCard: 'test-war-standard' }),
      callFromHand(SQUIRE, 'left'),
    )
    // Ember Squire asks first; the CONT bonus is already on the board.
    expect(continuousPower(called, SQUIRE)).toBe(2000)

    const fewDamage = act(
      baseState({
        vanguardCard: 'test-war-standard',
        damage: DAMAGE.slice(0, 2),
      }),
      callFromHand(SQUIRE, 'left'),
    )
    expect(continuousPower(fewDamage, SQUIRE)).toBe(0)
  })

  it('replaces retire with another destination', () => {
    const attacked = act(
      battleState({ foeRearCard: 'test-iron-bastion' }),
      declareAttack(),
    )
    const request = attacked.pendingRequests[0] as Extract<
      GameChoiceRequest,
      { type: 'choose.option' }
    >
    const chosenMode = answer(attacked, {
      type: 'answer.option',
      selectedOptionIds: [
        request.options.find((option) => option.key === 'retire')!.optionId,
      ],
    })
    const retired = answer(chosenMode, {
      type: 'answer.pieces',
      selectedPieceIds: [FOE_REAR],
    })

    expect(zoneOf(retired, FOE_REAR)).toBe(zone(P2, 'soul'))
  })
})

describe('rear-guard hits', () => {
  it('retires a hit rear-guard when the battle closes, without a damage check', () => {
    const result = attackWithoutGuard(
      battleState({ damage: DAMAGE.slice(0, 2) }),
      FOE_REAR,
    )

    expect(result.battle).toBeUndefined()
    expect(zoneOf(result, FOE_REAR)).toBe(zone(P2, 'drop'))
    expect(zonePieceIds(result, zone(P2, 'damage'))).toEqual([])
  })

  it('applies REPLACE to a rear-guard retired by a hit', () => {
    const result = attackWithoutGuard(
      battleState({
        damage: DAMAGE.slice(0, 2),
        foeRearCard: 'test-phoenix-ward',
      }),
      FOE_REAR,
    )

    expect(zoneOf(result, FOE_REAR)).toBe(zone(P2, 'soul'))
  })

  it('counts CONT power in combat: a boosted defender survives', () => {
    // Iron Bastion: +5000 during its opponent's turn, 15000 vs 10000.
    const result = attackWithoutGuard(
      battleState({
        damage: DAMAGE.slice(0, 2),
        foeRearCard: 'test-iron-bastion',
      }),
      FOE_REAR,
    )

    expect(result.battle).toBeUndefined()
    expect(zoneOf(result, FOE_REAR)).toBe(zone(P2, 'rear_guard_circle'))
  })

  it('still sends a vanguard hit to damage check', () => {
    const result = attackWithoutGuard(
      battleState({ damage: DAMAGE.slice(0, 2) }),
      FOE_VANGUARD,
    )

    expect(result.battle).toBeUndefined()
    expect(zonePieceIds(result, zone(P2, 'damage'))).toHaveLength(1)
  })
})

describe('drive check count', () => {
  const drivenCards = (state: GameState) =>
    DECK.length - zonePieceIds(state, zone(P1, 'deck')).length

  it('checks one card without Twin Drive!!', () => {
    const result = attackWithoutGuard(
      battleState({ damage: DAMAGE.slice(0, 2) }),
      FOE_VANGUARD,
    )
    expect(drivenCards(result)).toBe(1)
  })

  it('checks two cards with the twin-drive keyword', () => {
    const result = attackWithoutGuard(
      battleState({
        damage: DAMAGE.slice(0, 2),
        vanguardKeywords: ['twin-drive'],
      }),
      FOE_VANGUARD,
    )
    expect(drivenCards(result)).toBe(2)
  })

  it('applies drive -2 and still finishes the battle with zero checks', () => {
    const result = attackWithoutGuard(
      battleState({
        damage: DAMAGE.slice(0, 2),
        vanguardKeywords: ['twin-drive'],
        vanguardFlags: ['standard-slice.drive-minus-two.until-end-of-turn'],
      }),
      FOE_VANGUARD,
    )
    expect(drivenCards(result)).toBe(0)
    expect(result.battle).toBeUndefined()
  })
})

describe('validation of the extended format', () => {
  it('rejects misuse of CONT, REPLACE, among and subject filters', () => {
    const result = validateCardScript({
      format: 'vg-card-script/1',
      cardId: 'broken-2',
      abilities: [
        { id: 'a', type: 'CONT', effect: [{ do: 'draw', count: 1 }] },
        { id: 'b', type: 'REPLACE', replaces: 'retire' },
        {
          id: 'c',
          type: 'AUTO',
          on: 'call',
          subjectFilter: { player: 'self' },
          effect: [
            {
              do: 'choose',
              as: 'x',
              from: { player: 'self', zone: 'deck' },
              among: '$trigger',
              min: 0,
              max: 1,
            },
          ],
        },
      ],
    })

    expect(result.ok ? [] : result.issues.map((issue) => issue.path)).toEqual([
      'abilities[0].effect[0].do',
      'abilities[1].instead',
      'abilities[2].subjectFilter',
      'abilities[2].effect[0]',
    ])
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function respondAction(
  state: GameState,
  action: Record<string, unknown>,
): TransitionResult {
  return applyGameAction(
    state,
    { expectedRevision: state.revision, action: action as never },
    runtime.transitionOptions,
  )
}

function act(state: GameState, action: Record<string, unknown>): GameState {
  const result = respondAction(state, action)

  if (result.status !== 'applied') {
    throw new Error(
      `${result.status}: ${'message' in result ? result.message : ''}`,
    )
  }

  return result.nextState
}

function respond(
  state: GameState,
  response: DistributiveOmit<
    GameChoiceResponse,
    'requestId' | 'responderPlayerId'
  >,
): TransitionResult {
  const request = state.pendingRequests[0]!

  return applyGameChoiceResponse(
    state,
    {
      expectedRevision: state.revision,
      response: {
        ...response,
        requestId: request.requestId,
        responderPlayerId: request.responderPlayerId,
      } as GameChoiceResponse,
    },
    runtime.transitionOptions,
  )
}

function answer(
  state: GameState,
  response: DistributiveOmit<
    GameChoiceResponse,
    'requestId' | 'responderPlayerId'
  >,
): GameState {
  const result = respond(state, response)

  if (result.status !== 'applied') {
    throw new Error(
      `${result.status}: ${'message' in result ? result.message : ''}`,
    )
  }

  return result.nextState
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never

let actionCounter = 0

function nextActionId(): ActionId {
  actionCounter += 1
  return `action-${actionCounter}` as ActionId
}

function callFromHand(pieceId: PieceId, slotName: string) {
  return {
    actionId: nextActionId(),
    type: 'card.call',
    actor: { kind: 'player', playerId: P1 },
    pieceId,
    from: { zoneId: zone(P1, 'hand') },
    to: { zoneId: zone(P1, 'rear_guard_circle'), slotId: slot(P1, slotName) },
  }
}

function activate(sourcePieceId: PieceId, cardId: string) {
  return {
    actionId: nextActionId(),
    type: 'card.activate_effect',
    actor: { kind: 'player', playerId: P1 },
    sourcePieceId,
    effectDefinitionId: runtime.effectDefinitionIdsForCard(cardId)[0],
  }
}

function declareAttack(target: PieceId = FOE_VANGUARD) {
  return {
    actionId: nextActionId(),
    type: 'battle.declare_attack',
    actor: { kind: 'player', playerId: P1 },
    attackerPieceId: SOVEREIGN,
    target: { kind: 'piece', pieceId: target },
  }
}

/** Attack, no guard, then let the automatic battle steps run. */
function attackWithoutGuard(state: GameState, target: PieceId): GameState {
  let current = act(state, declareAttack(target))
  current = act(current, {
    actionId: nextActionId(),
    type: 'battle.guard',
    actor: { kind: 'player', playerId: P2 },
    againstAttackerPieceId: SOVEREIGN,
  })
  current = answer(current, { type: 'answer.pass', reason: 'pass' })

  return runMandatoryFlow(current)
}

function runMandatoryFlow(state: GameState): GameState {
  let current = state

  for (let step = 0; step < 10; step += 1) {
    const action = resolveNextMandatoryBattleAction(current)

    if (action === undefined) {
      return current
    }

    current = act(current, action as unknown as Record<string, unknown>)
  }

  throw new Error('Battle did not finish in 10 automatic steps.')
}

function zoneOf(state: GameState, pieceId: PieceId): ZoneId | undefined {
  return state.zones.find((candidate) =>
    candidate.occupants.some((occupant) => occupant.pieceId === pieceId),
  )?.zoneId
}

function slotOf(state: GameState, pieceId: PieceId): ZoneSlotId | undefined {
  for (const candidate of state.zones) {
    const occupant = candidate.occupants.find(
      (entry) => entry.pieceId === pieceId,
    )

    if (occupant !== undefined) {
      return occupant.slotId
    }
  }

  return undefined
}

function isFaceDown(state: GameState, pieceId: PieceId): boolean {
  return (
    state.pieceStates
      .find((pieceState) => pieceState.pieceId === pieceId)
      ?.flags.includes(FACE_DOWN_DAMAGE_FLAG) ?? false
  )
}

function zonePieceIds(state: GameState, zoneId: ZoneId): readonly PieceId[] {
  return (
    state.zones
      .find((candidate) => candidate.zoneId === zoneId)
      ?.occupants.map((occupant) => occupant.pieceId) ?? []
  )
}

function continuousPower(state: GameState, pieceId: PieceId): number {
  return (
    state.pieceStates.find((pieceState) => pieceState.pieceId === pieceId)
      ?.continuousPowerModifier ?? 0
  )
}

function powerModifier(state: GameState, pieceId: PieceId): number {
  return (
    state.pieceStates.find((pieceState) => pieceState.pieceId === pieceId)
      ?.powerModifier ?? 0
  )
}

function battleState(options: Parameters<typeof baseState>[0] = {}): GameState {
  const state = baseState(options)

  return {
    ...state,
    turn: { ...state.turn, phase: 'battle' as GameState['turn']['phase'] },
  }
}

function baseState(
  options: {
    readonly adeptOnBoard?: boolean
    readonly soul?: readonly PieceId[]
    readonly damage?: readonly PieceId[]
    /** Extra P1 rear-guards: [piece, cardId, slot name]. */
    readonly rearGuards?: readonly (readonly [PieceId, string, string])[]
    /** Extra P1 hand cards: [piece, cardId]. */
    readonly hand?: readonly (readonly [PieceId, string])[]
    readonly vanguardCard?: string
    readonly foeRearCard?: string
    readonly vanguardKeywords?: readonly string[]
    readonly vanguardFlags?: readonly string[]
  } = {},
): GameState {
  const damage = options.damage ?? DAMAGE
  const soul = options.soul ?? [SOUL_CARD]
  const extraRear = options.rearGuards ?? []
  const extraHand = options.hand ?? []
  const cards: [PieceId, string, PlayerId, number][] = [
    [SOVEREIGN, options.vanguardCard ?? 'test-gale-sovereign', P1, 3],
    ...extraRear.map(([id, cardId]): [PieceId, string, PlayerId, number] => [
      id,
      cardId,
      P1,
      1,
    ]),
    ...extraHand.map(([id, cardId]): [PieceId, string, PlayerId, number] => [
      id,
      cardId,
      P1,
      1,
    ]),
    [SQUIRE, 'test-ember-squire', P1, 1],
    [ADEPT, 'test-tide-adept', P1, 2],
    [SPRITE, 'test-glimmer-sprite', P1, 1],
    [HEAVY, 'filler-grade-3', P1, 3],
    [SOUL_CARD, 'filler-grade-3', P1, 3],
    ...DAMAGE.map((id): [PieceId, string, PlayerId, number] => [
      id,
      'filler-grade-0',
      P1,
      0,
    ]),
    ...DECK.map((id, index): [PieceId, string, PlayerId, number] => [
      id,
      `filler-grade-${index}`,
      P1,
      index,
    ]),
    [FOE_VANGUARD, 'filler-grade-3', P2, 3],
    [FOE_REAR, options.foeRearCard ?? 'filler-grade-1', P2, 1],
    [FOE_DECK, 'filler-grade-0', P2, 0],
  ]
  const usedCards = cards.filter(
    ([id]) =>
      (!DAMAGE.includes(id) || damage.includes(id)) &&
      (id !== SOUL_CARD || soul.includes(id)),
  )
  const grades = new Map<string, number>()

  for (const [, cardId, , grade] of cards) {
    if (!grades.has(cardId)) {
      grades.set(cardId, grade)
    }
  }

  const state: GameState = {
    gameId: 'script-test' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status: 'in_progress',
    revision: 0,
    turn: {
      turnNumber: 3,
      turnPlayerId: P1,
      priorityPlayerId: P1,
      phase: 'main' as GameState['turn']['phase'],
    },
    players: [P1, P2].map((playerId, seat) => ({
      playerId,
      seat,
      status: playerId === P1 ? 'active' : 'waiting',
      ownedZoneIds: ZONE_KINDS.map((kind) => zone(playerId, kind)),
      counters: [],
      flags: [],
    })),
    zones: [
      ...playerZones(P1, {
        deck: DECK,
        hand: [SQUIRE, ...extraHand.map(([id]) => id)],
        drop: [SPRITE, HEAVY],
        soul,
        damage,
        vanguard_circle: [SOVEREIGN],
        rear_guard_circle: [
          ...(options.adeptOnBoard === true ? [[ADEPT, 'left'] as const] : []),
          ...extraRear.map(([id, , slotName]) => [id, slotName] as const),
        ],
      }),
      ...playerZones(P2, {
        deck: [FOE_DECK],
        vanguard_circle: [FOE_VANGUARD],
        rear_guard_circle: [[FOE_REAR, 'left']],
      }),
    ],
    pieces: usedCards
      .filter(([id]) => id !== ADEPT || options.adeptOnBoard === true)
      .map(([pieceId, cardId, owner]) => ({
        pieceId,
        kind: 'card' as const,
        cardDefinitionId: cardId as CardId,
        ownerPlayerId: owner,
        controllerPlayerId: owner,
        ...(pieceId === SOVEREIGN && options.vanguardKeywords !== undefined
          ? { keywords: options.vanguardKeywords as never }
          : {}),
      })),
    cardStats: buildEngineCardStatsSnapshot(
      Array.from(grades, ([cardId, grade]) => ({
        cardDefinitionId: cardId as CardId,
        cardType: 'normal-unit' as const,
        grade: grade as never,
        power: 10000,
        shield: 5000,
        critical: 1,
        triggerType: null,
        keywords: [],
      })),
    ),
    pieceStates:
      options.vanguardFlags === undefined
        ? []
        : [
            {
              pieceId: SOVEREIGN,
              orientation: 'stand',
              flags: options.vanguardFlags as never,
            },
          ],
    flags: [],
    pendingRequests: [],
  }

  return runtime.bindCardScripts(state)
}

const ZONE_KINDS = [
  'deck',
  'hand',
  'drop',
  'soul',
  'damage',
  'bind',
  'vanguard_circle',
  'rear_guard_circle',
  'guardian_circle',
] as const

function playerZones(
  playerId: PlayerId,
  contents: {
    readonly deck?: readonly PieceId[]
    readonly hand?: readonly PieceId[]
    readonly drop?: readonly PieceId[]
    readonly soul?: readonly PieceId[]
    readonly damage?: readonly PieceId[]
    readonly bind?: readonly PieceId[]
    readonly guardian_circle?: readonly PieceId[]
    readonly vanguard_circle?: readonly PieceId[]
    readonly rear_guard_circle?: readonly (readonly [PieceId, string])[]
  },
): GameState['zones'] {
  return ZONE_KINDS.map((kind) => {
    const base = {
      zoneId: zone(playerId, kind),
      kind,
      scope: 'player' as const,
      ownerPlayerId: playerId,
      visibility:
        kind === 'deck' || kind === 'hand'
          ? ('owner-private' as const)
          : ('public' as const),
    }

    if (kind === 'rear_guard_circle') {
      return {
        ...base,
        layout: {
          ordering: 'unordered' as const,
          occupancy: 'slotted' as const,
          slotIds: ['left', 'right', 'back'].map((name) =>
            slot(playerId, name),
          ),
        },
        occupants: (contents.rear_guard_circle ?? []).map(
          ([pieceId, name]) => ({
            pieceId,
            slotId: slot(playerId, name),
          }),
        ),
      }
    }

    return {
      ...base,
      layout: {
        ordering:
          kind === 'deck' || kind === 'drop' || kind === 'soul'
            ? ('ordered' as const)
            : ('unordered' as const),
        occupancy:
          kind === 'vanguard_circle' ? ('single' as const) : ('multi' as const),
      },
      occupants: (contents[kind] ?? []).map((pieceId) => ({ pieceId })),
    }
  })
}
