const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const API_KEY = process.env.ANTHROPIC_KEY;

app.post('/api/chat', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_KEY not set in environment' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => {
  console.log('Server running on port 3001');
});
