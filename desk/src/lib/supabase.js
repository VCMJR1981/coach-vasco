import { createClient } from '@supabase/supabase-js';

// Both values are public by design (they sit in every browser that opens
// the app). Access is decided by the database rules, not by hiding these.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key) : null;

export const SNAPSHOT_LIMIT = 5;

// Throws the Supabase error so screens can show it instead of failing quietly.
export async function must(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
