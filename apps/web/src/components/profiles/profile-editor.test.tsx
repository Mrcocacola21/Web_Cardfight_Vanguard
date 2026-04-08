import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProfileEditor } from './profile-editor'

describe('ProfileEditor', () => {
  it('renders editable profile fields with initial values', () => {
    render(
      <ProfileEditor
        initialValues={{
          displayName: 'Azure Pilot',
          avatarUrl: 'https://images.example/avatar.png',
          bio: 'Deck analyst and test pilot.',
          visibility: 'private',
        }}
      />,
    )

    expect(screen.getByLabelText(/display name/i)).toHaveValue('Azure Pilot')
    expect(screen.getByLabelText(/profile visibility/i)).toHaveValue('private')
    expect(screen.getByLabelText(/avatar url/i)).toHaveValue(
      'https://images.example/avatar.png',
    )
    expect(screen.getByLabelText(/bio/i)).toHaveValue(
      'Deck analyst and test pilot.',
    )
    expect(
      screen.getByRole('button', { name: /save profile/i }),
    ).toBeInTheDocument()
  })
})
