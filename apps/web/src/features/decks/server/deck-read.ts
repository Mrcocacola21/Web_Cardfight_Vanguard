import { createDecksRepository, type RepositoryResult } from '@web-vg/db'
import type {
  DeckDetailRecord,
  DeckListItemRecord,
} from '@web-vg/db/repositories/decks'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function listDecksByOwnerProfileId(
  ownerProfileId: string,
): Promise<RepositoryResult<readonly DeckListItemRecord[]>> {
  const client = await createSupabaseServerClient()
  const repository = createDecksRepository(client)

  return repository.listDecksByOwner(ownerProfileId)
}

export async function getDeckDetailById(
  deckId: string,
): Promise<RepositoryResult<DeckDetailRecord | null>> {
  const client = await createSupabaseServerClient()
  const repository = createDecksRepository(client)

  return repository.getDeckDetailById(deckId)
}
