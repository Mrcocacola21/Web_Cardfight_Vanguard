import { describe, expect, it } from 'vitest'

import {
  resolveAuthPageDecision,
  resolveProtectedRouteDecision,
} from './route-guards'

describe('resolveProtectedRouteDecision', () => {
  it('redirects signed-out users to login', () => {
    expect(
      resolveProtectedRouteDecision({
        kind: 'signed-out',
      }),
    ).toEqual({
      kind: 'redirect',
      href: '/login',
    })
  })

  it('allows authenticated users', () => {
    expect(
      resolveProtectedRouteDecision({
        kind: 'ready',
        user: {
          id: 'user-1',
          email: 'pilot@example.com',
        },
      }),
    ).toEqual({
      kind: 'allow',
    })
  })
})

describe('resolveAuthPageDecision', () => {
  it('redirects authenticated users away from auth pages', () => {
    expect(
      resolveAuthPageDecision({
        kind: 'ready',
        user: {
          id: 'user-1',
          email: 'pilot@example.com',
        },
      }),
    ).toEqual({
      kind: 'redirect',
      href: '/profile',
    })
  })

  it('allows guests to stay on auth pages', () => {
    expect(
      resolveAuthPageDecision({
        kind: 'signed-out',
      }),
    ).toEqual({
      kind: 'allow',
    })
  })
})
