import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { isConfigured } from './config';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'placeholder',
  {
    auth: {
      storage: localStorage,
      autoRefreshToken: isConfigured,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

if (isConfigured) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
