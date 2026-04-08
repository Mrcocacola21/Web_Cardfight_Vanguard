import { describe, expect, it } from 'vitest'

import { getCurrentAuthState } from './auth-session'

describe('getCurrentAuthState', () => {
  it('returns signed-out when the server client has no user', async () => {
    const state = await getCurrentAuthState({
      client: {
        auth: {
          getUser: () =>
            Promise.resolve({
              data: {
                user: null,
              },
              error: null,
            }),
        },
      } as never,
    })

    expect(state).toEqual({
      kind: 'signed-out',
    })
  })

  it('returns ready when the server client resolves a user', async () => {
    const state = await getCurrentAuthState({
      client: {
        auth: {
          getUser: () =>
            Promise.resolve({
              data: {
                user: {
                  id: 'auth-user-1',
                  email: 'pilot@example.com',
                },
              },
              error: null,
            }),
        },
      } as never,
    })

    expect(state).toEqual({
      kind: 'ready',
      user: {
        id: 'auth-user-1',
        email: 'pilot@example.com',
      },
    })
  })

  it('returns an error state when session resolution fails', async () => {
    const state = await getCurrentAuthState({
      client: {
        auth: {
          getUser: () =>
            Promise.resolve({
              data: {
                user: null,
              },
              error: {
                message: 'session resolution failed',
              },
            }),
        },
      } as never,
    })

    expect(state).toEqual({
      kind: 'error',
      message: 'Failed to resolve the current authenticated session.',
    })
  })
})
