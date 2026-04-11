import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { PageContainer, type PageContainerSize } from './page-container'

interface DashboardPageLayoutProps {
  readonly header: ReactNode
  readonly children: ReactNode
  readonly containerSize?: PageContainerSize
  readonly className?: string
  readonly contentClassName?: string
}

export function DashboardPageLayout({
  header,
  children,
  containerSize = 'wide',
  className,
  contentClassName,
}: DashboardPageLayoutProps) {
  return (
    <PageContainer
      as="section"
      size={containerSize}
      className={cn('flex flex-col gap-6 py-8', className)}
    >
      {header}
      <div className={contentClassName}>{children}</div>
    </PageContainer>
  )
}
