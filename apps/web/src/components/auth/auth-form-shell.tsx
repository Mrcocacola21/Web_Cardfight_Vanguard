import Link from 'next/link'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'

interface AuthFormShellProps {
  readonly badgeLabel: string
  readonly title: string
  readonly description: string
  readonly alternateLabel: string
  readonly alternateHref: string
  readonly alternateText: string
  readonly children: ReactNode
}

export function AuthFormShell({
  badgeLabel,
  title,
  description,
  alternateLabel,
  alternateHref,
  alternateText,
  children,
}: AuthFormShellProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-14 md:px-10">
      <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="space-y-4">
          <Badge variant="outline">{badgeLabel}</Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {title}
            </h1>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
              {description}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {alternateText}{' '}
            <Link
              href={alternateHref}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {alternateLabel}
            </Link>
          </p>
        </section>
        <div>{children}</div>
      </div>
    </main>
  )
}
