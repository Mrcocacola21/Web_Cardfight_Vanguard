import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  FilterBar,
  FilterChip,
  FilterSelect,
  ItemCard,
  SearchBar,
  StatBlock,
  StatGrid,
} from '.'

describe('data display primitives', () => {
  it('renders item cards and stat blocks with shared structure', () => {
    render(
      <ItemCard
        title="Azure Vanguard Dragon"
        subtitle="Dragon Empire"
        badges={<span>Grade 3</span>}
        footer={<span>card-1</span>}
      >
        <StatGrid columns={2}>
          <StatBlock label="Power" value="13000" />
          <StatBlock label="Critical" value="1" />
        </StatGrid>
      </ItemCard>,
    )

    expect(
      screen.getByRole('heading', { name: /azure vanguard dragon/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/dragon empire/i)).toBeInTheDocument()
    expect(screen.getByText(/^power$/i)).toBeInTheDocument()
  })

  it('supports search clearing and filter controls without feature logic', () => {
    const onValueChange = vi.fn()
    const onClear = vi.fn()
    const onChipClick = vi.fn()
    const onSelectChange = vi.fn()

    render(
      <FilterBar>
        <SearchBar
          label="Search cards"
          defaultValue="dragon"
          onValueChange={onValueChange}
          onClear={onClear}
        />
        <FilterChip label="Standard" selected onClick={onChipClick} count={8} />
        <FilterSelect
          label="Format"
          defaultValue="all"
          options={[
            { value: 'all', label: 'All formats' },
            { value: 'standard', label: 'Standard' },
          ]}
          onValueChange={onSelectChange}
        />
      </FilterBar>,
    )

    fireEvent.click(screen.getByRole('button', { name: /clear search cards/i }))
    fireEvent.click(screen.getByRole('button', { name: /standard/i }))
    fireEvent.change(screen.getByLabelText(/format/i), {
      target: { value: 'standard' },
    })

    expect(onValueChange).toHaveBeenCalledWith('')
    expect(onClear).toHaveBeenCalled()
    expect(onChipClick).toHaveBeenCalled()
    expect(onSelectChange).toHaveBeenCalledWith('standard')
  })
})
