import type { ReactNode } from 'react'

import { ErrorState } from '@/components/feedback'
import { PageContainer } from '@/components/layout'
import { requireAuthPageAccess } from '@/features/auth/server/route-guards'

interface AuthLayoutProps {
  readonly children: ReactNode
}

export default async function AuthLayout({ children }: AuthLayoutProps) {
  const accessState = await requireAuthPageAccess()

  if (accessState.kind === 'error') {
    return (
      <PageContainer
        as="main"
        size="default"
        className="flex min-h-screen items-center py-14"
      >
        <ErrorState
          title="Auth flow is unavailable"
          description={accessState.message}
          actionLabel="Back home"
          actionHref="/"
        />
      </PageContainer>
    )
  }

  return children
}
