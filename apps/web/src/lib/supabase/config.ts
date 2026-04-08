type SupabasePublicEnv = Readonly<{
  url: string
  publishableKey: string
}>

function requireEnv(name: string, value: string | undefined): string {
  const normalizedValue = value?.trim()

  if (!normalizedValue) {
    throw new Error(
      `Missing ${name}. Configure apps/web/.env.local before using the Supabase integration.`,
    )
  }

  return normalizedValue
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  return {
    url: requireEnv(
      'NEXT_PUBLIC_SUPABASE_URL',
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    publishableKey: requireEnv(
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  }
}
