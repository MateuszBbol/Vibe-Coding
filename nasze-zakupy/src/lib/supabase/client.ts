import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { createPlatformStorage } from '@/lib/storage/platformStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

function isValidProjectUrl(value: string | undefined): value is string {
  if (!value) {
    return false;
  }
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export const isSupabaseConfigured =
  isValidProjectUrl(supabaseUrl) && Boolean(supabasePublishableKey);

const sessionStorage = createPlatformStorage(Platform.OS, {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
});
const canPersistSession = Platform.OS !== 'web' || typeof window !== 'undefined';

export const supabase =
  isSupabaseConfigured && supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          storage: sessionStorage,
          autoRefreshToken: canPersistSession,
          persistSession: canPersistSession,
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      })
    : null;
