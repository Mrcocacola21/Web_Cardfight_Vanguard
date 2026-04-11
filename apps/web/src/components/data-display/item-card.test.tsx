import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Badge } from '@/components/ui/badge'

import { ItemCard } from './item-card'

describe('ItemCard', () => {
  it('renders title, subtitle, badges, content, and footer', () => {
    render(
      <ItemCard
        title="Azure Vanguard Dragon"
        subtitle="Dragon Empire"
        badges={<Badge variant="accent">Grade 3</Badge>}
        footer={<span>Footer action</span>}
      >
        <p>Canonical key: card.azure-vanguard-dragon</p>
      </ItemCard>,
    )

    expect(
      screen.getByRole('heading', { name: /azure vanguard dragon/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/dragon empire/i)).toBeInTheDocument()
    expect(screen.getByText(/grade 3/i)).toBeInTheDocument()
    expect(
      screen.getByText(/canonical key: card\.azure-vanguard-dragon/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/footer action/i)).toBeInTheDocument()
  })
})
