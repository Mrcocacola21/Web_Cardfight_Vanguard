import { headers } from 'next/headers'

import {
  deriveInitialProfileDraft,
  readMetadataDisplayName,
} from '@/features/profiles/application/profile-provisioning-use-cases'

export const defaultPostAuthRedirect = '/profile'

const supportedOtpTypes = new Set([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
] as const)

type SupportedOtpType =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | 'email'

export type AuthCallbackErrorCode =
  | 'missing-parameters'
  | 'exchange-failed'
  | 'profile-setup-failed'

export interface AuthCallbackResolvedUser {
  readonly id: string
  readonly email: string | null
  readonly userMetadata: unknown
}

type AuthCallbackRequest =
  | {
      readonly kind: 'code'
      readonly code: string
    }
  | {
      readonly kind: 'otp'
      readonly tokenHash: string
      readonly type: SupportedOtpType
    }

interface AuthCallbackDependencies {
  readonly exchangeCodeForSession: (
    code: string,
  ) => Promise<AuthCallbackResolvedUser | null>
  readonly verifyOtp: (input: {
    tokenHash: string
    type: SupportedOtpType
  }) => Promise<AuthCallbackResolvedUser | null>
  readonly ensureProfile: (user: AuthCallbackResolvedUser) => Promise<boolean>
  readonly signOut: () => Promise<void>
}

export type AuthCallbackFlowResult =
  | {
      readonly kind: 'redirect'
      readonly href: string
    }
  | {
      readonly kind: 'error'
      readonly code: AuthCallbackErrorCode
    }

export function resolveSafePostAuthRedirect(
  candidate: string | null | undefined,
): string {
  const normalizedCandidate = candidate?.trim()

  if (!normalizedCandidate) {
    return defaultPostAuthRedirect
  }

  if (!normalizedCandidate.startsWith('/')) {
    return defaultPostAuthRedirect
  }

  if (normalizedCandidate.startsWith('//')) {
    return defaultPostAuthRedirect
  }

  if (normalizedCandidate.startsWith('/auth/callback')) {
    return defaultPostAuthRedirect
  }

  return normalizedCandidate
}

export function getAuthCallbackErrorMessage(
  code: string | null | undefined,
): string | null {
  switch (code) {
    case 'missing-parameters':
      return 'The confirmation link is incomplete or missing the required verification data.'
    case 'exchange-failed':
      return 'The confirmation link is invalid or expired. Request a new sign-in or sign-up flow and try again.'
    case 'profile-setup-failed':
      return 'Your account was confirmed, but the application profile could not be prepared. Sign in again to retry.'
    default:
      return null
  }
}

export function getAuthCallbackErrorRedirectHref(
  code: AuthCallbackErrorCode,
): string {
  return `/login?authError=${encodeURIComponent(code)}`
}

export function createInitialProfileDraftFromAuthUser(
  user: AuthCallbackResolvedUser,
) {
  return deriveInitialProfileDraft({
    preferredDisplayName: readMetadataDisplayName(user.userMetadata),
    email: user.email,
  })
}

export async function completeAuthCallbackFlow(
  searchParams: URLSearchParams,
  dependencies: AuthCallbackDependencies,
): Promise<AuthCallbackFlowResult> {
  if (searchParams.get('error') || searchParams.get('error_description')) {
    return {
      kind: 'error',
      code: 'exchange-failed',
    }
  }

  const resolvedRedirectHref = resolveSafePostAuthRedirect(
    searchParams.get('next'),
  )
  const callbackRequest = parseAuthCallbackRequest(searchParams)

  if (!callbackRequest) {
    return {
      kind: 'error',
      code: 'missing-parameters',
    }
  }

  const resolvedUser =
    callbackRequest.kind === 'code'
      ? await dependencies.exchangeCodeForSession(callbackRequest.code)
      : await dependencies.verifyOtp({
          tokenHash: callbackRequest.tokenHash,
          type: callbackRequest.type,
        })

  if (!resolvedUser) {
    return {
      kind: 'error',
      code: 'exchange-failed',
    }
  }

  const profilePrepared = await dependencies.ensureProfile(resolvedUser)

  if (!profilePrepared) {
    await dependencies.signOut()

    return {
      kind: 'error',
      code: 'profile-setup-failed',
    }
  }

  return {
    kind: 'redirect',
    href: resolvedRedirectHref,
  }
}

export async function buildAuthCallbackUrl(
  next: string = defaultPostAuthRedirect,
): Promise<string> {
  const origin = await resolveAppOrigin()
  const callbackUrl = new URL('/auth/callback', origin)
  const resolvedNext = resolveSafePostAuthRedirect(next)

  if (resolvedNext !== defaultPostAuthRedirect) {
    callbackUrl.searchParams.set('next', resolvedNext)
  }

  return callbackUrl.toString()
}

async function resolveAppOrigin(): Promise<string> {
  const configuredOrigin = normalizeOriginCandidate(
    process.env.NEXT_PUBLIC_APP_ORIGIN,
  )

  if (configuredOrigin) {
    return configuredOrigin
  }

  const headerStore = await headers()
  const originHeader = normalizeOriginCandidate(headerStore.get('origin'))

  if (originHeader) {
    return originHeader
  }

  const forwardedHost =
    headerStore.get('x-forwarded-host') ?? headerStore.get('host')
  const normalizedHost = forwardedHost?.split(',')[0]?.trim()

  if (!normalizedHost) {
    throw new Error(
      'Failed to resolve the application origin for auth callback redirects.',
    )
  }

  const forwardedProto =
    headerStore.get('x-forwarded-proto')?.split(',')[0]?.trim() ??
    (normalizedHost.startsWith('localhost') ||
    normalizedHost.startsWith('127.0.0.1')
      ? 'http'
      : 'https')

  return `${forwardedProto}://${normalizedHost}`
}

function parseAuthCallbackRequest(
  searchParams: URLSearchParams,
): AuthCallbackRequest | null {
  const authCode = searchParams.get('code')?.trim()

  if (authCode) {
    return {
      kind: 'code',
      code: authCode,
    }
  }

  const tokenHash = searchParams.get('token_hash')?.trim()
  const otpType = searchParams.get('type')?.trim()

  if (tokenHash && otpType && isSupportedOtpType(otpType)) {
    return {
      kind: 'otp',
      tokenHash,
      type: otpType,
    }
  }

  return null
}

function isSupportedOtpType(value: string): value is SupportedOtpType {
  return supportedOtpTypes.has(value as SupportedOtpType)
}

function normalizeOriginCandidate(value: string | null | undefined) {
  const normalizedValue = value?.trim()

  if (!normalizedValue) {
    return null
  }

  try {
    const parsedUrl = new URL(normalizedValue)

    return `${parsedUrl.protocol}//${parsedUrl.host}`
  } catch {
    return null
  }
}
