import type { ReactNode } from 'react'

import { AuthStatusCard } from '@/components/auth/auth-status-card'
import { requireAuthPageAccess } from '@/features/auth/server/route-guards'

interface AuthLayoutProps {
  readonly children: ReactNode
}

export default async function AuthLayout({ children }: AuthLayoutProps) {
  const accessState = await requireAuthPageAccess()

  if (accessState.kind === 'error') {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-14 md:px-10">
        <AuthStatusCard
          title="Auth flow is unavailable"
          description={accessState.message}
          actionLabel="Back home"
          actionHref="/"
        />
      </main>
    )
  }

  return children
}
