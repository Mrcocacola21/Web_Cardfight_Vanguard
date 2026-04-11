import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface FilterBarProps {
  readonly children: ReactNode
  readonly className?: string
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-border/70 bg-background-elevated/72 p-4 sm:flex-row sm:flex-wrap sm:items-center',
        className,
      )}
    >
      {children}
    </div>
  )
}
