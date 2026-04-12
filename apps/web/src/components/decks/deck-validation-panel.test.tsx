import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type {
  DeckValidationIssue,
  DeckValidationResult,
} from '@web-vg/deck-validation'
import type { CardId, FormatId } from '@web-vg/shared'

import { DeckValidationPanel } from './deck-validation-panel'

describe('DeckValidationPanel', () => {
  it('renders an honest empty state when validation is unavailable', () => {
    render(<DeckValidationPanel validation={null} />)

    expect(screen.getByText(/validation is unavailable/i)).toBeInTheDocument()
  })

  it('renders deck-level and card-level issues with severity and jump links', () => {
    render(
      <DeckValidationPanel
        validation={createValidationResult([
          {
            severity: 'error',
            category: 'section',
            code: 'main-deck-too-small',
            message:
              'Main deck contains 1 cards, but the baseline requires 50.',
            target: {
              type: 'section',
              section: 'main',
            },
          },
          {
            severity: 'warning',
            category: 'card',
            code: 'card-exceeds-restricted-copies',
            message: 'Card entity-bastion is limited to 1 copy.',
            target: {
              type: 'card',
              cardEntityId: 'entity-bastion' as CardId,
              section: 'main',
            },
          },
        ])}
        cardNamesById={{
          'entity-bastion': 'Apex Ruler, Bastion',
        }}
        resolveIssueHref={(issue) =>
          issue.target.type === 'card' ? '#deck-row-main-entity-bastion' : null
        }
      />,
    )

    expect(screen.getByText(/^deck issues$/i)).toBeInTheDocument()
    expect(screen.getByText(/^card issues$/i)).toBeInTheDocument()
    expect(screen.getByText(/^error$/i)).toBeInTheDocument()
    expect(screen.getByText(/^warning$/i)).toBeInTheDocument()
    expect(screen.getByText(/main deck contains 1 cards/i)).toBeInTheDocument()
    expect(screen.getByText(/apex ruler, bastion/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go to card/i })).toHaveAttribute(
      'href',
      '#deck-row-main-entity-bastion',
    )
  })

  it('collapses long card issue lists and expands them on demand', () => {
    render(
      <DeckValidationPanel
        validation={createValidationResult(
          Array.from({ length: 6 }, (_, index) => ({
            severity: 'error',
            category: 'card',
            code: `issue-${index}`,
            message: `Issue ${index}`,
            target: {
              type: 'card',
              cardEntityId: `entity-${index}` as CardId,
              section: 'main',
            },
          })),
        )}
      />,
    )

    expect(screen.getByText(/show 2 more/i)).toBeInTheDocument()
    expect(screen.queryByText('Issue 5')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /show 2 more/i }))

    expect(screen.getByText('Issue 5')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /show fewer/i }),
    ).toBeInTheDocument()
  })
})

function createValidationResult(
  issues: readonly DeckValidationIssue[],
): DeckValidationResult {
  const errorCount = issues.filter((issue) => issue.severity === 'error').length
  const warningCount = issues.filter(
    (issue) => issue.severity === 'warning',
  ).length
  const infoCount = issues.filter((issue) => issue.severity === 'info').length

  return {
    isValid: errorCount === 0,
    formatId: 'standard' as FormatId,
    validatorGroups: ['common', 'standard', 'restriction'],
    evaluatedRules: ['require-deck-format'],
    issues,
    summary: {
      totalIssues: issues.length,
      errorCount,
      warningCount,
      infoCount,
    },
  }
}
