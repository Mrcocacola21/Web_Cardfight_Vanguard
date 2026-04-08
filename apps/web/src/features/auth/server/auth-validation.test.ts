import { describe, expect, it } from 'vitest'

import { validateSignInDraft, validateSignUpDraft } from './auth-validation'

describe('auth validation', () => {
  it('accepts a valid sign-in draft', () => {
    expect(
      validateSignInDraft({
        email: ' Pilot@Example.com ',
        password: 'secret12',
      }),
    ).toEqual({
      ok: true,
      data: {
        email: 'pilot@example.com',
        password: 'secret12',
      },
    })
  })

  it('rejects invalid sign-in fields', () => {
    expect(
      validateSignInDraft({
        email: 'invalid',
        password: '123',
      }),
    ).toEqual({
      ok: false,
      errors: {
        email: 'Enter a valid email address.',
        password: 'Password must be at least 6 characters.',
      },
    })
  })

  it('rejects sign-up password mismatch', () => {
    expect(
      validateSignUpDraft({
        displayName: '   ',
        email: 'pilot@example.com',
        password: 'secret12',
        confirmPassword: 'secret13',
      }),
    ).toEqual({
      ok: false,
      errors: {
        displayName: 'Display name is required.',
        confirmPassword: 'Passwords do not match.',
      },
    })
  })

  it('accepts a valid sign-up draft with display name', () => {
    expect(
      validateSignUpDraft({
        displayName: 'Azure Pilot',
        email: ' Pilot@Example.com ',
        password: 'secret12',
        confirmPassword: 'secret12',
      }),
    ).toEqual({
      ok: true,
      data: {
        displayName: 'Azure Pilot',
        email: 'pilot@example.com',
        password: 'secret12',
        confirmPassword: 'secret12',
      },
    })
  })
})
