export interface AuthFieldErrors {
  readonly displayName?: string
  readonly email?: string
  readonly password?: string
  readonly confirmPassword?: string
}

export interface SignInDraft {
  readonly email: string
  readonly password: string
}

export interface SignUpDraft extends SignInDraft {
  readonly displayName: string
  readonly confirmPassword: string
}

export type AuthValidationResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly errors: AuthFieldErrors
    }

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
}

function validatePassword(password: string) {
  return password.trim().length >= 6
}

export function validateSignInDraft(
  input: SignInDraft,
): AuthValidationResult<SignInDraft> {
  const email = normalizeEmail(input.email)
  const password = input.password
  const errors: {
    email?: string
    password?: string
  } = {}

  if (!email) {
    errors.email = 'Email is required.'
  } else if (!validateEmail(email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!password) {
    errors.password = 'Password is required.'
  } else if (!validatePassword(password)) {
    errors.password = 'Password must be at least 6 characters.'
  }

  if (errors.email || errors.password) {
    return {
      ok: false,
      errors,
    }
  }

  return {
    ok: true,
    data: {
      email,
      password,
    },
  }
}

export function validateSignUpDraft(
  input: SignUpDraft,
): AuthValidationResult<SignUpDraft> {
  const displayName = input.displayName.trim()
  const base = validateSignInDraft(input)
  const errors: {
    displayName?: string
  } = {}
  const confirmPassword = input.confirmPassword
  const trimmedConfirmPassword = confirmPassword.trim()

  if (displayName.length === 0) {
    errors.displayName = 'Display name is required.'
  } else if (displayName.length > 80) {
    errors.displayName = 'Display name must stay within 80 characters.'
  }

  let confirmPasswordError: string | undefined

  if (!trimmedConfirmPassword) {
    confirmPasswordError = 'Confirm your password.'
  } else if (base.ok && base.data.password !== confirmPassword) {
    confirmPasswordError = 'Passwords do not match.'
  }

  if (!base.ok || errors.displayName || confirmPasswordError) {
    const baseErrors = base.ok ? {} : base.errors

    return {
      ok: false,
      errors: {
        ...errors,
        ...baseErrors,
        ...(confirmPasswordError
          ? { confirmPassword: confirmPasswordError }
          : {}),
      },
    }
  }

  return {
    ok: true,
    data: {
      displayName,
      ...base.data,
      confirmPassword,
    },
  }
}
