import { AuthFormShell } from '@/components/auth/auth-form-shell'
import { SignUpForm } from '@/components/auth/sign-up-form'

export default function RegisterPage() {
  return (
    <AuthFormShell
      badgeLabel="Auth Foundation"
      title="Create account"
      description="Minimal Supabase Auth registration with email and password. This step sets the baseline for route protection and future profile lifecycle work."
      alternateText="Already have an account?"
      alternateLabel="Sign in"
      alternateHref="/login"
    >
      <SignUpForm />
    </AuthFormShell>
  )
}
