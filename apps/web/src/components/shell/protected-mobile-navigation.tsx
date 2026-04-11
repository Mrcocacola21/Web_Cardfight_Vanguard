'use client'

import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'

import { SignOutButton } from '@/components/auth/sign-out-button'
import { Button } from '@/components/ui/button'
import { siteConfig } from '@/lib/site'

import { ProtectedNavLinks } from './protected-nav-links'

interface ProtectedMobileNavigationProps {
  readonly authUserLabel: string
}

export function ProtectedMobileNavigation({
  authUserLabel,
}: ProtectedMobileNavigationProps) {
  const pathname = usePathname()
  const [openedAtPathname, setOpenedAtPathname] = useState<string | null>(null)
  const isOpen = openedAtPathname === pathname

  useEffect(() => {
    if (!isOpen) {
      document.body.classList.remove('overflow-hidden')
      return
    }

    document.body.classList.add('overflow-hidden')

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenedAtPathname(null)
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.classList.remove('overflow-hidden')
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        onClick={() => setOpenedAtPathname(pathname)}
      >
        <Menu className="size-4" />
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-background-overlay/80"
            onClick={() => setOpenedAtPathname(null)}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Protected navigation"
            className="absolute inset-y-0 left-0 flex w-[calc(100%-1.5rem)] max-w-sm flex-col border-r border-border/70 bg-background px-4 py-5 shadow-[0_24px_64px_-28px_var(--shadow-color)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold">{siteConfig.title}</p>
                <p className="text-xs text-muted-foreground">
                  Protected application navigation
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                autoFocus
                aria-label="Close navigation panel"
                onClick={() => setOpenedAtPathname(null)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="mt-6 rounded-2xl border border-border/70 bg-background-elevated/76 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Signed in as
              </p>
              <p className="mt-2 truncate text-sm font-medium">
                {authUserLabel}
              </p>
            </div>

            <div className="mt-6 flex-1 overflow-y-auto">
              <ProtectedNavLinks
                pathname={pathname}
                compact={false}
                onNavigate={() => setOpenedAtPathname(null)}
              />
            </div>

            <div className="mt-6">
              <SignOutButton />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
