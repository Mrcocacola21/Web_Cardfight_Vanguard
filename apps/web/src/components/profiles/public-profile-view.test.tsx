import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PublicProfileView } from './public-profile-view'

describe('PublicProfileView', () => {
  it('renders only the public profile fields', () => {
    render(
      <PublicProfileView
        viewerCategory="authenticated-non-friend"
        viewerProfileId="profile-viewer"
        profile={{
          id: 'profile-1',
          displayName: 'Azure Pilot',
          avatarUrl: 'https://images.example/avatar.png',
          bio: 'Public pilot bio.',
          visibility: 'public',
          bioVisibility: 'public',
          bioVisible: true,
        }}
      />,
    )

    expect(
      screen.getByRole('heading', { name: /azure pilot/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/profile details/i)).toBeInTheDocument()
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
        viewerCategory="owner"
        viewerProfileId="profile-1"
        profile={{
          id: 'profile-1',
          displayName: 'Azure Pilot',
          avatarUrl: null,
          bio: null,
          visibility: 'private',
          bioVisibility: 'private',
          bioVisible: true,
        }}
      />,
    )

    expect(screen.getByText(/owner view/i)).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: /manage your profile and privacy settings/i,
      }),
    ).toHaveAttribute('href', '/profile')
  })

  it('renders a guest sign-in entry point for friend requests when no viewer profile is available', () => {
    render(
      <PublicProfileView
        viewerCategory="guest"
        profile={{
          id: 'profile-2',
          displayName: 'Nova Player',
          avatarUrl: null,
          bio: null,
          visibility: 'public',
          bioVisibility: 'public',
          bioVisible: false,
        }}
      />,
    )

    expect(
      screen.getByRole('link', { name: /sign in to add friend/i }),
    ).toHaveAttribute('href', '/login')
  })

  it('renders remove-friend controls when the viewer already has an active friendship', () => {
    render(
      <PublicProfileView
        viewerCategory="friend"
        viewerProfileId="profile-viewer"
        relationshipState={{
          kind: 'friend',
          friendshipId: 'friendship-1',
        }}
        profile={{
          id: 'profile-2',
          displayName: 'Nova Player',
          avatarUrl: null,
          bio: null,
          visibility: 'friends',
          bioVisibility: 'private',
          bioVisible: false,
        }}
      />,
    )

    expect(
      screen.getByRole('button', { name: /remove friend/i }),
    ).toBeInTheDocument()
  })

  it('renders a privacy message when bio is hidden from the current viewer category', () => {
    render(
      <PublicProfileView
        viewerCategory="authenticated-non-friend"
        viewerProfileId="profile-viewer"
        profile={{
          id: 'profile-2',
          displayName: 'Nova Player',
          avatarUrl: null,
          bio: null,
          visibility: 'public',
          bioVisibility: 'friends',
          bioVisible: false,
        }}
      />,
    )

    expect(
      screen.getByText(/bio is visible to friends only/i),
    ).toBeInTheDocument()
  })
})
