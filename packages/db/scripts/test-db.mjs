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

async function queryScalar(client, sql) {
  const result = await client.query(sql)
  return Number(result.rows[0]?.count ?? 0)
}

async function expectPgError(name, operation, expectedCode) {
  try {
    await operation()
  } catch (error) {
    if (error?.code === expectedCode) {
      console.log(`  ok ${name}`)
      return
    }

    throw error
  }

  throw new Error(`${name} did not fail with ${expectedCode}.`)
}

async function withRollback(client, name, callback) {
  await client.query('begin')

  try {
    await callback()
    console.log(`  ok ${name}`)
  } finally {
    await client.query('rollback')
  }
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
