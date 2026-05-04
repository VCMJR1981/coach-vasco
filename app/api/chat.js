// app/api/chat.js — Coach Vasco API route (Vercel serverless)

// ── TIER CONFIG ───────────────────────────────────────────────────────────────
const TIER_CONFIG = {
  free:    { model: 'claude-haiku-4-5-20251001', dailyLimit: 10 },
  mycoach: { model: 'claude-sonnet-4-6',         dailyLimit: 25 },
  athlete: { model: 'claude-sonnet-4-6',         dailyLimit: 50 },
};

// ── IN-MEMORY DAILY COUNTER ───────────────────────────────────────────────────
// Resets on server restart / Vercel cold start — fine for beta
// Key: `${userId}:${YYYY-MM-DD}` → count
const dailyUsage = {};

function getTodayKey(userId) {
  const d = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  return `${userId}:${d}`;
}

function getUsageCount(userId) {
  return dailyUsage[getTodayKey(userId)] || 0;
}

function incrementUsage(userId) {
  const key = getTodayKey(userId);
  dailyUsage[key] = (dailyUsage[key] || 0) + 1;
}

// ── PROMPT CACHE SUPPORT ──────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const promptCache = new Map();

function getCachedOrBuild(systemPrompt) {
  const now = Date.now();
  const existing = promptCache.get(systemPrompt);
  if (existing && now - existing.ts < CACHE_TTL_MS) return existing.built;

  // Mark system content for caching (Anthropic prompt caching)
  const built = [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }];
  promptCache.set(systemPrompt, { built, ts: now });

  // Prune old entries
  if (promptCache.size > 50) {
    const oldest = [...promptCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    promptCache.delete(oldest[0]);
  }

  return built;
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-tier, x-user-id');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;

    // ── TIER + USER ──────────────────────────────────────────────────────────
    const rawTier = (req.headers['x-user-tier'] || 'free').toLowerCase();
    const tier = TIER_CONFIG[rawTier] ? rawTier : 'free';
    const config = TIER_CONFIG[tier];

    // Use user ID from header, or fall back to a hash of the IP for anonymous users
    const userId = req.headers['x-user-id'] || req.headers['x-forwarded-for'] || 'anon';

    // ── DAILY LIMIT CHECK ────────────────────────────────────────────────────
    const currentCount = getUsageCount(userId);
    if (currentCount >= config.dailyLimit) {
      return res.status(429).json({
        error: 'LIMIT_REACHED',
        tier,
        used: currentCount,
        limit: config.dailyLimit,
      });
    }

    // ── RESOLVE MODEL ────────────────────────────────────────────────────────
    // Frontend may send a model — we override it based on tier
    const model = config.model;
    const max_tokens = body.max_tokens || 2000;

    // ── BUILD REQUEST ────────────────────────────────────────────────────────
    const systemContent = body.system ? getCachedOrBuild(body.system) : undefined;

    const anthropicBody = {
      model,
      max_tokens,
      messages: body.messages,
      ...(systemContent ? { system: systemContent } : {}),
    };

    // ── CALL ANTHROPIC ───────────────────────────────────────────────────────
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(anthropicBody),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      console.error('[Anthropic error]', data);
      return res.status(anthropicRes.status).json({ error: data.error || 'Anthropic API error' });
    }

    // ── INCREMENT COUNTER ONLY ON SUCCESS ────────────────────────────────────
    incrementUsage(userId);

    // ── RETURN WITH USAGE INFO ───────────────────────────────────────────────
    return res.status(200).json({
      ...data,
      _usage: {
        tier,
        model,
        used: currentCount + 1,
        limit: config.dailyLimit,
        remaining: config.dailyLimit - (currentCount + 1),
      },
    });

  } catch (err) {
    console.error('[chat.js error]', err);
    return res.status(500).json({ error: { message: err.message } });
  }
}
