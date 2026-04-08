import { describe, expect, it } from 'vitest'

import {
  buildDeckSections,
  createDeckSectionCounts,
  mapDeckCardRow,
  mapDeckDetailCardRow,
  mapDeckDetailVersionRow,
  mapDeckFormatRow,
  mapDeckListItemRow,
  mapDeckRow,
  mapDeckVersionRow,
} from './decks.mappers'

describe('deck mappers', () => {
  it('maps deck cards using canonical card identity', () => {
    const card = mapDeckCardRow({
      section_key: 'main',
      card_entity_id: 'card-entity-1',
      quantity: 4,
    })

    expect(card).toEqual({
      sectionKey: 'main',
      cardEntityId: 'card-entity-1',
      quantity: 4,
    })
  })

  it('maps a persisted deck with current version metadata', () => {
    const version = mapDeckVersionRow(
      {
        id: 'version-1',
        deck_id: 'deck-1',
        version_number: 2,
        created_by_profile_id: 'profile-1',
        version_note: 'updated ratios',
        created_at: '2026-04-08T00:00:00.000Z',
      },
      [
        {
          sectionKey: 'main',
          cardEntityId: 'card-entity-1',
          quantity: 4,
        },
      ],
    )

    const deck = mapDeckRow(
      {
        id: 'deck-1',
        owner_profile_id: 'profile-1',
        format_id: 'standard',
        title: 'Azure Test Deck',
        description: null,
        visibility: 'private',
        archived_at: null,
        created_at: '2026-04-08T00:00:00.000Z',
        updated_at: '2026-04-08T01:00:00.000Z',
        current_version_id: 'version-1',
      },
      version,
    )

    expect(deck.currentVersion?.cards[0]?.cardEntityId).toBe('card-entity-1')
    expect(deck.formatId).toBe('standard')
  })

  it('builds section counts and list summaries without legality assumptions', () => {
    const format = mapDeckFormatRow({
      id: 'standard',
      display_name: 'Standard',
      description: 'D-era baseline profile',
    })

    const sectionCounts = createDeckSectionCounts([
      {
        section_key: 'main',
        quantity: 46,
      },
      {
        section_key: 'ride',
        quantity: 4,
      },
    ])

    const summary = mapDeckListItemRow(
      {
        id: 'deck-1',
        owner_profile_id: 'profile-1',
        format_id: 'standard',
        title: 'Azure Test Deck',
        description: 'Server-side read model',
        visibility: 'private',
        archived_at: null,
        created_at: '2026-04-08T00:00:00.000Z',
        updated_at: '2026-04-08T01:00:00.000Z',
        current_version_id: 'version-1',
      },
      format,
      {
        id: 'version-1',
        deck_id: 'deck-1',
        version_number: 3,
        created_by_profile_id: 'profile-1',
        version_note: null,
        created_at: '2026-04-08T00:00:00.000Z',
      },
      sectionCounts,
    )

    expect(summary.format.displayName).toBe('Standard')
    expect(summary.currentVersionNumber).toBe(3)
    expect(summary.totalCards).toBe(50)
    expect(summary.sectionCounts.ride).toBe(4)
    expect(summary.sectionCounts.g).toBe(0)
  })

  it('builds detail sections from canonical card summaries', () => {
    const cards = [
      mapDeckDetailCardRow(
        {
          section_key: 'main',
          card_entity_id: 'card-1',
          quantity: 4,
        },
        {
          id: 'card-1',
          canonical_key: 'card.azure-vanguard-dragon',
          name: 'Azure Vanguard Dragon',
          grade: 3,
          card_type: 'normal-unit',
          trigger_type: null,
        },
      ),
      mapDeckDetailCardRow(
        {
          section_key: 'ride',
          card_entity_id: 'card-2',
          quantity: 1,
        },
        {
          id: 'card-2',
          canonical_key: 'card.blaze-rookie',
          name: 'Blaze Rookie',
          grade: 0,
          card_type: 'normal-unit',
          trigger_type: null,
        },
      ),
    ]

    const detailVersion = mapDeckDetailVersionRow(
      {
        id: 'version-1',
        deck_id: 'deck-1',
        version_number: 1,
        created_by_profile_id: 'profile-1',
        version_note: 'initial',
        created_at: '2026-04-08T00:00:00.000Z',
      },
      cards,
    )

    const sections = buildDeckSections(cards, detailVersion.sectionCounts)

    expect(detailVersion.totalCards).toBe(5)
    expect(detailVersion.cards[0]?.canonicalKey).toBe(
      'card.azure-vanguard-dragon',
    )
    expect(sections[0]).toEqual({
      key: 'main',
      totalCards: 4,
      cards: [cards[0]],
    })
    expect(sections[1]).toEqual({
      key: 'ride',
      totalCards: 1,
      cards: [cards[1]],
    })
    expect(sections[2]).toEqual({
      key: 'g',
      totalCards: 0,
      cards: [],
    })
  })
})
