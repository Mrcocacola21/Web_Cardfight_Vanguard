import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../generated/database.types'

export type DbClient = SupabaseClient<Database>
