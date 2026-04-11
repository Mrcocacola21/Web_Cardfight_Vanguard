import Link from 'next/link'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface FeedbackStateCardProps {
  readonly title: string
  readonly description: string
  readonly icon: LucideIcon
  readonly iconClassName: string
  readonly role?: 'alert' | 'status'
  readonly liveRegion?: 'assertive' | 'polite' | 'off'
  readonly compact?: boolean
  readonly action?: ReactNode | undefined
  readonly actionLabel?: string | undefined
  readonly actionHref?: string | undefined
  readonly animateIcon?: boolean
  readonly className?: string | undefined
}

export function FeedbackStateCard({
  title,
  description,
  icon: Icon,
  iconClassName,
  role,
  liveRegion = 'off',
  compact = false,
  action,
  actionLabel,
  actionHref,
  animateIcon = false,
  className,
}: FeedbackStateCardProps) {
  const resolvedAction =
    action ??
    (actionLabel && actionHref ? (
      <Link
        href={actionHref}
        className={buttonVariants({
          variant: 'outline',
          size: compact ? 'sm' : 'default',
        })}
      >
        {actionLabel}
      </Link>
    ) : null)

  return (
    <Card
      size={compact ? 'sm' : 'default'}
      role={role}
      aria-live={liveRegion}
      className={cn(
        'mx-auto w-full max-w-2xl',
        compact && 'max-w-full',
        className,
      )}
    >
      <CardHeader className={cn(compact ? 'gap-3' : 'gap-4')}>
        <div className="flex items-start gap-4">
          <span
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-2xl border',
              compact && 'size-10 rounded-xl',
              iconClassName,
            )}
          >
            <Icon
              className={cn(
                compact ? 'size-4' : 'size-5',
                animateIcon && 'animate-spin',
              )}
            />
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle className={cn(compact && 'text-sm')}>{title}</CardTitle>
            <CardDescription className={cn(compact && 'text-xs leading-5')}>
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      {resolvedAction ? (
        <CardFooter className="justify-start">{resolvedAction}</CardFooter>
      ) : null}
    </Card>
  )
}
