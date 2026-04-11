import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

type PageSectionElement = 'div' | 'section' | 'header'
type PageSectionSpacing = 'compact' | 'default' | 'relaxed'

const sectionSpacingClasses: Record<PageSectionSpacing, string> = {
  compact: 'space-y-3',
  default: 'space-y-6',
  relaxed: 'space-y-8',
}

interface PageSectionProps extends HTMLAttributes<HTMLElement> {
  readonly as?: PageSectionElement
  readonly spacing?: PageSectionSpacing
}

export function PageSection({
  as = 'div',
  spacing = 'default',
  className,
  ...props
}: PageSectionProps) {
  const Comp = as

  return (
    <Comp
      className={cn(sectionSpacingClasses[spacing], className)}
      {...props}
    />
  )
}
