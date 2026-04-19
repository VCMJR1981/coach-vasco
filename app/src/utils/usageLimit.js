import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sudybqzffhrrftgxlwzq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1ZHlicXpmZmhycmZ0Z3hsd3pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDAxMDgsImV4cCI6MjA5MDQ3NjEwOH0.RkLpf1SJPS7JNmrsQ5w9rFWvhV4P2HER4E3TwSRPuxk';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DAILY_LIMIT = 15;

export async function checkAndIncrementUsage() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { allowed: false, remaining: 0 };

  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('user_daily_usage')
    .select('message_count')
    .eq('user_id', user.id)
    .eq('usage_date', today)
    .single();

  const currentCount = existing?.message_count ?? 0;

  if (currentCount >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  await supabase
    .from('user_daily_usage')
    .upsert({
      user_id: user.id,
      usage_date: today,
      message_count: currentCount + 1
    }, { onConflict: 'user_id,usage_date' });

  return {
    allowed: true,
    remaining: DAILY_LIMIT - (currentCount + 1)
  };
}

export async function getRemainingMessages() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('user_daily_usage')
    .select('message_count')
    .eq('user_id', user.id)
    .eq('usage_date', today)
    .single();

  return DAILY_LIMIT - (data?.message_count ?? 0);
}