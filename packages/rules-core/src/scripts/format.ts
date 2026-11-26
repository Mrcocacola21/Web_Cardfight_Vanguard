/**
 * Card script format `vg-card-script/1`.
 *
 * A card script is plain JSON data: the engine ships the interpreter, while
 * card databases and per-card scripts are authored separately (EDOPro-style).
 * Every player decision (targets, optional costs, modes, slots) is an explicit
 * step that pauses the engine with a pending choice request.
 */

export const CARD_SCRIPT_FORMAT = 'vg-card-script/1' as const

/** Relative to the controller of the source card. */
export type ScriptPlayer = 'self' | 'opponent'

export const SCRIPT_ZONES = [
  'hand',
  'deck',
  'drop',
  'soul',
  'damage',
  'bind',
  'order_zone',
  'rear_guard_circle',
  'vanguard_circle',
] as const

export type ScriptZone = (typeof SCRIPT_ZONES)[number]

export const SCRIPT_MOVE_DESTINATIONS = [
  'hand',
  'drop',
  'soul',
  'bind',
  'deck_top',
  'deck_bottom',
] as const

export type ScriptMoveDestination = (typeof SCRIPT_MOVE_DESTINATIONS)[number]

/** A variable reference such as `$unit`. */
export type ScriptVariableRef = `$${string}`

/**
 * `source` - the card that owns the ability.
 * `my_vanguard` / `opponent_vanguard` - current vanguards.
 * `$name` - pieces stored by an earlier `choose` / `look_top` / `exclude` step.
 * `$trigger` - AUTO only: the card(s) the triggering event is about.
 */
export type ScriptTarget =
  | 'source'
  | 'my_vanguard'
  | 'opponent_vanguard'
  | ScriptVariableRef

export interface NumberComparison {
  readonly eq?: number
  readonly gte?: number
  readonly lte?: number
  readonly gt?: number
  readonly lt?: number
}

export interface ScriptCardFilter {
  readonly grade?: NumberComparison
  readonly power?: NumberComparison
  readonly cardType?: readonly string[]
  readonly triggerType?: readonly (string | null)[]
  readonly orientation?: 'stand' | 'rest'
  /** Damage zone only: face-up (true) or face-down (false). */
  readonly faceUp?: boolean
  readonly excludeSource?: boolean
}

export interface ScriptZoneSelector {
  readonly player: ScriptPlayer
  readonly zone: ScriptZone
}

/** Every card in a zone that matches the filter, e.g. all your rear-guards. */
export interface ScriptGroupTarget extends ScriptZoneSelector {
  readonly filter?: ScriptCardFilter
}

export type ScriptTargetRef = ScriptTarget | ScriptGroupTarget

export type ScriptCondition =
  | { readonly all: readonly ScriptCondition[] }
  | { readonly any: readonly ScriptCondition[] }
  | { readonly not: ScriptCondition }
  | ({
      readonly count: ScriptZoneSelector & {
        readonly filter?: ScriptCardFilter
      }
    } & NumberComparison)
  | ({ readonly chosen: string } & NumberComparison)
  | { readonly turn: ScriptPlayer }
  | { readonly phase: string }
  | { readonly sourceIn: readonly ScriptZone[] }

export interface ChooseStep {
  readonly do: 'choose'
  readonly as: string
  /** Zones to choose from. Use exactly one of `from` and `among`. */
  readonly from?: ScriptZoneSelector | readonly ScriptZoneSelector[]
  /** Choose among pieces stored in a variable, e.g. `$top` from `look_top`. */
  readonly among?: ScriptVariableRef
  readonly filter?: ScriptCardFilter
  readonly min: number
  readonly max: number
  /** Who picks. Defaults to `self`. */
  readonly chooser?: ScriptPlayer
  readonly prompt?: string
}

export interface MoveStep {
  readonly do: 'move'
  readonly target: ScriptTargetRef
  /** Destination zone of the moved card's owner. */
  readonly to: ScriptMoveDestination
}

export interface TargetOnlyStep<TKind extends string> {
  readonly do: TKind
  readonly target: ScriptTargetRef
}

export interface AmountStep<TKind extends string> {
  readonly do: TKind
  readonly target: ScriptTargetRef
  readonly amount: number
}

export interface CountStep<TKind extends string> {
  readonly do: TKind
  readonly count: number
}

export interface DrawStep {
  readonly do: 'draw'
  readonly count: number
  readonly player?: ScriptPlayer
}

/** Looks at the top N cards of your deck and stores them as `as`. */
export interface LookTopStep {
  readonly do: 'look_top'
  readonly count: number
  readonly as: string
}

/** Stores `from` minus `minus` as `as`, e.g. "the rest" after a pick. */
export interface ExcludeStep {
  readonly do: 'exclude'
  readonly as: string
  readonly from: ScriptVariableRef
  readonly minus: ScriptVariableRef
}

export interface ShuffleStep {
  readonly do: 'shuffle'
  readonly player?: ScriptPlayer
}

export interface IfStep {
  readonly do: 'if'
  readonly cond: ScriptCondition
  readonly then: readonly ScriptStep[]
  readonly else?: readonly ScriptStep[]
}

export interface MayStep {
  readonly do: 'may'
  readonly prompt?: string
  readonly then: readonly ScriptStep[]
}

export interface ChooseOneOption {
  readonly key: string
  readonly label?: string
  readonly steps: readonly ScriptStep[]
}

export interface ChooseOneStep {
  readonly do: 'choose_one'
  readonly prompt?: string
  readonly options: readonly ChooseOneOption[]
}

export type ScriptStep =
  | ChooseStep
  | MoveStep
  | TargetOnlyStep<'retire'>
  | TargetOnlyStep<'call'>
  | TargetOnlyStep<'stand'>
  | TargetOnlyStep<'rest'>
  | AmountStep<'power'>
  | AmountStep<'critical'>
  | DrawStep
  | CountStep<'counter_blast'>
  | CountStep<'counter_charge'>
  | CountStep<'soul_blast'>
  | CountStep<'soul_charge'>
  | CountStep<'energy_blast'>
  | CountStep<'energy_charge'>
  | LookTopStep
  | ExcludeStep
  | ShuffleStep
  | IfStep
  | MayStep
  | ChooseOneStep

export type ScriptStepKind = ScriptStep['do']

export const SCRIPT_STEP_KINDS: readonly ScriptStepKind[] = [
  'choose',
  'move',
  'retire',
  'call',
  'stand',
  'rest',
  'power',
  'critical',
  'draw',
  'counter_blast',
  'counter_charge',
  'soul_blast',
  'soul_charge',
  'energy_blast',
  'energy_charge',
  'look_top',
  'exclude',
  'shuffle',
  'if',
  'may',
  'choose_one',
]

/** Steps a CONT ability may use: values recomputed after every transition. */
export const SCRIPT_CONTINUOUS_STEP_KINDS: readonly ScriptStepKind[] = [
  'power',
  'critical',
]

export const SCRIPT_AUTO_TRIGGERS = [
  'ride',
  'call',
  'attack',
  'boost',
  'guard',
] as const

export type ScriptAutoTrigger = (typeof SCRIPT_AUTO_TRIGGERS)[number]

/**
 * Which card the AUTO event must be about: this card (default), another
 * card, or any card. With `other` / `any`, `subjectFilter` narrows it down.
 */
export type ScriptTriggerSubject = 'this' | 'other' | 'any'

export const SCRIPT_TRIGGER_SUBJECTS: readonly ScriptTriggerSubject[] = [
  'this',
  'other',
  'any',
]

export interface ScriptSubjectFilter {
  /** Controller of the subject card, relative to this card's controller. */
  readonly player?: ScriptPlayer
  /** Zones the subject card is in after the event. */
  readonly zones?: readonly ScriptZone[]
  readonly filter?: ScriptCardFilter
}

export const SCRIPT_REPLACEABLE_EVENTS = ['retire'] as const

export type ScriptReplaceableEvent = (typeof SCRIPT_REPLACEABLE_EVENTS)[number]

export type ScriptAbilityType = 'AUTO' | 'ACT' | 'CONT' | 'REPLACE'

export interface ScriptAbility {
  /** Unique within the card, lowercase: `call-draw`. */
  readonly id: string
  /**
   * AUTO - triggered; ACT - activated by the player; CONT - always on while
   * its zones/condition hold (power/critical only); REPLACE - this card goes
   * somewhere else instead of undergoing an event (`replaces` / `instead`).
   */
  readonly type: ScriptAbilityType
  /** AUTO only: the event that triggers the ability. */
  readonly on?: ScriptAutoTrigger
  /** AUTO only: whose event it is. Defaults to `this`. */
  readonly subject?: ScriptTriggerSubject
  readonly subjectFilter?: ScriptSubjectFilter
  /** REPLACE only: the event this card would undergo. */
  readonly replaces?: ScriptReplaceableEvent
  /** REPLACE only: where this card goes instead (its owner's zone). */
  readonly instead?: ScriptMoveDestination
  /** Zones the source card must be in, e.g. `["rear_guard_circle"]` for (RC). */
  readonly zones?: readonly ScriptZone[]
  readonly oncePerTurn?: boolean
  /** AUTO only: the controller is asked whether to use the ability. */
  readonly optional?: boolean
  readonly condition?: ScriptCondition
  readonly cost?: readonly ScriptStep[]
  /** Required for AUTO / ACT / CONT. REPLACE abilities have none. */
  readonly effect?: readonly ScriptStep[]
  /** Human-readable rules text, for UI/tooling only. */
  readonly text?: string
}

export interface CardScript {
  readonly format: typeof CARD_SCRIPT_FORMAT
  /** Must match `GamePieceState.cardDefinitionId` of the card it scripts. */
  readonly cardId: string
  readonly name?: string
  readonly abilities: readonly ScriptAbility[]
}
