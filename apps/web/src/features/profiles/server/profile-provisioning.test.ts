import { describe, expect, it } from 'vitest'

import { deriveInitialProfileDraft } from './profile-provisioning'

describe('deriveInitialProfileDraft', () => {
  it('prefers an explicit display name from the registration flow', () => {
    expect(
      deriveInitialProfileDraft({
        preferredDisplayName: 'Azure Pilot',
        email: 'pilot@example.com',
      }),
    ).toEqual({
      displayName: 'Azure Pilot',
      avatarUrl: null,
      bio: null,
      visibility: 'private',
    })
  })

  it('falls back to the email local part when the preferred name is missing', () => {
    expect(
      deriveInitialProfileDraft({
        preferredDisplayName: '   ',
        email: 'orbital.rider@example.com',
      }),
    ).toEqual({
      displayName: 'orbital.rider',
      avatarUrl: null,
      bio: null,
      visibility: 'private',
    })
  })
})
