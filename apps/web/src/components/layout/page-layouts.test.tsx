import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DetailPageLayout } from './detail-page-layout'
import { PageContainer } from './page-container'
import { PageHeader } from './page-header'

describe('layout primitives', () => {
  it('applies the configured container width token', () => {
    render(
      <PageContainer size="wide" data-testid="page-container">
        content
      </PageContainer>,
    )

    expect(screen.getByTestId('page-container')).toHaveClass('max-w-6xl')
  })

  it('renders a detail page layout with an aside slot', () => {
    render(
      <DetailPageLayout
        variant="content-aside"
        header={
          <PageHeader
            title="Deck Detail"
            description="Canonical two-column detail pattern."
          />
        }
        main={<div>Main content</div>}
        aside={<div>Aside content</div>}
      />,
    )

    expect(
      screen.getByRole('heading', { name: /deck detail/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/main content/i)).toBeInTheDocument()
    expect(screen.getByText(/aside content/i)).toBeInTheDocument()
  })
})
