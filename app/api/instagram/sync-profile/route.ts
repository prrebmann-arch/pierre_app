// Sync Instagram Profile — Followers, bio, etc.
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
    const { ig_user_id, access_token } = await request.json();
    if (!ig_user_id || !access_token) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400, headers: corsHeaders });
    }

    const profileRes = await fetch(`https://graph.instagram.com/v25.0/me?fields=username,name,biography,followers_count,follows_count,media_count,profile_picture_url&access_token=${access_token}`);
    const profile = await profileRes.json();

    if (profile.error) {
      return NextResponse.json({ error: profile.error.message }, { status: 400, headers: corsHeaders });
    }

    return NextResponse.json({
      username: profile.username,
      name: profile.name,
      bio: profile.biography,
      followers: profile.followers_count,
      following: profile.follows_count,
      posts: profile.media_count,
      profile_pic: profile.profile_picture_url,
    }, { headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=300' } });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500, headers: corsHeaders });
  }
}
