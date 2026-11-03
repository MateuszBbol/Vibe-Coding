import { supabase } from '@/lib/supabase/client';

export async function fetchProfileDisplayName(userId: string): Promise<string | null> {
  if (!supabase) {
    throw new Error('Brak konfiguracji Supabase.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return typeof data?.display_name === 'string' ? data.display_name : null;
}
