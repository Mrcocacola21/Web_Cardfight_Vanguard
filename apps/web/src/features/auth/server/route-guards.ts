import { redirect } from 'next/navigation'

import {
  getCurrentAuthState,
  type AuthUserRecord,
  type CurrentAuthState,
} from './auth-session'

export type RouteGuardDecision =
  | {
      readonly kind: 'allow'
    }
  | {
      readonly kind: 'redirect'
      readonly href: string
    }
  | {
      readonly kind: 'error'
      readonly message: string
    }

export type ProtectedRouteState =
  | {
      readonly kind: 'authorized'
      readonly user: AuthUserRecord
    }
  | {
      readonly kind: 'error'
      readonly message: string
    }

export type AuthPageRouteState =
  | {
      readonly kind: 'guest'
    }
  | {
      readonly kind: 'error'
      readonly message: string
    }

export function resolveProtectedRouteDecision(
  authState: CurrentAuthState,
): RouteGuardDecision {
  if (authState.kind === 'ready') {
    return {
      kind: 'allow',
    }
  }

  if (authState.kind === 'signed-out') {
    return {
      kind: 'redirect',
      href: '/login',
    }
  }

  return {
    kind: 'error',
    message: authState.message,
  }
}

export function resolveAuthPageDecision(
  authState: CurrentAuthState,
): RouteGuardDecision {
  if (authState.kind === 'ready') {
    return {
      kind: 'redirect',
      href: '/profile',
    }
  }

  if (authState.kind === 'signed-out') {
    return {
      kind: 'allow',
    }
  }

  return {
    kind: 'error',
    message: authState.message,
  }
}

export async function requireProtectedRouteAccess(): Promise<ProtectedRouteState> {
  const authState = await getCurrentAuthState()

  if (authState.kind === 'signed-out') {
    redirect('/login')
  }

  if (authState.kind === 'error') {
    return {
      kind: 'error',
      message: authState.message,
    }
  }

  return {
    kind: 'authorized',
    user: authState.user,
  }
}

export async function requireAuthPageAccess(): Promise<AuthPageRouteState> {
  const authState = await getCurrentAuthState()

  if (authState.kind === 'ready') {
    redirect('/profile')
  }

  if (authState.kind === 'error') {
    return {
      kind: 'error',
      message: authState.message,
    }
  }

  return {
    kind: 'guest',
  }
}
