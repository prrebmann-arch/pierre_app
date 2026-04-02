// Sync Instagram Reels — Fetch from Graph API and upsert into Supabase
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCoach, authErrorResponse } from '@/lib/api/auth';
import { getCorsHeaders, handlePreflight } from '@/lib/api/cors';

export async function OPTIONS(request: Request) {
  return handlePreflight(request);
}

export async function POST(request: Request) {
  const corsHeaders = getCorsHeaders(request);
  const body = await request.json();

  try { await verifyCoach(request, body, 'user_id'); } catch (e) { return authErrorResponse(e, corsHeaders); }

  try {
    const { ig_user_id, access_token, user_id } = body;
    if (!ig_user_id || !access_token || !user_id) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Fetch recent media (reels)
    const mediaRes = await fetch(`https://graph.instagram.com/v25.0/me/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=50&access_token=${access_token}`);
    const mediaData = await mediaRes.json();

    if (mediaData.error) {
      return NextResponse.json({ error: mediaData.error.message }, { status: 400, headers: corsHeaders });
    }

    const reels = (mediaData.data || []).filter((m: { media_type: string }) => m.media_type === 'VIDEO' || m.media_type === 'REELS');
    let synced = 0;

    for (const reel of reels) {
      // Fetch insights
      const insights: Record<string, number> = {};
      try {
        const insightsRes = await fetch(`https://graph.instagram.com/v25.0/${reel.id}/insights?metric=plays,reach,saved,shares&access_token=${access_token}`);
        const insightsData = await insightsRes.json();
        (insightsData.data || []).forEach((m: { name: string; values?: { value?: number }[] }) => {
          insights[m.name] = m.values?.[0]?.value || 0;
        });
      } catch { /* ignore insight errors */ }

      const likes = reel.like_count || 0;
      const comments = reel.comments_count || 0;
      const reach = insights.reach || 0;
      const plays = insights.plays || 0;
      const totalEng = likes + comments + (insights.saved || 0) + (insights.shares || 0);
      const engRate = reach > 0 ? (totalEng / reach * 100) : 0;

      await supabase.from('ig_reels').upsert({
        user_id,
        ig_media_id: reel.id,
        caption: reel.caption || null,
        thumbnail_url: reel.thumbnail_url || null,
        video_url: reel.media_url || null,
        views: plays,
        likes,
        comments,
        shares: insights.shares || 0,
        saves: insights.saved || 0,
        reach,
        plays,
        engagement_rate: parseFloat(engRate.toFixed(2)),
        published_at: reel.timestamp,
      }, { onConflict: 'ig_media_id' });
      synced++;
    }

    return NextResponse.json({ synced, total: reels.length }, { headers: corsHeaders });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500, headers: corsHeaders });
  }
}
