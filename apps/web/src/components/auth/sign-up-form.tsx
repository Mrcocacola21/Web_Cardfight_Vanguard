'use client'

import Link from 'next/link'
import { useActionState } from 'react'

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

  return (
    <Card className="border-white/50 bg-card/95 shadow-lg shadow-black/5">
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
              autoComplete="nickname"
              aria-invalid={state.fieldErrors.displayName ? 'true' : 'false'}
              placeholder="Azure Pilot"
            />
            {state.fieldErrors.displayName ? (
              <p className="text-sm text-destructive">
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
              autoComplete="email"
              aria-invalid={state.fieldErrors.email ? 'true' : 'false'}
              placeholder="pilot@example.com"
            />
            {state.fieldErrors.email ? (
              <p className="text-sm text-destructive">
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
              autoComplete="new-password"
              aria-invalid={state.fieldErrors.password ? 'true' : 'false'}
              placeholder="Create a password"
            />
            {state.fieldErrors.password ? (
              <p className="text-sm text-destructive">
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
              autoComplete="new-password"
              aria-invalid={
                state.fieldErrors.confirmPassword ? 'true' : 'false'
              }
              placeholder="Repeat the password"
            />
            {state.fieldErrors.confirmPassword ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.confirmPassword}
              </p>
            ) : null}
          </div>

          {state.message ? (
            <p
              className={
                state.status === 'success'
                  ? 'text-sm text-emerald-700'
                  : 'text-sm text-destructive'
              }
            >
              {state.message}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="justify-between gap-4">
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
