import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { PageContainer, type PageContainerSize } from './page-container'

type DetailLayoutVariant = 'split' | 'content-aside' | 'balanced'

const detailVariantClasses: Record<DetailLayoutVariant, string> = {
  split: 'lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]',
  'content-aside': 'lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]',
  balanced: 'lg:grid-cols-2',
}

interface DetailPageLayoutProps {
  readonly header: ReactNode
  readonly main: ReactNode
  readonly aside?: ReactNode
  readonly containerSize?: PageContainerSize
  readonly variant?: DetailLayoutVariant
  readonly className?: string
  readonly bodyClassName?: string
  readonly mainClassName?: string
  readonly asideClassName?: string
}

export function DetailPageLayout({
  header,
  main,
  aside,
  containerSize = 'default',
  variant = 'split',
  className,
  bodyClassName,
  mainClassName,
  asideClassName,
}: DetailPageLayoutProps) {
  return (
    <PageContainer
      as="section"
      size={containerSize}
      className={cn('flex flex-col gap-6 py-8', className)}
    >
      {header}
      {aside ? (
        <div
          className={cn(
            'grid gap-6',
            detailVariantClasses[variant],
            bodyClassName,
          )}
        >
          <div className={mainClassName}>{main}</div>
          <aside className={asideClassName}>{aside}</aside>
        </div>
      ) : (
        <div className={bodyClassName}>{main}</div>
      )}
    </PageContainer>
  )
}
