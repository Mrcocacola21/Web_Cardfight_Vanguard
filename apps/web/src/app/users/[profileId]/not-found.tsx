import { ProfileStatusCard } from '@/components/profiles/profile-status-card'

export default function PublicProfileNotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-14 md:px-10">
      <ProfileStatusCard
        title="Public profile not found"
        description="No public user profile matches this route."
        actionLabel="Back home"
        actionHref="/"
      />
    </main>
  )
}
