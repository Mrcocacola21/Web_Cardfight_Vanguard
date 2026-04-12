import type {
  DeckValidationInput,
  DeckValidationIssue,
  DeckValidationPlan,
  DeckValidationPipeline,
  DeckValidationResult,
  DeckValidationRuleId,
  DeckValidationSummary,
  DeckValidator,
  DeckValidationValidatorRegistry,
  SupportedDeckValidationFormatId,
} from './contracts'
import type { FormatId } from '@web-vg/shared'
import { defaultDeckValidationValidatorRegistry } from './formats/registry'
import {
  isSupportedDeckValidationFormatId,
  normalizeDeckValidationFormatId,
} from './formats/shared'

export function createDeckValidationPipeline(
  registry: DeckValidationValidatorRegistry = defaultDeckValidationValidatorRegistry,
): DeckValidationPipeline {
  return {
    registry,
    createPlan(input: DeckValidationInput): DeckValidationPlan {
      return createDeckValidationPlan(input, registry)
    },
    validate(input: DeckValidationInput): DeckValidationResult {
      const plan = createDeckValidationPlan(input, registry)
      const issues: DeckValidationIssue[] = []
      const evaluatedRules: DeckValidationRuleId[] = []

      runValidators(plan.commonValidators, input, issues, evaluatedRules)
      evaluatedRules.push('select-format-validator-group')

      if (plan.routingIssues.length > 0) {
        issues.push(...plan.routingIssues)
      } else {
        runValidators(plan.formatValidators, input, issues, evaluatedRules)
        runValidators(plan.restrictionValidators, input, issues, evaluatedRules)
      }

      return createDeckValidationResult({
        formatId: plan.formatId,
        validatorGroups: plan.validatorGroups,
        issues,
        evaluatedRules,
      })
    },
  }
}

export function validateDeck(
  input: DeckValidationInput,
  registry: DeckValidationValidatorRegistry = defaultDeckValidationValidatorRegistry,
): DeckValidationResult {
  return createDeckValidationPipeline(registry).validate(input)
}

function createDeckValidationResult(input: {
  readonly formatId: FormatId | null
  readonly validatorGroups: DeckValidationResult['validatorGroups']
  readonly issues: readonly DeckValidationIssue[]
  readonly evaluatedRules: readonly DeckValidationRuleId[]
}): DeckValidationResult {
  const summary = createDeckValidationSummary(input.issues)

  return {
    formatId: input.formatId,
    isValid: summary.errorCount === 0,
    validatorGroups: input.validatorGroups,
    evaluatedRules: input.evaluatedRules,
    issues: input.issues,
    summary,
  }
}

function createDeckValidationSummary(
  issues: readonly DeckValidationIssue[],
): DeckValidationSummary {
  let errorCount = 0
  let warningCount = 0
  let infoCount = 0

  for (const issue of issues) {
    if (issue.severity === 'error') {
      errorCount += 1
      continue
    }

    if (issue.severity === 'warning') {
      warningCount += 1
      continue
    }

    infoCount += 1
  }

  return {
    totalIssues: issues.length,
    errorCount,
    warningCount,
    infoCount,
  }
}

function createDeckValidationPlan(
  input: DeckValidationInput,
  registry: DeckValidationValidatorRegistry,
): DeckValidationPlan {
  const formatId = normalizeDeckValidationFormatId(input.deck.formatId)
  const commonValidators = registry.commonValidators.slice()
  const restrictionValidators = registry.restrictionValidators.slice()

  if (formatId == null) {
    return {
      formatId: null,
      validatorGroups: ['common'],
      commonValidators,
      formatValidators: [],
      restrictionValidators: [],
      routingIssues: [],
    }
  }

  const formatProfile = input.context?.format?.profile

  if (formatProfile && formatProfile.formatId !== formatId) {
    return {
      formatId,
      validatorGroups: ['common'],
      commonValidators,
      formatValidators: [],
      restrictionValidators: [],
      routingIssues: [
        {
          severity: 'error',
          category: 'format',
          code: 'format-profile-mismatch',
          message: `Validation received a format profile for ${String(formatProfile.formatId)} but the deck format is ${String(formatId)}.`,
          target: {
            type: 'format',
            field: 'formatId',
            formatId,
          },
        },
      ],
    }
  }

  if (!isSupportedDeckValidationFormatId(formatId)) {
    return {
      formatId,
      validatorGroups: ['common'],
      commonValidators,
      formatValidators: [],
      restrictionValidators: [],
      routingIssues: [
        {
          severity: 'error',
          category: 'format',
          code: 'unsupported-format',
          message: `Deck format ${String(formatId)} is not supported by the validation pipeline.`,
          target: {
            type: 'format',
            field: 'formatId',
            formatId,
          },
        },
      ],
    }
  }

  const supportedFormatId = formatId as SupportedDeckValidationFormatId
  const formatValidators =
    registry.formatValidatorsByFormat[supportedFormatId].slice()
  const validatorGroups =
    restrictionValidators.length > 0
      ? (['common', supportedFormatId, 'restriction'] as const)
      : (['common', supportedFormatId] as const)

  return {
    formatId,
    validatorGroups,
    commonValidators,
    formatValidators,
    restrictionValidators,
    routingIssues: [],
  }
}

function runValidators(
  validators: readonly DeckValidator[],
  input: DeckValidationInput,
  issues: DeckValidationIssue[],
  evaluatedRules: DeckValidationRuleId[],
): void {
  for (const validator of validators) {
    evaluatedRules.push(validator.id)

    const validatorIssues = validator.validate(input)

    if (validatorIssues.length > 0) {
      issues.push(...validatorIssues)
    }
  }
}
