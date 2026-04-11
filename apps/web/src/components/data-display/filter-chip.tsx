'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface FilterChipProps {
  readonly label: ReactNode
  readonly selected?: boolean
  readonly count?: ReactNode
  readonly onClick?: () => void
  readonly className?: string
}

export function FilterChip({
  label,
  selected = false,
  count,
  onClick,
  className,
}: FilterChipProps) {
  return (
    <Button
      type="button"
      variant={selected ? 'secondary' : 'outline'}
      size="sm"
      onClick={onClick}
      className={cn('justify-start rounded-full px-3', className)}
      aria-pressed={selected}
    >
      <span>{label}</span>
      {count ? (
        <Badge variant={selected ? 'accent' : 'outline'}>{count}</Badge>
      ) : null}
    </Button>
  )
}
