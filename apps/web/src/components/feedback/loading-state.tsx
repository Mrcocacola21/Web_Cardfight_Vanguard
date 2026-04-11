import { LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'

import { FeedbackStateCard } from './feedback-state-card'

interface LoadingStateProps {
  readonly title?: string
  readonly description?: string
  readonly action?: ReactNode
  readonly actionLabel?: string
  readonly actionHref?: string
  readonly compact?: boolean
  readonly className?: string
}

export function LoadingState({
  title = 'Loading',
  description = 'Please wait while the page is being prepared.',
  action,
  actionLabel,
  actionHref,
  compact = false,
  className,
}: LoadingStateProps) {
  return (
    <FeedbackStateCard
      title={title}
      description={description}
      icon={LoaderCircle}
      iconClassName="border-primary/30 bg-primary/12 text-primary"
      role="status"
      liveRegion="polite"
      animateIcon
      action={action}
      actionLabel={actionLabel}
      actionHref={actionHref}
      compact={compact}
      className={className}
    />
  )
}
