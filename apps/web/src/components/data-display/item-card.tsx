import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'

interface ItemCardProps {
  readonly title: ReactNode
  readonly subtitle?: ReactNode
  readonly badges?: ReactNode
  readonly actions?: ReactNode
  readonly footer?: ReactNode
  readonly children?: ReactNode
  readonly className?: string
  readonly contentClassName?: string
}

export function ItemCard({
  title,
  subtitle,
  badges,
  actions,
  footer,
  children,
  className,
  contentClassName,
}: ItemCardProps) {
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="gap-3">
        {badges ? <div className="flex flex-wrap gap-2">{badges}</div> : null}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h3 className="text-base leading-snug font-medium">{title}</h3>
            {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </CardHeader>
      {children ? (
        <CardContent className={cn('space-y-4', contentClassName)}>
          {children}
        </CardContent>
      ) : null}
      {footer ? (
        <CardFooter className="flex-wrap items-center justify-between gap-3">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  )
}
