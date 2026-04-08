'use server'

import { redirect } from 'next/navigation'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildAuthCallbackUrl } from '@/features/auth/server/auth-callback'
import {
  deriveInitialProfileDraft,
  ensureProfileForAuthUser,
  readMetadataDisplayName,
} from '@/features/profiles/server/profile-provisioning'

import { validateSignInDraft, validateSignUpDraft } from './auth-validation'
import type { AuthFormState } from './auth-form-state'

function mapAuthErrorMessage(errorMessage: string, fallbackMessage: string) {
  const normalizedMessage = errorMessage.toLowerCase()

  if (normalizedMessage.includes('invalid login credentials')) {
    return 'Email or password is incorrect.'
  }

  if (normalizedMessage.includes('user already registered')) {
    return 'An account with this email already exists.'
  }

  if (normalizedMessage.includes('email not confirmed')) {
    return 'Confirm your email before signing in.'
  }

  if (normalizedMessage.includes('password should be at least')) {
    return 'Password must be at least 6 characters.'
  }

  return fallbackMessage
}
export async function signInAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const emailValue = formData.get('email')
  const passwordValue = formData.get('password')

  const validation = validateSignInDraft({
    email: typeof emailValue === 'string' ? emailValue : '',
    password: typeof passwordValue === 'string' ? passwordValue : '',
  })

  if (!validation.ok) {
    return {
      status: 'error',
      message: 'Email or password is invalid.',
      fieldErrors: validation.errors,
    }
  }

  const client = await createSupabaseServerClient()
  const { data, error } = await client.auth.signInWithPassword({
    email: validation.data.email,
    password: validation.data.password,
  })

  if (error) {
    return {
      status: 'error',
      message: mapAuthErrorMessage(error.message, 'Failed to sign in.'),
      fieldErrors: {},
    }
  }

  if (!data.user) {
    await client.auth.signOut()

    return {
      status: 'error',
      message:
        'Sign-in completed, but the authenticated user could not be resolved.',
      fieldErrors: {},
    }
  }

  const initialProfileDraft = deriveInitialProfileDraft({
    preferredDisplayName: readMetadataDisplayName(data.user.user_metadata),
    email: data.user.email ?? validation.data.email,
  })
  const profileResult = await ensureProfileForAuthUser({
    client,
    authUserId: data.user.id,
    displayName: initialProfileDraft.displayName,
    avatarUrl: initialProfileDraft.avatarUrl,
    bio: initialProfileDraft.bio,
    visibility: initialProfileDraft.visibility,
  })

  if (!profileResult.ok) {
    await client.auth.signOut()

    return {
      status: 'error',
      message:
        'Sign-in succeeded, but the application profile could not be prepared. The session was cleared; sign in again to retry.',
      fieldErrors: {},
    }
  }

  redirect('/profile')
}

export async function signUpAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const displayNameValue = formData.get('displayName')
  const emailValue = formData.get('email')
  const passwordValue = formData.get('password')
  const confirmPasswordValue = formData.get('confirmPassword')

  const validation = validateSignUpDraft({
    displayName: typeof displayNameValue === 'string' ? displayNameValue : '',
    email: typeof emailValue === 'string' ? emailValue : '',
    password: typeof passwordValue === 'string' ? passwordValue : '',
    confirmPassword:
      typeof confirmPasswordValue === 'string' ? confirmPasswordValue : '',
  })

  if (!validation.ok) {
    return {
      status: 'error',
      message: 'Registration data is incomplete or invalid.',
      fieldErrors: validation.errors,
    }
  }

  const client = await createSupabaseServerClient()
  let emailRedirectTo: string

  try {
    emailRedirectTo = await buildAuthCallbackUrl()
  } catch {
    return {
      status: 'error',
      message:
        'Registration is temporarily unavailable because the email confirmation callback URL could not be prepared.',
      fieldErrors: {},
    }
  }

  const { data, error } = await client.auth.signUp({
    email: validation.data.email,
    password: validation.data.password,
    options: {
      emailRedirectTo,
      data: {
        display_name: validation.data.displayName,
      },
    },
  })

  if (error) {
    return {
      status: 'error',
      message: mapAuthErrorMessage(error.message, 'Failed to register.'),
      fieldErrors: {},
    }
  }

  if (!data.user) {
    return {
      status: 'error',
      message:
        'Account registration completed, but the authenticated user record could not be resolved.',
      fieldErrors: {},
    }
  }

  const initialProfileDraft = deriveInitialProfileDraft({
    preferredDisplayName: validation.data.displayName,
    email: data.user.email ?? validation.data.email,
  })
  const profileResult = await ensureProfileForAuthUser({
    client,
    authUserId: data.user.id,
    displayName: initialProfileDraft.displayName,
    avatarUrl: initialProfileDraft.avatarUrl,
    bio: initialProfileDraft.bio,
    visibility: initialProfileDraft.visibility,
  })

  if (!profileResult.ok) {
    if (data.session) {
      await client.auth.signOut()
    }

    return {
      status: 'error',
      message: data.session
        ? 'Account created, but profile initialization failed. The session was cleared; sign in again to retry.'
        : 'Account created, but profile initialization failed. After confirming your email, sign in to retry profile setup.',
      fieldErrors: {},
    }
  }

  if (data.session) {
    redirect('/profile')
  }

  return {
    status: 'success',
    message:
      'Account created and profile initialized. If email confirmation is enabled for this environment, use the email link to finish sign-in and return to the app automatically.',
    fieldErrors: {},
  }
}

export async function signOutAction() {
  const client = await createSupabaseServerClient()
  await client.auth.signOut()

  redirect('/login')
}
