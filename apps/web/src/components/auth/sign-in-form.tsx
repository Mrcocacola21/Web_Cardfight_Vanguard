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
import { signInAction } from '@/features/auth/server/auth-actions'
import {
  initialAuthFormState,
  type AuthFormState,
} from '@/features/auth/server/auth-form-state'

export function SignInForm() {
  const [state, formAction, isPending] = useActionState<
    AuthFormState,
    FormData
  >(signInAction, initialAuthFormState)
  const emailErrorId = state.fieldErrors.email
    ? 'sign-in-email-error'
    : undefined
  const passwordErrorId = state.fieldErrors.password
    ? 'sign-in-password-error'
    : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Email and password authentication through Supabase Auth with a
          server-side session path.
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-5">
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
              autoComplete="current-password"
              aria-invalid={state.fieldErrors.password ? 'true' : 'false'}
              aria-describedby={passwordErrorId}
              placeholder="Enter your password"
            />
            {state.fieldErrors.password ? (
              <p id={passwordErrorId} className="text-sm text-destructive">
                {state.fieldErrors.password}
              </p>
            ) : null}
          </div>

          {state.message ? (
            state.status === 'success' ? (
              <SuccessState
                compact
                title="Sign-in ready"
                description={state.message}
              />
            ) : (
              <ErrorState
                compact
                title="Sign-in failed"
                description={state.message}
              />
            )
          ) : null}
        </CardContent>
        <CardFooter className="flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Need an account?{' '}
            <Link
              href="/register"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Register here
            </Link>
            .
          </p>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Signing in...' : 'Sign in'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
