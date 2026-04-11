import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type StatTone = 'default' | 'accent' | 'muted'

interface StatBlockProps {
  readonly label: ReactNode
  readonly value: ReactNode
  readonly hint?: ReactNode
  readonly tone?: StatTone
  readonly className?: string
}

const toneClasses: Record<StatTone, string> = {
  default: 'bg-background-elevated/76',
  accent: 'bg-accent/12',
  muted: 'bg-muted/50',
}

export function StatBlock({
  label,
  value,
  hint,
  tone = 'default',
  className,
}: StatBlockProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/70 p-3',
        toneClasses[tone],
        className,
      )}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-base font-medium text-foreground">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-foreground-secondary">{hint}</p>
      ) : null}
    </div>
  )
}
