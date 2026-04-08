import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PublicProfileView } from './public-profile-view'

describe('PublicProfileView', () => {
  it('renders only the public profile fields', () => {
    render(
      <PublicProfileView
        profile={{
          id: 'profile-1',
          displayName: 'Azure Pilot',
          avatarUrl: 'https://images.example/avatar.png',
          bio: 'Public pilot bio.',
        }}
      />,
    )

    expect(
      screen.getByRole('heading', { name: /azure pilot/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/public pilot bio/i)).toBeInTheDocument()
    expect(
      screen.getByText(/https:\/\/images\.example\/avatar\.png/i),
    ).toBeInTheDocument()
    expect(screen.getByAltText(/azure pilot avatar/i)).toBeInTheDocument()
  })

  it('renders an owner hint when the viewer is also the owner', () => {
    render(
      <PublicProfileView
        isOwnerViewer
        profile={{
          id: 'profile-1',
          displayName: 'Azure Pilot',
          avatarUrl: null,
          bio: null,
        }}
      />,
    )

    expect(screen.getByText(/viewer is owner/i)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /manage your profile/i }),
    ).toHaveAttribute('href', '/profile')
  })
})
