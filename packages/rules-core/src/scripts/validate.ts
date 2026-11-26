import {
  CARD_SCRIPT_FORMAT,
  SCRIPT_AUTO_TRIGGERS,
  SCRIPT_CONTINUOUS_STEP_KINDS,
  SCRIPT_MOVE_DESTINATIONS,
  SCRIPT_REPLACEABLE_EVENTS,
  SCRIPT_STEP_KINDS,
  SCRIPT_TRIGGER_SUBJECTS,
  SCRIPT_ZONES,
  type CardScript,
  type ScriptAbilityType,
} from './format'

const ABILITY_TYPES: readonly ScriptAbilityType[] = [
  'AUTO',
  'ACT',
  'CONT',
  'REPLACE',
]

export interface CardScriptIssue {
  /** JSON path, e.g. `abilities[0].effect[2].target`. */
  readonly path: string
  readonly message: string
}

export type CardScriptValidationResult =
  | { readonly ok: true; readonly script: CardScript }
  | { readonly ok: false; readonly issues: readonly CardScriptIssue[] }

const ABILITY_ID_PATTERN = /^[a-z][a-z0-9-]*$/
const VARIABLE_PATTERN = /^[a-z][a-z0-9_]*$/
const NAMED_TARGETS = new Set(['source', 'my_vanguard', 'opponent_vanguard'])
const COMPARISON_KEYS = ['eq', 'gte', 'lte', 'gt', 'lt'] as const
const PLAYERS = new Set(['self', 'opponent'])
const MAX_COUNT = 50

type Json = Record<string, unknown>

/**
 * Validates untrusted script JSON (community-authored). Never throws: returns
 * every issue found so a script author can fix them in one pass.
 */
export function validateCardScript(input: unknown): CardScriptValidationResult {
  const issues: CardScriptIssue[] = []
  const report = (path: string, message: string) =>
    issues.push({ path, message })

  if (!isObject(input)) {
    return {
      ok: false,
      issues: [{ path: '', message: 'Script must be an object.' }],
    }
  }

  if (input.format !== CARD_SCRIPT_FORMAT) {
    report('format', `Expected "${CARD_SCRIPT_FORMAT}".`)
  }

  if (typeof input.cardId !== 'string' || input.cardId.trim() === '') {
    report('cardId', 'cardId must be a non-empty string.')
  }

  if (input.name !== undefined && typeof input.name !== 'string') {
    report('name', 'name must be a string.')
  }

  if (!Array.isArray(input.abilities) || input.abilities.length === 0) {
    report('abilities', 'abilities must be a non-empty array.')
  } else {
    const seenIds = new Set<string>()

    input.abilities.forEach((ability, index) =>
      validateAbility(ability, `abilities[${index}]`, seenIds, report),
    )
  }

  return issues.length === 0
    ? { ok: true, script: input as unknown as CardScript }
    : { ok: false, issues }
}

function validateAbility(
  ability: unknown,
  path: string,
  seenIds: Set<string>,
  report: (path: string, message: string) => void,
): void {
  if (!isObject(ability)) {
    report(path, 'Ability must be an object.')
    return
  }

  if (typeof ability.id !== 'string' || !ABILITY_ID_PATTERN.test(ability.id)) {
    report(`${path}.id`, 'id must match /^[a-z][a-z0-9-]*$/.')
  } else if (seenIds.has(ability.id)) {
    report(`${path}.id`, `Duplicate ability id "${ability.id}".`)
  } else {
    seenIds.add(ability.id)
  }

  if (!includes(ABILITY_TYPES, ability.type)) {
    report(`${path}.type`, `type must be ${ABILITY_TYPES.join(', ')}.`)
  }

  if (ability.type === 'AUTO') {
    if (!includes(SCRIPT_AUTO_TRIGGERS, ability.on)) {
      report(
        `${path}.on`,
        `AUTO abilities need on: ${SCRIPT_AUTO_TRIGGERS.join(' | ')}.`,
      )
    }

    if (
      ability.subject !== undefined &&
      !includes(SCRIPT_TRIGGER_SUBJECTS, ability.subject)
    ) {
      report(`${path}.subject`, 'subject must be "this", "other" or "any".')
    }

    if (ability.subjectFilter !== undefined) {
      if (ability.subject === undefined || ability.subject === 'this') {
        report(
          `${path}.subjectFilter`,
          'subjectFilter needs subject "other" or "any".',
        )
      }

      validateSubjectFilter(
        ability.subjectFilter,
        `${path}.subjectFilter`,
        report,
      )
    }

    if (
      Array.isArray(ability.cost) &&
      ability.cost.length > 0 &&
      ability.optional !== true
    ) {
      report(`${path}.optional`, 'AUTO abilities with a cost must be optional.')
    }
  } else {
    for (const key of ['on', 'subject', 'subjectFilter'] as const) {
      if (ability[key] !== undefined) {
        report(`${path}.${key}`, `Only AUTO abilities use "${key}".`)
      }
    }
  }

  if (ability.type !== 'AUTO' && ability.optional !== undefined) {
    report(
      `${path}.optional`,
      'Only AUTO abilities use "optional" (ACT is always optional).',
    )
  }

  if (ability.type === 'CONT' || ability.type === 'REPLACE') {
    if (ability.cost !== undefined) {
      report(`${path}.cost`, `${ability.type} abilities have no cost.`)
    }

    if (ability.oncePerTurn !== undefined) {
      report(
        `${path}.oncePerTurn`,
        `${ability.type} abilities cannot be once per turn.`,
      )
    }
  }

  if (ability.type === 'REPLACE') {
    if (!includes(SCRIPT_REPLACEABLE_EVENTS, ability.replaces)) {
      report(
        `${path}.replaces`,
        `replaces must be one of ${SCRIPT_REPLACEABLE_EVENTS.join(', ')}.`,
      )
    }

    if (!includes(SCRIPT_MOVE_DESTINATIONS, ability.instead)) {
      report(
        `${path}.instead`,
        `instead must be one of ${SCRIPT_MOVE_DESTINATIONS.join(', ')}.`,
      )
    }

    if (ability.effect !== undefined) {
      report(`${path}.effect`, 'REPLACE abilities have no effect steps.')
    }

    if (ability.condition !== undefined) {
      report(
        `${path}.condition`,
        'REPLACE abilities support zones only, not conditions.',
      )
    }
  } else {
    for (const key of ['replaces', 'instead'] as const) {
      if (ability[key] !== undefined) {
        report(`${path}.${key}`, `Only REPLACE abilities use "${key}".`)
      }
    }
  }

  if (ability.zones !== undefined) {
    validateZoneList(ability.zones, `${path}.zones`, report)
  }

  for (const flag of ['oncePerTurn', 'optional'] as const) {
    if (ability[flag] !== undefined && typeof ability[flag] !== 'boolean') {
      report(`${path}.${flag}`, `${flag} must be a boolean.`)
    }
  }

  if (ability.text !== undefined && typeof ability.text !== 'string') {
    report(`${path}.text`, 'text must be a string.')
  }

  // `$trigger` is bound by the runtime for AUTO abilities.
  const variables = new Set<string>(ability.type === 'AUTO' ? ['trigger'] : [])

  if (ability.condition !== undefined) {
    validateCondition(ability.condition, `${path}.condition`, variables, report)
  }

  if (ability.cost !== undefined) {
    validateSteps(ability.cost, `${path}.cost`, variables, report)
  }

  if (ability.type === 'REPLACE') {
    return
  }

  if (!Array.isArray(ability.effect)) {
    report(`${path}.effect`, 'effect must be an array of steps.')
    return
  }

  if (ability.type === 'CONT') {
    ability.effect.forEach((step, index) => {
      if (
        isObject(step) &&
        !(SCRIPT_CONTINUOUS_STEP_KINDS as readonly unknown[]).includes(step.do)
      ) {
        report(
          `${path}.effect[${index}].do`,
          `CONT abilities support only ${SCRIPT_CONTINUOUS_STEP_KINDS.join(', ')}.`,
        )
      }
    })
  }

  validateSteps(ability.effect, `${path}.effect`, variables, report)
}

function validateSubjectFilter(
  value: unknown,
  path: string,
  report: (path: string, message: string) => void,
): void {
  if (!isObject(value)) {
    report(path, 'subjectFilter must be an object.')
    return
  }

  if (value.player !== undefined && !PLAYERS.has(value.player as string)) {
    report(`${path}.player`, 'player must be "self" or "opponent".')
  }

  if (value.zones !== undefined) {
    validateZoneList(value.zones, `${path}.zones`, report)
  }

  if (value.filter !== undefined) {
    validateFilter(value.filter, `${path}.filter`, report)
  }
}

function validateSteps(
  steps: unknown,
  path: string,
  variables: Set<string>,
  report: (path: string, message: string) => void,
): void {
  if (!Array.isArray(steps)) {
    report(path, 'Expected an array of steps.')
    return
  }

  steps.forEach((step, index) =>
    validateStep(step, `${path}[${index}]`, variables, report),
  )
}

function validateStep(
  step: unknown,
  path: string,
  variables: Set<string>,
  report: (path: string, message: string) => void,
): void {
  if (!isObject(step)) {
    report(path, 'Step must be an object.')
    return
  }

  if (!includes(SCRIPT_STEP_KINDS, step.do)) {
    report(
      `${path}.do`,
      `Unknown step "${String(step.do)}". Known: ${SCRIPT_STEP_KINDS.join(', ')}.`,
    )
    return
  }

  switch (step.do) {
    case 'choose': {
      if ((step.from === undefined) === (step.among === undefined)) {
        report(path, 'choose needs exactly one of "from" or "among".')
      }

      if (step.among !== undefined) {
        validateVariableRef(step.among, `${path}.among`, variables, report)
      }

      const selectors =
        step.from === undefined
          ? []
          : Array.isArray(step.from)
            ? step.from
            : [step.from]

      if (Array.isArray(step.from) && selectors.length === 0) {
        report(`${path}.from`, 'from must name at least one zone.')
      }

      selectors.forEach((selector, index) =>
        validateZoneSelector(
          selector,
          Array.isArray(step.from) ? `${path}.from[${index}]` : `${path}.from`,
          report,
        ),
      )

      if (step.filter !== undefined) {
        validateFilter(step.filter, `${path}.filter`, report)
      }

      validateCount(step.min, `${path}.min`, report, 0)
      validateCount(step.max, `${path}.max`, report, 1)

      if (
        typeof step.min === 'number' &&
        typeof step.max === 'number' &&
        step.min > step.max
      ) {
        report(path, 'min must not exceed max.')
      }

      if (step.chooser !== undefined && !PLAYERS.has(step.chooser as string)) {
        report(`${path}.chooser`, 'chooser must be "self" or "opponent".')
      }

      defineVariable(step.as, `${path}.as`, variables, report)
      return
    }
    case 'move':
      validateTarget(step.target, `${path}.target`, variables, report)

      if (!includes(SCRIPT_MOVE_DESTINATIONS, step.to)) {
        report(
          `${path}.to`,
          `to must be one of ${SCRIPT_MOVE_DESTINATIONS.join(', ')}.`,
        )
      }
      return
    case 'retire':
    case 'call':
    case 'stand':
    case 'rest':
      validateTarget(step.target, `${path}.target`, variables, report)
      return
    case 'power':
    case 'critical':
      validateTarget(step.target, `${path}.target`, variables, report)

      if (!Number.isSafeInteger(step.amount) || step.amount === 0) {
        report(`${path}.amount`, 'amount must be a non-zero integer.')
      }
      return
    case 'draw':
      validateCount(step.count, `${path}.count`, report, 1)

      if (step.player !== undefined && !PLAYERS.has(step.player as string)) {
        report(`${path}.player`, 'player must be "self" or "opponent".')
      }
      return
    case 'counter_blast':
    case 'counter_charge':
    case 'soul_blast':
    case 'soul_charge':
    case 'energy_blast':
    case 'energy_charge':
      validateCount(step.count, `${path}.count`, report, 1)
      return
    case 'look_top':
      validateCount(step.count, `${path}.count`, report, 1)
      defineVariable(step.as, `${path}.as`, variables, report)
      return
    case 'exclude':
      validateVariableRef(step.from, `${path}.from`, variables, report)
      validateVariableRef(step.minus, `${path}.minus`, variables, report)
      defineVariable(step.as, `${path}.as`, variables, report)
      return
    case 'shuffle':
      if (step.player !== undefined && !PLAYERS.has(step.player as string)) {
        report(`${path}.player`, 'player must be "self" or "opponent".')
      }
      return
    case 'if': {
      validateCondition(step.cond, `${path}.cond`, variables, report)
      // Variables chosen inside a branch are only safe inside that branch.
      validateSteps(step.then, `${path}.then`, new Set(variables), report)

      if (step.else !== undefined) {
        validateSteps(step.else, `${path}.else`, new Set(variables), report)
      }
      return
    }
    case 'may':
      validateSteps(step.then, `${path}.then`, new Set(variables), report)
      return
    case 'choose_one': {
      if (!Array.isArray(step.options) || step.options.length < 2) {
        report(`${path}.options`, 'choose_one needs at least two options.')
        return
      }

      const keys = new Set<string>()

      step.options.forEach((option, index) => {
        const optionPath = `${path}.options[${index}]`

        if (!isObject(option)) {
          report(optionPath, 'Option must be an object.')
          return
        }

        if (typeof option.key !== 'string' || option.key === '') {
          report(`${optionPath}.key`, 'key must be a non-empty string.')
        } else if (keys.has(option.key)) {
          report(`${optionPath}.key`, `Duplicate option key "${option.key}".`)
        } else {
          keys.add(option.key)
        }

        validateSteps(
          option.steps,
          `${optionPath}.steps`,
          new Set(variables),
          report,
        )
      })
      return
    }
  }
}

function validateCondition(
  condition: unknown,
  path: string,
  variables: ReadonlySet<string>,
  report: (path: string, message: string) => void,
): void {
  if (!isObject(condition)) {
    report(path, 'Condition must be an object.')
    return
  }

  if ('all' in condition || 'any' in condition) {
    const key = 'all' in condition ? 'all' : 'any'
    const list = condition[key]

    if (!Array.isArray(list) || list.length === 0) {
      report(`${path}.${key}`, `${key} must be a non-empty array.`)
      return
    }

    list.forEach((child, index) =>
      validateCondition(child, `${path}.${key}[${index}]`, variables, report),
    )
    return
  }

  if ('not' in condition) {
    validateCondition(condition.not, `${path}.not`, variables, report)
    return
  }

  if ('count' in condition) {
    const count = condition.count

    validateZoneSelector(count, `${path}.count`, report)

    if (isObject(count) && count.filter !== undefined) {
      validateFilter(count.filter, `${path}.count.filter`, report)
    }

    validateComparison(condition, path, report, true)
    return
  }

  if ('chosen' in condition) {
    if (
      typeof condition.chosen !== 'string' ||
      !variables.has(condition.chosen)
    ) {
      report(
        `${path}.chosen`,
        `Unknown variable "${String(condition.chosen)}".`,
      )
    }

    validateComparison(condition, path, report, true)
    return
  }

  if ('turn' in condition) {
    if (!PLAYERS.has(condition.turn as string)) {
      report(`${path}.turn`, 'turn must be "self" or "opponent".')
    }
    return
  }

  if ('phase' in condition) {
    if (typeof condition.phase !== 'string') {
      report(`${path}.phase`, 'phase must be a string.')
    }
    return
  }

  if ('sourceIn' in condition) {
    validateZoneList(condition.sourceIn, `${path}.sourceIn`, report)
    return
  }

  report(
    path,
    'Unknown condition. Use all/any/not/count/chosen/turn/phase/sourceIn.',
  )
}

function validateTarget(
  target: unknown,
  path: string,
  variables: ReadonlySet<string>,
  report: (path: string, message: string) => void,
): void {
  if (isObject(target)) {
    // Group target: every matching card in a zone.
    validateZoneSelector(target, path, report)

    if (target.filter !== undefined) {
      validateFilter(target.filter, `${path}.filter`, report)
    }
    return
  }

  if (typeof target !== 'string') {
    report(path, 'target must be a string or { player, zone, filter }.')
    return
  }

  if (NAMED_TARGETS.has(target)) {
    return
  }

  if (target.startsWith('$')) {
    validateVariableRef(target, path, variables, report)
    return
  }

  report(
    path,
    'target must be source, my_vanguard, opponent_vanguard, $variable or { player, zone }.',
  )
}

function validateVariableRef(
  value: unknown,
  path: string,
  variables: ReadonlySet<string>,
  report: (path: string, message: string) => void,
): void {
  if (typeof value !== 'string' || !value.startsWith('$')) {
    report(path, 'Expected a variable like "$name".')
    return
  }

  if (!variables.has(value.slice(1))) {
    report(path, `Variable "${value}" is not chosen before this step.`)
  }
}

function defineVariable(
  value: unknown,
  path: string,
  variables: Set<string>,
  report: (path: string, message: string) => void,
): void {
  if (typeof value !== 'string' || !VARIABLE_PATTERN.test(value)) {
    report(path, 'as must match /^[a-z][a-z0-9_]*$/.')
  } else if (value === 'trigger') {
    report(path, '"trigger" is reserved for the AUTO event subject.')
  } else {
    variables.add(value)
  }
}

function validateZoneSelector(
  selector: unknown,
  path: string,
  report: (path: string, message: string) => void,
): void {
  if (!isObject(selector)) {
    report(path, 'Expected { player, zone }.')
    return
  }

  if (!PLAYERS.has(selector.player as string)) {
    report(`${path}.player`, 'player must be "self" or "opponent".')
  }

  if (!includes(SCRIPT_ZONES, selector.zone)) {
    report(`${path}.zone`, `zone must be one of ${SCRIPT_ZONES.join(', ')}.`)
  }
}

function validateZoneList(
  zones: unknown,
  path: string,
  report: (path: string, message: string) => void,
): void {
  if (!Array.isArray(zones) || zones.length === 0) {
    report(path, 'Expected a non-empty array of zones.')
    return
  }

  zones.forEach((zone, index) => {
    if (!includes(SCRIPT_ZONES, zone)) {
      report(`${path}[${index}]`, `Unknown zone "${String(zone)}".`)
    }
  })
}

function validateFilter(
  filter: unknown,
  path: string,
  report: (path: string, message: string) => void,
): void {
  if (!isObject(filter)) {
    report(path, 'filter must be an object.')
    return
  }

  const known = new Set([
    'grade',
    'power',
    'cardType',
    'triggerType',
    'orientation',
    'faceUp',
    'excludeSource',
  ])

  for (const key of Object.keys(filter)) {
    if (!known.has(key)) {
      report(`${path}.${key}`, `Unknown filter "${key}".`)
    }
  }

  for (const key of ['grade', 'power'] as const) {
    if (filter[key] !== undefined) {
      if (!isObject(filter[key])) {
        report(
          `${path}.${key}`,
          `${key} must be a comparison like { "lte": 2 }.`,
        )
      } else {
        validateComparison(filter[key], `${path}.${key}`, report, true)
      }
    }
  }

  if (filter.cardType !== undefined && !isStringArray(filter.cardType)) {
    report(`${path}.cardType`, 'cardType must be an array of strings.')
  }

  if (
    filter.triggerType !== undefined &&
    !(
      Array.isArray(filter.triggerType) &&
      filter.triggerType.every(
        (value) => value === null || typeof value === 'string',
      )
    )
  ) {
    report(
      `${path}.triggerType`,
      'triggerType must be an array of strings or null.',
    )
  }

  if (
    filter.orientation !== undefined &&
    filter.orientation !== 'stand' &&
    filter.orientation !== 'rest'
  ) {
    report(`${path}.orientation`, 'orientation must be "stand" or "rest".')
  }

  for (const key of ['faceUp', 'excludeSource'] as const) {
    if (filter[key] !== undefined && typeof filter[key] !== 'boolean') {
      report(`${path}.${key}`, `${key} must be a boolean.`)
    }
  }
}

function validateComparison(
  value: Json,
  path: string,
  report: (path: string, message: string) => void,
  required: boolean,
): void {
  const present = COMPARISON_KEYS.filter((key) => value[key] !== undefined)

  if (required && present.length === 0) {
    report(path, 'Add at least one comparison: eq, gte, lte, gt or lt.')
  }

  for (const key of present) {
    if (!Number.isSafeInteger(value[key])) {
      report(`${path}.${key}`, `${key} must be an integer.`)
    }
  }
}

function validateCount(
  value: unknown,
  path: string,
  report: (path: string, message: string) => void,
  minimum: number,
): void {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < minimum ||
    (value as number) > MAX_COUNT
  ) {
    report(path, `Expected an integer between ${minimum} and ${MAX_COUNT}.`)
  }
}

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function includes<T extends string>(
  list: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === 'string' && (list as readonly string[]).includes(value)
  )
}
