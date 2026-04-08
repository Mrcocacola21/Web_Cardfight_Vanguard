import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface CatalogStatusCardProps {
  readonly title: string
  readonly description: string
  readonly actionLabel?: string
  readonly actionHref?: string
}

export function CatalogStatusCard({
  title,
  description,
  actionLabel,
  actionHref,
}: CatalogStatusCardProps) {
  return (
    <Card className="mx-auto w-full max-w-2xl border-white/50 bg-card/95 shadow-lg shadow-black/5">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {(actionLabel ?? actionHref) ? (
        <CardFooter>
          {actionLabel && actionHref ? (
            <Link
              href={actionHref}
              className={buttonVariants({ variant: 'outline' })}
            >
              {actionLabel}
            </Link>
          ) : null}
        </CardFooter>
      ) : (
        <CardContent />
      )}
    </Card>
  )
}
