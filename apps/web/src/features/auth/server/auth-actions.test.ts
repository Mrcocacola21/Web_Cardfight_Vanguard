// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthCallbackModule from '@/features/auth/server/auth-callback'
import type * as ProfileProvisioningModule from '@/features/profiles/server/profile-provisioning'

import { initialAuthFormState } from './auth-form-state'

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`)
  }),
  createSupabaseServerClient: vi.fn(),
  buildAuthCallbackUrl: vi.fn(),
  ensureProfileForAuthUser: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/auth/server/auth-callback', async () => {
  const actual = await vi.importActual<typeof AuthCallbackModule>(
    '@/features/auth/server/auth-callback',
  )

  return {
    ...actual,
    buildAuthCallbackUrl: mocks.buildAuthCallbackUrl,
  }
})

vi.mock('@/features/profiles/server/profile-provisioning', async () => {
  const actual = await vi.importActual<typeof ProfileProvisioningModule>(
    '@/features/profiles/server/profile-provisioning',
  )

  return {
    ...actual,
    ensureProfileForAuthUser: mocks.ensureProfileForAuthUser,
  }
})

import { signInAction, signOutAction, signUpAction } from './auth-actions'

function createFormData(values: Record<string, string>) {
  const formData = new FormData()

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value)
  }

  return formData
}

function createSupabaseClientMock() {
  return {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
    },
  }
}

describe('auth actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('completes sign up with email-confirmation messaging when no session is returned', async () => {
    const client = createSupabaseClientMock()
    mocks.createSupabaseServerClient.mockResolvedValueOnce(client)
    mocks.buildAuthCallbackUrl.mockResolvedValueOnce(
      'http://127.0.0.1:3000/auth/callback',
    )
    client.auth.signUp.mockResolvedValueOnce({
      data: {
        user: {
          id: 'auth-user-1',
          email: 'pilot@example.com',
        },
        session: null,
      },
      error: null,
    })
    mocks.ensureProfileForAuthUser.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'profile-1',
      },
    })

    const result = await signUpAction(
      initialAuthFormState,
      createFormData({
        displayName: 'Azure Pilot',
        email: 'pilot@example.com',
        password: 'vanguard-pass-123',
        confirmPassword: 'vanguard-pass-123',
      }),
    )

    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'pilot@example.com',
      password: 'vanguard-pass-123',
      options: {
        emailRedirectTo: 'http://127.0.0.1:3000/auth/callback',
        data: {
          display_name: 'Azure Pilot',
        },
      },
    })
    expect(mocks.ensureProfileForAuthUser).toHaveBeenCalledWith({
      client,
      authUserId: 'auth-user-1',
      displayName: 'Azure Pilot',
      avatarUrl: null,
      bio: null,
      visibility: 'private',
    })
    expect(result).toEqual({
      status: 'success',
      message:
        'Account created and profile initialized. If email confirmation is enabled for this environment, use the email link to finish sign-in and return to the app automatically.',
      fieldErrors: {},
    })
  })

  it('fails sign up cleanly when the callback URL cannot be prepared', async () => {
    const client = createSupabaseClientMock()
    mocks.createSupabaseServerClient.mockResolvedValueOnce(client)
    mocks.buildAuthCallbackUrl.mockRejectedValueOnce(
      new Error('missing origin'),
    )

    const result = await signUpAction(
      initialAuthFormState,
      createFormData({
        displayName: 'Azure Pilot',
        email: 'pilot@example.com',
        password: 'vanguard-pass-123',
        confirmPassword: 'vanguard-pass-123',
      }),
    )

    expect(client.auth.signUp).not.toHaveBeenCalled()
    expect(result).toEqual({
      status: 'error',
      message:
        'Registration is temporarily unavailable because the email confirmation callback URL could not be prepared.',
      fieldErrors: {},
    })
  })

  it('redirects to the protected profile route after a successful sign in', async () => {
    const client = createSupabaseClientMock()
    mocks.createSupabaseServerClient.mockResolvedValueOnce(client)
    client.auth.signInWithPassword.mockResolvedValueOnce({
      data: {
        user: {
          id: 'auth-user-1',
          email: 'pilot@example.com',
          user_metadata: {
            display_name: 'Azure Pilot',
          },
        },
      },
      error: null,
    })
    mocks.ensureProfileForAuthUser.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'profile-1',
      },
    })

    await expect(
      signInAction(
        initialAuthFormState,
        createFormData({
          email: 'pilot@example.com',
          password: 'vanguard-pass-123',
        }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT:/profile')

    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'pilot@example.com',
      password: 'vanguard-pass-123',
    })
    expect(mocks.ensureProfileForAuthUser).toHaveBeenCalledWith({
      client,
      authUserId: 'auth-user-1',
      displayName: 'Azure Pilot',
      avatarUrl: null,
      bio: null,
      visibility: 'private',
    })
    expect(mocks.redirect).toHaveBeenCalledWith('/profile')
  })

  it('returns a friendly error when sign-in credentials are invalid', async () => {
    const client = createSupabaseClientMock()
    mocks.createSupabaseServerClient.mockResolvedValueOnce(client)
    client.auth.signInWithPassword.mockResolvedValueOnce({
      data: {
        user: null,
      },
      error: {
        message: 'Invalid login credentials',
      },
    })

    const result = await signInAction(
      initialAuthFormState,
      createFormData({
        email: 'pilot@example.com',
        password: 'wrong-password',
      }),
    )

    expect(result).toEqual({
      status: 'error',
      message: 'Email or password is incorrect.',
      fieldErrors: {},
    })
  })

  it('clears the session and redirects to login on sign out', async () => {
    const client = createSupabaseClientMock()
    mocks.createSupabaseServerClient.mockResolvedValueOnce(client)
    client.auth.signOut.mockResolvedValueOnce({
      error: null,
    })

    await expect(signOutAction()).rejects.toThrow('NEXT_REDIRECT:/login')

    expect(client.auth.signOut).toHaveBeenCalledOnce()
    expect(mocks.redirect).toHaveBeenCalledWith('/login')
  })
})
