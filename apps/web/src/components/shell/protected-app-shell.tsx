import Link from 'next/link'
import type { ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'

import type { AuthUserRecord } from '@/features/auth/server/auth-session'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { siteConfig } from '@/lib/site'

import { ProtectedAppHeader } from './protected-app-header'
import { ProtectedSidebarNavigation } from './protected-sidebar-navigation'

interface ProtectedAppShellProps {
  readonly authUser: AuthUserRecord
  readonly children: ReactNode
}

export function ProtectedAppShell({
  authUser,
  children,
}: ProtectedAppShellProps) {
  const authUserLabel = authUser.email ?? authUser.id

  return (
    <div className="min-h-screen">
      <div className="min-h-screen md:grid md:grid-cols-[17.5rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-border/70 bg-card/72 md:flex md:flex-col">
          <div className="sticky top-0 flex h-screen flex-col px-4 py-5">
            <div className="space-y-4">
              <Badge variant="outline" className="w-fit">
                App Shell
              </Badge>
              <Link
                href="/"
                className="block rounded-3xl border border-border/70 bg-background-elevated/88 p-4 shadow-[0_24px_60px_-32px_var(--shadow-color)] transition-colors hover:bg-background-elevated"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                    <ShieldCheck className="size-5" />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold">
                      {siteConfig.title}
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Protected navigation shell for decks, profiles, and future
                      user-facing application areas.
                    </p>
                  </div>
                </div>
              </Link>
            </div>

            <div className="mt-6 flex-1 overflow-y-auto pr-1">
              <ProtectedSidebarNavigation />
            </div>

            <Card className="mt-6 bg-background-elevated/88">
              <CardHeader className="gap-2">
                <CardTitle className="text-sm">Current session</CardTitle>
                <CardDescription className="text-xs leading-5">
                  Shell stays UI-only. It exposes navigation and minimal current
                  user presence without querying feature data.
                </CardDescription>
              </CardHeader>
              <div className="px-6 pb-6 text-sm">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Signed in as
                </p>
                <p className="mt-2 truncate font-medium">{authUserLabel}</p>
              </div>
            </Card>
          </div>
        </aside>

        <div className="min-w-0">
          <ProtectedAppHeader authUserLabel={authUserLabel} />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  )
}
