import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { DeckCreateForm } from '@/components/decks/deck-create-form'
import { EmptyState, ErrorState } from '@/components/feedback'
import {
  DashboardPageLayout,
  PageContainer,
  PageHeader,
} from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { getCurrentProfileState } from '@/features/profiles/server/profile-read'

export default async function CreateDeckPage() {
  const profileState = await getCurrentProfileState()

  if (profileState.kind !== 'ready') {
    return (
      <PageContainer
        as="section"
        size="default"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <ErrorState
          title="Deck creation is unavailable"
          description={
            profileState.kind === 'error'
              ? profileState.message
              : 'The protected deck creation route could not resolve the authenticated session.'
          }
          actionLabel="Back home"
          actionHref="/"
        />
      </PageContainer>
    )
  }

  if (!profileState.profile) {
    return (
      <PageContainer
        as="section"
        size="default"
        className="flex min-h-[calc(100vh-10rem)] items-center py-8"
      >
        <EmptyState
          title="No profile row for deck ownership"
          description={
            'The authenticated session exists, but no persisted profile row is available yet. Deck creation stays profile-owned, so create the profile record first.'
          }
          actionLabel="Open profile"
          actionHref="/profile"
        />
      </PageContainer>
    )
  }

  return (
    <DashboardPageLayout
      containerSize="default"
      header={
        <PageHeader
          eyebrow={<Badge variant="outline">Create Deck</Badge>}
          title="Choose a format"
          description={
            'This is the first real write flow for deck builder. Pick the format, create an empty deck shell, and continue in the deck workspace.'
          }
          actions={
            <Link
              href="/decks"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ArrowLeft className="size-4" />
              Back to decks
            </Link>
          }
        />
      }
    >
      <DeckCreateForm />
    </DashboardPageLayout>
  )
}
