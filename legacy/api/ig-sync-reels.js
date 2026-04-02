// Sync Instagram Reels — Fetch from Graph API and upsert into Supabase
const { createClient } = require('@supabase/supabase-js');
const { verifyCoach, handleAuthError } = require('./_auth');
const { cors } = require('./_cors');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth: verify JWT + user_id ownership
  try { await verifyCoach(req, 'user_id'); } catch (e) { return handleAuthError(res, e); }

  try {
    const { ig_user_id, access_token, user_id } = req.body;
    if (!ig_user_id || !access_token || !user_id) return res.status(400).json({ error: 'Missing params' });

    const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    // Fetch recent media (reels)
    const mediaRes = await fetch(`https://graph.instagram.com/v25.0/me/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=50&access_token=${access_token}`);
    const mediaData = await mediaRes.json();

    if (mediaData.error) return res.status(400).json({ error: mediaData.error.message });

    const reels = (mediaData.data || []).filter(m => m.media_type === 'VIDEO' || m.media_type === 'REELS');
    let synced = 0;

    for (const reel of reels) {
      // Fetch insights
      let insights = {};
      try {
        const insightsRes = await fetch(`https://graph.instagram.com/v25.0/${reel.id}/insights?metric=plays,reach,saved,shares&access_token=${access_token}`);
        const insightsData = await insightsRes.json();
        (insightsData.data || []).forEach(m => { insights[m.name] = m.values?.[0]?.value || 0; });
      } catch {}

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

    return res.status(200).json({ synced, total: reels.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
