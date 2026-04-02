// Instagram Content Publishing API — Publish a post via Instagram Business API
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
    const { access_token, ig_user_id, image_url, video_url, caption, media_type } = await request.json();

    if (!access_token || !ig_user_id) {
      return NextResponse.json({ error: 'Missing access_token or ig_user_id' }, { status: 400, headers: corsHeaders });
    }

    const apiBase = 'https://graph.instagram.com/v25.0';

    // Step 1: Create media container
    const containerParams = new URLSearchParams({ access_token });
    if (caption) containerParams.set('caption', caption);

    if (media_type === 'VIDEO' || media_type === 'REELS') {
      if (!video_url) return NextResponse.json({ error: 'Missing video_url for video post' }, { status: 400, headers: corsHeaders });
      containerParams.set('video_url', video_url);
      containerParams.set('media_type', 'REELS');
    } else {
      if (!image_url) return NextResponse.json({ error: 'Missing image_url for image post' }, { status: 400, headers: corsHeaders });
      containerParams.set('image_url', image_url);
    }

    const containerRes = await fetch(`${apiBase}/${ig_user_id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: containerParams,
    });
    const containerData = await containerRes.json();

    if (containerData.error) {
      return NextResponse.json({ error: containerData.error.message, code: containerData.error.code }, { status: 400, headers: corsHeaders });
    }

    const creationId = containerData.id;

    // Step 2: For videos, poll until container is ready (can take up to 60s)
    if (media_type === 'VIDEO' || media_type === 'REELS') {
      let ready = false;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await fetch(`${apiBase}/${creationId}?fields=status_code&access_token=${access_token}`);
        const statusData = await statusRes.json();
        if (statusData.status_code === 'FINISHED') { ready = true; break; }
        if (statusData.status_code === 'ERROR') {
          return NextResponse.json({ error: 'Video processing failed on Instagram side' }, { status: 400, headers: corsHeaders });
        }
      }
      if (!ready) {
        return NextResponse.json({ error: 'Video processing timeout — try again later' }, { status: 408, headers: corsHeaders });
      }
    }

    // Step 3: Publish the container
    const publishRes = await fetch(`${apiBase}/${ig_user_id}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ creation_id: creationId, access_token }),
    });
    const publishData = await publishRes.json();

    if (publishData.error) {
      return NextResponse.json({ error: publishData.error.message, code: publishData.error.code }, { status: 400, headers: corsHeaders });
    }

    return NextResponse.json({ success: true, ig_media_id: publishData.id }, { headers: corsHeaders });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500, headers: corsHeaders });
  }
}
