import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { signOutAction } from '@/features/auth/server/auth-actions'

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="outline">
        <LogOut className="size-4" />
        Sign out
      </Button>
    </form>
  )
}
