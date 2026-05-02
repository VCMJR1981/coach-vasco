export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const body = req.body;

    // ── PROMPT CACHING ─────────────────────────────────────────────────────────
    // If the request has a string system prompt, convert it to the block format
    // required for caching. The cache_control marks it for 5-minute caching.
    // Cache reads cost 10% of normal input price — pays off after 1 follow-up message.
    // Falls back gracefully: if system is already a block array, leave it as-is.
    if (body.system && typeof body.system === 'string') {
      body.system = [
        {
          type: 'text',
          text: body.system,
          cache_control: { type: 'ephemeral' }, // 5-minute cache
        },
      ];
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31', // required to enable caching
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Optional: log cache usage in development to verify it's working
    // data.usage will include cache_creation_input_tokens and cache_read_input_tokens
    // when caching is active. Remove this log in production if preferred.
    if (data.usage && (data.usage.cache_creation_input_tokens || data.usage.cache_read_input_tokens)) {
      console.log('[Cache]', {
        written: data.usage.cache_creation_input_tokens || 0,
        read: data.usage.cache_read_input_tokens || 0,
        normal: data.usage.input_tokens || 0,
      });
    }

    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
