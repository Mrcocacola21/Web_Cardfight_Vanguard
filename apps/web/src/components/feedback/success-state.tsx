import { CircleCheckBig } from 'lucide-react'
import type { ReactNode } from 'react'

import { FeedbackStateCard } from './feedback-state-card'

interface SuccessStateProps {
  readonly title: string
  readonly description: string
  readonly action?: ReactNode
  readonly actionLabel?: string
  readonly actionHref?: string
  readonly compact?: boolean
  readonly className?: string
}

export function SuccessState({
  title,
  description,
  action,
  actionLabel,
  actionHref,
  compact = false,
  className,
}: SuccessStateProps) {
  return (
    <FeedbackStateCard
      title={title}
      description={description}
      icon={CircleCheckBig}
      iconClassName="border-success/30 bg-success/15 text-success"
      role="status"
      liveRegion="polite"
      action={action}
      actionLabel={actionLabel}
      actionHref={actionHref}
      compact={compact}
      className={className}
    />
  )
}
