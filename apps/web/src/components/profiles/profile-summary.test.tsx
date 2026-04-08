import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProfileSummary } from './profile-summary'

describe('ProfileSummary', () => {
  it('renders persisted profile fields', () => {
    render(
      <ProfileSummary
        title="Current persisted profile"
        description="Server-side read model."
        profile={{
          id: 'profile-1',
          username: 'azurepilot',
          displayName: 'Azure Pilot',
          avatarUrl: 'https://images.example/avatar.png',
          bio: 'Deck analyst and test pilot.',
          visibility: 'public',
          createdAt: '2026-04-08T00:00:00.000Z',
          updatedAt: '2026-04-08T01:00:00.000Z',
        }}
      />,
    )

    expect(screen.getByText(/azure pilot/i)).toBeInTheDocument()
    expect(
      screen.getByText(/https:\/\/images\.example\/avatar\.png/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/deck analyst and test pilot/i)).toBeInTheDocument()
    expect(screen.getByText(/@azurepilot/i)).toBeInTheDocument()
  })

  it('renders sane fallbacks for missing avatar and bio', () => {
    render(
      <ProfileSummary
        title="Current persisted profile"
        description="Server-side read model."
        profile={{
          id: 'profile-2',
          username: null,
          displayName: 'Nova Player',
          avatarUrl: null,
          bio: null,
          visibility: 'public',
          createdAt: '2026-04-08T00:00:00.000Z',
          updatedAt: '2026-04-08T01:00:00.000Z',
        }}
      />,
    )

    expect(
      screen.getByText(/no avatar url configured yet/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/no bio published yet/i)).toBeInTheDocument()
  })
})
