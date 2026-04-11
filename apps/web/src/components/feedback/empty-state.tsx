import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

import { FeedbackStateCard } from './feedback-state-card'

interface EmptyStateProps {
  readonly title: string
  readonly description: string
  readonly action?: ReactNode
  readonly actionLabel?: string
  readonly actionHref?: string
  readonly compact?: boolean
  readonly className?: string
}

export function EmptyState({
  title,
  description,
  action,
  actionLabel,
  actionHref,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <FeedbackStateCard
      title={title}
      description={description}
      icon={Inbox}
      iconClassName="border-border/70 bg-background-elevated/84 text-foreground-secondary"
      action={action}
      actionLabel={actionLabel}
      actionHref={actionHref}
      compact={compact}
      className={className}
    />
  )
}
