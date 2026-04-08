import { describe, expect, it } from 'vitest'

import { validateProfileDraft } from './profile-validation'

describe('validateProfileDraft', () => {
  it('accepts a small valid profile payload', () => {
    expect(
      validateProfileDraft({
        displayName: 'Azure Pilot',
        avatarUrl: 'https://images.example/avatar.png',
        bio: 'Testing profile foundation.',
        visibility: 'public',
      }),
    ).toEqual({
      ok: true,
      data: {
        displayName: 'Azure Pilot',
        avatarUrl: 'https://images.example/avatar.png',
        bio: 'Testing profile foundation.',
        visibility: 'public',
      },
    })
  })

  it('rejects empty display names, invalid visibility, and oversized bios', () => {
    expect(
      validateProfileDraft({
        displayName: '   ',
        avatarUrl: 'not-a-url',
        bio: 'x'.repeat(281),
        visibility: 'friends',
      }),
    ).toEqual({
      ok: false,
      errors: {
        displayName: 'Display name is required.',
        avatarUrl: 'Avatar URL must be a valid absolute URL.',
        bio: 'Bio must stay within 280 characters.',
        visibility: 'Profile visibility must be public or private.',
      },
    })
  })
})
