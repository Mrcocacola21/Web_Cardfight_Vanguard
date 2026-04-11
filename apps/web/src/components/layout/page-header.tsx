import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { PageSection } from './page-section'

interface PageHeaderProps {
  readonly eyebrow?: ReactNode
  readonly title: ReactNode
  readonly description?: ReactNode
  readonly meta?: ReactNode
  readonly actions?: ReactNode
  readonly className?: string
}

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 md:flex-row md:items-start md:justify-between',
        className,
      )}
    >
      <PageSection spacing="compact" className="min-w-0 flex-1">
        {eyebrow ? (
          <div className="flex flex-wrap items-center gap-2">{eyebrow}</div>
        ) : null}
        <PageSection spacing="compact">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {title}
          </h1>
          {description ? (
            <div className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
              {description}
            </div>
          ) : null}
          {meta ? <div>{meta}</div> : null}
        </PageSection>
      </PageSection>

      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
}
