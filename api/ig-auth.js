// Instagram API OAuth — Exchange code for long-lived token
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { code, redirect_uri } = req.body;
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!code || !redirect_uri) {
      return res.status(400).json({ error: 'Missing code or redirect_uri' });
    }
    if (!appId || !appSecret) {
      console.error('[ig-auth] META_APP_ID or META_APP_SECRET not set in environment variables');
      return res.status(500).json({ error: 'Instagram app credentials not configured. Check Vercel env vars.' });
    }

    console.log('[ig-auth] Step 1: Exchanging code for short-lived token, redirect_uri:', redirect_uri);

    // Step 1: Exchange code for short-lived token
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

    if (tokenData.error_message || tokenData.error_type) {
      console.error('[ig-auth] Step 1 failed:', JSON.stringify(tokenData));
      return res.status(400).json({ error: tokenData.error_message || tokenData.error_type || 'Token exchange failed' });
    }

    const shortToken = tokenData.access_token;
    const igUserId = tokenData.user_id;

    if (!shortToken) {
      console.error('[ig-auth] No access_token in response:', JSON.stringify(tokenData));
      return res.status(400).json({ error: 'No access token received from Instagram' });
    }

    console.log('[ig-auth] Step 2: Exchanging for long-lived token');

    // Step 2: Exchange for long-lived token (60 days)
    const longRes = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`);
    const longData = await longRes.json();
    if (longData.error) {
      console.error('[ig-auth] Step 2 failed:', JSON.stringify(longData.error));
      return res.status(400).json({ error: longData.error.message || 'Long-lived token exchange failed' });
    }

    console.log('[ig-auth] Step 3: Fetching profile info');

    // Step 3: Get profile info (v25.0)
    const profileRes = await fetch(`https://graph.instagram.com/v25.0/me?fields=user_id,username,name,profile_picture_url,followers_count,media_count&access_token=${longData.access_token}`);
    const profile = await profileRes.json();

    if (profile.error) {
      console.error('[ig-auth] Profile fetch failed:', JSON.stringify(profile.error));
      // Non-blocking: return token even if profile fails
    }

    console.log('[ig-auth] Success! Connected as @' + (profile.username || igUserId));

    return res.status(200).json({
      access_token: longData.access_token,
      expires_in: longData.expires_in || 5184000,
      ig_user_id: String(igUserId),
      ig_username: profile.username || '',
      followers: profile.followers_count || 0,
      media_count: profile.media_count || 0,
      profile_pic: profile.profile_picture_url || '',
    });
  } catch (err) {
    console.error('[ig-auth] Unexpected error:', err);
    return res.status(500).json({ error: err.message });
  }
};
