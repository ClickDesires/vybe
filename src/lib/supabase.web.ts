// Web build: the browser's own localStorage holds the session (no expo-sqlite needed).
import { createClient } from '@supabase/supabase-js';

import { isConfigured } from './config';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'placeholder',
  {
    auth: { autoRefreshToken: isConfigured, persistSession: true, detectSessionInUrl: false },
  },
);
