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
    throw new Error(result.stderr || fallbackMessage)
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

let activeTransactionClient = null

async function queryScalar(client, sql) {
  const result = await client.query(sql)
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

async function verifyAuthorizationRls(client) {
  console.log('Verifying baseline authorization and RLS...')

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
            collection_id,
            card_printing_id,
            quantity
          ) values (
            $1,
            '30000000-0000-4000-8000-000000000001',
            2
          )
        `,
        [ownerCollectionId],
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
            `select id from user_data.collection_items where collection_id = $1`,
            [ownerCollectionId],
          )

          assert(
            ownItems.rowCount === 1,
            'Owner should be able to read collection items for their collection.',
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

          await expectPgError(
            'non-owner cannot add items to another user collection',
            () =>
              client.query(
                `
                  insert into user_data.collection_items (
                    collection_id,
                    card_printing_id,
                    quantity
                  ) values (
                    $1,
                    '30000000-0000-4000-8000-000000000002',
                    1
                  )
                `,
                [ownerCollectionId],
              ),
            '42501',
          )
        },
      )
    },
  )

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
        [ownerDeckVersionId],
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
    },
  )

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

async function main() {
  console.log('Starting DB checkpoint verification...')

  runCorepack(
    ['pnpm', 'dlx', `supabase@${cliVersion}`, 'start'],
    'Failed to start local Supabase services.\n',
  )

  runCorepack(
    ['pnpm', 'dlx', `supabase@${cliVersion}`, 'db', 'reset', '--local'],
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
    await verifyConstraints(client)
    await verifyAuthorizationRls(client)
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
