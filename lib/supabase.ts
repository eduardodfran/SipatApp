import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL) {
  throw new Error(
    'Missing required environment variable: EXPO_PUBLIC_SUPABASE_URL',
  )
}

if (!SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing required environment variable: EXPO_PUBLIC_SUPABASE_ANON_KEY',
  )
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
