'use client'

import { ShieldCheck } from 'lucide-react'
import { usePathname } from 'next/navigation'

import { SignOutButton } from '@/components/auth/sign-out-button'
import { Badge } from '@/components/ui/badge'
import { siteConfig } from '@/lib/site'
import { getProtectedCurrentNavItem } from '@/features/shell/protected-navigation'

import { ProtectedMobileNavigation } from './protected-mobile-navigation'

interface ProtectedAppHeaderProps {
  readonly authUserLabel: string
}

export function ProtectedAppHeader({ authUserLabel }: ProtectedAppHeaderProps) {
  const pathname = usePathname()
  const currentNavItem = getProtectedCurrentNavItem(pathname)

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/88 backdrop-blur supports-[backdrop-filter]:bg-background/76">
      <div className="flex min-h-16 items-center gap-3 px-4 py-3 md:px-6 lg:px-8">
        <div className="md:hidden">
          <ProtectedMobileNavigation authUserLabel={authUserLabel} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="hidden sm:inline-flex">
              Protected Area
            </Badge>
            {currentNavItem ? (
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {currentNavItem.label}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border bg-card text-primary shadow-sm">
              <ShieldCheck className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold md:text-base">
                {siteConfig.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {currentNavItem?.description ??
                  'Reusable shell baseline for private application routes.'}
              </p>
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <div className="rounded-2xl border border-border/70 bg-background-elevated/78 px-3 py-2 text-right shadow-[0_18px_40px_-28px_var(--shadow-color)]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Signed in as
            </p>
            <p className="max-w-56 truncate text-sm font-medium">
              {authUserLabel}
            </p>
          </div>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
