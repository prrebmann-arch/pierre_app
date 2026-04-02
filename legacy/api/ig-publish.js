// Instagram Content Publishing API — Publish a post via Instagram Business API
const { verifyAuth, handleAuthError } = require('./_auth');
const { cors } = require('./_cors');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth: verify the caller is authenticated
  try { await verifyAuth(req); } catch (e) { return handleAuthError(res, e); }

  try {
    const { access_token, ig_user_id, image_url, video_url, caption, media_type } = req.body;

    if (!access_token || !ig_user_id) {
      return res.status(400).json({ error: 'Missing access_token or ig_user_id' });
    }

    const apiBase = 'https://graph.instagram.com/v25.0';

    // Step 1: Create media container
    const containerParams = new URLSearchParams({ access_token });
    if (caption) containerParams.set('caption', caption);

    if (media_type === 'VIDEO' || media_type === 'REELS') {
      if (!video_url) return res.status(400).json({ error: 'Missing video_url for video post' });
      containerParams.set('video_url', video_url);
      containerParams.set('media_type', 'REELS');
    } else {
      if (!image_url) return res.status(400).json({ error: 'Missing image_url for image post' });
      containerParams.set('image_url', image_url);
    }

    const containerRes = await fetch(`${apiBase}/${ig_user_id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: containerParams,
    });
    const containerData = await containerRes.json();

    if (containerData.error) {
      return res.status(400).json({ error: containerData.error.message, code: containerData.error.code });
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
          return res.status(400).json({ error: 'Video processing failed on Instagram side' });
        }
      }
      if (!ready) {
        return res.status(408).json({ error: 'Video processing timeout — try again later' });
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
      return res.status(400).json({ error: publishData.error.message, code: publishData.error.code });
    }

    return res.status(200).json({
      success: true,
      ig_media_id: publishData.id,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
