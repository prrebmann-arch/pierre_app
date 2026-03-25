// Instagram API OAuth via Facebook Login for Business — Exchange code for long-lived token
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
      console.error('[ig-auth] META_APP_ID or META_APP_SECRET not set');
      return res.status(500).json({ error: 'Instagram app credentials not configured.' });
    }

    console.log('[ig-auth] Step 1: Exchanging code via Facebook Graph API');

    // Step 1: Exchange code for token
    const tokenUrl = `https://graph.facebook.com/v25.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirect_uri)}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error('[ig-auth] Step 1 failed:', JSON.stringify(tokenData.error));
      return res.status(400).json({ error: tokenData.error.message || 'Token exchange failed' });
    }

    const shortToken = tokenData.access_token;
    if (!shortToken) {
      console.error('[ig-auth] No access_token:', JSON.stringify(tokenData));
      return res.status(400).json({ error: 'No access token received' });
    }

    console.log('[ig-auth] Step 2: Exchanging for long-lived token');

    // Step 2: Long-lived token
    const longRes = await fetch(`https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`);
    const longData = await longRes.json();
    const longToken = (longData.error ? null : longData.access_token) || shortToken;

    console.log('[ig-auth] Step 3: Finding Instagram account via Facebook Pages');

    // Step 3: Try direct Instagram API first
    let igUserId = '';
    let igUsername = '';
    let followers = 0;
    let mediaCount = 0;
    let profilePic = '';
    let pageId = null;
    let pageAccessToken = null;

    try {
      const profileRes = await fetch(`https://graph.instagram.com/v25.0/me?fields=user_id,username,name,profile_picture_url,followers_count,media_count&access_token=${longToken}`);
      const profile = await profileRes.json();
      if (!profile.error && profile.username) {
        igUserId = profile.user_id || profile.id || '';
        igUsername = profile.username || '';
        followers = profile.followers_count || 0;
        mediaCount = profile.media_count || 0;
        profilePic = profile.profile_picture_url || '';
        console.log('[ig-auth] Direct Instagram API worked: @' + igUsername);
      } else {
        throw new Error('Direct IG API failed, trying Pages fallback');
      }
    } catch (e) {
      console.log('[ig-auth] Falling back to Facebook Pages method');

      // Fallback: Get Pages → find linked Instagram Business Account
      const pagesRes = await fetch(`https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url,followers_count,media_count}&access_token=${longToken}`);
      const pagesData = await pagesRes.json();

      if (pagesData.error) {
        console.error('[ig-auth] Pages fetch failed:', JSON.stringify(pagesData.error));
        return res.status(400).json({ error: 'Impossible de récupérer vos Pages Facebook: ' + (pagesData.error.message || '') });
      }

      // Find first page with an Instagram account
      const pageWithIg = (pagesData.data || []).find(p => p.instagram_business_account);

      if (!pageWithIg) {
        console.error('[ig-auth] No Page with Instagram Business Account found');
        return res.status(400).json({ error: 'Aucune Page Facebook liée à un compte Instagram Business trouvée.' });
      }

      const igAccount = pageWithIg.instagram_business_account;
      pageId = pageWithIg.id;
      pageAccessToken = pageWithIg.access_token;
      igUserId = igAccount.id || '';
      igUsername = igAccount.username || '';
      followers = igAccount.followers_count || 0;
      mediaCount = igAccount.media_count || 0;
      profilePic = igAccount.profile_picture_url || '';
      console.log('[ig-auth] Found IG via Page "' + pageWithIg.name + '": @' + igUsername);
    }

    if (!igUserId) {
      return res.status(400).json({ error: 'Impossible de trouver votre compte Instagram.' });
    }

    console.log('[ig-auth] Success! Connected as @' + igUsername);

    return res.status(200).json({
      access_token: pageAccessToken || longToken,
      expires_in: longData.expires_in || 5184000,
      ig_user_id: String(igUserId),
      ig_username: igUsername,
      followers,
      media_count: mediaCount,
      profile_pic: profilePic,
      page_id: pageId,
      page_access_token: pageAccessToken,
    });
  } catch (err) {
    console.error('[ig-auth] Unexpected error:', err);
    return res.status(500).json({ error: err.message });
  }
};
