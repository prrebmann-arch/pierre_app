/**
 * Shared CORS helper for API endpoints.
 * File prefixed with _ so Vercel does NOT deploy it as a route.
 */

const ALLOWED_ORIGINS = [
  'https://pierreapp.vercel.app',
];

// Dev origins — only in non-production environments
if (process.env.VERCEL_ENV !== 'production') {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500');
}

/**
 * Handle CORS headers and preflight requests.
 * @returns {boolean} true if the request was a preflight (caller should stop processing)
 */
function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

module.exports = { cors };
