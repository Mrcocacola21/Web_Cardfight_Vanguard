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

  return (
    <Card className="border-white/50 bg-card/95 shadow-lg shadow-black/5">
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
              autoComplete="current-password"
              aria-invalid={state.fieldErrors.password ? 'true' : 'false'}
              placeholder="Enter your password"
            />
            {state.fieldErrors.password ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.password}
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
