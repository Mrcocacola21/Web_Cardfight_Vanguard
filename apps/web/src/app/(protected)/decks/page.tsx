import { DeckListView } from '@/components/decks/deck-list-view'
import { DeckStatusCard } from '@/components/decks/deck-status-card'
import { listDecksByOwnerProfileId } from '@/features/decks/server/deck-read'
import { getCurrentProfileState } from '@/features/profiles/server/profile-read'

export default async function DecksPage() {
  const profileState = await getCurrentProfileState()

  if (profileState.kind !== 'ready') {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-14 md:px-10">
        <DeckStatusCard
          title="Deck flow is unavailable"
          description={
            profileState.kind === 'error'
              ? profileState.message
              : 'The protected decks route could not resolve the authenticated session.'
          }
          actionLabel="Back home"
          actionHref="/"
        />
      </main>
    )
  }

  if (!profileState.profile) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-14 md:px-10">
        <DeckStatusCard
          title="No profile row for deck ownership"
          description="The authenticated session exists, but no persisted profile row is available yet. Deck reads stay attached to profile-owned data, so create the profile record first."
          actionLabel="Open profile"
          actionHref="/profile"
        />
      </main>
    )
  }

  const decksResult = await listDecksByOwnerProfileId(profileState.profile.id)

  if (!decksResult.ok) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-14 md:px-10">
        <DeckStatusCard
          title="Deck list is unavailable"
          description="The server-side deck read flow failed. Persistence is still isolated behind repositories, but the deck list could not be loaded."
          actionLabel="Back home"
          actionHref="/"
        />
      </main>
    )
  }

  if (decksResult.data.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-14 md:px-10">
        <DeckStatusCard
          title="No decks saved yet"
          description="The current profile does not have any persisted deck records yet. Deck builder and write-side flows are intentionally outside this step."
          actionLabel="Open profile"
          actionHref="/profile"
        />
      </main>
    )
  }

  return (
    <DeckListView decks={decksResult.data} profile={profileState.profile} />
  )
}
