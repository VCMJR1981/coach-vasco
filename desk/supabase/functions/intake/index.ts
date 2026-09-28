// Concrete Surfers intake: the website's forms post here.
//
// POST  stores an enquiry (via intake_submit in the database) and emails
//       the coach a short alert through Resend.
// GET   tells the website whether this month's five Snapshot places are
//       taken. It also keeps the free Supabase project awake: the weekly
//       ping in .github/workflows/keep-awake.yml calls it.
//
// Deploy in the Supabase dashboard (Edge Functions > Deploy a new function >
// Via Editor), name it `intake`, paste this file, and switch OFF "Verify JWT"
// so the website can call it without a key.
//
// Secrets (Edge Functions > Secrets): RESEND_API_KEY, ALERT_EMAIL, DESK_URL.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SNAPSHOT_LIMIT = 5;
const PRODUCTS = ['snapshot', 'snapshot_skate', 'diagnostic', 'single', 'block', 'classes',
  'retreat', 'cert', 'workshop', 'unsure'];
const PRODUCT_NAMES: Record<string, string> = {
  snapshot: 'Snapshot', snapshot_skate: 'Surfskate Snapshot', diagnostic: 'Diagnostic',
  single: 'Single session', block: '12-week block', classes: 'Surfskate classes',
  retreat: 'Retreat', cert: 'Coach certification', workshop: 'Workshop', unsure: 'Not sure yet',
};
const CREDIT = ['first name', 'first name and instagram', 'anonymous'];
// Product-specific answers kept together in submissions.details
const DETAIL_FIELDS = ['session_type', 'which_retreat', 'room_preference', 'class_location',
  'class_kit', 'city', 'current_role', 'selected_level'];

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

// Text fields are capped so nobody can post a novel into the inbox.
function clean(v: unknown, max = 2000): string {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, max);
}

function yes(v: unknown): boolean {
  return v === true || v === 'yes' || v === 'on' || v === 'true';
}

function firstOfNextMonthLisbon(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon', year: 'numeric', month: 'numeric',
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === 'year')!.value);
  const m = Number(parts.find((p) => p.type === 'month')!.value);
  const next = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));
  return next.toISOString().slice(0, 10);
}

async function snapshotsThisMonth(): Promise<number> {
  const { data, error } = await db.rpc('snapshot_month_count');
  if (error) throw error;
  return data as number;
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const type = req.headers.get('content-type') || '';
  if (type.includes('application/json')) return await req.json();
  const form = await req.formData();
  const out: Record<string, unknown> = {};
  form.forEach((v, k) => { out[k] = typeof v === 'string' ? v : ''; });
  return out;
}

async function alertCoach(p: Record<string, unknown>, ids: Record<string, unknown>) {
  const key = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('ALERT_EMAIL');
  if (!key || !to) return;
  const desk = (Deno.env.get('DESK_URL') || '').replace(/\/$/, '');
  const product = String(p.product);
  const count = Number(ids.snapshots_this_month ?? 0);
  const isSnap = product.startsWith('snapshot');
  const link = ids.assessment_id ? `${desk}/a/${ids.assessment_id}` : `${desk}/e/${ids.submission_id}`;
  const subject = isSnap
    ? `New ${PRODUCT_NAMES[product]}: ${p.name} (${count} of ${SNAPSHOT_LIMIT} clips received this month)`
    : `New enquiry, ${PRODUCT_NAMES[product] ?? product}: ${p.name}`;
  // Kept short on purpose: the details stay in the database, not in email.
  const text = [
    `${PRODUCT_NAMES[product] ?? product} from ${p.name} <${p.email}>`,
    isSnap && count >= SNAPSHOT_LIMIT
      ? `Heads up: ${count} Snapshot clips already received this month.` : '',
    '',
    desk ? `Open it: ${link}` : '',
  ].filter((l) => l !== '').join('\n');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Concrete Surfers desk <onboarding@resend.dev>', to: [to], subject, text }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) console.error('resend', res.status, await res.text());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  if (req.method === 'GET') {
    try {
      const used = await snapshotsThisMonth();
      return json({ snapshot_full: used >= SNAPSHOT_LIMIT, next_opening: firstOfNextMonthLisbon() });
    } catch (e) {
      console.error('status', e);
      return json({ snapshot_full: false }, 200);
    }
  }

  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  let raw: Record<string, unknown>;
  try { raw = await readBody(req); } catch { return json({ error: 'bad_request' }, 400); }

  // Honeypot: bots fill the hidden field. Pretend it worked, store nothing.
  if (clean(raw['bot-field'])) return json({ ok: true });

  const product = clean(raw.interest || raw.product, 40);
  if (!PRODUCTS.includes(product)) return json({ error: 'invalid', field: 'interest' }, 400);

  const details: Record<string, string> = {};
  for (const f of DETAIL_FIELDS) { const v = clean(raw[f], 300); if (v) details[f] = v; }

  const footageConsent = yes(raw.footage_consent);
  const newsletter = yes(raw.training_notes ?? raw.newsletter);
  const payload = {
    form: clean(raw['form-name'] || raw.form, 40) || 'work-with-us',
    product,
    name: clean(raw.name, 120),
    email: clean(raw.email, 200),
    phone: clean(raw.phone, 60),
    country: clean(raw.country, 120),
    level: clean(raw.level, 120),
    footage_link: clean(raw.clip_link || raw.footage_link, 1000),
    footage_note: clean(raw.footage),
    surf_frequency: clean(raw.surf_frequency_next_trip),
    frustration: clean(raw.goal),
    newsletter,
    newsletter_wording: newsletter ? clean(raw.newsletter_wording, 2000) : null,
    footage_consent: footageConsent,
    footage_consent_wording: footageConsent ? clean(raw.footage_consent_wording, 2000) : null,
    credit_as: footageConsent
      ? (CREDIT.includes(clean(raw.credit_as, 40)) ? clean(raw.credit_as, 40) : 'first name') : null,
    age_confirmed: yes(raw.age_confirmed),
    details,
    source: clean(raw.source || raw.utm, 300),
  };

  const { data, error } = await db.rpc('intake_submit', { p: payload });
  if (error) {
    const msg = error.message || '';
    if (msg.includes('too_many')) return json({ error: 'too_many' }, 429);
    const m = msg.match(/invalid: (\w+)/);
    if (m) return json({ error: 'invalid', field: m[1] }, 400);
    console.error('intake', error);
    return json({ error: 'server' }, 500);
  }

  try { await alertCoach(payload, data as Record<string, unknown>); } catch (e) { console.error('alert', e); }
  return json({ ok: true });
});
