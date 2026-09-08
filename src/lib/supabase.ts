import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Pastikan Anda sudah membuat file .env di root proyek (sejajar dengan package.json)
// Isi dengan:
// EXPO_PUBLIC_SUPABASE_URL=https://xyzcompany.supabase.co
// EXPO_PUBLIC_SUPABASE_ANON_KEY=public-anon-key
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
