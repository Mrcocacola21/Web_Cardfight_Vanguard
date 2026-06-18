import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { LocalMatchEventLogEntry } from '@/features/matches/play/event-log'

import { EventLogPanel } from './event-log-panel'

describe('EventLogPanel', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders an honest empty timeline state', () => {
    render(<EventLogPanel entries={[]} />)

    expect(screen.getByRole('region', { name: 'Event log' })).toBeVisible()
    expect(screen.getByText('Recent Play')).toBeVisible()
    expect(screen.getByText('No table events yet.')).toBeVisible()
  })

  it('renders ordered readable entries with structured details', () => {
    render(<EventLogPanel entries={createEntries()} />)

    const log = screen.getByRole('region', { name: 'Event log' })
    const entries = within(log).getAllByRole('listitem')

    expect(entries).toHaveLength(2)
    expect(within(entries[0]!).getByText('Match started.')).toBeVisible()
    expect(within(entries[0]!).getByText('#1')).toBeVisible()
    expect(within(entries[1]!).getByText('Turn 0 started.')).toBeVisible()
    expect(within(entries[1]!).getByText('#2')).toBeVisible()
    expect(within(log).getByText('2 recent events')).toBeVisible()
    expect(within(log).queryByText('Engine timeline')).toBeNull()
  })
})

function createEntries(): readonly LocalMatchEventLogEntry[] {
  return [
    {
      recordId: 'record-1',
      ordinal: 1,
      roomRevision: 4,
      engineRevision: 3,
      transitionId: 'transition-1',
      eventId: 'event-1',
      sequence: 0,
      type: 'match.started',
      category: 'match',
      source: 'match-setup',
      summary: 'Match started.',
      details: [{ label: 'Event id', value: 'event-1' }],
    },
    {
      recordId: 'record-2',
      ordinal: 2,
      roomRevision: 4,
      engineRevision: 3,
      transitionId: 'transition-1',
      eventId: 'event-2',
      sequence: 1,
      type: 'turn.started',
      category: 'turn',
      source: 'match-setup',
      summary: 'Turn 0 started.',
      details: [{ label: 'Event id', value: 'event-2' }],
    },
  ]
}
