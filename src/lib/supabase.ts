// lib/supabase.ts
import type { Database } from '@/types/database'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://knezqdjwcgauoycrmbdi.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  realtime: {
    worker: true,
  },
})
