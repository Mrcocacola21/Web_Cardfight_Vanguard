import { describe, expect, it, vi } from 'vitest'

import {
  completeAuthCallbackFlow,
  getAuthCallbackErrorMessage,
  resolveSafePostAuthRedirect,
} from './auth-callback'

describe('resolveSafePostAuthRedirect', () => {
  it('keeps safe relative redirects', () => {
    expect(resolveSafePostAuthRedirect('/catalog')).toBe('/catalog')
  })

  it('falls back for external or callback-loop redirects', () => {
    expect(resolveSafePostAuthRedirect('https://evil.example')).toBe('/profile')
    expect(resolveSafePostAuthRedirect('//evil.example')).toBe('/profile')
    expect(resolveSafePostAuthRedirect('/auth/callback')).toBe('/profile')
  })
})

describe('completeAuthCallbackFlow', () => {
  it('redirects after a valid code exchange and profile ensure', async () => {
    const ensureProfile = vi.fn(() => Promise.resolve(true))

    const result = await completeAuthCallbackFlow(
      new URLSearchParams({
        code: 'valid-code',
        next: '/catalog',
      }),
      {
        exchangeCodeForSession: () =>
          Promise.resolve({
            id: 'auth-user-1',
            email: 'pilot@example.com',
            userMetadata: {
              display_name: 'Azure Pilot',
            },
          }),
        verifyOtp: () => Promise.resolve(null),
        ensureProfile,
        signOut: () => Promise.resolve(),
      },
    )

    expect(result).toEqual({
      kind: 'redirect',
      href: '/catalog',
    })
    expect(ensureProfile).toHaveBeenCalledOnce()
  })

  it('returns an error when verification parameters are missing', async () => {
    const result = await completeAuthCallbackFlow(new URLSearchParams(), {
      exchangeCodeForSession: () => Promise.resolve(null),
      verifyOtp: () => Promise.resolve(null),
      ensureProfile: () => Promise.resolve(true),
      signOut: () => Promise.resolve(),
    })

    expect(result).toEqual({
      kind: 'error',
      code: 'missing-parameters',
    })
  })

  it('treats provider callback errors as exchange failures', async () => {
    const result = await completeAuthCallbackFlow(
      new URLSearchParams({
        error: 'access_denied',
        error_description: 'Email link expired',
      }),
      {
        exchangeCodeForSession: () => Promise.resolve(null),
        verifyOtp: () => Promise.resolve(null),
        ensureProfile: () => Promise.resolve(true),
        signOut: () => Promise.resolve(),
      },
    )

    expect(result).toEqual({
      kind: 'error',
      code: 'exchange-failed',
    })
  })

  it('signs out and returns an error when profile setup fails after exchange', async () => {
    const signOut = vi.fn(() => Promise.resolve())

    const result = await completeAuthCallbackFlow(
      new URLSearchParams({
        code: 'valid-code',
      }),
      {
        exchangeCodeForSession: () =>
          Promise.resolve({
            id: 'auth-user-1',
            email: 'pilot@example.com',
            userMetadata: null,
          }),
        verifyOtp: () => Promise.resolve(null),
        ensureProfile: () => Promise.resolve(false),
        signOut,
      },
    )

    expect(result).toEqual({
      kind: 'error',
      code: 'profile-setup-failed',
    })
    expect(signOut).toHaveBeenCalledOnce()
  })
})

describe('getAuthCallbackErrorMessage', () => {
  it('maps callback error codes to user-facing messages', () => {
    expect(getAuthCallbackErrorMessage('exchange-failed')).toMatch(
      /invalid or expired/i,
    )
    expect(getAuthCallbackErrorMessage('unknown')).toBeNull()
  })
})
