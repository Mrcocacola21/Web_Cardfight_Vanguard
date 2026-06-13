import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(
  new URL(
    '../../../../supabase/migrations/20260606203000_harden_gameplay_room_auth_rls.sql',
    import.meta.url,
  ),
  'utf8',
)

const canonicalGameplayTables = [
  'match_rooms',
  'room_players',
  'room_snapshots',
  'room_events',
  'pending_choices',
] as const

describe('gameplay room auth and RLS migration posture', () => {
  it('keeps canonical gameplay persistence server-only', () => {
    expect(migrationSource).toContain(
      'revoke all on schema gameplay from anon, authenticated',
    )
    expect(migrationSource).toContain(
      'revoke all on all tables in schema gameplay from anon, authenticated',
    )
    expect(migrationSource).toContain(
      'grant usage on schema gameplay to service_role',
    )
    expect(migrationSource).not.toMatch(
      /grant\s+(?:select|insert|update|delete)[\s\S]+?\bto\s+(?:anon|authenticated)\b/iu,
    )
  })

  it('enables RLS and service-role policies for every canonical gameplay table', () => {
    for (const tableName of canonicalGameplayTables) {
      expect(migrationSource).toContain(
        `alter table gameplay.${tableName} enable row level security`,
      )
      expect(migrationSource).toMatch(
        new RegExp(
          `grant select, insert, update, delete on table gameplay\\.${tableName}\\s+to service_role`,
          'u',
        ),
      )
      expect(migrationSource).toContain(
        `on gameplay.${tableName}\n  for all\n  to service_role`,
      )
    }
  })
})
