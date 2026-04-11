'use client'

import { usePathname } from 'next/navigation'

import { ProtectedNavLinks } from './protected-nav-links'

export function ProtectedSidebarNavigation() {
  const pathname = usePathname()

  return <ProtectedNavLinks pathname={pathname} />
}
