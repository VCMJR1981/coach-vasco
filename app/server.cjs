const express = require('express');
const cors = require('cors');
const https = require('https');
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const key = process.env.ANTHROPIC_KEY;

app.post('/api/chat', (req, res) => {
  const body = JSON.stringify(req.body);
  const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(body)
    }
  };
  const apiReq = https.request(options, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => res.json(JSON.parse(data)));
  });
  apiReq.on('error', err => res.status(500).json({ error: err.message }));
  apiReq.write(body);
  apiReq.end();
});

app.listen(3001, () => console.log('Coach Vasco running on port 3001'));
