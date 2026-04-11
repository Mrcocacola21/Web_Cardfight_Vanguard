'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { ErrorState, SuccessState } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { signUpAction } from '@/features/auth/server/auth-actions'
import {
  initialAuthFormState,
  type AuthFormState,
} from '@/features/auth/server/auth-form-state'

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState<
    AuthFormState,
    FormData
  >(signUpAction, initialAuthFormState)
  const displayNameErrorId = state.fieldErrors.displayName
    ? 'sign-up-display-name-error'
    : undefined
  const emailErrorId = state.fieldErrors.email
    ? 'sign-up-email-error'
    : undefined
  const passwordErrorId = state.fieldErrors.password
    ? 'sign-up-password-error'
    : undefined
  const confirmPasswordErrorId = state.fieldErrors.confirmPassword
    ? 'sign-up-confirm-password-error'
    : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register</CardTitle>
        <CardDescription>
          Minimal registration through Supabase Auth. The app captures a display
          name and creates the initial profile baseline after successful account
          creation.
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="displayName" className="text-sm font-medium">
              Display name
            </label>
            <Input
              id="displayName"
              name="displayName"
              required
              autoComplete="nickname"
              aria-invalid={state.fieldErrors.displayName ? 'true' : 'false'}
              aria-describedby={displayNameErrorId}
              placeholder="Azure Pilot"
            />
            {state.fieldErrors.displayName ? (
              <p id={displayNameErrorId} className="text-sm text-destructive">
                {state.fieldErrors.displayName}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              aria-invalid={state.fieldErrors.email ? 'true' : 'false'}
              aria-describedby={emailErrorId}
              placeholder="pilot@example.com"
            />
            {state.fieldErrors.email ? (
              <p id={emailErrorId} className="text-sm text-destructive">
                {state.fieldErrors.email}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              aria-invalid={state.fieldErrors.password ? 'true' : 'false'}
              aria-describedby={passwordErrorId}
              placeholder="Create a password"
            />
            {state.fieldErrors.password ? (
              <p id={passwordErrorId} className="text-sm text-destructive">
                {state.fieldErrors.password}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm password
            </label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              aria-invalid={
                state.fieldErrors.confirmPassword ? 'true' : 'false'
              }
              aria-describedby={confirmPasswordErrorId}
              placeholder="Repeat the password"
            />
            {state.fieldErrors.confirmPassword ? (
              <p
                id={confirmPasswordErrorId}
                className="text-sm text-destructive"
              >
                {state.fieldErrors.confirmPassword}
              </p>
            ) : null}
          </div>

          {state.message ? (
            state.status === 'success' ? (
              <SuccessState
                compact
                title="Registration created"
                description={state.message}
              />
            ) : (
              <ErrorState
                compact
                title="Registration failed"
                description={state.message}
              />
            )
          ) : null}
        </CardContent>
        <CardFooter className="flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Sign in
            </Link>
            .
          </p>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating account...' : 'Create account'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
