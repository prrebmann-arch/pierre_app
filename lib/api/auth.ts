/**
 * Shared authentication helpers for all API endpoints (App Router version).
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Lightweight Supabase client (anon key) — only used for auth.getUser()
let _supabaseAuth: ReturnType<typeof createClient> | null = null;
function getAuthClient() {
  if (!_supabaseAuth) {
    _supabaseAuth = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabaseAuth;
}

export interface AuthError {
  status: number;
  message: string;
}

/**
 * Verify the JWT from the Authorization header.
 * Returns { user } or throws { status, message }.
 */
export async function verifyAuth(request: Request): Promise<{ user: { id: string; [key: string]: unknown } }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw { status: 401, message: 'Missing or invalid Authorization header' } as AuthError;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw { status: 401, message: 'Missing token' } as AuthError;
  }

  const supabase = getAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw { status: 401, message: 'Invalid or expired token' } as AuthError;
  }

  return { user: user as unknown as { id: string; [key: string]: unknown } };
}

/**
 * Verify JWT + check that the authenticated user matches a given ID field in the body.
 */
export async function verifyCoach(
  request: Request,
  body: Record<string, unknown>,
  bodyField = 'coachId',
  searchParams?: URLSearchParams
): Promise<{ user: { id: string; [key: string]: unknown } }> {
  const { user } = await verifyAuth(request);

  const claimedId = (body?.[bodyField] as string) || searchParams?.get(bodyField);
  if (!claimedId) {
    throw { status: 400, message: `Missing ${bodyField}` } as AuthError;
  }

  if (user.id !== claimedId) {
    throw { status: 403, message: 'Forbidden: user does not match' } as AuthError;
  }

  return { user };
}

/**
 * Verify the cron secret (used by Vercel Cron Jobs).
 */
export function verifyCronSecret(request: Request): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw { status: 500, message: 'CRON_SECRET not configured' } as AuthError;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw { status: 401, message: 'Missing cron authorization' } as AuthError;
  }

  const provided = authHeader.split(' ')[1];
  if (!provided) {
    throw { status: 401, message: 'Missing cron token' } as AuthError;
  }

  const expected = Buffer.from(secret);
  const received = Buffer.from(provided);

  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    throw { status: 401, message: 'Invalid cron secret' } as AuthError;
  }
}

/**
 * Build a JSON error response from an auth error.
 */
export function authErrorResponse(err: unknown, corsHeaders: Record<string, string> = {}): Response {
  const authErr = err as AuthError;
  const status = authErr.status || 500;
  const message = authErr.message || 'Authentication error';
  return Response.json({ error: message }, { status, headers: corsHeaders });
}
