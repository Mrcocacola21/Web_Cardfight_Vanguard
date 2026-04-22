export class RulesCoreError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RulesCoreError'
  }
}

export class RulesInvariantError extends RulesCoreError {
  constructor(message: string) {
    super(message)
    this.name = 'RulesInvariantError'
  }
}

export function assertRulesInvariant(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new RulesInvariantError(message)
  }
}
