'use client'

import { useState } from 'react'

import {
  FilterBar,
  FilterChip,
  FilterSelect,
  SearchBar,
  StatBlock,
  StatGrid,
} from '@/components/data-display'

const formatOptions = [
  { value: 'all', label: 'All formats' },
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
] as const

const typeOptions = [
  { value: 'all', label: 'All card types' },
  { value: 'normal-unit', label: 'Normal Unit' },
  { value: 'trigger-unit', label: 'Trigger Unit' },
] as const

export function FoundationDataDisplayPreview() {
  const [query, setQuery] = useState('vanguard')
  const [format, setFormat] = useState('standard')
  const [cardType, setCardType] = useState('all')

  return (
    <div className="space-y-4">
      <FilterBar>
        <div className="min-w-0 flex-1">
          <SearchBar
            label="Search"
            value={query}
            onValueChange={setQuery}
            onClear={() => setQuery('')}
            placeholder="Shared search bar preview"
          />
        </div>
        <FilterSelect
          label="Format"
          value={format}
          onValueChange={setFormat}
          options={formatOptions}
          className="min-w-40"
        />
        <FilterSelect
          label="Type"
          value={cardType}
          onValueChange={setCardType}
          options={typeOptions}
          className="min-w-44"
        />
        <div className="flex flex-wrap items-end gap-2">
          <FilterChip
            label="Triggers"
            selected={cardType === 'trigger-unit'}
            onClick={() =>
              setCardType((current) =>
                current === 'trigger-unit' ? 'all' : 'trigger-unit',
              )
            }
            count={4}
          />
          <FilterChip
            label="Grade 3"
            selected={query === 'grade 3'}
            onClick={() =>
              setQuery((current) => (current === 'grade 3' ? '' : 'grade 3'))
            }
            count={6}
          />
        </div>
      </FilterBar>

      <StatGrid columns={3}>
        <StatBlock label="Visible items" value="8" hint="Shared stat block" />
        <StatBlock label="Active format" value={format} tone="accent" />
        <StatBlock label="Search term" value={query || 'none'} tone="muted" />
      </StatGrid>
    </div>
  )
}
