/**
 * Shared authentication helpers for all API endpoints.
 * File prefixed with _ so Vercel does NOT deploy it as a route.
 */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Lightweight Supabase client (anon key) — only used for auth.getUser()
let _supabaseAuth;
function getAuthClient() {
  if (!_supabaseAuth) {
    _supabaseAuth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return _supabaseAuth;
}

/**
 * Verify the JWT from the Authorization header.
 * Returns { user } or throws { status, message }.
 */
async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw { status: 401, message: 'Missing or invalid Authorization header' };
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw { status: 401, message: 'Missing token' };
  }

  const supabase = getAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw { status: 401, message: 'Invalid or expired token' };
  }

  return { user };
}

/**
 * Verify JWT + check that the authenticated user matches the coachId in the request body.
 * @param {object} req - HTTP request
 * @param {string} bodyField - field name to check (default: 'coachId')
 */
async function verifyCoach(req, bodyField = 'coachId') {
  const { user } = await verifyAuth(req);

  const claimedId = req.body?.[bodyField] || req.query?.[bodyField];
  if (!claimedId) {
    throw { status: 400, message: `Missing ${bodyField}` };
  }

  if (user.id !== claimedId) {
    throw { status: 403, message: 'Forbidden: user does not match' };
  }

  return { user };
}

/**
 * Verify the cron secret (used by Vercel Cron Jobs).
 * Vercel sends Authorization: Bearer <CRON_SECRET> automatically.
 */
function verifyCronSecret(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw { status: 500, message: 'CRON_SECRET not configured' };
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw { status: 401, message: 'Missing cron authorization' };
  }

  const provided = authHeader.split(' ')[1];
  if (!provided) {
    throw { status: 401, message: 'Missing cron token' };
  }

  const expected = Buffer.from(secret);
  const received = Buffer.from(provided);

  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    throw { status: 401, message: 'Invalid cron secret' };
  }
}

/**
 * Helper to send auth error responses consistently.
 */
function handleAuthError(res, err) {
  const status = err.status || 500;
  const message = err.message || 'Authentication error';
  return res.status(status).json({ error: message });
}

module.exports = { verifyAuth, verifyCoach, verifyCronSecret, handleAuthError };
