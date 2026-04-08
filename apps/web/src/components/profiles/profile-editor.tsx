'use client'

import type { ProfileVisibility } from '@web-vg/db'
import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { saveCurrentProfileAction } from '@/features/profiles/server/profile-actions'
import {
  initialProfileFormState,
  type ProfileFormState,
} from '@/features/profiles/server/profile-form-state'

interface ProfileEditorProps {
  readonly initialValues: {
    displayName: string
    avatarUrl: string
    bio: string
    visibility: ProfileVisibility
  }
}

export function ProfileEditor({ initialValues }: ProfileEditorProps) {
  const [state, formAction, isPending] = useActionState<
    ProfileFormState,
    FormData
  >(saveCurrentProfileAction, initialProfileFormState)

  return (
    <Card className="border-white/50 bg-card/95 shadow-lg shadow-black/5">
      <CardHeader>
        <CardTitle>Profile foundation</CardTitle>
        <CardDescription>
          Minimal profile read/write flow through a server action and the
          repository layer.
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="displayName" className="text-sm font-medium">
              Display name
            </label>
            <Input
              id="displayName"
              name="displayName"
              defaultValue={initialValues.displayName}
              aria-invalid={state.fieldErrors.displayName ? 'true' : 'false'}
              placeholder="Enter a display name"
            />
            {state.fieldErrors.displayName ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.displayName}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="visibility" className="text-sm font-medium">
              Profile visibility
            </label>
            <select
              id="visibility"
              name="visibility"
              defaultValue={initialValues.visibility}
              aria-invalid={state.fieldErrors.visibility ? 'true' : 'false'}
              className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Private profiles stay hidden from the public user route. Public
              profiles are visible on `/users/[profileId]`.
            </p>
            {state.fieldErrors.visibility ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.visibility}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="avatarUrl" className="text-sm font-medium">
              Avatar URL
            </label>
            <Input
              id="avatarUrl"
              name="avatarUrl"
              type="url"
              defaultValue={initialValues.avatarUrl}
              aria-invalid={state.fieldErrors.avatarUrl ? 'true' : 'false'}
              placeholder="https://images.example/avatar.png"
            />
            {state.fieldErrors.avatarUrl ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.avatarUrl}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="bio" className="text-sm font-medium">
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              defaultValue={initialValues.bio}
              rows={5}
              aria-invalid={state.fieldErrors.bio ? 'true' : 'false'}
              placeholder="Add a short profile note"
              className="flex min-h-28 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
            />
            {state.fieldErrors.bio ? (
              <p className="text-sm text-destructive">
                {state.fieldErrors.bio}
              </p>
            ) : null}
          </div>

          {state.message ? (
            <p
              className={
                state.status === 'success'
                  ? 'text-sm text-emerald-700'
                  : 'text-sm text-destructive'
              }
            >
              {state.message}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            First save creates the profile row if it does not exist yet. Saved
            visibility applies immediately to the public profile route.
          </p>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save profile'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
