import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Client } = pg

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../../..')
const defaultSeedPath = path.join(
  repoRoot,
  'supabase',
  'seeds',
  'dev_minimal_dataset.sql',
)

const seedFilePath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : defaultSeedPath

const connectionString =
  process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? null

if (!connectionString) {
  console.error(
    'Missing DATABASE_URL or SUPABASE_DB_URL. Provide a direct Postgres connection string before running db:seed.',
  )
  process.exit(1)
}

const sslMode = process.env.DATABASE_SSL ?? 'disable'
const ssl =
  sslMode === 'require'
    ? {
        rejectUnauthorized: false,
      }
    : false

const client = new Client({
  connectionString,
  ssl,
})

try {
  const sql = await readFile(seedFilePath, 'utf8')

  console.log(`Seeding database from ${seedFilePath}`)

  await client.connect()
  await client.query(sql)

  console.log('Seed completed successfully.')
} catch (error) {
  console.error('Seed failed.')
  console.error(error)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
