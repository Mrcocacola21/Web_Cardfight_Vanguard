import type { ScriptAbility, ScriptCondition, ScriptStep } from './format'

/** Steps that do work (everything except control flow). */
export type PrimitiveScriptStep = Exclude<
  ScriptStep,
  { readonly do: 'if' } | { readonly do: 'may' } | { readonly do: 'choose_one' }
>

/**
 * Abilities compile to a flat instruction list so that a paused script is
 * fully described by `pc + vars (+ frame)`: small, JSON-serializable, and
 * safe to persist between HTTP requests.
 */
export type ScriptInstruction =
  | {
      readonly op: 'step'
      readonly step: PrimitiveScriptStep
      readonly role: 'cost' | 'effect'
    }
  | {
      readonly op: 'branch'
      readonly cond: ScriptCondition
      readonly elseTarget: number
    }
  | { readonly op: 'jump'; readonly target: number }
  | {
      readonly op: 'ask'
      readonly prompt?: string
      readonly elseTarget: number
    }
  | {
      readonly op: 'mode'
      readonly prompt?: string
      readonly options: readonly {
        readonly key: string
        readonly label?: string
      }[]
      readonly targets: readonly number[]
    }
  | { readonly op: 'mark_once_per_turn' }

/** Builder-only shape; jump targets are patched after their blocks emit. */
type MutableInstruction = Record<string, unknown>

export function compileAbility(
  ability: ScriptAbility,
): readonly ScriptInstruction[] {
  const program: MutableInstruction[] = []
  let optionalAsk: MutableInstruction | undefined

  if (ability.type === 'AUTO' && ability.optional === true) {
    optionalAsk = { op: 'ask', elseTarget: -1, prompt: ability.text }
    program.push(optionalAsk)
  }

  emitSteps(program, ability.cost ?? [], 'cost')

  if (ability.oncePerTurn === true) {
    program.push({ op: 'mark_once_per_turn' })
  }

  emitSteps(program, ability.effect ?? [], 'effect')

  if (optionalAsk !== undefined) {
    optionalAsk.elseTarget = program.length
  }

  return Object.freeze(
    program.map((instruction) => Object.freeze({ ...instruction })),
  ) as unknown as readonly ScriptInstruction[]
}

function emitSteps(
  program: MutableInstruction[],
  steps: readonly ScriptStep[],
  role: 'cost' | 'effect',
): void {
  for (const step of steps) {
    switch (step.do) {
      case 'if': {
        const branch: MutableInstruction = {
          op: 'branch',
          cond: step.cond,
          elseTarget: -1,
        }
        program.push(branch)
        emitSteps(program, step.then, role)

        if (step.else === undefined || step.else.length === 0) {
          branch.elseTarget = program.length
          break
        }

        const skipElse: MutableInstruction = { op: 'jump', target: -1 }
        program.push(skipElse)
        branch.elseTarget = program.length
        emitSteps(program, step.else, role)
        skipElse.target = program.length
        break
      }
      case 'may': {
        const ask: MutableInstruction = {
          op: 'ask',
          elseTarget: -1,
          ...(step.prompt === undefined ? {} : { prompt: step.prompt }),
        }
        program.push(ask)
        emitSteps(program, step.then, role)
        ask.elseTarget = program.length
        break
      }
      case 'choose_one': {
        const targets: number[] = []
        const mode: MutableInstruction = {
          op: 'mode',
          options: step.options.map((option) => ({
            key: option.key,
            ...(option.label === undefined ? {} : { label: option.label }),
          })),
          targets,
          ...(step.prompt === undefined ? {} : { prompt: step.prompt }),
        }
        const exits: MutableInstruction[] = []
        program.push(mode)

        for (const option of step.options) {
          targets.push(program.length)
          emitSteps(program, option.steps, role)
          const exit: MutableInstruction = { op: 'jump', target: -1 }
          exits.push(exit)
          program.push(exit)
        }

        for (const exit of exits) {
          exit.target = program.length
        }
        break
      }
      default:
        program.push({ op: 'step', step, role })
    }
  }
}
