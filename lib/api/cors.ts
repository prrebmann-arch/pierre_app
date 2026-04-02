/**
 * CORS headers for API responses.
 * In Next.js App Router, CORS is handled via response headers (no req/res mutation).
 */

function getAllowedOrigins(): string[] {
  const origins = ['https://pierreapp.vercel.app'];
  if (process.env.VERCEL_ENV !== 'production') {
    origins.push('http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500');
  }
  return origins;
}

/**
 * Build CORS headers based on the request origin.
 */
export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  if (origin && getAllowedOrigins().includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

/**
 * Handle OPTIONS preflight — returns a 204 Response with CORS headers.
 */
export function handlePreflight(request: Request): Response {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) });
}
