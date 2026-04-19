import {
  BookOpenText,
  House,
  Handshake,
  Layers3,
  Swords,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

export interface ProtectedNavItem {
  readonly href: string
  readonly label: string
  readonly description: string
  readonly icon: LucideIcon
}

export const protectedNavItems: readonly ProtectedNavItem[] = [
  {
    href: '/',
    label: 'Home',
    description: 'Return to the public application entry surface.',
    icon: House,
  },
  {
    href: '/catalog',
    label: 'Catalog',
    description: 'Browse cards and printings through server-rendered reads.',
    icon: BookOpenText,
  },
  {
    href: '/decks',
    label: 'Decks',
    description: 'Open protected deck overview and detail screens.',
    icon: Layers3,
  },
  {
    href: '/profile',
    label: 'Profile',
    description: 'Manage your own profile and visibility settings.',
    icon: UserRound,
  },
  {
    href: '/friends',
    label: 'Friends',
    description:
      'Review active friendships plus incoming and outgoing requests.',
    icon: Handshake,
  },
  {
    href: '/matches',
    label: 'Matches',
    description:
      'Review owner-owned match history and branch into manual entry before gameplay automation exists.',
    icon: Swords,
  },
  {
    href: '/users',
    label: 'Users',
    description: 'Search public profiles and open their public profile pages.',
    icon: UsersRound,
  },
] as const

export function isProtectedNavItemActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/'
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function getProtectedCurrentNavItem(pathname: string) {
  return (
    protectedNavItems.find((item) =>
      isProtectedNavItemActive(pathname, item.href),
    ) ?? null
  )
}
