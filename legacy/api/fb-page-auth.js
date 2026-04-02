// Facebook Page Auth — Exchange code for Page Access Token (needed for Instagram DMs)
const { verifyAuth, handleAuthError } = require('./_auth');
const { cors } = require('./_cors');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth: verify the caller is authenticated
  try { await verifyAuth(req); } catch (e) { return handleAuthError(res, e); }

  try {
    const { code, redirect_uri } = req.body;
    const appId = process.env.META_APP_ID_FB || process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET_FB || process.env.META_APP_SECRET;

    if (!code || !redirect_uri) {
      return res.status(400).json({ error: 'Missing code or redirect_uri' });
    }
    if (!appId || !appSecret) {
      console.error('[fb-page-auth] META_APP_ID_FB/META_APP_ID or META_APP_SECRET_FB/META_APP_SECRET not set');
      return res.status(500).json({ error: 'Facebook app credentials not configured.' });
    }

    console.log('[fb-page-auth] Step 1: Exchange code for user token');

    // Step 1: Exchange code for Facebook user access token
    const tokenRes = await fetch(`https://graph.facebook.com/v25.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirect_uri)}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`);
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error('[fb-page-auth] Token exchange failed:', JSON.stringify(tokenData.error));
      return res.status(400).json({ error: tokenData.error.message });
    }

    const userToken = tokenData.access_token;
    if (!userToken) {
      return res.status(400).json({ error: 'No access token received' });
    }

    // Step 2: Debug — check who we are and what permissions we have
    const meRes = await fetch(`https://graph.facebook.com/v25.0/me?fields=id,name&access_token=${userToken}`);
    const meData = await meRes.json();
    console.log('[fb-page-auth] Logged in as:', JSON.stringify(meData));

    const permsRes = await fetch(`https://graph.facebook.com/v25.0/me/permissions?access_token=${userToken}`);
    const permsData = await permsRes.json();
    const grantedPerms = (permsData.data || []).filter(p => p.status === 'granted').map(p => p.permission);
    console.log('[fb-page-auth] Permissions:', JSON.stringify(grantedPerms));

    // Step 3: Get long-lived user token
    const longRes = await fetch(`https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${userToken}`);
    const longData = await longRes.json();
    const longToken = longData.access_token || userToken;

    // Step 4: Get page access token for the linked Facebook Page
    const igAccountId = req.body.ig_user_id;
    console.log('[fb-page-auth] Getting pages for user...');

    const pagesRes = await fetch(`https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token&access_token=${longToken}`);
    const pagesData = await pagesRes.json();
    const pages = pagesData.data || [];
    console.log('[fb-page-auth] Found', pages.length, 'pages');

    let pageId = null;
    let pageToken = longToken;
    let pageName = meData.name || 'Facebook';

    if (pages.length > 0) {
      // Use the first page (or the one linked to Instagram)
      pageId = pages[0].id;
      pageToken = pages[0].access_token || longToken;
      pageName = pages[0].name || pageName;
      console.log('[fb-page-auth] Using page:', pageId, pageName);
    }

    return res.status(200).json({
      page_id: pageId || igAccountId,
      page_name: pageName,
      page_access_token: pageToken,
      ig_business_account_id: igAccountId,
    });
  } catch (err) {
    console.error('[fb-page-auth] Unexpected error:', err);
    return res.status(500).json({ error: err.message });
  }
};
