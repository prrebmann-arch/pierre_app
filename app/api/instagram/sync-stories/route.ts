// Sync Instagram Stories — Fetch from Graph API and upsert into Supabase
// Supports both POST (manual) and GET (cron job)
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCoach, verifyCronSecret, authErrorResponse } from '@/lib/api/auth';
import { getCorsHeaders, handlePreflight } from '@/lib/api/cors';

// Cached Supabase admin client (service role — persists across requests in same lambda)
let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  return _supabaseAdmin;
}

export async function OPTIONS(request: Request) {
  return handlePreflight(request);
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();

  // Cron job: verify cron secret
  try { verifyCronSecret(request); } catch (e) { return authErrorResponse(e); }

  const { data } = await supabase.from('ig_accounts').select('*').eq('is_connected', true);
  const accounts = data || [];

  const totalSynced = await syncStories(supabase, accounts);
  return NextResponse.json({ synced: totalSynced });
}

export async function POST(request: Request) {
  const corsHeaders = getCorsHeaders(request);
  const body = await request.json();

  try { await verifyCoach(request, body, 'user_id'); } catch (e) { return authErrorResponse(e, corsHeaders); }

  const { ig_user_id, access_token, user_id } = body;
  if (!ig_user_id || !access_token || !user_id) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400, headers: corsHeaders });
  }

  const supabase = getSupabaseAdmin();

  const totalSynced = await syncStories(supabase, [{ ig_user_id, access_token, user_id }]);
  return NextResponse.json({ synced: totalSynced }, { headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=300' } });
}

// Shared sync logic
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncStories(
  supabase: any,
  accounts: { ig_user_id?: string; access_token: string; user_id: string }[]
): Promise<number> {
  let totalSynced = 0;

  for (const acct of accounts) {
    try {
      const storiesRes = await fetch(`https://graph.instagram.com/v25.0/me/stories?fields=id,media_url,thumbnail_url,caption,media_type,timestamp&access_token=${acct.access_token}`);
      const storiesData = await storiesRes.json();

      if (storiesData.error) continue;

      for (const story of (storiesData.data || [])) {
        const insights: Record<string, number> = {};
        try {
          const iRes = await fetch(`https://graph.instagram.com/v25.0/${story.id}/insights?metric=views,reach,replies,shares,total_interactions,navigation&access_token=${acct.access_token}`);
          const iData = await iRes.json();
          (iData.data || []).forEach((m: { name: string; values?: { value?: number }[] }) => {
            insights[m.name] = m.values?.[0]?.value || 0;
          });
        } catch { /* ignore insight errors */ }

        await supabase.from('ig_stories').upsert({
          user_id: acct.user_id,
          ig_story_id: story.id,
          ig_media_url: story.media_url || null,
          thumbnail_url: story.thumbnail_url || null,
          caption: story.caption || null,
          story_type: story.media_type === 'VIDEO' ? 'video' : 'image',
          impressions: insights.views || 0,
          reach: insights.reach || 0,
          replies: insights.replies || 0,
          exits: insights.navigation || 0,
          taps_forward: insights.total_interactions || 0,
          taps_back: insights.shares || 0,
          published_at: story.timestamp,
          expires_at: new Date(new Date(story.timestamp).getTime() + 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: 'ig_story_id' });
        totalSynced++;
      }
    } catch (err: unknown) {
      console.error(`[IG Sync Stories] Error for user ${acct.user_id}:`, (err as Error).message);
    }
  }

  return totalSynced;
}
