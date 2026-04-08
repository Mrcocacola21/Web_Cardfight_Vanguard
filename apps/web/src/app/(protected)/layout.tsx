import type { ReactNode } from 'react'

import { AuthStatusCard } from '@/components/auth/auth-status-card'
import { requireProtectedRouteAccess } from '@/features/auth/server/route-guards'

interface ProtectedLayoutProps {
  readonly children: ReactNode
}

export default async function ProtectedLayout({
  children,
}: ProtectedLayoutProps) {
  const accessState = await requireProtectedRouteAccess()

  if (accessState.kind === 'error') {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-14 md:px-10">
        <AuthStatusCard
          title="Protected route is unavailable"
          description={accessState.message}
          actionLabel="Back home"
          actionHref="/"
        />
      </main>
    )
  }

  return children
}
