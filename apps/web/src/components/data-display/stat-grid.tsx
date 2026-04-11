import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface StatGridProps {
  readonly children: ReactNode
  readonly columns?: 2 | 3 | 4
  readonly className?: string
}

const columnClasses: Record<NonNullable<StatGridProps['columns']>, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
}

export function StatGrid({ children, columns = 4, className }: StatGridProps) {
  return (
    <div className={cn('grid gap-2', columnClasses[columns], className)}>
      {children}
    </div>
  )
}
