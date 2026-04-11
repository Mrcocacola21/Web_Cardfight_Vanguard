import Link from 'next/link'

import { cn } from '@/lib/utils'
import {
  getProtectedCurrentNavItem,
  isProtectedNavItemActive,
  protectedNavItems,
} from '@/features/shell/protected-navigation'

interface ProtectedNavLinksProps {
  readonly pathname: string
  readonly onNavigate?: () => void
  readonly compact?: boolean
}

export function ProtectedNavLinks({
  pathname,
  onNavigate,
  compact = false,
}: ProtectedNavLinksProps) {
  const currentItem = getProtectedCurrentNavItem(pathname)
  const navigateProps = onNavigate ? { onClick: onNavigate } : {}

  return (
    <nav aria-label="Primary" className="space-y-1.5">
      {protectedNavItems.map((item) => {
        const isActive = isProtectedNavItemActive(pathname, item.href)
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            {...navigateProps}
            className={cn(
              'group flex items-start gap-3 rounded-2xl border px-3 py-3 transition-colors',
              isActive
                ? 'border-primary/25 bg-primary/6 text-foreground shadow-sm'
                : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/70 hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border transition-colors',
                isActive
                  ? 'border-primary/20 bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground group-hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 space-y-1">
              <span className="flex items-center gap-2">
                <span className="block text-sm font-medium">{item.label}</span>
                {currentItem?.href === item.href ? (
                  <span className="inline-flex rounded-full border border-primary/20 bg-primary/8 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
                    Current
                  </span>
                ) : null}
              </span>
              {!compact ? (
                <span className="block text-xs leading-5 text-muted-foreground">
                  {item.description}
                </span>
              ) : null}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
