// @vitest-environment node

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ProfileProvisioningModule from '@/features/profiles/server/profile-provisioning'

type CookieWrite = {
  readonly name: string
  readonly value: string
  readonly options?: {
    readonly path?: string
    readonly maxAge?: number
  }
}

type AuthRouteUser = {
  readonly id: string
  readonly email: string | null
  readonly user_metadata: unknown
}

type ExchangeResponse = {
  readonly data: {
    readonly user: AuthRouteUser | null
  }
  readonly error: object | null
}

type EnsureProfileResponse =
  | {
      readonly ok: true
      readonly data: {
        readonly id: string
      }
    }
  | {
      readonly ok: false
      readonly error: string
    }

type CookieAdapter = {
  readonly cookies: {
    readonly setAll: (cookies: CookieWrite[]) => void
  }
}

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  exchangeCodeForSession: vi.fn<(code: string) => Promise<ExchangeResponse>>(),
  verifyOtp: vi.fn<(input: unknown) => Promise<ExchangeResponse>>(),
  signOut: vi.fn<() => Promise<void>>(),
  ensureProfileForAuthUser:
    vi.fn<(input: unknown) => Promise<EnsureProfileResponse>>(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: mocks.createServerClient,
}))

vi.mock('@/features/profiles/server/profile-provisioning', async () => {
  const actual = await vi.importActual<typeof ProfileProvisioningModule>(
    '@/features/profiles/server/profile-provisioning',
  )

  return {
    ...actual,
    ensureProfileForAuthUser: mocks.ensureProfileForAuthUser,
  }
})

import { GET } from './route'

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key'

    mocks.createServerClient.mockImplementation(
      (_url: string, _key: string, options: CookieAdapter) => ({
        auth: {
          exchangeCodeForSession: (code: string) => {
            options.cookies.setAll([
              {
                name: 'sb-access-token',
                value: 'token',
                options: {
                  path: '/',
                },
              },
            ])

            return mocks.exchangeCodeForSession(code)
          },
          verifyOtp: (input: unknown) => {
            options.cookies.setAll([
              {
                name: 'sb-access-token',
                value: 'token',
                options: {
                  path: '/',
                },
              },
            ])

            return mocks.verifyOtp(input)
          },
          signOut: () => {
            options.cookies.setAll([
              {
                name: 'sb-access-token',
                value: '',
                options: {
                  path: '/',
                  maxAge: 0,
                },
              },
            ])

            return mocks.signOut()
          },
        },
      }),
    )
  })

  it('exchanges the auth code, ensures the profile, and redirects with session cookies', async () => {
    mocks.exchangeCodeForSession.mockResolvedValueOnce({
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

    const response = await GET(
      new NextRequest(
        'http://127.0.0.1:3000/auth/callback?code=valid-code&next=/catalog',
      ),
    )

    expect(response.status).toBeGreaterThanOrEqual(300)
    expect(response.status).toBeLessThan(400)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/catalog',
    )
    expect(response.headers.get('set-cookie')).toContain(
      'sb-access-token=token',
    )
    const ensureProfileInput = mocks.ensureProfileForAuthUser.mock.calls[0]?.[0]

    expect(ensureProfileInput).toMatchObject({
      authUserId: 'auth-user-1',
      displayName: 'Azure Pilot',
      avatarUrl: null,
      bio: null,
      visibility: 'private',
    })
    expect(ensureProfileInput).toHaveProperty('client')
  })

  it('redirects missing callback parameters to login with an explicit error', async () => {
    const response = await GET(
      new NextRequest('http://127.0.0.1:3000/auth/callback'),
    )

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?authError=missing-parameters',
    )
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled()
    expect(mocks.verifyOtp).not.toHaveBeenCalled()
  })
})
