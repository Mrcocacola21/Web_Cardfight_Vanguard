import { AuthStatusCard } from '@/components/auth/auth-status-card'
import { AuthFormShell } from '@/components/auth/auth-form-shell'
import { SignInForm } from '@/components/auth/sign-in-form'
import { getAuthCallbackErrorMessage } from '@/features/auth/server/auth-callback'

interface LoginPageProps {
  readonly searchParams: Promise<{
    authError?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { authError } = await searchParams
  const callbackErrorMessage = getAuthCallbackErrorMessage(authError)

  return (
    <AuthFormShell
      badgeLabel="Auth Foundation"
      title="Sign in"
      description="Minimal SSR-friendly Supabase Auth login. Session handling stays server-aware through the App Router path and proxy refresh."
      alternateText="Need a new account?"
      alternateLabel="Register"
      alternateHref="/register"
    >
      <div className="space-y-4">
        {callbackErrorMessage ? (
          <AuthStatusCard
            title="Authentication callback failed"
            description={callbackErrorMessage}
          />
        ) : null}
        <SignInForm />
      </div>
    </AuthFormShell>
  )
}
