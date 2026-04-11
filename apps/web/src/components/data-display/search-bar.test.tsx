import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FilterBar } from './filter-bar'
import { FilterChip } from './filter-chip'
import { FilterSelect } from './filter-select'
import { SearchBar } from './search-bar'

describe('data display controls', () => {
  it('calls onClear from the search bar', () => {
    const onClear = vi.fn()

    render(
      <SearchBar
        label="Search cards"
        value="dragon"
        onValueChange={() => {}}
        onClear={onClear}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /clear search cards/i }))

    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('renders filter controls with the expected semantics', () => {
    render(
      <FilterBar>
        <FilterChip label="All" selected />
        <FilterSelect
          label="Format"
          defaultValue="standard"
          options={[
            { label: 'Standard', value: 'standard' },
            { label: 'Premium', value: 'premium' },
          ]}
        />
      </FilterBar>,
    )

    expect(screen.getByRole('button', { name: /all/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText(/format/i)).toHaveValue('standard')
  })
})
