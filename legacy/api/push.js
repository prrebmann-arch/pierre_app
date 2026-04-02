// Vercel Serverless Function — proxy to Expo Push API (avoids CORS)
const https = require('https');
const { verifyAuth, handleAuthError } = require('./_auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify JWT authentication
  try {
    await verifyAuth(req);
  } catch (e) {
    return handleAuthError(res, e);
  }

  const payload = JSON.stringify(req.body);

  return new Promise((resolve) => {
    const request = https.request('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          const data = JSON.parse(body);
          res.status(response.statusCode).json(data);
        } catch (e) {
          res.status(500).json({ error: 'Invalid response from Expo', raw: body });
        }
        resolve();
      });
    });

    request.on('error', (err) => {
      res.status(500).json({ error: 'Push request failed', message: err.message });
      resolve();
    });

    request.write(payload);
    request.end();
  });
};
