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

interface AuthStatusCardProps {
  readonly title: string
  readonly description: string
  readonly actionLabel?: string
  readonly actionHref?: string
}

export function AuthStatusCard({
  title,
  description,
  actionLabel,
  actionHref,
}: AuthStatusCardProps) {
  return (
    <Card className="mx-auto w-full max-w-2xl border-white/50 bg-card/95 shadow-lg shadow-black/5">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent />
      {actionLabel && actionHref ? (
        <CardFooter>
          <Link
            href={actionHref}
            className={buttonVariants({ variant: 'outline' })}
          >
            {actionLabel}
          </Link>
        </CardFooter>
      ) : null}
    </Card>
  )
}
