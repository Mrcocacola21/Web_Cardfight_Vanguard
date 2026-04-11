import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

import { FeedbackStateCard } from './feedback-state-card'

interface ErrorStateProps {
  readonly title: string
  readonly description: string
  readonly action?: ReactNode
  readonly actionLabel?: string
  readonly actionHref?: string
  readonly compact?: boolean
  readonly className?: string
}

export function ErrorState({
  title,
  description,
  action,
  actionLabel,
  actionHref,
  compact = false,
  className,
}: ErrorStateProps) {
  return (
    <FeedbackStateCard
      title={title}
      description={description}
      icon={TriangleAlert}
      iconClassName="border-destructive/30 bg-destructive/12 text-destructive"
      role="alert"
      liveRegion="assertive"
      action={action}
      actionLabel={actionLabel}
      actionHref={actionHref}
      compact={compact}
      className={className}
    />
  )
}
