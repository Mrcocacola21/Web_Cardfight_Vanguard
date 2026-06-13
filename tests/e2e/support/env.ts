export const useLocalSupabase =
  process.env.PLAYWRIGHT_USE_LOCAL_SUPABASE === '1'

export const useLocalSupabaseServiceRole =
  useLocalSupabase &&
  typeof process.env.SUPABASE_SERVICE_ROLE_KEY === 'string' &&
  process.env.SUPABASE_SERVICE_ROLE_KEY.trim().length > 0

export const defaultE2EPassword = 'VanguardPass123!'

export function createUniqueTestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createUniqueEmail(prefix: string): string {
  return `${createUniqueTestId(prefix)}@example.com`
}
