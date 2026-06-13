import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Client } = pg

const cliVersion = '2.88.0'
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(packageRoot, '../..')
const localDbUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const atomicDeckMainCardId = '20000000-0000-4000-8000-000000000004'
const atomicDeckRideCardId = '20000000-0000-4000-8000-000000000008'

function quoteArg(arg) {
  return /[\s"]/u.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg
}

function runCorepack(corepackArgs, fallbackMessage) {
  const result =
    process.platform === 'win32'
      ? spawnSync(
          process.env.ComSpec ?? 'cmd.exe',
          [
            '/d',
            '/s',
            '/c',
            ['corepack', ...corepackArgs].map(quoteArg).join(' '),
          ],
          {
            cwd: repoRoot,
            encoding: 'utf8',
            env: process.env,
            maxBuffer: 20 * 1024 * 1024,
          },
        )
      : spawnSync('corepack', corepackArgs, {
          cwd: repoRoot,
          encoding: 'utf8',
          env: process.env,
          maxBuffer: 20 * 1024 * 1024,
        })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(
      [
        fallbackMessage.trimEnd(),
        `Command: corepack ${corepackArgs.join(' ')}`,
        `Exit status: ${result.status}`,
        result.stdout ? `stdout:\n${result.stdout.trimEnd()}` : '',
        result.stderr ? `stderr:\n${result.stderr.trimEnd()}` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    )
  }

  return result.stdout
}

function parseDbUrl(statusOutput) {
  const match = statusOutput.match(/DB_URL="([^"]+)"/u)
  return match?.[1] ?? localDbUrl
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertJsonEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual)
  const expectedJson = JSON.stringify(expected)

  assert(
    actualJson === expectedJson,
    `${message}\nExpected: ${expectedJson}\nReceived: ${actualJson}`,
  )
}

let activeTransactionClient = null

async function queryScalar(client, sql, values = []) {
  const result = await client.query(sql, values)
  return Number(result.rows[0]?.count ?? 0)
}

async function expectPgError(name, operation, expectedCode) {
  const client = activeTransactionClient

  if (!client) {
    throw new Error('expectPgError requires an active transaction client.')
  }

  const savepointName = `sp_${randomUUID().replaceAll('-', '_')}`

  await client.query(`savepoint ${savepointName}`)

  try {
    await operation()
  } catch (error) {
    await client.query(`rollback to savepoint ${savepointName}`)
    await client.query(`release savepoint ${savepointName}`)

    if (error?.code === expectedCode) {
      console.log(`  ok ${name}`)
      return
    }

    throw error
  }

  await client.query(`release savepoint ${savepointName}`)

  throw new Error(`${name} did not fail with ${expectedCode}.`)
}

async function withRollback(client, name, callback) {
  const previousTransactionClient = activeTransactionClient
  activeTransactionClient = client

  await client.query('begin')

  try {
    await callback()
    console.log(`  ok ${name}`)
  } finally {
    await client.query('rollback')
    activeTransactionClient = previousTransactionClient
  }
}

async function createAuthUser(
  client,
  { authUserId, email } = { authUserId: randomUUID(), email: null },
) {
  const resolvedAuthUserId = authUserId ?? randomUUID()
  const resolvedEmail = email ?? `${resolvedAuthUserId}@example.test`

  await client.query(
    `
      insert into auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_sso_user,
        created_at,
        updated_at
      ) values (
        '00000000-0000-0000-0000-000000000000',
        $1,
        'authenticated',
        'authenticated',
        $2,
        crypt('password', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        false,
        now(),
        now()
      )
    `,
    [resolvedAuthUserId, resolvedEmail],
  )

  return resolvedAuthUserId
}

async function createProfileFixture(
  client,
  {
    authUserId = randomUUID(),
    profileId = randomUUID(),
    displayName,
    visibility = 'private',
  },
) {
  await createAuthUser(client, {
    authUserId,
    email: `${profileId}@example.test`,
  })

  await client.query(
    `
        insert into user_data.profiles (
          id,
          auth_user_id,
          display_name,
          visibility
        ) values (
          $1,
          $2,
          $3,
          $4
        )
      `,
    [profileId, authUserId, displayName, visibility],
  )

  return {
    authUserId,
    profileId,
  }
}

async function runAsDatabaseRole(client, { role, authUserId }, callback) {
  const claims = JSON.stringify(
    authUserId
      ? {
          sub: authUserId,
          role,
        }
      : {
          role,
        },
  )

  await client.query(`set local role ${role}`)
  await client.query(
    `
      select
        set_config('request.jwt.claim.role', $1, true),
        set_config('request.jwt.claim.sub', $2, true),
        set_config('request.jwt.claims', $3, true)
    `,
    [role, authUserId ?? '', claims],
  )

  return callback()
}

async function resetDatabaseRole(client) {
  await client.query('reset role')
  await client.query(
    `
      select
        set_config('request.jwt.claim.role', '', true),
        set_config('request.jwt.claim.sub', '', true),
        set_config('request.jwt.claims', '{}'::text, true)
    `,
  )
}

async function saveDeckAggregate(
  client,
  {
    deckId = null,
    ownerProfileId,
    formatId,
    title,
    description = null,
    tags = [],
    isFavorite = null,
    visibility = null,
    archivedAt = null,
    versionNote = null,
    cards = [],
  },
) {
  const result = await client.query(
    `
      select *
      from user_data.save_deck_aggregate(
        save_deck_id => $1::uuid,
        save_owner_profile_id => $2::uuid,
        save_format_id => $3::text,
        save_title => $4::text,
        save_description => $5::text,
        save_tags => $6::text[],
        save_is_favorite => $7::boolean,
        save_visibility => $8::text,
        save_archived_at => $9::timestamptz,
        save_version_note => $10::text,
        save_cards => $11::jsonb
      )
    `,
    [
      deckId,
      ownerProfileId,
      formatId,
      title,
      description,
      tags,
      isFavorite,
      visibility,
      archivedAt,
      versionNote,
      JSON.stringify(cards),
    ],
  )

  assert(
    result.rowCount === 1,
    'Atomic deck write should return exactly one persisted aggregate row.',
  )

  return result.rows[0]
}

async function listDeckSummaries(client, { ownerProfileId }) {
  const result = await client.query(
    `
      select *
      from user_data.list_deck_summaries($1::uuid)
    `,
    [ownerProfileId],
  )

  return result.rows
}

async function getDeckDetailAggregate(client, { deckId }) {
  const result = await client.query(
    `
      select *
      from user_data.get_deck_detail_aggregate($1::uuid)
    `,
    [deckId],
  )

  assert(
    result.rowCount <= 1,
    'Dense deck detail read should return at most one aggregate row.',
  )

  return result.rows[0] ?? null
}

async function loadDeckGraphState(client, deckId) {
  const result = await client.query(
    `
      select
        (select count(*)::int from user_data.decks where id = $1) as deck_count,
        (
          select count(*)::int
          from user_data.deck_versions
          where deck_id = $1
        ) as version_count,
        (
          select count(*)::int
          from user_data.deck_cards
          where deck_version_id in (
            select id
            from user_data.deck_versions
            where deck_id = $1
          )
        ) as card_count,
        (
          select current_version_id
          from user_data.decks
          where id = $1
        ) as current_version_id,
        (
          select deck_versions.version_number
          from user_data.deck_versions
          where deck_versions.id = (
            select current_version_id
            from user_data.decks
            where id = $1
          )
        ) as current_version_number,
        (
          select title
          from user_data.decks
          where id = $1
        ) as title,
        (
          select format_id
          from user_data.decks
          where id = $1
        ) as format_id,
        (
          select is_favorite
          from user_data.decks
          where id = $1
        ) as is_favorite,
        (
          select visibility
          from user_data.decks
          where id = $1
        ) as visibility
    `,
    [deckId],
  )

  return result.rows[0]
}

async function loadDeckGraphCountsByTitle(client, { ownerProfileId, title }) {
  const result = await client.query(
    `
      select
        (
          select count(*)::int
          from user_data.decks
          where owner_profile_id = $1
            and title = $2
        ) as deck_count,
        (
          select count(*)::int
          from user_data.deck_versions
          join user_data.decks
            on decks.id = deck_versions.deck_id
          where decks.owner_profile_id = $1
            and decks.title = $2
        ) as version_count,
        (
          select count(*)::int
          from user_data.deck_cards
          join user_data.deck_versions
            on deck_versions.id = deck_cards.deck_version_id
          join user_data.decks
            on decks.id = deck_versions.deck_id
          where decks.owner_profile_id = $1
            and decks.title = $2
        ) as card_count
    `,
    [ownerProfileId, title],
  )

  return result.rows[0]
}

function normalizeDeckCards(cards) {
  return [...cards]
    .map((card) => ({
      sectionKey: card.sectionKey ?? card.section_key ?? null,
      cardEntityId: card.cardEntityId ?? card.card_entity_id ?? null,
      quantity: Number(card.quantity ?? 0),
    }))
    .sort((left, right) => {
      const leftKey = `${left.sectionKey}:${left.cardEntityId}`
      const rightKey = `${right.sectionKey}:${right.cardEntityId}`
      return leftKey.localeCompare(rightKey)
    })
}

async function loadDeckVersionGraph(client, deckId) {
  const versionsResult = await client.query(
    `
      select
        id,
        version_number,
        created_by_profile_id,
        version_note
      from user_data.deck_versions
      where deck_id = $1
      order by version_number asc
    `,
    [deckId],
  )

  const cardsByVersionId = new Map()
  const versionIds = versionsResult.rows.map((row) => row.id)

  if (versionIds.length > 0) {
    const cardsResult = await client.query(
      `
        select
          deck_version_id,
          section_key,
          card_entity_id,
          quantity
        from user_data.deck_cards
        where deck_version_id = any($1::uuid[])
      `,
      [versionIds],
    )

    for (const row of cardsResult.rows) {
      const existingCards = cardsByVersionId.get(row.deck_version_id) ?? []
      existingCards.push(row)
      cardsByVersionId.set(row.deck_version_id, existingCards)
    }
  }

  return versionsResult.rows.map((row) => ({
    versionNumber: row.version_number,
    createdByProfileId: row.created_by_profile_id,
    versionNote: row.version_note,
    cards: normalizeDeckCards(cardsByVersionId.get(row.id) ?? []),
  }))
}

async function verifySeedSmoke(client) {
  console.log('Verifying seeded baseline...')

  assert(
    (await queryScalar(
      client,
      `select count(*) from legality.formats where id in ('standard', 'v-premium', 'premium')`,
    )) === 3,
    'Expected 3 seeded formats.',
  )

  assert(
    (await queryScalar(
      client,
      `select count(*) from legality.rule_profiles where is_active`,
    )) >= 3,
    'Expected active rule profiles after reset.',
  )

  assert(
    (await queryScalar(client, 'select count(*) from catalog.products')) >= 4,
    'Expected seeded catalog products.',
  )

  assert(
    (await queryScalar(client, 'select count(*) from catalog.card_entities')) >=
      10,
    'Expected seeded card entities.',
  )

  assert(
    (await queryScalar(
      client,
      'select count(*) from catalog.card_printings',
    )) >= 12,
    'Expected seeded card printings.',
  )

  assert(
    (await queryScalar(
      client,
      'select count(*) from legality.restriction_lists where is_active',
    )) >= 3,
    'Expected active legality restriction lists.',
  )

  console.log('  ok seed baseline counts')
}

async function verifyConstraints(client) {
  console.log('Verifying load-bearing constraints...')

  await withRollback(
    client,
    'canonical card identity uniqueness on catalog.card_entities',
    async () => {
      await expectPgError(
        'duplicate canonical_key rejected',
        () =>
          client.query(
            `
              insert into catalog.card_entities (
                id,
                canonical_key,
                name,
                normalized_name,
                grade,
                card_type,
                nation,
                clan,
                race,
                trigger_type,
                base_power,
                base_critical,
                base_shield,
                keywords,
                effect_refs
              ) values (
                $1,
                'card.azure-vanguard-dragon',
                'Duplicate Azure Vanguard Dragon',
                'duplicate azure vanguard dragon',
                3,
                'normal-unit',
                'Dragon Empire',
                null,
                'Cosmo Dragon',
                null,
                13000,
                1,
                0,
                '{}'::text[],
                '{}'::text[]
              )
            `,
            [randomUUID()],
          ),
        '23505',
      )
    },
  )

  await withRollback(
    client,
    'printing rows require valid canonical card references',
    async () => {
      await expectPgError(
        'missing card_entity_id FK rejected',
        () =>
          client.query(
            `
              insert into catalog.card_printings (
                id,
                printing_key,
                card_entity_id,
                product_id,
                collector_number,
                rarity,
                locale_code,
                region_code,
                printed_name,
                art_variant,
                is_alternate_art,
                is_promo_variant
              ) values (
                $1,
                $2,
                $3,
                '10000000-0000-4000-8000-000000000001',
                '999',
                'PR',
                'en',
                'en',
                'Broken Printing',
                null,
                false,
                false
              )
            `,
            [randomUUID(), `printing.invalid.${randomUUID()}`, randomUUID()],
          ),
        '23503',
      )
    },
  )

  await withRollback(
    client,
    'deck composition uniqueness stays scoped to one deck version section',
    async () => {
      const profileId = randomUUID()
      const deckId = randomUUID()
      const deckVersionId = randomUUID()

      await client.query(
        `
          insert into user_data.profiles (id, display_name, visibility)
          values ($1, 'Deck Constraint Profile', 'private')
        `,
        [profileId],
      )

      await client.query(
        `
          insert into user_data.decks (
            id,
            owner_profile_id,
            format_id,
            title,
            visibility
          ) values (
            $1,
            $2,
            'standard',
            'Constraint Deck',
            'private'
          )
        `,
        [deckId, profileId],
      )

      await client.query(
        `
          insert into user_data.deck_versions (
            id,
            deck_id,
            version_number,
            created_by_profile_id,
            version_note
          ) values (
            $1,
            $2,
            1,
            $3,
            'constraint test'
          )
        `,
        [deckVersionId, deckId, profileId],
      )

      await client.query(
        `
          insert into user_data.deck_cards (
            deck_version_id,
            section_key,
            card_entity_id,
            quantity
          ) values (
            $1,
            'main',
            '20000000-0000-4000-8000-000000000004',
            4
          )
        `,
        [deckVersionId],
      )

      await expectPgError(
        'duplicate deck_version + section + card_entity rejected',
        () =>
          client.query(
            `
              insert into user_data.deck_cards (
                deck_version_id,
                section_key,
                card_entity_id,
                quantity
              ) values (
                $1,
                'main',
                '20000000-0000-4000-8000-000000000004',
                2
              )
            `,
            [deckVersionId],
          ),
        '23505',
      )
    },
  )

  await withRollback(
    client,
    'friend relationships stay unique across unordered profile pairs',
    async () => {
      const requesterId = randomUUID()
      const addresseeId = randomUUID()

      await client.query(
        `
          insert into user_data.profiles (id, display_name, visibility)
          values
            ($1, 'Requester Profile', 'private'),
            ($2, 'Addressee Profile', 'private')
        `,
        [requesterId, addresseeId],
      )

      await client.query(
        `
          insert into social.friend_relationships (
            requester_profile_id,
            addressee_profile_id,
            status,
            responded_at
          ) values (
            $1,
            $2,
            'accepted',
            now()
          )
        `,
        [requesterId, addresseeId],
      )

      await expectPgError(
        'reverse duplicate friendship rejected',
        () =>
          client.query(
            `
              insert into social.friend_relationships (
                requester_profile_id,
                addressee_profile_id,
                status,
                responded_at
              ) values (
                $1,
                $2,
                'accepted',
                now()
              )
            `,
            [addresseeId, requesterId],
          ),
        '23505',
      )
    },
  )

  await withRollback(
    client,
    'match rows require an owning profile and default to manual source',
    async () => {
      const owner = await createProfileFixture(client, {
        displayName: 'Match Constraint Owner',
      })

      await expectPgError(
        'match rows cannot be ownerless',
        () =>
          client.query(
            `
              insert into social.matches (
                recorded_by_profile_id,
                format_id,
                visibility,
                status
              ) values (
                null,
                'standard',
                'private',
                'completed'
              )
            `,
          ),
        '23502',
      )

      const insertResult = await client.query(
        `
          insert into social.matches (
            recorded_by_profile_id,
            format_id,
            visibility,
            status
          ) values (
            $1,
            'standard',
            'private',
            'completed'
          )
          returning entry_source, updated_at
        `,
        [owner.profileId],
      )

      assert(
        insertResult.rowCount === 1,
        'Owner-backed match row should insert successfully.',
      )
      assert(
        insertResult.rows[0]?.entry_source === 'manual',
        'Manual match history rows should default to manual provenance.',
      )
      assert(
        insertResult.rows[0]?.updated_at instanceof Date ||
          typeof insertResult.rows[0]?.updated_at === 'string',
        'Match rows should expose an updated_at timestamp.',
      )
    },
  )

  await withRollback(
    client,
    'match participants cannot reference deck versions owned by another profile',
    async () => {
      const matchOwner = await createProfileFixture(client, {
        displayName: 'Match Deck Owner',
      })
      const otherDeckOwner = await createProfileFixture(client, {
        displayName: 'Other Deck Owner',
      })

      const matchId = randomUUID()
      const ownerDeckId = randomUUID()
      const ownerDeckVersionId = randomUUID()
      const foreignDeckId = randomUUID()
      const foreignDeckVersionId = randomUUID()

      await client.query(
        `
          insert into user_data.decks (
            id,
            owner_profile_id,
            format_id,
            title,
            visibility
          ) values
            ($1, $2, 'standard', 'Owner Match Deck', 'private'),
            ($3, $4, 'standard', 'Foreign Match Deck', 'private')
        `,
        [
          ownerDeckId,
          matchOwner.profileId,
          foreignDeckId,
          otherDeckOwner.profileId,
        ],
      )

      await client.query(
        `
          insert into user_data.deck_versions (
            id,
            deck_id,
            version_number,
            created_by_profile_id,
            version_note
          ) values
            ($1, $2, 1, $3, 'owner deck'),
            ($4, $5, 1, $6, 'foreign deck')
        `,
        [
          ownerDeckVersionId,
          ownerDeckId,
          matchOwner.profileId,
          foreignDeckVersionId,
          foreignDeckId,
          otherDeckOwner.profileId,
        ],
      )

      await client.query(
        `
          insert into social.matches (
            id,
            recorded_by_profile_id,
            format_id,
            visibility,
            status
          ) values (
            $1,
            $2,
            'standard',
            'private',
            'completed'
          )
        `,
        [matchId, matchOwner.profileId],
      )

      await client.query(
        `
          insert into social.match_participants (
            match_id,
            profile_id,
            deck_version_id,
            seat_order,
            result
          ) values (
            $1,
            $2,
            $3,
            1,
            'win'
          )
        `,
        [matchId, matchOwner.profileId, ownerDeckVersionId],
      )

      await expectPgError(
        'foreign deck version rejected for owner match history',
        () =>
          client.query(
            `
              insert into social.match_participants (
                match_id,
                profile_id,
                deck_version_id,
                seat_order,
                result
              ) values (
                $1,
                $2,
                $3,
                2,
                'loss'
              )
            `,
            [matchId, otherDeckOwner.profileId, foreignDeckVersionId],
          ),
        '23514',
      )
    },
  )

  await withRollback(
    client,
    'gameplay room events cannot reference room players from another room',
    async () => {
      const hostProfileId = randomUUID()
      const roomAId = randomUUID()
      const roomBId = randomUUID()
      const roomPlayerId = randomUUID()

      await client.query(
        `
          insert into user_data.profiles (id, display_name, visibility)
          values ($1, 'Gameplay Host', 'private')
        `,
        [hostProfileId],
      )

      await client.query(
        `
          insert into gameplay.match_rooms (
            id,
            format_id,
            host_profile_id,
            status
          ) values
            ($1, 'standard', $3, 'setup'),
            ($2, 'standard', $3, 'setup')
        `,
        [roomAId, roomBId, hostProfileId],
      )

      await client.query(
        `
          insert into gameplay.room_players (
            id,
            room_id,
            profile_id,
            seat_order,
            player_status
          ) values (
            $1,
            $2,
            $3,
            1,
            'joined'
          )
        `,
        [roomPlayerId, roomAId, hostProfileId],
      )

      await expectPgError(
        'cross-room actor reference rejected',
        () =>
          client.query(
            `
              insert into gameplay.room_events (
                room_id,
                event_sequence,
                actor_room_player_id,
                event_kind,
                source_kind,
                source_ref,
                event_payload
              ) values (
                $1,
                1,
                $2,
                'attack-declared',
                'player-action',
                'dev.test',
                '{}'::jsonb
              )
            `,
            [roomBId, roomPlayerId],
          ),
        '23503',
      )
    },
  )
}

async function verifyDeckWriteAtomicity(client) {
  console.log('Verifying deck write atomicity...')

  await withRollback(
    client,
    'deck write RPC commits create and save flows as one aggregate unit',
    async () => {
      const owner = await createProfileFixture(client, {
        displayName: 'Atomic Deck Owner',
      })

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: owner.authUserId },
        async () => {
          const createdDeck = await saveDeckAggregate(client, {
            ownerProfileId: owner.profileId,
            formatId: 'standard',
            title: 'Atomic Create Deck',
            description: 'Initial atomic version',
            tags: ['atomic'],
            isFavorite: true,
            cards: [
              {
                section_key: 'main',
                card_entity_id: atomicDeckMainCardId,
                quantity: 4,
              },
              {
                section_key: 'ride',
                card_entity_id: atomicDeckRideCardId,
                quantity: 1,
              },
            ],
            versionNote: 'initial atomic write',
          })

          assert(
            createdDeck.current_version_number === 1,
            'Atomic create should persist version 1 as the current version.',
          )
          assert(
            createdDeck.visibility === 'private',
            'Atomic create should default deck visibility to private.',
          )

          const createdState = await loadDeckGraphState(
            client,
            createdDeck.deck_id,
          )

          assert(
            createdState.deck_count === 1,
            'Atomic create should persist exactly one deck row.',
          )
          assert(
            createdState.version_count === 1,
            'Atomic create should persist exactly one deck version row.',
          )
          assert(
            createdState.card_count === 2,
            'Atomic create should persist the full initial card graph.',
          )
          assert(
            createdState.current_version_id === createdDeck.current_version_id,
            'Atomic create should attach the created version as the deck current version.',
          )
          assert(
            createdState.current_version_number === 1,
            'Atomic create should expose version 1 on the persisted deck graph.',
          )
          assert(
            createdState.title === 'Atomic Create Deck',
            'Atomic create should persist deck metadata together with the version graph.',
          )

          const createdVersionGraph = await loadDeckVersionGraph(
            client,
            createdDeck.deck_id,
          )

          assertJsonEqual(
            createdVersionGraph,
            [
              {
                versionNumber: 1,
                createdByProfileId: owner.profileId,
                versionNote: 'initial atomic write',
                cards: normalizeDeckCards([
                  {
                    sectionKey: 'main',
                    cardEntityId: atomicDeckMainCardId,
                    quantity: 4,
                  },
                  {
                    sectionKey: 'ride',
                    cardEntityId: atomicDeckRideCardId,
                    quantity: 1,
                  },
                ]),
              },
            ],
            'Atomic create should persist the expected initial deck version graph.',
          )

          const savedDeck = await saveDeckAggregate(client, {
            deckId: createdDeck.deck_id,
            ownerProfileId: owner.profileId,
            formatId: 'premium',
            title: 'Atomic Save Deck',
            description: 'Second atomic version',
            tags: ['atomic', 'premium'],
            isFavorite: false,
            visibility: 'private',
            cards: [
              {
                section_key: 'main',
                card_entity_id: atomicDeckMainCardId,
                quantity: 3,
              },
              {
                section_key: 'ride',
                card_entity_id: atomicDeckRideCardId,
                quantity: 2,
              },
            ],
            versionNote: 'second atomic write',
          })

          assert(
            savedDeck.deck_id === createdDeck.deck_id,
            'Atomic save should update the existing deck aggregate in place.',
          )
          assert(
            savedDeck.current_version_number === 2,
            'Atomic save should append the next version number.',
          )
          assert(
            savedDeck.current_version_id !== createdDeck.current_version_id,
            'Atomic save should create a new current version row instead of mutating the old one.',
          )

          const savedState = await loadDeckGraphState(
            client,
            createdDeck.deck_id,
          )

          assert(
            savedState.deck_count === 1,
            'Atomic save should keep exactly one parent deck row.',
          )
          assert(
            savedState.version_count === 2,
            'Atomic save should append exactly one additional deck version row.',
          )
          assert(
            savedState.card_count === 4,
            'Atomic save should keep both persisted version card slices consistent.',
          )
          assert(
            savedState.current_version_id === savedDeck.current_version_id,
            'Atomic save should repoint the deck current version to the new version row.',
          )
          assert(
            savedState.current_version_number === 2,
            'Atomic save should expose the new version as the current persisted revision.',
          )
          assert(
            savedState.title === 'Atomic Save Deck',
            'Atomic save should update deck metadata inside the same transaction boundary.',
          )
          assert(
            savedState.format_id === 'premium',
            'Atomic save should update the deck format together with the new current version.',
          )
          assert(
            savedState.is_favorite === false,
            'Atomic save should update deck favorite metadata inside the same commit.',
          )
          assert(
            savedState.visibility === 'private',
            'Atomic save should preserve deck visibility on the committed aggregate.',
          )

          const savedVersionGraph = await loadDeckVersionGraph(
            client,
            createdDeck.deck_id,
          )

          assertJsonEqual(
            savedVersionGraph,
            [
              {
                versionNumber: 1,
                createdByProfileId: owner.profileId,
                versionNote: 'initial atomic write',
                cards: normalizeDeckCards([
                  {
                    sectionKey: 'main',
                    cardEntityId: atomicDeckMainCardId,
                    quantity: 4,
                  },
                  {
                    sectionKey: 'ride',
                    cardEntityId: atomicDeckRideCardId,
                    quantity: 1,
                  },
                ]),
              },
              {
                versionNumber: 2,
                createdByProfileId: owner.profileId,
                versionNote: 'second atomic write',
                cards: normalizeDeckCards([
                  {
                    sectionKey: 'main',
                    cardEntityId: atomicDeckMainCardId,
                    quantity: 3,
                  },
                  {
                    sectionKey: 'ride',
                    cardEntityId: atomicDeckRideCardId,
                    quantity: 2,
                  },
                ]),
              },
            ],
            'Atomic save should persist the full expected version graph without stray child rows.',
          )

          const savedDetail = await getDeckDetailAggregate(client, {
            deckId: createdDeck.deck_id,
          })

          assert(
            savedDetail !== null,
            'Atomic save should leave the dense deck detail aggregate readable for the owner.',
          )
          assert(
            savedDetail?.current_version_number === 2,
            'Atomic save should surface the new current version number through the dense read RPC.',
          )
          assert(
            savedDetail?.current_version_note === 'second atomic write',
            'Atomic save should surface the persisted version note through the dense read RPC.',
          )
          assert(
            savedDetail?.current_version_created_by_profile_id ===
              owner.profileId,
            'Atomic save should keep current version ownership aligned in the dense read payload.',
          )
          assert(
            savedDetail?.has_missing_card_entity === false,
            'Atomic save should not introduce dangling card references into the dense read payload.',
          )
          assertJsonEqual(
            normalizeDeckCards(savedDetail?.current_version_cards ?? []),
            normalizeDeckCards([
              {
                sectionKey: 'main',
                cardEntityId: atomicDeckMainCardId,
                quantity: 3,
              },
              {
                sectionKey: 'ride',
                cardEntityId: atomicDeckRideCardId,
                quantity: 2,
              },
            ]),
            'Atomic save should expose the expected current-version cards through the dense read RPC.',
          )
        },
      )
    },
  )

  await withRollback(
    client,
    'deck write RPC rolls back failed create attempts without orphan rows',
    async () => {
      const owner = await createProfileFixture(client, {
        displayName: 'Atomic Create Failure Owner',
      })
      const failedDeckTitle = `Atomic Failed Create ${randomUUID()}`

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: owner.authUserId },
        async () => {
          await expectPgError(
            'atomic create rejects invalid card references',
            () =>
              saveDeckAggregate(client, {
                ownerProfileId: owner.profileId,
                formatId: 'standard',
                title: failedDeckTitle,
                description: 'Should roll back completely',
                tags: ['atomic'],
                cards: [
                  {
                    section_key: 'main',
                    card_entity_id: randomUUID(),
                    quantity: 4,
                  },
                ],
                versionNote: 'invalid create write',
              }),
            '23503',
          )
        },
      )

      await resetDatabaseRole(client)

      const failedCreateCounts = await loadDeckGraphCountsByTitle(client, {
        ownerProfileId: owner.profileId,
        title: failedDeckTitle,
      })

      assert(
        failedCreateCounts.deck_count === 0,
        'Failed atomic create must not leave a deck row behind.',
      )
      assert(
        failedCreateCounts.version_count === 0,
        'Failed atomic create must not leave deck version rows behind.',
      )
      assert(
        failedCreateCounts.card_count === 0,
        'Failed atomic create must not leave deck card rows behind.',
      )
    },
  )

  await withRollback(
    client,
    'deck write RPC leaves existing persisted state unchanged when save fails',
    async () => {
      const owner = await createProfileFixture(client, {
        displayName: 'Atomic Save Failure Owner',
      })

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: owner.authUserId },
        async () => {
          const baselineDeck = await saveDeckAggregate(client, {
            ownerProfileId: owner.profileId,
            formatId: 'standard',
            title: 'Atomic Failure Baseline',
            description: 'Baseline persisted version',
            tags: ['baseline'],
            isFavorite: true,
            cards: [
              {
                section_key: 'main',
                card_entity_id: atomicDeckMainCardId,
                quantity: 4,
              },
              {
                section_key: 'ride',
                card_entity_id: atomicDeckRideCardId,
                quantity: 1,
              },
            ],
            versionNote: 'baseline write',
          })

          const stateBeforeFailure = await loadDeckGraphState(
            client,
            baselineDeck.deck_id,
          )

          await expectPgError(
            'atomic save rejects invalid replacement card references',
            () =>
              saveDeckAggregate(client, {
                deckId: baselineDeck.deck_id,
                ownerProfileId: owner.profileId,
                formatId: 'premium',
                title: 'Should Not Persist',
                description: 'This write should roll back',
                tags: ['invalid'],
                isFavorite: false,
                visibility: 'private',
                cards: [
                  {
                    section_key: 'main',
                    card_entity_id: randomUUID(),
                    quantity: 4,
                  },
                ],
                versionNote: 'broken save',
              }),
            '23503',
          )

          const stateAfterFailure = await loadDeckGraphState(
            client,
            baselineDeck.deck_id,
          )

          assert(
            stateAfterFailure.deck_count === stateBeforeFailure.deck_count,
            'Failed atomic save must not delete the existing deck row.',
          )
          assert(
            stateAfterFailure.version_count ===
              stateBeforeFailure.version_count,
            'Failed atomic save must not append a new deck version row.',
          )
          assert(
            stateAfterFailure.card_count === stateBeforeFailure.card_count,
            'Failed atomic save must not leave extra deck card rows.',
          )
          assert(
            stateAfterFailure.current_version_id ===
              stateBeforeFailure.current_version_id,
            'Failed atomic save must not repoint the current version.',
          )
          assert(
            stateAfterFailure.current_version_number ===
              stateBeforeFailure.current_version_number,
            'Failed atomic save must keep the previous current version number intact.',
          )
          assert(
            stateAfterFailure.title === stateBeforeFailure.title,
            'Failed atomic save must not mutate deck metadata.',
          )
          assert(
            stateAfterFailure.format_id === stateBeforeFailure.format_id,
            'Failed atomic save must not mutate the persisted deck format.',
          )
          assert(
            stateAfterFailure.is_favorite === stateBeforeFailure.is_favorite,
            'Failed atomic save must not mutate persisted favorite metadata.',
          )
          assert(
            stateAfterFailure.visibility === stateBeforeFailure.visibility,
            'Failed atomic save must not mutate persisted visibility metadata.',
          )
        },
      )
    },
  )

  await withRollback(
    client,
    'deck write RPC rejects forged owner ids without partial writes',
    async () => {
      const owner = await createProfileFixture(client, {
        displayName: 'Atomic Owner Check',
      })
      const foreignOwner = await createProfileFixture(client, {
        displayName: 'Atomic Foreign Owner',
      })
      const forgedDeckTitle = `Atomic Forged Owner ${randomUUID()}`

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: owner.authUserId },
        async () => {
          await expectPgError(
            'atomic create rejects forged owner profile ids',
            () =>
              saveDeckAggregate(client, {
                ownerProfileId: foreignOwner.profileId,
                formatId: 'standard',
                title: forgedDeckTitle,
                description: 'Owner mismatch should fail before any write.',
                tags: ['forged-owner'],
                cards: [
                  {
                    section_key: 'main',
                    card_entity_id: atomicDeckMainCardId,
                    quantity: 4,
                  },
                ],
                versionNote: 'forged owner write',
              }),
            '42501',
          )
        },
      )

      await resetDatabaseRole(client)

      const ownerCounts = await loadDeckGraphCountsByTitle(client, {
        ownerProfileId: owner.profileId,
        title: forgedDeckTitle,
      })
      const foreignOwnerCounts = await loadDeckGraphCountsByTitle(client, {
        ownerProfileId: foreignOwner.profileId,
        title: forgedDeckTitle,
      })

      assert(
        ownerCounts.deck_count === 0 &&
          ownerCounts.version_count === 0 &&
          ownerCounts.card_count === 0,
        'Forged owner writes must not create rows for the authenticated caller either.',
      )
      assert(
        foreignOwnerCounts.deck_count === 0 &&
          foreignOwnerCounts.version_count === 0 &&
          foreignOwnerCounts.card_count === 0,
        'Forged owner writes must not create rows for the targeted foreign owner.',
      )
    },
  )
}

async function verifyDeckReadDensification(client) {
  console.log('Verifying deck read path densification...')

  await withRollback(
    client,
    'dense deck read RPCs return owner-scoped summaries and aggregate detail',
    async () => {
      const owner = await createProfileFixture(client, {
        displayName: 'Dense Read Owner',
      })
      const foreignUser = await createProfileFixture(client, {
        displayName: 'Dense Read Foreign User',
      })

      let persistedDeckId = null

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: owner.authUserId },
        async () => {
          const createdDeck = await saveDeckAggregate(client, {
            ownerProfileId: owner.profileId,
            formatId: 'standard',
            title: 'Dense Read Deck',
            description: 'Read-side aggregate verification',
            tags: ['dense-read'],
            isFavorite: true,
            cards: [
              {
                section_key: 'main',
                card_entity_id: atomicDeckMainCardId,
                quantity: 4,
              },
              {
                section_key: 'ride',
                card_entity_id: atomicDeckRideCardId,
                quantity: 1,
              },
            ],
            versionNote: 'dense read baseline',
          })

          persistedDeckId = createdDeck.deck_id

          const deckSummaries = await listDeckSummaries(client, {
            ownerProfileId: owner.profileId,
          })

          assert(
            deckSummaries.length === 1,
            'Dense deck list should return the persisted owner deck in one DB-side read model.',
          )

          const summary = deckSummaries[0]

          assert(
            summary.deck_id === createdDeck.deck_id,
            'Dense deck list should surface the persisted deck id.',
          )
          assert(
            summary.format_id === 'standard' &&
              summary.format_display_name === 'Standard',
            'Dense deck list should attach format data without an extra application-side fetch.',
          )
          assert(
            summary.current_version_number === 1,
            'Dense deck list should surface the current version number.',
          )
          assert(
            summary.main_count === 4 &&
              summary.ride_count === 1 &&
              summary.g_count === 0,
            'Dense deck list should expose section counts from the current version in the same read.',
          )

          const deckDetail = await getDeckDetailAggregate(client, {
            deckId: createdDeck.deck_id,
          })

          assert(
            deckDetail !== null,
            'Dense deck detail should return the persisted deck aggregate.',
          )
          assert(
            deckDetail?.deck_id === createdDeck.deck_id,
            'Dense deck detail should return the requested deck aggregate row.',
          )
          assert(
            deckDetail?.current_version_number === 1,
            'Dense deck detail should surface the current version metadata.',
          )
          assert(
            Array.isArray(deckDetail?.current_version_cards) &&
              deckDetail.current_version_cards.length === 2,
            'Dense deck detail should inline the full current version card slice.',
          )
          assert(
            deckDetail?.has_missing_card_entity === false,
            'Dense deck detail should not report missing canonical cards for intact seed data.',
          )
        },
      )

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: foreignUser.authUserId },
        async () => {
          assert(
            persistedDeckId !== null,
            'Dense read verification requires a persisted deck id.',
          )

          const foreignVisibleDecks = await listDeckSummaries(client, {
            ownerProfileId: owner.profileId,
          })

          assert(
            foreignVisibleDecks.length === 0,
            'Dense deck list must keep owner scoping under RLS for foreign users.',
          )

          const foreignDeckDetail = await getDeckDetailAggregate(client, {
            deckId: persistedDeckId,
          })

          assert(
            foreignDeckDetail === null,
            'Dense deck detail must not expose another user deck aggregate.',
          )
        },
      )
    },
  )
}

async function verifyAuthorizationRls(client, { onlyDeck = false } = {}) {
  console.log(
    onlyDeck
      ? 'Verifying deck authorization and RLS...'
      : 'Verifying baseline authorization and RLS...',
  )

  if (!onlyDeck) {
    await withRollback(
      client,
      'profiles stay owner-only while public profile reads use a safe projection',
      async () => {
        const owner = await createProfileFixture(client, {
          displayName: 'Owner Pilot',
          visibility: 'private',
        })
        const stranger = await createProfileFixture(client, {
          displayName: 'Stranger Pilot',
          visibility: 'private',
        })
        const publicProfile = await createProfileFixture(client, {
          displayName: 'Public Pilot',
          visibility: 'public',
        })

        await runAsDatabaseRole(client, { role: 'anon' }, async () => {
          const publicViewResult = await client.query(
            `
            select id, display_name, avatar_url, bio
            from user_data.public_profiles
            order by display_name asc
          `,
          )

          assert(
            publicViewResult.rowCount === 1,
            'Anon should see only one public profile row.',
          )
          assert(
            publicViewResult.rows[0]?.id === publicProfile.profileId,
            'Anon should only see the public profile projection.',
          )

          await expectPgError(
            'anon cannot read base profiles table directly',
            () => client.query(`select id from user_data.profiles`),
            '42501',
          )
        })

        await runAsDatabaseRole(
          client,
          { role: 'authenticated', authUserId: owner.authUserId },
          async () => {
            const ownProfileResult = await client.query(
              `
              select id
              from user_data.profiles
              where id = $1
            `,
              [owner.profileId],
            )

            assert(
              ownProfileResult.rowCount === 1,
              'Owner should be able to read their own profile row.',
            )

            const privateOtherResult = await client.query(
              `
              select id
              from user_data.profiles
              where id = $1
            `,
              [stranger.profileId],
            )

            assert(
              privateOtherResult.rowCount === 0,
              'Authenticated non-owner must not read another private profile row.',
            )

            const updateOwnProfileResult = await client.query(
              `
              update user_data.profiles
              set bio = 'Owner bio'
              where id = $1
              returning id
            `,
              [owner.profileId],
            )

            assert(
              updateOwnProfileResult.rowCount === 1,
              'Owner should be able to update their own profile row.',
            )

            await expectPgError(
              'authenticated user cannot forge another auth_user_id on profile insert',
              () =>
                client.query(
                  `
                  insert into user_data.profiles (
                    auth_user_id,
                    display_name,
                    visibility
                  ) values (
                    $1,
                    'Forged Profile',
                    'private'
                  )
                `,
                  [stranger.authUserId],
                ),
              '42501',
            )
          },
        )
      },
    )

    await withRollback(
      client,
      'collections and collection items stay owner-only',
      async () => {
        const owner = await createProfileFixture(client, {
          displayName: 'Collection Owner',
        })
        const stranger = await createProfileFixture(client, {
          displayName: 'Collection Stranger',
        })

        const ownerCollectionId = randomUUID()

        await client.query(
          `
          insert into user_data.collections (
            id,
            owner_profile_id,
            name,
            collection_kind,
            visibility,
            is_default
          ) values (
            $1,
            $2,
            'Owner Binder',
            'binder',
            'private',
            false
          )
        `,
          [ownerCollectionId, owner.profileId],
        )

        await client.query(
          `
          insert into user_data.collection_items (
            owner_profile_id,
            card_printing_id,
            quantity
          ) values (
            $1,
            '30000000-0000-4000-8000-000000000001',
            2
          )
        `,
          [owner.profileId],
        )

        await runAsDatabaseRole(
          client,
          { role: 'authenticated', authUserId: owner.authUserId },
          async () => {
            const ownCollections = await client.query(
              `select id from user_data.collections where owner_profile_id = $1`,
              [owner.profileId],
            )

            assert(
              ownCollections.rowCount === 1,
              'Owner should be able to read their own collection.',
            )

            const ownItems = await client.query(
              `
              select id, quantity
              from user_data.collection_items
              where owner_profile_id = $1
            `,
              [owner.profileId],
            )

            assert(
              ownItems.rowCount === 1,
              'Owner should be able to read their own collection items.',
            )
            assert(
              ownItems.rows[0]?.quantity === 2,
              'Owner collection item should keep the inserted quantity.',
            )

            const updateCollectionResult = await client.query(
              `
              update user_data.collections
              set description = 'Updated by owner'
              where id = $1
              returning id
            `,
              [ownerCollectionId],
            )

            assert(
              updateCollectionResult.rowCount === 1,
              'Owner should be able to update their own collection.',
            )

            const incrementItemResult = await client.query(
              `
              select quantity
              from user_data.change_collection_item_quantity($1, $2, $3)
            `,
              [owner.profileId, '30000000-0000-4000-8000-000000000001', 1],
            )

            assert(
              incrementItemResult.rowCount === 1 &&
                incrementItemResult.rows[0]?.quantity === 3,
              'Owner should be able to increment their own collection item quantity.',
            )

            const clearItemResult = await client.query(
              `
              select *
              from user_data.set_collection_item_quantity($1, $2, $3)
            `,
              [owner.profileId, '30000000-0000-4000-8000-000000000001', 0],
            )

            assert(
              clearItemResult.rowCount === 0,
              'Setting collection quantity to zero should delete the row cleanly.',
            )

            const deletedItems = await client.query(
              `
              select id
              from user_data.collection_items
              where owner_profile_id = $1
                and card_printing_id = $2
            `,
              [owner.profileId, '30000000-0000-4000-8000-000000000001'],
            )

            assert(
              deletedItems.rowCount === 0,
              'Deleted collection items should no longer remain in owner inventory.',
            )

            await client.query(
              `
              insert into user_data.collection_items (
                owner_profile_id,
                card_printing_id,
                quantity
              ) values (
                $1,
                '30000000-0000-4000-8000-000000000001',
                1
              )
            `,
              [owner.profileId],
            )

            await expectPgError(
              'owner cannot create duplicate collection rows for the same printing',
              () =>
                client.query(
                  `
                  insert into user_data.collection_items (
                    owner_profile_id,
                    card_printing_id,
                    quantity
                  ) values (
                    $1,
                    '30000000-0000-4000-8000-000000000001',
                    1
                  )
                `,
                  [owner.profileId],
                ),
              '23505',
            )

            await expectPgError(
              'owner cannot create a collection for another profile',
              () =>
                client.query(
                  `
                  insert into user_data.collections (
                    owner_profile_id,
                    name,
                    collection_kind,
                    visibility
                  ) values (
                    $1,
                    'Forged Inventory',
                    'inventory',
                    'private'
                  )
                `,
                  [stranger.profileId],
                ),
              '42501',
            )

            await expectPgError(
              'owner cannot create a collection item for another profile',
              () =>
                client.query(
                  `
                  insert into user_data.collection_items (
                    owner_profile_id,
                    card_printing_id,
                    quantity
                  ) values (
                    $1,
                    '30000000-0000-4000-8000-000000000002',
                    1
                  )
                `,
                  [stranger.profileId],
                ),
              '42501',
            )
          },
        )

        await runAsDatabaseRole(
          client,
          { role: 'authenticated', authUserId: stranger.authUserId },
          async () => {
            const otherCollections = await client.query(
              `select id from user_data.collections where id = $1`,
              [ownerCollectionId],
            )

            assert(
              otherCollections.rowCount === 0,
              'Non-owner must not read another user collection.',
            )

            const otherItems = await client.query(
              `
              select id
              from user_data.collection_items
              where owner_profile_id = $1
            `,
              [owner.profileId],
            )

            assert(
              otherItems.rowCount === 0,
              'Non-owner must not read another user collection items.',
            )

            await expectPgError(
              'non-owner cannot add items to another user collection inventory',
              () =>
                client.query(
                  `
                  insert into user_data.collection_items (
                    owner_profile_id,
                    card_printing_id,
                    quantity
                  ) values (
                    $1,
                    '30000000-0000-4000-8000-000000000002',
                    1
                  )
                `,
                  [owner.profileId],
                ),
              '42501',
            )

            await expectPgError(
              'non-owner cannot mutate another user collection item through the quantity rpc',
              () =>
                client.query(
                  `
                  select *
                  from user_data.change_collection_item_quantity($1, $2, $3)
                `,
                  [owner.profileId, '30000000-0000-4000-8000-000000000001', 1],
                ),
              '42501',
            )
          },
        )
      },
    )
  }

  await withRollback(
    client,
    'decks, versions, and cards stay owner-only',
    async () => {
      const owner = await createProfileFixture(client, {
        displayName: 'Deck Owner',
      })
      const stranger = await createProfileFixture(client, {
        displayName: 'Deck Stranger',
      })

      const ownerDeckId = randomUUID()
      const ownerDeckVersionId = randomUUID()
      const ownerDeckCardId = randomUUID()

      await client.query(
        `
          insert into user_data.decks (
            id,
            owner_profile_id,
            format_id,
            title,
            visibility
          ) values (
            $1,
            $2,
            'standard',
            'Owner Deck',
            'private'
          )
        `,
        [ownerDeckId, owner.profileId],
      )

      await client.query(
        `
          insert into user_data.deck_versions (
            id,
            deck_id,
            version_number,
            created_by_profile_id,
            version_note
          ) values (
            $1,
            $2,
            1,
            $3,
            'owner baseline'
          )
        `,
        [ownerDeckVersionId, ownerDeckId, owner.profileId],
      )

      await client.query(
        `
          insert into user_data.deck_cards (
            id,
            deck_version_id,
            section_key,
            card_entity_id,
            quantity
          ) values (
            $1,
            $2,
            'main',
            '20000000-0000-4000-8000-000000000004',
            4
          )
        `,
        [ownerDeckCardId, ownerDeckVersionId],
      )

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: owner.authUserId },
        async () => {
          const ownDecks = await client.query(
            `select id from user_data.decks where id = $1`,
            [ownerDeckId],
          )

          assert(
            ownDecks.rowCount === 1,
            'Owner should be able to read their own deck.',
          )

          const ownVersions = await client.query(
            `select id from user_data.deck_versions where id = $1`,
            [ownerDeckVersionId],
          )

          assert(
            ownVersions.rowCount === 1,
            'Owner should be able to read their own deck versions.',
          )

          const ownDeckCards = await client.query(
            `select id from user_data.deck_cards where deck_version_id = $1`,
            [ownerDeckVersionId],
          )

          assert(
            ownDeckCards.rowCount === 1,
            'Owner should be able to read deck cards for their own deck.',
          )

          const updateDeckResult = await client.query(
            `
              update user_data.decks
              set title = 'Owner Deck Updated'
              where id = $1
              returning id
            `,
            [ownerDeckId],
          )

          assert(
            updateDeckResult.rowCount === 1,
            'Owner should be able to update their own deck.',
          )

          const insertedVersion = await client.query(
            `
              insert into user_data.deck_versions (
                deck_id,
                version_number,
                created_by_profile_id,
                version_note
              ) values (
                $1,
                2,
                $2,
                'owner revision'
              )
              returning id
            `,
            [ownerDeckId, owner.profileId],
          )

          assert(
            insertedVersion.rowCount === 1,
            'Owner should be able to create a new deck version on their own deck.',
          )

          const insertedVersionId = insertedVersion.rows[0]?.id ?? null

          assert(
            typeof insertedVersionId === 'string',
            'Owner-created deck versions should return a persisted version id.',
          )

          const insertedDeckCard = await client.query(
            `
              insert into user_data.deck_cards (
                deck_version_id,
                section_key,
                card_entity_id,
                quantity
              ) values (
                $1,
                'ride',
                '20000000-0000-4000-8000-000000000008',
                1
              )
              returning quantity
            `,
            [insertedVersionId],
          )

          assert(
            insertedDeckCard.rowCount === 1 &&
              insertedDeckCard.rows[0]?.quantity === 1,
            'Owner should be able to create deck cards on their own persisted version graph.',
          )

          await expectPgError(
            'owner cannot rewrite persisted deck versions in place',
            () =>
              client.query(
                `
                  update user_data.deck_versions
                  set version_note = 'tampered historical version'
                  where id = $1
                `,
                [ownerDeckVersionId],
              ),
            '42501',
          )

          await expectPgError(
            'owner cannot rewrite persisted deck cards in place',
            () =>
              client.query(
                `
                  update user_data.deck_cards
                  set quantity = 3
                  where id = $1
                `,
                [ownerDeckCardId],
              ),
            '42501',
          )

          await expectPgError(
            'owner cannot create a deck for another profile',
            () =>
              client.query(
                `
                  insert into user_data.decks (
                    owner_profile_id,
                    format_id,
                    title,
                    visibility
                  ) values (
                    $1,
                    'standard',
                    'Forged Deck',
                    'private'
                  )
                `,
                [stranger.profileId],
              ),
            '42501',
          )
        },
      )

      const stateBeforeDeniedRpc = await loadDeckGraphState(client, ownerDeckId)

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: stranger.authUserId },
        async () => {
          const foreignDecks = await client.query(
            `select id from user_data.decks where id = $1`,
            [ownerDeckId],
          )

          assert(
            foreignDecks.rowCount === 0,
            'Non-owner must not read another user deck.',
          )

          const foreignVersions = await client.query(
            `select id from user_data.deck_versions where id = $1`,
            [ownerDeckVersionId],
          )

          assert(
            foreignVersions.rowCount === 0,
            'Non-owner must not read another user deck version rows directly.',
          )

          const foreignDeckCards = await client.query(
            `select id from user_data.deck_cards where id = $1`,
            [ownerDeckCardId],
          )

          assert(
            foreignDeckCards.rowCount === 0,
            'Non-owner must not read another user deck card rows directly.',
          )

          const updateDeckResult = await client.query(
            `
              update user_data.decks
              set title = 'Stranger Update Attempt'
              where id = $1
              returning id
            `,
            [ownerDeckId],
          )

          assert(
            updateDeckResult.rowCount === 0,
            'Non-owner must not update another user deck.',
          )

          await expectPgError(
            'non-owner cannot create a deck version on another user deck',
            () =>
              client.query(
                `
                  insert into user_data.deck_versions (
                    deck_id,
                    version_number,
                    created_by_profile_id,
                    version_note
                  ) values (
                    $1,
                    2,
                    $2,
                    'stranger revision'
                  )
                `,
                [ownerDeckId, stranger.profileId],
              ),
            '42501',
          )

          await expectPgError(
            'non-owner cannot create deck cards on another user version graph',
            () =>
              client.query(
                `
                  insert into user_data.deck_cards (
                    deck_version_id,
                    section_key,
                    card_entity_id,
                    quantity
                  ) values (
                    $1,
                    'ride',
                    '20000000-0000-4000-8000-000000000008',
                    1
                  )
                `,
                [ownerDeckVersionId],
              ),
            '42501',
          )

          await expectPgError(
            'non-owner cannot save another user deck through the atomic write RPC',
            () =>
              saveDeckAggregate(client, {
                deckId: ownerDeckId,
                ownerProfileId: owner.profileId,
                formatId: 'standard',
                title: 'Forbidden Save Attempt',
                description: 'This must stay blocked by the database.',
                tags: ['forbidden'],
                cards: [],
                versionNote: 'stranger save attempt',
              }),
            '42501',
          )

          const deleteDeckResult = await client.query(
            `
              delete from user_data.decks
              where id = $1
              returning id
            `,
            [ownerDeckId],
          )

          assert(
            deleteDeckResult.rowCount === 0,
            'Non-owner must not delete another user deck.',
          )
        },
      )

      await resetDatabaseRole(client)

      const stateAfterDeniedRpc = await loadDeckGraphState(client, ownerDeckId)

      assertJsonEqual(
        stateAfterDeniedRpc,
        stateBeforeDeniedRpc,
        'Denied cross-owner aggregate saves must not mutate the persisted deck graph.',
      )
    },
  )

  await withRollback(
    client,
    'deck ownership invariants reject cross-owner or reassigned child links',
    async () => {
      const owner = await createProfileFixture(client, {
        displayName: 'Deck Invariant Owner',
      })
      const stranger = await createProfileFixture(client, {
        displayName: 'Deck Invariant Stranger',
      })

      const ownerDeckId = randomUUID()
      const siblingDeckId = randomUUID()
      const ownerDeckVersionId = randomUUID()
      const siblingDeckVersionId = randomUUID()
      const ownerDeckCardId = randomUUID()

      await client.query(
        `
          insert into user_data.decks (
            id,
            owner_profile_id,
            format_id,
            title,
            visibility
          ) values
            ($1, $2, 'standard', 'Invariant Deck A', 'private'),
            ($3, $2, 'standard', 'Invariant Deck B', 'private')
        `,
        [ownerDeckId, owner.profileId, siblingDeckId],
      )

      await client.query(
        `
          insert into user_data.deck_versions (
            id,
            deck_id,
            version_number,
            created_by_profile_id,
            version_note
          ) values
            ($1, $2, 1, $3, 'baseline a'),
            ($4, $5, 1, $3, 'baseline b')
        `,
        [
          ownerDeckVersionId,
          ownerDeckId,
          owner.profileId,
          siblingDeckVersionId,
          siblingDeckId,
        ],
      )

      await client.query(
        `
          insert into user_data.deck_cards (
            id,
            deck_version_id,
            section_key,
            card_entity_id,
            quantity
          ) values (
            $1,
            $2,
            'main',
            '20000000-0000-4000-8000-000000000004',
            4
          )
        `,
        [ownerDeckCardId, ownerDeckVersionId],
      )

      await expectPgError(
        'deck ownership root cannot be reassigned after creation',
        () =>
          client.query(
            `
              update user_data.decks
              set owner_profile_id = $2
              where id = $1
            `,
            [ownerDeckId, stranger.profileId],
          ),
        '23514',
      )

      await expectPgError(
        'deck versions cannot claim a creator that does not own the parent deck',
        () =>
          client.query(
            `
              insert into user_data.deck_versions (
                id,
                deck_id,
                version_number,
                created_by_profile_id,
                version_note
              ) values (
                $1,
                $2,
                2,
                $3,
                'cross-owner mismatch'
              )
            `,
            [randomUUID(), ownerDeckId, stranger.profileId],
          ),
        '23514',
      )

      await expectPgError(
        'deck versions cannot be moved onto another deck after creation',
        () =>
          client.query(
            `
              update user_data.deck_versions
              set deck_id = $2
              where id = $1
            `,
            [ownerDeckVersionId, siblingDeckId],
          ),
        '23514',
      )

      await expectPgError(
        'deck cards cannot be moved onto another persisted version graph',
        () =>
          client.query(
            `
              update user_data.deck_cards
              set deck_version_id = $2
              where id = $1
            `,
            [ownerDeckCardId, siblingDeckVersionId],
          ),
        '23514',
      )
    },
  )

  if (onlyDeck) {
    return
  }

  await withRollback(
    client,
    'matches and participants stay owner-only',
    async () => {
      const owner = await createProfileFixture(client, {
        displayName: 'Match Owner',
      })
      const stranger = await createProfileFixture(client, {
        displayName: 'Match Stranger',
      })

      const ownerDeckId = randomUUID()
      const ownerDeckVersionId = randomUUID()
      const ownerMatchId = randomUUID()

      await client.query(
        `
          insert into user_data.decks (
            id,
            owner_profile_id,
            format_id,
            title,
            visibility
          ) values (
            $1,
            $2,
            'standard',
            'Match Deck',
            'private'
          )
        `,
        [ownerDeckId, owner.profileId],
      )

      await client.query(
        `
          insert into user_data.deck_versions (
            id,
            deck_id,
            version_number,
            created_by_profile_id,
            version_note
          ) values (
            $1,
            $2,
            1,
            $3,
            'match baseline'
          )
        `,
        [ownerDeckVersionId, ownerDeckId, owner.profileId],
      )

      await client.query(
        `
          insert into social.matches (
            id,
            recorded_by_profile_id,
            format_id,
            visibility,
            status,
            notes
          ) values (
            $1,
            $2,
            'standard',
            'private',
            'completed',
            'Owner-only match'
          )
        `,
        [ownerMatchId, owner.profileId],
      )

      await client.query(
        `
          insert into social.match_participants (
            match_id,
            profile_id,
            deck_version_id,
            seat_order,
            result
          ) values (
            $1,
            $2,
            $3,
            1,
            'win'
          )
        `,
        [ownerMatchId, owner.profileId, ownerDeckVersionId],
      )

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: owner.authUserId },
        async () => {
          const ownMatches = await client.query(
            `select id from social.matches where id = $1`,
            [ownerMatchId],
          )

          assert(
            ownMatches.rowCount === 1,
            'Owner should be able to read their own match rows.',
          )

          const ownParticipants = await client.query(
            `select id from social.match_participants where match_id = $1`,
            [ownerMatchId],
          )

          assert(
            ownParticipants.rowCount === 1,
            'Owner should be able to read participants for their own recorded match.',
          )

          const updateMatchResult = await client.query(
            `
              update social.matches
              set notes = 'Updated owner note'
              where id = $1
              returning id
            `,
            [ownerMatchId],
          )

          assert(
            updateMatchResult.rowCount === 1,
            'Owner should be able to update their own match rows.',
          )

          const insertedParticipant = await client.query(
            `
              insert into social.match_participants (
                match_id,
                profile_id,
                deck_version_id,
                seat_order,
                result
              ) values (
                $1,
                $2,
                $3,
                2,
                'loss'
              )
              returning id
            `,
            [ownerMatchId, stranger.profileId, ownerDeckVersionId],
          )

          assert(
            insertedParticipant.rowCount === 1,
            'Owner should be able to add participants to their own match row.',
          )

          await expectPgError(
            'owner cannot create a match for another profile',
            () =>
              client.query(
                `
                  insert into social.matches (
                    recorded_by_profile_id,
                    format_id,
                    visibility,
                    status
                  ) values (
                    $1,
                    'standard',
                    'private',
                    'completed'
                  )
                `,
                [stranger.profileId],
              ),
            '42501',
          )
        },
      )

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: stranger.authUserId },
        async () => {
          const foreignMatches = await client.query(
            `select id from social.matches where id = $1`,
            [ownerMatchId],
          )

          assert(
            foreignMatches.rowCount === 0,
            'Non-owner must not read another user match.',
          )

          await expectPgError(
            'non-owner cannot add participants to another user match',
            () =>
              client.query(
                `
                  insert into social.match_participants (
                    match_id,
                    profile_id,
                    seat_order,
                    result
                  ) values (
                    $1,
                    $2,
                    3,
                    'draw'
                  )
                `,
                [ownerMatchId, stranger.profileId],
              ),
            '42501',
          )
        },
      )
    },
  )

  await withRollback(
    client,
    'friend requests stay recipient-owned and accepted requests create explicit friendships',
    async () => {
      const sender = await createProfileFixture(client, {
        displayName: 'Private Sender',
        visibility: 'private',
      })
      const recipient = await createProfileFixture(client, {
        displayName: 'Public Recipient',
        visibility: 'public',
      })
      const outsider = await createProfileFixture(client, {
        displayName: 'Outsider Pilot',
        visibility: 'private',
      })

      let requestId = null

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: sender.authUserId },
        async () => {
          const insertResult = await client.query(
            `
              insert into social.friend_relationships (
                requester_profile_id,
                addressee_profile_id,
                status
              ) values (
                $1,
                $2,
                'pending'
              )
              returning id
            `,
            [sender.profileId, recipient.profileId],
          )

          requestId = insertResult.rows[0]?.id ?? null

          assert(
            requestId,
            'Sender should be able to create a pending request.',
          )

          const senderMutationAttempt = await client.query(
            `
              update social.friend_relationships
              set status = 'accepted', responded_at = now()
              where id = $1
              returning id
            `,
            [requestId],
          )

          assert(
            senderMutationAttempt.rowCount === 0,
            'Sender must not accept their own request.',
          )
        },
      )

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: outsider.authUserId },
        async () => {
          const foreignInbox = await client.query(
            `
              select request_id
              from social.incoming_pending_friend_requests
            `,
          )

          assert(
            foreignInbox.rowCount === 0,
            'Non-recipient must not see another user incoming requests.',
          )

          const foreignMutationAttempt = await client.query(
            `
              update social.friend_relationships
              set status = 'accepted', responded_at = now()
              where id = $1
              returning id
            `,
            [requestId],
          )

          assert(
            foreignMutationAttempt.rowCount === 0,
            'Non-recipient must not mutate another user friend request.',
          )
        },
      )

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: recipient.authUserId },
        async () => {
          const incomingRequests = await client.query(
            `
              select
                request_id,
                requester_profile_id,
                requester_display_name
              from social.incoming_pending_friend_requests
            `,
          )

          assert(
            incomingRequests.rowCount === 1,
            'Recipient should see exactly one incoming pending request.',
          )
          assert(
            incomingRequests.rows[0]?.request_id === requestId,
            'Recipient inbox should expose the pending request id.',
          )
          assert(
            incomingRequests.rows[0]?.requester_profile_id === sender.profileId,
            'Recipient inbox should expose the sender profile id.',
          )
          assert(
            incomingRequests.rows[0]?.requester_display_name ===
              'Private Sender',
            'Recipient inbox should expose a minimal sender summary even for private senders.',
          )

          const acceptResult = await client.query(
            `
              update social.friend_relationships
              set status = 'accepted', responded_at = now()
              where id = $1
              returning id
            `,
            [requestId],
          )

          assert(
            acceptResult.rowCount === 1,
            'Recipient should be able to accept a pending request.',
          )

          const friendshipResult = await client.query(
            `
              select
                first_profile_id,
                second_profile_id,
                friend_request_id
              from social.friendships
              where friend_request_id = $1
            `,
            [requestId],
          )

          assert(
            friendshipResult.rowCount === 1,
            'Accepted requests should create exactly one explicit friendship edge.',
          )
          assert(
            [sender.profileId, recipient.profileId].includes(
              friendshipResult.rows[0]?.first_profile_id,
            ) &&
              [sender.profileId, recipient.profileId].includes(
                friendshipResult.rows[0]?.second_profile_id,
              ),
            'Friendship edge should connect the sender and recipient profiles.',
          )

          const handledInbox = await client.query(
            `
              select request_id
              from social.incoming_pending_friend_requests
            `,
          )

          assert(
            handledInbox.rowCount === 0,
            'Accepted requests must disappear from the pending inbox view.',
          )

          const repeatedMutation = await client.query(
            `
              update social.friend_relationships
              set status = 'declined', responded_at = now()
              where id = $1
              returning id
            `,
            [requestId],
          )

          assert(
            repeatedMutation.rowCount === 0,
            'Handled requests must not transition again through the recipient update path.',
          )
        },
      )
    },
  )

  await withRollback(
    client,
    'declined friend requests do not create friendship edges',
    async () => {
      const sender = await createProfileFixture(client, {
        displayName: 'Public Challenger',
        visibility: 'private',
      })
      const recipient = await createProfileFixture(client, {
        displayName: 'Public Defender',
        visibility: 'public',
      })

      let requestId = null

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: sender.authUserId },
        async () => {
          const insertResult = await client.query(
            `
              insert into social.friend_relationships (
                requester_profile_id,
                addressee_profile_id,
                status
              ) values (
                $1,
                $2,
                'pending'
              )
              returning id
            `,
            [sender.profileId, recipient.profileId],
          )

          requestId = insertResult.rows[0]?.id ?? null
        },
      )

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: recipient.authUserId },
        async () => {
          const declineResult = await client.query(
            `
              update social.friend_relationships
              set status = 'declined', responded_at = now()
              where id = $1
              returning id
            `,
            [requestId],
          )

          assert(
            declineResult.rowCount === 1,
            'Recipient should be able to decline a pending request.',
          )

          const friendshipResult = await client.query(
            `
              select id
              from social.friendships
              where friend_request_id = $1
            `,
            [requestId],
          )

          assert(
            friendshipResult.rowCount === 0,
            'Declined requests must not create friendship edges.',
          )
        },
      )
    },
  )

  await withRollback(
    client,
    'friendship removal deletes only the active edge while keeping accepted request history',
    async () => {
      const sender = await createProfileFixture(client, {
        displayName: 'Removal Sender',
        visibility: 'private',
      })
      const recipient = await createProfileFixture(client, {
        displayName: 'Removal Recipient',
        visibility: 'public',
      })
      const outsider = await createProfileFixture(client, {
        displayName: 'Removal Outsider',
        visibility: 'private',
      })

      let requestId = null
      let friendshipId = null

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: sender.authUserId },
        async () => {
          const insertResult = await client.query(
            `
              insert into social.friend_relationships (
                requester_profile_id,
                addressee_profile_id,
                status
              ) values (
                $1,
                $2,
                'pending'
              )
              returning id
            `,
            [sender.profileId, recipient.profileId],
          )

          requestId = insertResult.rows[0]?.id ?? null
        },
      )

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: recipient.authUserId },
        async () => {
          await client.query(
            `
              update social.friend_relationships
              set status = 'accepted', responded_at = now()
              where id = $1
            `,
            [requestId],
          )

          const friendshipResult = await client.query(
            `
              select id
              from social.friendships
              where friend_request_id = $1
            `,
            [requestId],
          )

          friendshipId = friendshipResult.rows[0]?.id ?? null
        },
      )

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: outsider.authUserId },
        async () => {
          const outsiderDelete = await client.query(
            `
              delete from social.friendships
              where id = $1
              returning id
            `,
            [friendshipId],
          )

          assert(
            outsiderDelete.rowCount === 0,
            'Non-participant must not be able to delete a friendship edge.',
          )
        },
      )

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: sender.authUserId },
        async () => {
          const deleteResult = await client.query(
            `
              delete from social.friendships
              where id = $1
              returning id
            `,
            [friendshipId],
          )

          assert(
            deleteResult.rowCount === 1,
            'Either participant should be able to remove the active friendship edge.',
          )

          const remainingFriendship = await client.query(
            `
              select id
              from social.friendships
              where id = $1
            `,
            [friendshipId],
          )

          assert(
            remainingFriendship.rowCount === 0,
            'Friendship removal should delete the active edge for both sides.',
          )

          const requestHistory = await client.query(
            `
              select status
              from social.friend_relationships
              where id = $1
            `,
            [requestId],
          )

          assert(
            requestHistory.rowCount === 1 &&
              requestHistory.rows[0]?.status === 'accepted',
            'Accepted request history must remain intact after friendship removal.',
          )

          const repeatedDelete = await client.query(
            `
              delete from social.friendships
              where id = $1
              returning id
            `,
            [friendshipId],
          )

          assert(
            repeatedDelete.rowCount === 0,
            'Repeated friendship removal should not recreate or half-delete state.',
          )
        },
      )
    },
  )
}

async function verifyGameplayRoomAuthorizationRls(client) {
  console.log('Verifying gameplay room authorization and RLS...')

  const canonicalGameplayTables = [
    'match_rooms',
    'room_players',
    'room_snapshots',
    'room_events',
    'pending_choices',
  ]

  await withRollback(
    client,
    'canonical gameplay room tables stay server-only',
    async () => {
      const participant = await createProfileFixture(client, {
        displayName: 'Gameplay Participant',
      })
      const stranger = await createProfileFixture(client, {
        displayName: 'Gameplay Stranger',
      })
      const roomId = randomUUID()
      const roomPlayerId = randomUUID()
      const persistentPendingChoiceId = randomUUID()
      const deletedPendingChoiceId = randomUUID()

      await runAsDatabaseRole(client, { role: 'service_role' }, async () => {
        await client.query(
          `
            insert into gameplay.match_rooms (
              id,
              format_id,
              host_profile_id,
              status,
              latest_event_sequence,
              latest_snapshot_sequence,
              started_at
            ) values (
              $1,
              'standard',
              $2,
              'active',
              1,
              1,
              now()
            )
          `,
          [roomId, participant.profileId],
        )

        await client.query(
          `
            insert into gameplay.room_players (
              id,
              room_id,
              profile_id,
              seat_order,
              player_status
            ) values (
              $1,
              $2,
              $3,
              1,
              'active'
            )
          `,
          [roomPlayerId, roomId, participant.profileId],
        )

        await client.query(
          `
            insert into gameplay.room_events (
              room_id,
              event_sequence,
              actor_room_player_id,
              event_kind,
              source_kind,
              event_payload
            ) values (
              $1,
              1,
              $2,
              'match.started',
              'setup',
              '{"event":"canonical-start"}'::jsonb
            )
          `,
          [roomId, roomPlayerId],
        )

        await client.query(
          `
            insert into gameplay.room_snapshots (
              room_id,
              snapshot_sequence,
              last_event_sequence,
              turn_number,
              phase_key,
              active_room_player_id,
              is_current,
              game_state_payload
            ) values (
              $1,
              1,
              1,
              1,
              'main',
              $2,
              true,
              '{"engineState":"canonical-hidden-state"}'::jsonb
            )
          `,
          [roomId, roomPlayerId],
        )

        await client.query(
          `
            insert into gameplay.pending_choices (
              id,
              room_id,
              owner_kind,
              owner_room_player_id,
              choice_kind,
              opened_event_sequence,
              options_payload,
              context_payload
            ) values (
              $1,
              $2,
              'player',
              $3,
              'confirm.boolean',
              1,
              '{"secret":"pending-choice-options"}'::jsonb,
              '{"context":"canonical"}'::jsonb
            ),
            (
              $4,
              $2,
              'player',
              $3,
              'confirm.boolean',
              1,
              '{"secret":"delete-proof"}'::jsonb,
              '{"context":"canonical"}'::jsonb
            )
          `,
          [
            persistentPendingChoiceId,
            roomId,
            roomPlayerId,
            deletedPendingChoiceId,
          ],
        )

        const canonicalSnapshot = await client.query(
          `
            select game_state_payload
            from gameplay.room_snapshots
            where room_id = $1
          `,
          [roomId],
        )

        assert(
          canonicalSnapshot.rowCount === 1,
          'Service role should read canonical room snapshots for session restore.',
        )

        const roomUpdate = await client.query(
          `
            update gameplay.match_rooms
            set latest_event_sequence = 2
            where id = $1
            returning id
          `,
          [roomId],
        )

        assert(
          roomUpdate.rowCount === 1,
          'Service role should update canonical room metadata.',
        )

        const pendingDelete = await client.query(
          `
            delete from gameplay.pending_choices
            where id = $1
            returning id
          `,
          [deletedPendingChoiceId],
        )

        assert(
          pendingDelete.rowCount === 1,
          'Service role should delete canonical pending choice rows.',
        )
      })

      await runAsDatabaseRole(client, { role: 'anon' }, async () => {
        for (const tableName of canonicalGameplayTables) {
          await expectPgError(
            `anon cannot read gameplay.${tableName}`,
            () => client.query(`select * from gameplay.${tableName} limit 1`),
            '42501',
          )
        }
      })

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: participant.authUserId },
        async () => {
          for (const tableName of canonicalGameplayTables) {
            await expectPgError(
              `participant cannot directly read gameplay.${tableName}`,
              () => client.query(`select * from gameplay.${tableName} limit 1`),
              '42501',
            )
          }

          await expectPgError(
            'participant cannot patch canonical room status directly',
            () =>
              client.query(
                `
                  update gameplay.match_rooms
                  set status = 'completed'
                  where id = $1
                `,
                [roomId],
              ),
            '42501',
          )

          await expectPgError(
            'participant cannot append raw canonical room events directly',
            () =>
              client.query(
                `
                  insert into gameplay.room_events (
                    room_id,
                    event_sequence,
                    event_kind,
                    source_kind,
                    event_payload
                  ) values (
                    $1,
                    99,
                    'client.injected',
                    'player-action',
                    '{"cheat":true}'::jsonb
                  )
                `,
                [roomId],
              ),
            '42501',
          )

          await expectPgError(
            'participant cannot mutate canonical pending choices directly',
            () =>
              client.query(
                `
                  delete from gameplay.pending_choices
                  where id = $1
                `,
                [persistentPendingChoiceId],
              ),
            '42501',
          )
        },
      )

      await runAsDatabaseRole(
        client,
        { role: 'authenticated', authUserId: stranger.authUserId },
        async () => {
          for (const tableName of canonicalGameplayTables) {
            await expectPgError(
              `non-participant cannot directly read gameplay.${tableName}`,
              () => client.query(`select * from gameplay.${tableName} limit 1`),
              '42501',
            )
          }
        },
      )
    },
  )
}

async function verifyGameplayPersistedMatchSessionStorage(client) {
  console.log('Verifying gameplay persisted match session storage...')

  await withRollback(
    client,
    'persisted match session RPCs create and advance one durable room aggregate atomically',
    async () => {
      const roomId = randomUUID()
      const roomPlayerId = randomUUID()
      const pendingChoiceId = randomUUID()
      const createdAt = '2026-06-07T11:00:00.000Z'
      const initializedAt = '2026-06-07T11:00:00.500Z'
      const transitionAt = '2026-06-07T11:01:00.000Z'
      const persistedAt = '2026-06-07T11:01:01.000Z'
      const createdDocument = {
        version: 1,
        persistenceModel: 'snapshot+event-history',
        room: {
          roomId,
          formatId: 'standard',
          engineAdapterId: 'rules-core:standard',
          status: 'initialized',
          revision: 1,
          participants: [
            {
              participantId: 'participant-db-smoke-1',
              seat: 0,
              enginePlayerId: 'player-db-smoke-1',
            },
          ],
          metadata: {
            createdAt,
            initializedAt,
            updatedAt: initializedAt,
          },
          clock: {
            authority: 'server',
            settings: {
              requestTimeoutMs: 120000,
              turnTimeoutMs: 1800000,
            },
            activeTurn: null,
            activeRequest: null,
            closedAt: null,
          },
          engineState: {
            status: 'setup',
            revision: 0,
            pendingRequests: [],
          },
        },
        history: [],
      }
      const nextHistoryEntry = {
        entryId: `${roomId}:history:1`,
        sequence: 1,
        roomId,
        roomRevision: 2,
        engineRevision: 1,
        recordedAt: persistedAt,
        event: {
          kind: 'engine_event',
          transitionId: 'transition-db-smoke-1',
          event: {
            eventId: 'event-db-smoke-1',
            type: 'mulligan.started',
            sequence: 1,
            origin: {
              kind: 'system',
              system: 'match-setup',
            },
            playerId: 'player-db-smoke-1',
            requestId: 'request-db-smoke-1',
          },
        },
      }
      const nextDocument = {
        ...createdDocument,
        room: {
          ...createdDocument.room,
          status: 'in_progress',
          revision: 2,
          metadata: {
            ...createdDocument.room.metadata,
            startedAt: transitionAt,
            updatedAt: transitionAt,
          },
          clock: {
            ...createdDocument.room.clock,
            activeRequest: {
              requestId: 'request-db-smoke-1',
              responderPlayerId: 'player-db-smoke-1',
              deadlineAt: '2026-06-07T11:03:00.000Z',
              openedAt: transitionAt,
              timeoutReason: 'request_timeout',
            },
          },
          engineState: {
            ...createdDocument.room.engineState,
            status: 'awaiting_choice',
            revision: 1,
            pendingRequests: [
              {
                requestId: 'request-db-smoke-1',
                type: 'mulligan.select_cards',
                responderPlayerId: 'player-db-smoke-1',
                purpose: 'rule',
                visibility: 'responder-only',
              },
            ],
          },
        },
        history: [nextHistoryEntry],
      }
      const createPayload = {
        room: {
          id: roomId,
          format_id: 'standard',
          host_profile_id: null,
          status: 'setup',
          latest_event_sequence: 0,
          latest_snapshot_sequence: 1,
          created_at: createdAt,
          started_at: null,
          ended_at: null,
          updated_at: initializedAt,
        },
        roomPlayers: [
          {
            id: roomPlayerId,
            profile_id: null,
            seat_order: 1,
            player_status: 'active',
            submitted_deck_version_id: null,
            submitted_deck_snapshot: null,
          },
        ],
        snapshot: {
          snapshot_sequence: 1,
          last_event_sequence: 0,
          turn_number: null,
          phase_key: 'pregame',
          active_room_player_id: roomPlayerId,
          game_state_payload: createdDocument,
          created_at: initializedAt,
        },
        events: [],
        pendingChoices: [],
        document: createdDocument,
        persistedAt: initializedAt,
      }
      const transitionPayload = {
        room: {
          id: roomId,
          format_id: 'standard',
          host_profile_id: null,
          status: 'active',
          latest_event_sequence: 1,
          latest_snapshot_sequence: 2,
          created_at: createdAt,
          started_at: transitionAt,
          ended_at: null,
          updated_at: persistedAt,
        },
        roomPlayers: createPayload.roomPlayers,
        snapshot: {
          snapshot_sequence: 2,
          last_event_sequence: 1,
          turn_number: null,
          phase_key: 'pregame',
          active_room_player_id: roomPlayerId,
          game_state_payload: nextDocument,
          created_at: persistedAt,
        },
        events: [
          {
            event_sequence: 1,
            actor_room_player_id: null,
            event_kind: 'mulligan.started',
            source_kind: 'setup',
            source_ref: 'transition-db-smoke-1:event-db-smoke-1',
            event_payload: nextHistoryEntry,
            created_at: persistedAt,
          },
        ],
        pendingChoices: [
          {
            id: pendingChoiceId,
            owner_kind: 'player',
            owner_room_player_id: roomPlayerId,
            choice_kind: 'mulligan.select_cards',
            opened_event_sequence: 1,
            options_payload: nextDocument.room.engineState.pendingRequests[0],
            context_payload: {
              requestId: 'request-db-smoke-1',
              queueIndex: 0,
              deadline: nextDocument.room.clock.activeRequest,
            },
            created_at: persistedAt,
            updated_at: persistedAt,
          },
        ],
        document: nextDocument,
        persistedAt,
        expectedRoomRevision: 1,
        expectedHistoryLength: 0,
      }

      await runAsDatabaseRole(client, { role: 'service_role' }, async () => {
        const created = await client.query(
          `
            select *
            from gameplay.create_persisted_match_session($1::jsonb)
          `,
          [JSON.stringify(createPayload)],
        )

        assert(
          created.rowCount === 1 && created.rows[0].room_id === roomId,
          'Create persisted match session RPC should return the created room.',
        )

        const advanced = await client.query(
          `
            select *
            from gameplay.persist_accepted_match_session_transition($1::jsonb)
          `,
          [JSON.stringify(transitionPayload)],
        )

        assert(
          advanced.rowCount === 1 && advanced.rows[0].room_id === roomId,
          'Accepted transition RPC should return the advanced room.',
        )

        const persistedState = await client.query(
          `
            select
              match_rooms.status,
              match_rooms.latest_event_sequence,
              match_rooms.latest_snapshot_sequence,
              (
                select count(*)::int
                from gameplay.room_snapshots
                where room_id = match_rooms.id
              ) as snapshot_count,
              (
                select count(*)::int
                from gameplay.room_snapshots
                where room_id = match_rooms.id
                  and is_current
              ) as current_snapshot_count,
              (
                select count(*)::int
                from gameplay.room_events
                where room_id = match_rooms.id
              ) as event_count,
              (
                select count(*)::int
                from gameplay.pending_choices
                where room_id = match_rooms.id
                  and status = 'pending'
              ) as pending_choice_count
            from gameplay.match_rooms
            where id = $1
          `,
          [roomId],
        )
        const state = persistedState.rows[0]

        assert(
          state.status === 'active' &&
            state.latest_event_sequence === '1' &&
            state.latest_snapshot_sequence === 2 &&
            state.snapshot_count === 2 &&
            state.current_snapshot_count === 1 &&
            state.event_count === 1 &&
            state.pending_choice_count === 1,
          'Accepted transition RPC should atomically update room, snapshots, events, and pending choices.',
        )

        await expectPgError(
          'repeated accepted transition rejects stale room revision',
          () =>
            client.query(
              `
                select *
                from gameplay.persist_accepted_match_session_transition($1::jsonb)
              `,
              [JSON.stringify(transitionPayload)],
            ),
          'VG002',
        )
      })
    },
  )
}

async function main() {
  console.log('Starting DB checkpoint verification...')
  const runDeckBoundaryOnly = process.argv.slice(2).includes('--suite=decks')

  runCorepack(['pnpm', 'dev:up'], 'Failed to start local Supabase services.\n')

  runCorepack(
    ['pnpm', 'dev:reset'],
    'Failed to reset local Supabase database.\n',
  )

  const statusOutput = runCorepack(
    ['pnpm', 'dlx', `supabase@${cliVersion}`, 'status', '-o', 'env'],
    'Failed to resolve local Supabase database connection info.\n',
  )

  const client = new Client({
    connectionString: parseDbUrl(statusOutput),
    ssl: false,
  })

  try {
    await client.connect()
    await verifySeedSmoke(client)
    if (runDeckBoundaryOnly) {
      await verifyDeckWriteAtomicity(client)
      await verifyDeckReadDensification(client)
      await verifyAuthorizationRls(client, { onlyDeck: true })
      console.log('Deck DB boundary verification completed successfully.')
      return
    }
    await verifyConstraints(client)
    await verifyDeckWriteAtomicity(client)
    await verifyDeckReadDensification(client)
    await verifyAuthorizationRls(client)
    await verifyGameplayRoomAuthorizationRls(client)
    await verifyGameplayPersistedMatchSessionStorage(client)
    console.log('DB checkpoint verification completed successfully.')
  } finally {
    await client.end().catch(() => {})
  }
}

main().catch((error) => {
  console.error('DB checkpoint verification failed.')
  console.error(error)
  process.exitCode = 1
})
