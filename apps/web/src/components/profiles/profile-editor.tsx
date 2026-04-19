'use client'

import type { ProfileVisibility } from '@web-vg/db/repositories/profiles'
import { useActionState } from 'react'

import { ErrorState, SuccessState } from '@/components/feedback'
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
    bioVisibility: ProfileVisibility
  }
}

export function ProfileEditor({ initialValues }: ProfileEditorProps) {
  const [state, formAction, isPending] = useActionState<
    ProfileFormState,
    FormData
  >(saveCurrentProfileAction, initialProfileFormState)
  const displayNameErrorId = state.fieldErrors.displayName
    ? 'profile-display-name-error'
    : undefined
  const visibilityErrorId = state.fieldErrors.visibility
    ? 'profile-visibility-error'
    : undefined
  const visibilityHelpId = 'profile-visibility-help'
  const bioVisibilityErrorId = state.fieldErrors.bioVisibility
    ? 'profile-bio-visibility-error'
    : undefined
  const bioVisibilityHelpId = 'profile-bio-visibility-help'
  const avatarUrlErrorId = state.fieldErrors.avatarUrl
    ? 'profile-avatar-url-error'
    : undefined
  const bioErrorId = state.fieldErrors.bio ? 'profile-bio-error' : undefined

  return (
    <Card>
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
              required
              defaultValue={initialValues.displayName}
              aria-invalid={state.fieldErrors.displayName ? 'true' : 'false'}
              aria-describedby={displayNameErrorId}
              placeholder="Enter a display name"
            />
            {state.fieldErrors.displayName ? (
              <p id={displayNameErrorId} className="text-sm text-destructive">
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
              required
              defaultValue={initialValues.visibility}
              aria-invalid={state.fieldErrors.visibility ? 'true' : 'false'}
              aria-describedby={
                visibilityErrorId
                  ? `${visibilityHelpId} ${visibilityErrorId}`
                  : visibilityHelpId
              }
              className="flex h-11 w-full rounded-xl border border-input bg-background-elevated/75 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
            >
              <option value="private">Private</option>
              <option value="friends">Friends only</option>
              <option value="public">Public</option>
            </select>
            <p id={visibilityHelpId} className="text-xs text-muted-foreground">
              This controls discoverability and whether `/users/[profileId]` can
              be opened by strangers or friends. Private profiles stay out of
              public routes and search.
            </p>
            {state.fieldErrors.visibility ? (
              <p id={visibilityErrorId} className="text-sm text-destructive">
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
              aria-describedby={avatarUrlErrorId}
              placeholder="https://images.example/avatar.png"
            />
            {state.fieldErrors.avatarUrl ? (
              <p id={avatarUrlErrorId} className="text-sm text-destructive">
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
              aria-describedby={bioErrorId}
              placeholder="Add a short profile note"
              className="flex min-h-28 w-full rounded-xl border border-input bg-background-elevated/75 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
            />
            {state.fieldErrors.bio ? (
              <p id={bioErrorId} className="text-sm text-destructive">
                {state.fieldErrors.bio}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="bioVisibility" className="text-sm font-medium">
              Bio visibility
            </label>
            <select
              id="bioVisibility"
              name="bioVisibility"
              required
              defaultValue={initialValues.bioVisibility}
              aria-invalid={state.fieldErrors.bioVisibility ? 'true' : 'false'}
              aria-describedby={
                bioVisibilityErrorId
                  ? `${bioVisibilityHelpId} ${bioVisibilityErrorId}`
                  : bioVisibilityHelpId
              }
              className="flex h-11 w-full rounded-xl border border-input bg-background-elevated/75 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
            >
              <option value="private">Private</option>
              <option value="friends">Friends only</option>
              <option value="public">Public</option>
            </select>
            <p
              id={bioVisibilityHelpId}
              className="text-xs text-muted-foreground"
            >
              Bio visibility can stay equal to or stricter than the profile
              surface. Pending requests do not unlock friends-only bio access.
            </p>
            {state.fieldErrors.bioVisibility ? (
              <p id={bioVisibilityErrorId} className="text-sm text-destructive">
                {state.fieldErrors.bioVisibility}
              </p>
            ) : null}
          </div>

          {state.message ? (
            state.status === 'success' ? (
              <SuccessState
                compact
                title="Profile saved"
                description={state.message}
              />
            ) : (
              <ErrorState
                compact
                title="Save failed"
                description={state.message}
              />
            )
          ) : null}
        </CardContent>
        <CardFooter className="flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            First save creates the profile row if it does not exist yet. Saved
            privacy settings apply immediately to search, profile, and social
            summary reads.
          </p>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save profile'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
