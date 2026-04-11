import type { ReactNode } from 'react'

import { ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { ProtectedAppShell } from '@/components/shell/protected-app-shell'
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
      <PageContainer
        as="main"
        size="default"
        className="flex min-h-screen items-center py-14"
      >
        <ErrorState
          title="Protected route is unavailable"
          description={accessState.message}
          actionLabel="Back home"
          actionHref="/"
        />
      </PageContainer>
    )
  }

  return (
    <ProtectedAppShell authUser={accessState.user}>
      {children}
    </ProtectedAppShell>
  )
}
