// Sync Instagram Stories — Fetch from Graph API and upsert into Supabase
// Supports both POST (manual) and GET (cron job)
const { createClient } = require('@supabase/supabase-js');
const { verifyCoach, verifyCronSecret, handleAuthError } = require('./_auth');
const { cors } = require('./_cors');

module.exports = async function handler(req, res) {
  const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  let accounts = [];

  if (req.method === 'GET') {
    // Cron job: verify cron secret
    try { verifyCronSecret(req); } catch (e) { return handleAuthError(res, e); }
    const { data } = await supabase.from('ig_accounts').select('*').eq('is_connected', true);
    accounts = data || [];
  } else if (req.method === 'POST') {
    if (cors(req, res)) return;
    // Manual sync: verify JWT + user_id ownership
    try { await verifyCoach(req, 'user_id'); } catch (e) { return handleAuthError(res, e); }
    const { ig_user_id, access_token, user_id } = req.body;
    if (!ig_user_id || !access_token || !user_id) return res.status(400).json({ error: 'Missing params' });
    accounts = [{ ig_user_id, access_token, user_id }];
  } else if (req.method === 'OPTIONS') {
    if (cors(req, res)) return;
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let totalSynced = 0;

  for (const acct of accounts) {
    try {
      const storiesRes = await fetch(`https://graph.instagram.com/v25.0/me/stories?fields=id,media_url,thumbnail_url,caption,media_type,timestamp&access_token=${acct.access_token}`);
      const storiesData = await storiesRes.json();

      if (storiesData.error) continue;

      for (const story of (storiesData.data || [])) {
        let insights = {};
        try {
          const iRes = await fetch(`https://graph.instagram.com/v25.0/${story.id}/insights?metric=views,reach,replies,shares,total_interactions,navigation&access_token=${acct.access_token}`);
          const iData = await iRes.json();
          (iData.data || []).forEach(m => { insights[m.name] = m.values?.[0]?.value || 0; });
        } catch {}

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
    } catch (err) {
      console.error(`[IG Sync Stories] Error for user ${acct.user_id}:`, err.message);
    }
  }

  return res.status(200).json({ synced: totalSynced });
};
