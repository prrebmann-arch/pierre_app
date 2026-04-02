// Instagram API OAuth — Exchange code for long-lived token (Instagram Login flow)
import { NextResponse } from 'next/server';
import { verifyAuth, authErrorResponse } from '@/lib/api/auth';
import { getCorsHeaders, handlePreflight } from '@/lib/api/cors';

export async function OPTIONS(request: Request) {
  return handlePreflight(request);
}

export async function POST(request: Request) {
  const corsHeaders = getCorsHeaders(request);

  try { await verifyAuth(request); } catch (e) { return authErrorResponse(e, corsHeaders); }

  try {
    const { code, redirect_uri } = await request.json();
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!code || !redirect_uri) {
      return NextResponse.json({ error: 'Missing code or redirect_uri' }, { status: 400, headers: corsHeaders });
    }
    if (!appId || !appSecret) {
      console.error('[ig-auth] META_APP_ID or META_APP_SECRET not set');
      return NextResponse.json({ error: 'Instagram app credentials not configured.' }, { status: 500, headers: corsHeaders });
    }

    console.log('[ig-auth] Step 1: Exchanging code for short-lived token');

    // Step 1: Exchange code for short-lived token (Instagram API)
    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'authorization_code',
        redirect_uri,
        code,
      }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error_message || tokenData.error) {
      console.error('[ig-auth] Step 1 failed:', JSON.stringify(tokenData));
      return NextResponse.json({ error: tokenData.error_message || tokenData.error || 'Token exchange failed' }, { status: 400, headers: corsHeaders });
    }

    const shortToken = tokenData.access_token;
    if (!shortToken) {
      console.error('[ig-auth] No access_token:', JSON.stringify(tokenData));
      return NextResponse.json({ error: 'No access token received' }, { status: 400, headers: corsHeaders });
    }

    console.log('[ig-auth] Step 2: Exchanging for long-lived token');

    // Step 2: Exchange for long-lived token (60 days)
    const longRes = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`);
    const longData = await longRes.json();
    const longToken = (longData.error ? null : longData.access_token) || shortToken;

    console.log('[ig-auth] Step 3: Fetching Instagram profile');

    // Step 3: Get Instagram profile
    const profileRes = await fetch(`https://graph.instagram.com/v25.0/me?fields=user_id,username,name,profile_picture_url,followers_count,media_count&access_token=${longToken}`);
    const profile = await profileRes.json();

    if (profile.error) {
      console.error('[ig-auth] Profile fetch failed:', JSON.stringify(profile.error));
    }

    const igUserId = profile.user_id || profile.id || tokenData.user_id || '';
    const igUsername = profile.username || '';

    console.log('[ig-auth] Success! Connected as @' + igUsername);

    return NextResponse.json({
      access_token: longToken,
      expires_in: longData.expires_in || 5184000,
      ig_user_id: String(igUserId),
      ig_username: igUsername,
      followers: profile.followers_count || 0,
      media_count: profile.media_count || 0,
      profile_pic: profile.profile_picture_url || '',
    }, { headers: corsHeaders });
  } catch (err: unknown) {
    console.error('[ig-auth] Unexpected error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500, headers: corsHeaders });
  }
}
