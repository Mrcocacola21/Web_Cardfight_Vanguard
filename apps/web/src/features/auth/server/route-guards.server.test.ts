// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentAuthState: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`)
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}))

vi.mock('./auth-session', () => ({
  getCurrentAuthState: mocks.getCurrentAuthState,
}))

import {
  requireAuthPageAccess,
  requireProtectedRouteAccess,
} from './route-guards'

describe('server route guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects signed-out users away from protected routes', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'signed-out',
    })

    await expect(requireProtectedRouteAccess()).rejects.toThrow(
      'NEXT_REDIRECT:/login',
    )
    expect(mocks.redirect).toHaveBeenCalledWith('/login')
  })

  it('returns the authenticated user for protected routes', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'ready',
      user: {
        id: 'auth-user-1',
        email: 'pilot@example.com',
      },
    })

    await expect(requireProtectedRouteAccess()).resolves.toEqual({
      kind: 'authorized',
      user: {
        id: 'auth-user-1',
        email: 'pilot@example.com',
      },
    })
  })

  it('redirects authenticated users away from auth pages', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'ready',
      user: {
        id: 'auth-user-1',
        email: 'pilot@example.com',
      },
    })

    await expect(requireAuthPageAccess()).rejects.toThrow(
      'NEXT_REDIRECT:/profile',
    )
    expect(mocks.redirect).toHaveBeenCalledWith('/profile')
  })

  it('returns an error state when auth page access cannot resolve session', async () => {
    mocks.getCurrentAuthState.mockResolvedValueOnce({
      kind: 'error',
      message: 'session resolution failed',
    })

    await expect(requireAuthPageAccess()).resolves.toEqual({
      kind: 'error',
      message: 'session resolution failed',
    })
  })
})
