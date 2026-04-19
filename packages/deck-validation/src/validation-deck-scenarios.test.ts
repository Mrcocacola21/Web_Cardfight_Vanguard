import { describe, expect, it } from 'vitest'

import { validateDeck, type DeckValidationIssue } from './index'
import {
  premiumDeckScenarioFixtures,
  standardDeckScenarioFixtures,
  type DeckValidationScenarioFixture,
  vPremiumDeckScenarioFixtures,
  vPremiumProfileDrivenScenarioFixture,
} from './fixtures/decks'

describe('@web-vg/deck-validation deck scenario fixtures', () => {
  describe('Standard fixtures', () => {
    for (const scenario of standardDeckScenarioFixtures) {
      it(scenario.name, () => {
        assertScenarioFixture(scenario)
      })
    }
  })

  describe('V Premium fixtures', () => {
    for (const scenario of vPremiumDeckScenarioFixtures) {
      it(scenario.name, () => {
        assertScenarioFixture(scenario)
      })
    }
  })

  describe('Premium fixtures', () => {
    for (const scenario of premiumDeckScenarioFixtures) {
      it(scenario.name, () => {
        assertScenarioFixture(scenario)
      })
    }
  })

  describe('Profile-driven baseline fixture', () => {
    it(vPremiumProfileDrivenScenarioFixture.name, () => {
      const result = assertScenarioFixture(vPremiumProfileDrivenScenarioFixture)

      expect(result.issues.map((issue) => issue.code)).not.toContain(
        'main-deck-too-small',
      )
    })
  })
})

function assertScenarioFixture(scenario: DeckValidationScenarioFixture) {
  const result = validateDeck(scenario.input)

  expect(result.formatId).toBe(scenario.formatId)
  expect(result.validatorGroups).toEqual(scenario.expectedValidatorGroups)
  expect(result.issues.map(projectIssue)).toEqual(scenario.expectedIssues)
  expect(result.summary).toEqual(createExpectedSummary(scenario.expectedIssues))
  expect(result.isValid).toBe(
    scenario.expectedIssues.every((issue) => issue.severity !== 'error'),
  )
  expect(result.evaluatedRules).toEqual(
    expect.arrayContaining([...scenario.requiredEvaluatedRules]),
  )

  for (const ruleId of scenario.forbiddenEvaluatedRules) {
    expect(result.evaluatedRules).not.toContain(ruleId)
  }

  for (const prefix of scenario.forbiddenIssueCodePrefixes) {
    expect(
      result.issues.some((issue) => String(issue.code).startsWith(prefix)),
    ).toBe(false)
  }

  return result
}

function projectIssue(issue: DeckValidationIssue) {
  return {
    code: issue.code,
    severity: issue.severity,
    category: issue.category,
    target: issue.target,
  }
}

function createExpectedSummary(
  issues: readonly Pick<DeckValidationIssue, 'severity'>[],
) {
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
