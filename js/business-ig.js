// ===== BUSINESS — INSTAGRAM ANALYTICS =====

// ── Canonical redirect URI (must match Meta Developer Dashboard exactly) ──
function _bizIgRedirectUri() {
  return 'https://pierreapp.vercel.app/';
}

// ── Instagram OAuth Connect ──
function bizConnectInstagram() {
  const appId = document.querySelector('meta[name="meta-app-id"]')?.content;
  if (!appId) {
    notify('Instagram non configuré. Contactez le support.', 'error');
    return;
  }

  const redirectUri = encodeURIComponent(_bizIgRedirectUri());
  const scope = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights';
  const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&enable_fb_login=0`;

  devError('[IG OAuth] Redirecting to:', authUrl);
  window.location.href = authUrl;
}

// Handle OAuth callback (check for ?code= in URL on page load)
async function _bizCheckIgCallback() {
  const params = new URLSearchParams(window.location.search);
  let code = params.get('code');
  if (!code) return;
  // Skip if this is a Facebook Page auth callback (handled by business-messages.js)
  if (params.get('state') === 'fb_page_auth') return;
  // Instagram appends #_ to the code sometimes — strip it
  code = code.replace(/#_$/, '').replace(/#$/, '');

  devError('[IG Callback] Code received, waiting for auth...');

  // Clean URL immediately to avoid re-processing on refresh
  window.history.replaceState({}, '', window.location.pathname + window.location.hash);

  // Wait for currentUser to be available (auth is async)
  const user = await _bizWaitForUser(15000);
  if (!user) {
    notify('Session expirée. Reconnectez-vous et réessayez Instagram.', 'error');
    devError('[IG Callback] currentUser not available after timeout');
    return;
  }

  notify('Connexion Instagram en cours...', 'success');

  try {
    // Use the exact same redirect URI as the auth request
    const redirectUri = _bizIgRedirectUri();
    devError('[IG Callback] Exchanging code with redirect_uri:', redirectUri);

    const resp = await authFetch('/api/ig-auth', {
      method: 'POST',
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    });
    const data = await resp.json();

    if (!resp.ok || data.error) {
      notify('Erreur Instagram: ' + (data.error || `HTTP ${resp.status}`), 'error');
      devError('[IG Callback] Token exchange failed:', data);
      return;
    }

    // Save to Supabase (delete existing + insert to avoid unique constraint issues)
    await supabaseClient.from('ig_accounts').delete().eq('user_id', user.id);
    const insertData = {
      user_id: user.id,
      ig_user_id: data.ig_user_id || '',
      ig_username: data.ig_username || '',
      access_token: data.access_token,
      token_expires_at: new Date(Date.now() + (data.expires_in || 5184000) * 1000).toISOString(),
      is_connected: true,
    };
    if (data.page_id) insertData.page_id = data.page_id;
    if (data.page_access_token) insertData.page_access_token = data.page_access_token;
    const { error } = await supabaseClient.from('ig_accounts').insert(insertData);

    if (error) { handleError(error, 'ig-connect'); return; }

    notify(`Instagram @${data.ig_username} connecté !`, 'success');
    devError('[IG Callback] Success! Connected as @' + data.ig_username);

    // Auto-sync
    await bizSyncIgData();
  } catch (err) {
    notify('Erreur de connexion Instagram', 'error');
    devError('[IG Auth]', err);
  }
}

// Wait for currentUser to be set (polls every 200ms, up to timeout)
function _bizWaitForUser(timeout = 15000) {
  return new Promise(resolve => {
    if (typeof currentUser !== 'undefined' && currentUser) return resolve(currentUser);
    const start = Date.now();
    const interval = setInterval(() => {
      if (typeof currentUser !== 'undefined' && currentUser) {
        clearInterval(interval);
        resolve(currentUser);
      } else if (Date.now() - start > timeout) {
        clearInterval(interval);
        resolve(null);
      }
    }, 200);
  });
}

async function bizSyncIgData() {
  const { data: acct } = await supabaseClient.from('ig_accounts').select('*').eq('user_id', currentUser.id).single();
  if (!acct?.access_token) return;

  notify('Synchronisation Instagram...', 'success');

  try {
    // Sync reels client-side
    const mediaRes = await fetch(`https://graph.instagram.com/v25.0/me/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=50&access_token=${acct.access_token}`);
    const mediaData = await mediaRes.json();
    if (!mediaData.error && mediaData.data) {
      for (const item of mediaData.data) {
        const isVideo = item.media_type === 'VIDEO' || item.media_type === 'REELS';
        // Fetch insights for videos/reels
        if (isVideo) {
          const likes = item.like_count || 0;
          const comments = item.comments_count || 0;

          let reach = 0, saved = 0, shares = 0, totalViews = 0;

          // Fetch insights
          try {
            const iRes = await fetch(`https://graph.instagram.com/v25.0/${item.id}/insights?metric=views,reach,saved,shares&access_token=${acct.access_token}`);
            const iData = await iRes.json();
            if (iData.data) {
              iData.data.forEach(m => {
                if (m.name === 'views') totalViews = m.values?.[0]?.value || 0;
                if (m.name === 'reach') reach = m.values?.[0]?.value || 0;
                if (m.name === 'saved') saved = m.values?.[0]?.value || 0;
                if (m.name === 'shares') shares = m.values?.[0]?.value || 0;
              });
            }
          } catch (e) { devError('[biz-ig] reel insights fetch failed', e); }

          const views = totalViews || reach;

          const totalEng = likes + comments + saved + shares;
          const engRate = reach > 0 ? (totalEng / reach * 100) : 0;

          await supabaseClient.from('ig_reels').upsert({
            user_id: currentUser.id,
            ig_media_id: item.id,
            caption: item.caption || null,
            thumbnail_url: item.thumbnail_url || null,
            video_url: item.media_url || null,
            views,
            likes,
            comments,
            shares,
            saves: saved,
            reach,
            plays: views,
            engagement_rate: parseFloat(engRate.toFixed(2)),
            published_at: item.timestamp,
          }, { onConflict: 'ig_media_id' });
        }
      }
    }

    // Sync active stories (last 24h only — Instagram API limitation)
    try {
      const storiesRes = await fetch(`https://graph.instagram.com/v25.0/me/stories?fields=id,media_url,thumbnail_url,caption,media_type,timestamp&access_token=${acct.access_token}`);
      const storiesData = await storiesRes.json();
      if (!storiesData.error && storiesData.data) {
        for (const story of storiesData.data) {
          // Check if story already exists in DB
          const { data: existing } = await supabaseClient.from('ig_stories').select('id').eq('ig_story_id', story.id).maybeSingle();

          let ins = {};
          let insightsOk = false;
          try {
            const iRes = await fetch(`https://graph.instagram.com/v25.0/${story.id}/insights?metric=views,reach,replies,shares,total_interactions,navigation&access_token=${acct.access_token}`);
            const iData = await iRes.json();
            if (iData.data) {
              insightsOk = true;
              iData.data.forEach(m => { ins[m.name] = m.values?.[0]?.value || 0; });
            }
          } catch (e) { devError('[biz-ig] story insights fetch failed', e); }

          if (existing) {
            // Story exists — only update if we have insights
            if (insightsOk) {
              await supabaseClient.from('ig_stories').update({
                ig_media_url: story.media_url || null,
                thumbnail_url: story.thumbnail_url || null,
                impressions: ins.views || 0,
                reach: ins.reach || 0,
                replies: ins.replies || 0,
                exits: ins.navigation || 0,
                taps_forward: ins.total_interactions || 0,
                taps_back: ins.shares || 0,
              }).eq('ig_story_id', story.id);
            }
          } else {
            // New story — insert with whatever data we have
            await supabaseClient.from('ig_stories').insert({
              user_id: currentUser.id,
              ig_story_id: story.id,
              ig_media_url: story.media_url || null,
              thumbnail_url: story.thumbnail_url || null,
              caption: story.caption || null,
              story_type: story.media_type === 'VIDEO' ? 'video' : 'image',
              impressions: insightsOk ? (ins.views || 0) : 0,
              reach: insightsOk ? (ins.reach || 0) : 0,
              replies: insightsOk ? (ins.replies || 0) : 0,
              exits: insightsOk ? (ins.navigation || 0) : 0,
              taps_forward: insightsOk ? (ins.total_interactions || 0) : 0,
              taps_back: insightsOk ? (ins.shares || 0) : 0,
              published_at: story.timestamp,
              expires_at: new Date(new Date(story.timestamp).getTime() + 24 * 60 * 60 * 1000).toISOString(),
            });
          }
        }
      }
    } catch (e) { devError('[biz-ig] stories sync failed', e); }

    // Auto-snapshot after sync — re-read fresh reels from DB
    try {
      const profileRes = await fetch(`https://graph.instagram.com/v25.0/me?fields=followers_count&access_token=${acct.access_token}`);
      const profile = await profileRes.json();
      const { data: freshReels } = await supabaseClient.from('ig_reels').select('views,reach').eq('user_id', currentUser.id);
      const totalViews = (freshReels || []).reduce((s, r) => s + (r.views || 0), 0);
      const totalReach = (freshReels || []).reduce((s, r) => s + (r.reach || 0), 0);

      // Insert new snapshot row
      await supabaseClient.from('ig_snapshots').insert({
        user_id: currentUser.id,
        snapshot_date: new Date().toISOString().slice(0, 10),
        followers: profile.followers_count || 0,
        total_views: totalViews,
        total_reach: totalReach,
        new_followers: (profile.followers_count || 0) - (acct.starting_followers || 0),
      });

      // Keep max 10 snapshots per user — delete oldest beyond 10
      const { data: allSnaps } = await supabaseClient.from('ig_snapshots').select('id,created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false });
      if (allSnaps && allSnaps.length > 10) {
        const toDelete = allSnaps.slice(10).map(s => s.id);
        await supabaseClient.from('ig_snapshots').delete().in('id', toDelete);
      }
    } catch (e) { devError('[IG Snapshot]', e); }

    notify('Instagram synchronisé !', 'success');
  } catch (err) {
    notify('Erreur de synchronisation', 'error');
    devError('[IG Sync]', err);
  }
}

// Check callback on script load — _bizCheckIgCallback now waits for currentUser internally
_bizCheckIgCallback();

let _bizIgTab = 'general';
window._bizIgStories = [];
window._bizIgSequences = [];
window._bizIgSequenceItems = [];
window._bizIgReels = [];
window._bizIgPillars = [];
window._bizIgAccount = null;

const IG_SEQ_TYPES = {
  confiance:       { label: 'Confiance',       color: '#3b82f6' },
  peur:            { label: 'Peur',            color: '#ef4444' },
  preuve_sociale:  { label: 'Preuve sociale',  color: '#22c55e' },
  urgence:         { label: 'Urgence',         color: '#f97316' },
  autorité:        { label: 'Autorité',        color: '#8b5cf6' },
  storytelling:    { label: 'Storytelling',     color: '#ec4899' },
  offre:           { label: 'Offre',           color: '#eab308' },
  éducation:       { label: 'Éducation',       color: '#06b6d4' },
};

// ── Auto-sync stories silently (captures stories before they expire) ──
let _bizIgLastSync = 0;
async function _bizIgAutoSync() {
  // Only sync once per 30min to avoid spamming API
  if (Date.now() - _bizIgLastSync < 30 * 60 * 1000) return;
  _bizIgLastSync = Date.now();

  try {
    const { data: acct } = await supabaseClient.from('ig_accounts').select('*').eq('user_id', currentUser.id).single();
    if (!acct?.access_token) return;

    // Silent story sync
    const storiesRes = await fetch(`https://graph.instagram.com/v25.0/me/stories?fields=id,media_url,thumbnail_url,caption,media_type,timestamp&access_token=${acct.access_token}`);
    const storiesData = await storiesRes.json();
    if (!storiesData.error && storiesData.data) {
      for (const story of storiesData.data) {
        let ins = {};
        try {
          const iRes = await fetch(`https://graph.instagram.com/v25.0/${story.id}/insights?metric=impressions,reach,replies,exits,taps_forward,taps_back&access_token=${acct.access_token}`);
          const iData = await iRes.json();
          (iData.data || []).forEach(m => { ins[m.name] = m.values?.[0]?.value || 0; });
        } catch (e) { devError('[biz-ig] detailed insights failed', e); }

        await supabaseClient.from('ig_stories').upsert({
          user_id: currentUser.id,
          ig_story_id: story.id,
          ig_media_url: story.media_url || null,
          thumbnail_url: story.thumbnail_url || null,
          caption: story.caption || null,
          story_type: story.media_type === 'VIDEO' ? 'video' : 'image',
          impressions: ins.impressions || 0,
          reach: ins.reach || 0,
          replies: ins.replies || 0,
          exits: ins.exits || 0,
          taps_forward: ins.taps_forward || 0,
          taps_back: ins.taps_back || 0,
          published_at: story.timestamp,
          expires_at: new Date(new Date(story.timestamp).getTime() + 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: 'ig_story_id' });
      }
    }
  } catch (e) { devError('[IG AutoSync]', e); }
}

// ── Shared "not connected" screen (shown from any sub-tab) ──
function _bizIgNotConnectedHtml() {
  return `
    <div style="text-align:center;padding:60px;">
      <i class="fab fa-instagram" style="font-size:48px;color:var(--text3);margin-bottom:16px;display:block;opacity:0.4;"></i>
      <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:8px;">Aucun compte connecté</div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:20px;">Connectez votre compte Instagram pour commencer</div>
      <button class="btn btn-red" onclick="bizConnectInstagram()"><i class="fab fa-instagram" style="margin-right:6px;"></i>Connecter Instagram</button>
      <div style="font-size:11px;color:var(--text3);margin-top:12px;">Nécessite un compte Instagram Business ou Creator</div>
    </div>`;
}

// ── Main render ──
async function bizRenderInstagram() {
  const el = document.getElementById('biz-tab-content');

  // Quick check: is there an IG account connected?
  if (!window._bizIgAccount) {
    try {
      const { data } = await supabaseClient.from('ig_accounts').select('*').eq('user_id', currentUser.id).single();
      window._bizIgAccount = data || null;
    } catch (e) { window._bizIgAccount = null; devError('[biz-ig] ig_account load failed', e); }
  }

  // If not connected → show connect screen immediately (no sub-tabs)
  if (!window._bizIgAccount) {
    el.innerHTML = _bizIgNotConnectedHtml();
    return;
  }

  // Auto-sync stories silently in background
  _bizIgAutoSync();

  el.innerHTML = `
    <div style="display:flex;gap:6px;margin-bottom:20px;flex-wrap:wrap;">
      <button class="btn ${_bizIgTab==='general'?'btn-red':'btn-outline'}" onclick="_bizIgTab='general';bizRenderInstagram()"><i class="fas fa-chart-line" style="margin-right:4px;"></i>Général</button>
      <button class="btn ${_bizIgTab==='stories'?'btn-red':'btn-outline'}" onclick="_bizIgTab='stories';bizRenderInstagram()"><i class="fas fa-images" style="margin-right:4px;"></i>Stories</button>
      <button class="btn ${_bizIgTab==='reels'?'btn-red':'btn-outline'}" onclick="_bizIgTab='reels';bizRenderInstagram()"><i class="fas fa-film" style="margin-right:4px;"></i>Reels</button>
      <button class="btn ${_bizIgTab==='overview'?'btn-red':'btn-outline'}" onclick="_bizIgTab='overview';bizRenderInstagram()"><i class="fas fa-chart-pie" style="margin-right:4px;"></i>Aperçu</button>
    </div>
    <div id="biz-ig-content"><div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div></div>`;

  switch (_bizIgTab) {
    case 'general': await bizRenderIgGeneral(); break;
    case 'stories': await bizRenderIgStories(); break;
    case 'reels':   await bizRenderIgReels(); break;
    case 'overview': await bizRenderIgOverview(); break;
  }
}

// ═══════════════════════════════════════
// ── GENERAL TAB ──
// ═══════════════════════════════════════

window._bizIgPeriod = '30d';

const _BIZ_IG_PERIODS = [
  { key: '7d',  label: '7 jours',  days: 7 },
  { key: '30d', label: '30 jours', days: 30 },
  { key: '90d', label: '90 jours', days: 90 },
  { key: '6m',  label: '6 mois',   days: 180 },
  { key: '1y',  label: '1 an',     days: 365 },
];

function _bizIgPeriodRange(key) {
  const p = _BIZ_IG_PERIODS.find(x => x.key === key) || _BIZ_IG_PERIODS[1];
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - p.days);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function _bizIgGetQuarter(date) {
  const d = date ? new Date(date) : new Date();
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `${d.getFullYear()}-Q${q}`;
}

async function bizRenderIgGeneral() {
  const ct = document.getElementById('biz-ig-content');

  try {
    const [acctRes, reelsRes, pillarsRes, snapshotsRes, goalsRes] = await Promise.all([
      supabaseClient.from('ig_accounts').select('*').eq('user_id', currentUser.id).single(),
      supabaseClient.from('ig_reels').select('*').eq('user_id', currentUser.id).order('published_at', { ascending: false }),
      supabaseClient.from('ig_content_pillars').select('*').eq('user_id', currentUser.id).order('name'),
      supabaseClient.from('ig_snapshots').select('*').eq('user_id', currentUser.id).order('snapshot_date', { ascending: true }),
      supabaseClient.from('ig_goals').select('*').eq('user_id', currentUser.id),
    ]);
    window._bizIgAccount = acctRes.data || null;
    window._bizIgReels = reelsRes.data || [];
    window._bizIgPillars = pillarsRes.data || [];
    window._bizIgSnapshots = snapshotsRes.data || [];
    window._bizIgGoals = goalsRes.data || [];
  } catch (e) {
    handleError(e, 'ig-general');
  }

  // Fetch live profile
  const acct = window._bizIgAccount;
  if (acct?.access_token) {
    try {
      const resp = await fetch(`https://graph.instagram.com/v25.0/me?fields=username,name,followers_count,follows_count,media_count,profile_picture_url&access_token=${acct.access_token}`);
      window._bizIgProfile = await resp.json();
    } catch (e) { window._bizIgProfile = {}; }
  } else {
    window._bizIgProfile = {};
  }

  _renderIgGeneralView(ct);
}

function _renderIgGeneralView(ct) {
  if (!ct) ct = document.getElementById('biz-ig-content');

  const acct = window._bizIgAccount;
  const profile = window._bizIgProfile || {};
  const allReels = window._bizIgReels || [];
  const pillars = window._bizIgPillars || [];
  const snapshots = window._bizIgSnapshots || [];
  const goals = window._bizIgGoals || [];
  const period = window._bizIgPeriod || '30d';
  const quarter = _bizIgGetQuarter();

  if (!acct) {
    ct.innerHTML = `
      <div style="text-align:center;padding:60px;">
        <i class="fab fa-instagram" style="font-size:48px;color:var(--text3);margin-bottom:16px;display:block;opacity:0.4;"></i>
        <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:8px;">Aucun compte connecté</div>
        <div style="font-size:13px;color:var(--text3);margin-bottom:20px;">Connectez votre compte Instagram pour voir le tableau de bord</div>
        <button class="btn btn-red" onclick="bizConnectInstagram()"><i class="fab fa-instagram" style="margin-right:6px;"></i>Connecter Instagram</button>
      </div>`;
    return;
  }

  // Filter reels by period
  const { start: pStart, end: pEnd } = _bizIgPeriodRange(period);
  const reels = allReels.filter(r => {
    if (!r.published_at) return false;
    const d = new Date(r.published_at);
    return d >= pStart && d <= pEnd;
  });

  // Filter snapshots by period
  const qSnapshots = snapshots.filter(s => {
    const d = new Date(s.snapshot_date);
    return d >= pStart && d <= pEnd;
  });

  // ── Period selector ──
  const periodPills = _BIZ_IG_PERIODS.map(p =>
    `<button class="btn ${p.key === period ? 'btn-red' : 'btn-outline'} btn-sm" onclick="window._bizIgPeriod='${p.key}';_renderIgGeneralView()">${p.label}</button>`
  ).join('');

  // ── Section 1 — KPI Row ──
  const followers = profile.followers_count || 0;
  const firstSnapshot = qSnapshots.length ? qSnapshots[0] : null;
  const startFollowers = firstSnapshot ? firstSnapshot.followers : followers;
  const newFollowers = followers - startFollowers;
  const totalViews = reels.reduce((s, r) => s + (r.views || 0), 0);
  const totalReach = reels.reduce((s, r) => s + (r.reach || 0), 0);
  const totalInteractions = reels.reduce((s, r) => s + (r.likes || 0) + (r.comments || 0) + (r.saves || 0) + (r.shares || 0), 0);
  const postedCount = reels.length;

  const kpi = (label, value, color) => `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px 16px;text-align:center;min-width:100px;flex-shrink:0;">
      <div style="font-size:22px;font-weight:700;${color ? 'color:' + color + ';' : 'color:var(--text);'}">${value}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px;">${label}</div>
    </div>`;

  const kpiRow = `
    <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;margin-bottom:20px;">
      ${kpi('Followers', followers.toLocaleString(), 'var(--success)')}
      ${kpi('New', (newFollowers >= 0 ? '+' : '') + newFollowers.toLocaleString(), null)}
      ${kpi('Views', totalViews.toLocaleString(), 'var(--primary)')}
      ${kpi('Reached', totalReach.toLocaleString(), null)}
      ${kpi('Visits', '\u2014', null)}
      ${kpi('Interactions', totalInteractions.toLocaleString(), null)}
      ${kpi('DMs', '\u2014', null)}
      ${kpi('Link', '\u2014', null)}
      ${kpi('Posted', postedCount, null)}
    </div>`;

  // ── Section 2 — Growth Trend ──
  const growthSection = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:20px;">
      <h4 style="font-size:14px;font-weight:700;color:var(--text);margin:0 0 16px;">Growth Trend</h4>
      ${qSnapshots.length
        ? `<div style="position:relative;height:220px;width:100%;"><canvas id="ig-general-growth-chart"></canvas></div>`
        : '<div style="text-align:center;padding:30px;color:var(--text3);font-size:12px;"><i class="fas fa-chart-line" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.3;"></i>Aucun historique \u2014 les donn\u00e9es seront enregistr\u00e9es automatiquement</div>'}
    </div>`;

  // ── Section 3 — Performance by Format ──
  const formats = {};
  reels.forEach(r => {
    const f = r.format || 'non_tagg\u00e9';
    if (!formats[f]) formats[f] = { views: 0, count: 0 };
    formats[f].views += (r.views || 0);
    formats[f].count++;
  });
  const hasFormats = reels.some(r => r.format);

  const formatSection = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:20px;">
      <h4 style="font-size:14px;font-weight:700;color:var(--text);margin:0 0 16px;">Performance par Format</h4>
      ${hasFormats
        ? `<div style="position:relative;height:160px;width:100%;"><canvas id="ig-general-format-chart"></canvas></div>`
        : '<div style="text-align:center;padding:30px;color:var(--text3);font-size:12px;"><i class="fas fa-tags" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.3;"></i>Aucun reel tagg\u00e9 \u2014 ajoutez un format (talking_head, text_overlay, raw_documentary) \u00e0 vos reels</div>'}
    </div>`;

  // ── Section 4 — Transformation Results (based on snapshots) ──
  const currentEngagement = reels.length ? (reels.reduce((s, r) => s + (r.engagement_rate || 0), 0) / reels.length).toFixed(2) : '0.00';
  const currentViews = reels.reduce((s, r) => s + (r.views || 0), 0);
  const bestReelViews = reels.length ? Math.max(...reels.map(r => r.views || 0)) : 0;

  const transLine = (label, before, after, diff) => {
    const diffStr = diff > 0 ? `<span style="color:var(--success);font-size:10px;margin-left:4px;">+${diff.toLocaleString()}</span>` : diff < 0 ? `<span style="color:var(--danger);font-size:10px;margin-left:4px;">${diff.toLocaleString()}</span>` : '';
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:12px;color:var(--text2);">${label}</span>
      <div style="font-size:12px;">
        <span style="color:var(--text3);">${before}</span>
        <span style="color:var(--text3);margin:0 6px;">\u2192</span>
        <span style="color:var(--text);font-weight:700;">${after}</span>${diffStr}
      </div>
    </div>`;
  };

  const periodLabel = (_BIZ_IG_PERIODS.find(p => p.key === period) || {}).label || period;
  const transformSection = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow:hidden;">
      <div style="height:3px;background:linear-gradient(90deg, var(--primary), var(--success));"></div>
      <div style="padding:20px;">
        <h4 style="font-size:14px;font-weight:700;color:var(--text);margin:0 0 12px;">\u00c9volution (${periodLabel})</h4>
        ${firstSnapshot
          ? `${transLine('Followers', firstSnapshot.followers.toLocaleString(), followers.toLocaleString(), followers - firstSnapshot.followers)}
            ${transLine('Views', (firstSnapshot.total_views || 0).toLocaleString(), currentViews.toLocaleString(), currentViews - (firstSnapshot.total_views || 0))}
            ${transLine('Reach', (firstSnapshot.total_reach || 0).toLocaleString(), reels.reduce((s, r) => s + (r.reach || 0), 0).toLocaleString(), reels.reduce((s, r) => s + (r.reach || 0), 0) - (firstSnapshot.total_reach || 0))}
            ${transLine('Best Reel', '\u2014', bestReelViews.toLocaleString(), 0)}`
          : `<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px;">
              <i class="fas fa-chart-line" style="font-size:20px;display:block;margin-bottom:8px;opacity:0.3;"></i>
              Pas encore de donn\u00e9es sur cette p\u00e9riode.<br>Chaque sync enregistre un snapshot \u2014 les donn\u00e9es s'accumuleront au fil du temps.
            </div>`}
      </div>
    </div>`;

  // ── Section 5 — Goals ──
  const qGoals = goals.filter(g => g.quarter === quarter);
  const goalMetrics = {
    followers: { label: 'Followers', icon: 'fa-users', current: followers },
    monthly_views: { label: 'Views (période)', icon: 'fa-eye', current: currentViews },
    engagement_rate: { label: 'Engagement', icon: 'fa-heart', current: parseFloat(currentEngagement) },
    weekly_output: { label: 'Reels / semaine', icon: 'fa-film', current: (() => {
      const now = new Date();
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1); weekStart.setHours(0,0,0,0);
      return allReels.filter(r => r.published_at && new Date(r.published_at) >= weekStart).length;
    })() },
    dms_month: { label: 'DMs / mois', icon: 'fa-envelope', current: 0 },
    viral_reels: { label: 'Reels viraux (100K+)', icon: 'fa-fire', current: reels.filter(r => (r.views || 0) >= 100000).length },
  };

  const goalBars = qGoals.map(g => {
    const meta = goalMetrics[g.metric] || { label: g.metric, icon: 'fa-bullseye', current: 0 };
    const pct = g.target_value > 0 ? Math.min(100, Math.round(meta.current / g.target_value * 100)) : 0;
    const status = pct >= 100 ? '\u2705' : pct >= 80 ? '\u26a0\ufe0f' : '\u274c';
    return `
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:12px;color:var(--text2);"><i class="fas ${meta.icon}" style="margin-right:4px;width:14px;text-align:center;"></i>${meta.label} ${status}</span>
          <span style="font-size:11px;color:var(--text3);">${meta.current.toLocaleString()} / ${Number(g.target_value).toLocaleString()}</span>
        </div>
        <div style="background:var(--bg3);border-radius:3px;height:6px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:var(--success);border-radius:3px;transition:width 0.3s;"></div>
        </div>
      </div>`;
  }).join('');

  const goalsSection = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h4 style="font-size:14px;font-weight:700;color:var(--text);margin:0;">${quarter.replace('-', ' ')} Goals</h4>
        <button class="btn btn-outline btn-sm" onclick="_bizIgEditGoalsModal('${quarter}')"><i class="fas fa-pen" style="margin-right:4px;"></i>Modifier</button>
      </div>
      ${qGoals.length
        ? goalBars
        : '<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px;">Aucun objectif d\u00e9fini pour ce trimestre<br><button class="btn btn-red btn-sm" style="margin-top:8px;" onclick="_bizIgEditGoalsModal(\'' + quarter + '\')"><i class="fas fa-plus" style="margin-right:4px;"></i>D\u00e9finir des objectifs</button></div>'}
    </div>`;

  // ── Section 6 — Top Performing Reels ──
  const sortedReels = [...reels].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 8);
  const topReelRows = sortedReels.map((r, idx) => {
    const caption = (r.caption || '').length > 50 ? escHtml(r.caption.slice(0, 50)) + '...' : escHtml(r.caption || '\u2014');
    const pillar = pillars.find(p => p.id === r.pillar_id);
    const pillarTag = pillar
      ? `<span style="font-size:10px;padding:2px 8px;border-radius:8px;background:${escHtml(pillar.color || '#6b7280')}20;color:${escHtml(pillar.color || '#6b7280')};font-weight:600;">${escHtml(pillar.name)}</span>`
      : '<span style="color:var(--text3);font-size:10px;">\u2014</span>';
    const thumb = r.thumbnail_url
      ? `<img src="${escHtml(r.thumbnail_url)}" style="width:36px;height:48px;object-fit:cover;border-radius:4px;cursor:pointer;" onclick="_bizIgPlayReel('${r.id}')">`
      : `<div style="width:36px;height:48px;background:var(--bg3);border-radius:4px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-film" style="font-size:10px;color:var(--text3);"></i></div>`;
    return `
      <tr class="nd-tr" style="cursor:pointer;" onclick="_bizIgPlayReel('${r.id}')">
        <td style="padding:6px 8px;font-size:12px;color:var(--text3);font-weight:600;">#${idx + 1}</td>
        <td style="padding:6px 8px;">${thumb}</td>
        <td style="font-size:12px;color:var(--text);max-width:200px;">${caption}</td>
        <td>${pillarTag}</td>
        <td style="font-size:12px;color:var(--text2);font-weight:600;">${(r.views || 0).toLocaleString()}</td>
        <td style="font-size:12px;color:var(--text2);">${r.saves || 0}</td>
        <td style="font-size:12px;color:var(--text2);">${r.shares || 0}</td>
      </tr>`;
  }).join('');

  const topReelsSection = reels.length ? `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:20px;">
      <h4 style="font-size:14px;font-weight:700;color:var(--text);margin:0 0 12px;">Top Performing Reels</h4>
      <div class="nd-table-wrap">
        <table class="nd-table">
          <thead><tr><th>#</th><th></th><th>Caption</th><th>Pillar</th><th>Views</th><th>Saves</th><th>Shares</th></tr></thead>
          <tbody>${topReelRows}</tbody>
        </table>
      </div>
    </div>` : '';

  // ── Section 7 — Content Pillars Distribution ──
  const pillarCounts = {};
  reels.forEach(r => {
    const pid = r.pillar_id || '_none';
    pillarCounts[pid] = (pillarCounts[pid] || 0) + 1;
  });
  const hasPillarData = pillars.length > 0 && reels.some(r => r.pillar_id);

  const pillarLegend = pillars.filter(p => pillarCounts[p.id]).map(p => {
    const count = pillarCounts[p.id] || 0;
    const pct = reels.length ? Math.round(count / reels.length * 100) : 0;
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${escHtml(p.color || '#6b7280')};flex-shrink:0;"></div>
        <span style="font-size:12px;color:var(--text);flex:1;">${escHtml(p.name)}</span>
        <span style="font-size:11px;color:var(--text3);">${pct}% (${count})</span>
      </div>`;
  }).join('');

  const pillarsSection = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:20px;">
      <h4 style="font-size:14px;font-weight:700;color:var(--text);margin:0 0 16px;">Content Pillars Distribution</h4>
      ${hasPillarData
        ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:center;">
            <div style="position:relative;height:200px;"><canvas id="ig-general-pillars-chart"></canvas></div>
            <div>${pillarLegend}</div>
          </div>`
        : '<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">Assignez des piliers \u00e0 vos reels pour voir la r\u00e9partition</div>'}
    </div>`;

  // ── Section 8 — Audience placeholder ──
  const audienceSection = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:20px;">
      <h4 style="font-size:14px;font-weight:700;color:var(--text);margin:0 0 12px;"><i class="fas fa-globe" style="margin-right:6px;"></i>Audience</h4>
      <div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">
        <i class="fas fa-globe" style="font-size:28px;display:block;margin-bottom:8px;opacity:0.3;"></i>
        Bient\u00f4t disponible \u2014 les donn\u00e9es d'audience seront ajout\u00e9es prochainement
      </div>
    </div>`;

  // ── Assemble layout ──
  ct.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
      ${periodPills}
      <div style="flex:1;"></div>
      <button class="btn btn-outline btn-sm" onclick="bizSyncIgData().then(()=>bizRenderInstagram())"><i class="fas fa-sync" style="margin-right:4px;"></i>Sync</button>
    </div>

    ${kpiRow}

    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(340px, 1fr));gap:16px;margin-bottom:16px;">
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${growthSection}
        ${formatSection}
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${transformSection}
        ${goalsSection}
        ${audienceSection}
      </div>
    </div>

    ${topReelsSection}
    <div style="margin-top:16px;">${pillarsSection}</div>`;

  // ── Render Chart.js charts ──
  setTimeout(() => {
    _bizIgRenderGrowthChart(qSnapshots);
    _bizIgRenderFormatChart(formats, hasFormats);
    _bizIgRenderPillarsChart(pillars, pillarCounts, hasPillarData);
  }, 50);
}

// ── Chart renderers ──
function _bizIgRenderGrowthChart(snapshots) {
  const canvas = document.getElementById('ig-general-growth-chart');
  if (!canvas || !snapshots.length) return;

  const labels = snapshots.map(s => {
    const d = new Date(s.snapshot_date);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  });

  const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#333';
  const text3 = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim() || '#888';

  new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Followers', data: snapshots.map(s => s.followers || 0), borderColor: '#3b82f6', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3 },
        { label: 'Views', data: snapshots.map(s => s.total_views || 0), borderColor: '#eab308', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3 },
        { label: 'Reached', data: snapshots.map(s => s.total_reach || 0), borderColor: '#22c55e', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: text3, font: { size: 11 } } } },
      scales: {
        x: { grid: { color: borderColor }, ticks: { color: text3, font: { size: 10 } } },
        y: { grid: { color: borderColor }, ticks: { color: text3, font: { size: 10 } } },
      },
    },
  });
}

function _bizIgRenderFormatChart(formats, hasFormats) {
  const canvas = document.getElementById('ig-general-format-chart');
  if (!canvas || !hasFormats) return;

  const formatColors = { talking_head: '#3b82f6', text_overlay: '#f59e0b', raw_documentary: '#ef4444' };
  const formatLabels = { talking_head: 'Talking Head', text_overlay: 'Text Overlay', raw_documentary: 'Raw/Documentary' };
  const keys = Object.keys(formats).filter(k => k !== 'non_tagg\u00e9');
  const labels = keys.map(k => formatLabels[k] || k);
  const avgViews = keys.map(k => formats[k].count > 0 ? Math.round(formats[k].views / formats[k].count) : 0);
  const colors = keys.map(k => formatColors[k] || '#6b7280');

  const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#333';
  const text3 = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim() || '#888';

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Avg Views', data: avgViews, backgroundColor: colors, borderRadius: 4 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: borderColor }, ticks: { color: text3, font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { color: text3, font: { size: 11 } } },
      },
    },
  });
}

function _bizIgRenderPillarsChart(pillars, pillarCounts, hasPillarData) {
  const canvas = document.getElementById('ig-general-pillars-chart');
  if (!canvas || !hasPillarData) return;

  const activePillars = pillars.filter(p => pillarCounts[p.id]);
  const labels = activePillars.map(p => p.name);
  const data = activePillars.map(p => pillarCounts[p.id] || 0);
  const colors = activePillars.map(p => p.color || '#6b7280');

  const text3 = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim() || '#888';

  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 0 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw} reels` } },
      },
    },
  });
}

// ── Set starting point ──
async function _bizIgSetStartingPoint() {
  const profile = window._bizIgProfile || {};
  const allReels = window._bizIgReels || [];
  const now = new Date();
  const monthReels = allReels.filter(r => {
    if (!r.published_at) return false;
    const d = new Date(r.published_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthViews = monthReels.reduce((s, r) => s + (r.views || 0), 0);
  const avgEng = allReels.length ? parseFloat((allReels.reduce((s, r) => s + (r.engagement_rate || 0), 0) / allReels.length).toFixed(2)) : 0;
  const bestReel = allReels.length ? Math.max(...allReels.map(r => r.views || 0)) : 0;

  const { error } = await supabaseClient.from('ig_accounts').update({
    starting_followers: profile.followers_count || 0,
    starting_date: new Date().toISOString().slice(0, 10),
    starting_monthly_views: monthViews,
    starting_engagement: avgEng,
    starting_best_reel: bestReel,
  }).eq('user_id', currentUser.id);

  if (error) { handleError(error, 'ig-starting'); return; }
  notify('Point de d\u00e9part enregistr\u00e9 !', 'success');
  await bizRenderIgGeneral();
}

// ── Goals modal ──
function _bizIgEditGoalsModal(quarter) {
  const goals = (window._bizIgGoals || []).filter(g => g.quarter === quarter);
  const metrics = [
    { key: 'followers', label: 'Followers' },
    { key: 'monthly_views', label: 'Monthly Views' },
    { key: 'engagement_rate', label: 'Engagement Rate (%)' },
    { key: 'weekly_output', label: 'Reels / semaine' },
    { key: 'dms_month', label: 'DMs / mois' },
    { key: 'viral_reels', label: 'Reels viraux (100K+)' },
  ];

  const rows = metrics.map(m => {
    const existing = goals.find(g => g.metric === m.key);
    const val = existing ? existing.target_value : '';
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <label style="font-size:12px;color:var(--text2);width:160px;">${m.label}</label>
        <input type="number" id="ig-goal-${m.key}" class="bt-input" value="${val}" placeholder="0" style="flex:1;">
      </div>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.id = 'ig-goals-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';
  overlay.innerHTML = `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:28px;width:440px;max-width:90vw;">
      <h3 style="font-size:18px;font-weight:700;color:var(--text);margin:0 0 20px;">Objectifs ${quarter.replace('-', ' ')}</h3>
      ${rows}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        <button class="btn btn-outline" onclick="document.getElementById('ig-goals-modal').remove()">Annuler</button>
        <button class="btn btn-red" onclick="_bizIgSaveGoals('${quarter}')">Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

async function _bizIgSaveGoals(quarter) {
  const metrics = ['followers', 'monthly_views', 'engagement_rate', 'weekly_output', 'dms_month', 'viral_reels'];
  const inserts = [];

  for (const m of metrics) {
    const el = document.getElementById(`ig-goal-${m}`);
    const val = parseFloat(el?.value);
    if (!isNaN(val) && val > 0) {
      inserts.push({ user_id: currentUser.id, quarter, metric: m, target_value: val });
    }
  }

  // Delete existing goals for this quarter, then insert new ones
  await supabaseClient.from('ig_goals').delete().eq('user_id', currentUser.id).eq('quarter', quarter);
  if (inserts.length) {
    const { error } = await supabaseClient.from('ig_goals').insert(inserts);
    if (error) { handleError(error, 'ig-goals-save'); return; }
  }

  document.getElementById('ig-goals-modal')?.remove();
  notify('Objectifs enregistr\u00e9s !', 'success');
  await bizRenderIgGeneral();
}

// ═══════════════════════════════════════
// ── STORIES TAB ──
// ═══════════════════════════════════════

async function bizRenderIgStories() {
  const ct = document.getElementById('biz-ig-content');

  try {
    const [seqRes, storiesRes] = await Promise.all([
      supabaseClient.from('story_sequences').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
      supabaseClient.from('ig_stories').select('*').eq('user_id', currentUser.id).order('published_at', { ascending: false }),
    ]);

    // Fetch sequence items based on user's sequences
    const seqIds = (seqRes.data || []).map(s => s.id);
    let itemsRes = { data: [] };
    if (seqIds.length) {
      itemsRes = await supabaseClient.from('story_sequence_items').select('*').in('sequence_id', seqIds);
    }

    window._bizIgSequences = seqRes.data || [];
    window._bizIgSequenceItems = itemsRes.data || [];
    window._bizIgStories = storiesRes.data || [];
  } catch (e) {
    handleError(e, 'ig-stories');
  }

  _renderIgStoriesView(ct);
}

window._bizIgStoryWeekOffset = 0;
window._bizIgSelectedDay = null;

function _renderIgStoriesView(ct) {
  if (!ct) ct = document.getElementById('biz-ig-content');
  const sequences = window._bizIgSequences || [];
  const items = window._bizIgSequenceItems || [];

  // ── Week navigation ──
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1 + (window._bizIgStoryWeekOffset * 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const weekLabel = weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' — ' + weekEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const todayStr = now.toISOString().slice(0, 10);
  const wsStr = weekStart.toISOString().slice(0, 10);
  const weStr = weekEnd.toISOString().slice(0, 10);

  if (!window._bizIgSelectedDay || window._bizIgSelectedDay < wsStr || window._bizIgSelectedDay > weStr) {
    window._bizIgSelectedDay = todayStr >= wsStr && todayStr <= weStr ? todayStr : wsStr;
  }
  const selDay = window._bizIgSelectedDay;

  // Build days
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push({ date: d.toISOString().slice(0, 10), label: d.toLocaleDateString('fr-FR', { weekday: 'short' }), num: d.getDate() });
  }

  // Find sequences for selected day (by published_at or created_at date)
  const daySequences = sequences.filter(seq => {
    const seqDate = (seq.published_at || seq.created_at || '').slice(0, 10);
    return seqDate === selDay;
  });

  // Check which days have sequences
  const seqDates = new Set(sequences.map(s => (s.published_at || s.created_at || '').slice(0, 10)));

  // ── Day buttons (full-width like diet history) ──
  const daysHtml = days.map(d => {
    const hasSeq = seqDates.has(d.date);
    const isSel = d.date === selDay;
    return `<button onclick="window._bizIgSelectedDay='${d.date}';_renderIgStoriesView()" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 0;border-radius:12px;border:none;background:${isSel ? 'var(--primary)' : 'transparent'};cursor:pointer;transition:all 0.15s;">
      <span style="font-size:11px;font-weight:600;color:${isSel ? '#fff' : 'var(--text3)'};text-transform:uppercase;letter-spacing:0.5px;">${d.label.replace('.','')}</span>
      <span style="font-size:22px;font-weight:800;color:${isSel ? '#fff' : 'var(--text)'};">${d.num}</span>
      ${hasSeq ? `<span style="width:6px;height:6px;border-radius:50%;background:${isSel ? '#fff' : 'var(--success)'};"></span>` : '<span style="width:6px;height:6px;"></span>'}
    </button>`;
  }).join('');

  // ── Day content: sequences for selected day ──
  let dayContent = '';
  if (daySequences.length) {
    dayContent = daySequences.map(seq => {
      // Reverse sort: Story 1 = last published (rightmost in IG), display left to right = newest to oldest
      const seqItems = items.filter(i => i.sequence_id === seq.id).sort((a, b) => (b.position || 0) - (a.position || 0));
      const t = IG_SEQ_TYPES[seq.sequence_type] || { label: seq.sequence_type, color: '#6b7280' };
      const allStories = window._bizIgStories || [];
      const totalItems = seqItems.length;

      // Big story cards with drop-off arrows between them
      const storyCards = seqItems.map((item, idx) => {
        const story = allStories.find(s => s.id === item.story_id);
        const views = item.impressions || story?.impressions || 0;
        const replies = item.replies || story?.replies || 0;
        const exits = item.exits || story?.exits || 0;
        const reach = story?.reach || 0;
        const tapsF = story?.taps_forward || 0;
        const tapsB = story?.taps_back || 0;
        const storyNum = idx + 1;

        // Drop-off arrow between stories (reading left to right)
        let dropoffArrow = '';
        if (idx > 0) {
          const prevItem = seqItems[idx - 1];
          const prevViews = prevItem.impressions || (allStories.find(s => s.id === prevItem.story_id)?.impressions) || 0;
          const dropPct = prevViews > 0 ? Math.round((1 - views / prevViews) * 100) : 0;
          const dropColor = dropPct > 30 ? 'var(--danger)' : dropPct > 15 ? 'var(--warning)' : 'var(--success)';
          dropoffArrow = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:44px;">
              <i class="fas fa-chevron-right" style="font-size:16px;color:${dropColor};margin-bottom:2px;"></i>
              <span style="font-size:13px;font-weight:700;color:${dropColor};">${dropPct > 0 ? '-' : ''}${dropPct}%</span>
            </div>`;
        }

        const card = `
          <div style="display:flex;flex-direction:column;align-items:center;min-width:200px;">
            <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;overflow:hidden;width:200px;">
              <div style="width:100%;aspect-ratio:9/16;background:var(--bg3);display:flex;align-items:center;justify-content:center;position:relative;">
                ${story?.thumbnail_url || story?.ig_media_url
                  ? `<img src="${escHtml(story.thumbnail_url || story.ig_media_url)}" style="width:100%;height:100%;object-fit:cover;">`
                  : '<i class="fas fa-image" style="font-size:28px;color:var(--text3);opacity:0.3;"></i>'}
                <div style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.7);color:#fff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:12px;">Story ${storyNum}</div>
              </div>
            </div>
            <div style="width:200px;margin-top:12px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <div style="text-align:center;flex:1;"><div style="font-size:16px;font-weight:700;color:var(--text);">${views}</div><div style="font-size:10px;color:var(--text3);">Vues</div></div>
                <div style="text-align:center;flex:1;"><div style="font-size:16px;font-weight:700;color:var(--text);">${reach}</div><div style="font-size:10px;color:var(--text3);">Reach</div></div>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <div style="text-align:center;flex:1;"><div style="font-size:14px;font-weight:600;color:var(--text2);">${replies}</div><div style="font-size:10px;color:var(--text3);">DMs</div></div>
                <div style="text-align:center;flex:1;"><div style="font-size:14px;font-weight:600;color:var(--text2);">${exits}</div><div style="font-size:10px;color:var(--text3);">Exits</div></div>
                <div style="text-align:center;flex:1;"><div style="font-size:14px;font-weight:600;color:var(--text2);">${tapsF}</div><div style="font-size:10px;color:var(--text3);">Next</div></div>
                <div style="text-align:center;flex:1;"><div style="font-size:14px;font-weight:600;color:var(--text2);">${tapsB}</div><div style="font-size:10px;color:var(--text3);">Back</div></div>
              </div>
            </div>
          </div>`;

        return dropoffArrow + card;
      }).join('');

      // Funnel
      const maxImp = Math.max(...seqItems.map(i => i.impressions || 0), 1);
      const funnelBars = seqItems.map((item, idx) => {
        const pct = ((item.impressions || 0) / maxImp * 100);
        return `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="font-size:10px;color:var(--text3);width:50px;text-align:right;">Story ${idx + 1}</span>
            <div style="flex:1;background:var(--bg3);border-radius:4px;height:22px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:${t.color};border-radius:4px;display:flex;align-items:center;padding-left:6px;">
                <span style="font-size:9px;color:#fff;font-weight:600;">${item.impressions || 0}</span>
              </div>
            </div>
          </div>`;
      }).join('');

      return `
        <div style="margin-bottom:24px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
            <span style="font-size:16px;font-weight:700;color:var(--text);">${escHtml(seq.name)}</span>
            <span style="font-size:10px;padding:3px 10px;border-radius:8px;background:${t.color}20;color:${t.color};font-weight:600;">${escHtml(t.label)}</span>
            <div style="flex:1;"></div>
            <button class="btn btn-outline btn-sm" onclick="_bizIgShowSequenceDetail('${seq.id}')"><i class="fas fa-pen" style="margin-right:3px;"></i>Détails</button>
            <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="event.stopPropagation();_bizIgDeleteSequence('${seq.id}','${escHtml(seq.name)}')"><i class="fas fa-trash"></i></button>
          </div>
          ${seq.objective ? `<div style="font-size:12px;color:var(--text3);margin-bottom:12px;"><i class="fas fa-bullseye" style="margin-right:4px;"></i>${escHtml(seq.objective)}</div>` : ''}

          <div style="display:flex;gap:0;overflow-x:auto;padding-bottom:12px;margin-bottom:16px;justify-content:center;align-items:center;">${storyCards || '<div style="color:var(--text3);font-size:12px;">Aucune story ajoutée</div>'}</div>

          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
            <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;">
              <div style="font-size:18px;font-weight:700;color:var(--text);">${seqItems.length}</div>
              <div style="font-size:10px;color:var(--text3);">Stories</div>
            </div>
            <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;">
              <div style="font-size:18px;font-weight:700;color:var(--text);">${seq.total_impressions || 0}</div>
              <div style="font-size:10px;color:var(--text3);">Impressions</div>
            </div>
            <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;">
              <div style="font-size:18px;font-weight:700;color:${seq.overall_dropoff_rate > 50 ? 'var(--danger)' : 'var(--success)'};">${seq.overall_dropoff_rate != null ? seq.overall_dropoff_rate + '%' : '—'}</div>
              <div style="font-size:10px;color:var(--text3);">Drop-off</div>
            </div>
            <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;">
              <div style="font-size:18px;font-weight:700;color:var(--text);">${seq.total_replies || 0}</div>
              <div style="font-size:10px;color:var(--text3);">Replies</div>
            </div>
          </div>

          ${seqItems.length > 1 ? `
          <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px;">Funnel de rétention</div>
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px;">${funnelBars}</div>` : ''}

          ${seq.notes ? `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:12px;color:var(--text3);"><strong>Notes :</strong> ${escHtml(seq.notes)}</div>` : ''}
        </div>`;
    }).join('');
  } else {
    dayContent = `
      <div style="text-align:center;padding:40px;color:var(--text3);">
        <i class="fas fa-images" style="font-size:32px;margin-bottom:12px;display:block;opacity:0.3;"></i>
        <div style="font-size:14px;margin-bottom:4px;">Aucune story séquence ce jour</div>
        <div style="font-size:12px;">Créez une séquence pour analyser vos stories</div>
      </div>`;
  }

  // ── Stories du jour (hors séquence) ──
  const allStories = window._bizIgStories || [];
  const seqStoryIds = new Set(items.map(i => i.story_id));
  const dayStories = allStories.filter(s => {
    if (!s.published_at) return false;
    return s.published_at.slice(0, 10) === selDay && !seqStoryIds.has(s.id);
  });

  const dayStoriesHtml = dayStories.length ? dayStories.map(s => `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow:hidden;min-width:130px;max-width:130px;flex-shrink:0;">
      <div style="width:100%;aspect-ratio:9/16;background:var(--bg3);display:flex;align-items:center;justify-content:center;">
        ${s.thumbnail_url || s.ig_media_url
          ? `<img src="${escHtml(s.thumbnail_url || s.ig_media_url)}" style="width:100%;height:100%;object-fit:cover;">`
          : '<i class="fas fa-image" style="font-size:20px;color:var(--text3);opacity:0.3;"></i>'}
      </div>
      <div style="padding:8px;">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:4px;">
          <span><strong>${s.impressions || 0}</strong> vues</span>
          <span><strong>${s.reach || 0}</strong> reach</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);">
          <span>${s.replies || 0} DMs</span>
          <span>${s.exits || 0} nav</span>
        </div>
      </div>
    </div>`).join('') : '';

  // ── All sequences list ──
  const allSeqList = sequences.map(seq => {
    const t = IG_SEQ_TYPES[seq.sequence_type] || { label: seq.sequence_type, color: '#6b7280' };
    const seqItems = items.filter(i => i.sequence_id === seq.id);
    const date = (seq.published_at || seq.created_at || '').slice(0, 10);
    const dateLabel = date ? new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
    return `
      <tr class="nd-tr" style="cursor:pointer;" onclick="_bizIgShowSequenceDetail('${seq.id}')">
        <td style="font-size:12px;font-weight:600;color:var(--text);">${escHtml(seq.name)}</td>
        <td><span style="font-size:10px;padding:2px 8px;border-radius:8px;background:${t.color}20;color:${t.color};font-weight:600;">${escHtml(t.label)}</span></td>
        <td style="font-size:12px;color:var(--text2);">${seqItems.length}</td>
        <td style="font-size:12px;color:var(--text2);">${seq.total_impressions || 0}</td>
        <td style="font-size:12px;color:var(--text2);">${seq.overall_dropoff_rate != null ? seq.overall_dropoff_rate + '%' : '—'}</td>
        <td style="font-size:12px;color:var(--text3);">${dateLabel}</td>
      </tr>`;
  }).join('');

  ct.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:20px;">
      <button class="btn btn-outline btn-sm" style="width:36px;height:36px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:10px;" onclick="window._bizIgStoryWeekOffset--;window._bizIgSelectedDay=null;_renderIgStoriesView()"><i class="fas fa-chevron-left"></i></button>
      <span style="font-size:15px;font-weight:700;color:var(--text);min-width:220px;text-align:center;">${weekLabel}</span>
      <button class="btn btn-outline btn-sm" style="width:36px;height:36px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:10px;" onclick="window._bizIgStoryWeekOffset++;window._bizIgSelectedDay=null;_renderIgStoriesView()"><i class="fas fa-chevron-right"></i></button>
    </div>

    <div style="display:flex;gap:0;margin-bottom:24px;background:var(--bg2);border-radius:14px;border:1px solid var(--border);overflow:hidden;">${daysHtml}</div>

    <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
      <button class="btn btn-red btn-sm" onclick="_bizIgCreateSequenceModal()"><i class="fas fa-plus" style="margin-right:4px;"></i>Nouvelle Séquence</button>
    </div>

    ${dayContent}

    ${dayStoriesHtml ? `
    <div style="margin-top:20px;">
      <h3 style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:10px;">Stories du jour (hors séquence)</h3>
      <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;">${dayStoriesHtml}</div>
    </div>` : ''}

    <div style="margin-top:24px;border-top:1px solid var(--border);padding-top:20px;">
      <h3 style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px;">Toutes les séquences</h3>
      ${sequences.length ? `
      <div class="nd-table-wrap">
        <table class="nd-table">
          <thead><tr><th>Nom</th><th>Type</th><th>Stories</th><th>Impressions</th><th>Drop-off</th><th>Date</th></tr></thead>
          <tbody>${allSeqList}</tbody>
        </table>
      </div>` : '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">Aucune séquence créée</div>'}
    </div>`;
}

// ── Sequence detail with funnel ──
function _bizIgShowSequenceDetail(seqId) {
  const seq = (window._bizIgSequences || []).find(s => s.id === seqId);
  if (!seq) return;

  const items = (window._bizIgSequenceItems || []).filter(i => i.sequence_id === seqId).sort((a, b) => (a.position || 0) - (b.position || 0));
  const t = IG_SEQ_TYPES[seq.sequence_type] || { label: seq.sequence_type, color: '#6b7280' };

  // Build funnel bars
  const maxImpressions = Math.max(...items.map(i => i.impressions || 0), 1);
  const funnelBars = items.map((item, idx) => {
    const pct = ((item.impressions || 0) / maxImpressions * 100);
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <span style="font-size:10px;color:var(--text3);width:60px;text-align:right;">Story ${idx + 1}</span>
        <div style="flex:1;background:var(--bg3);border-radius:4px;height:24px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${t.color};border-radius:4px;display:flex;align-items:center;padding-left:8px;">
            <span style="font-size:10px;color:#fff;font-weight:600;">${item.impressions || 0}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  const ct = document.getElementById('biz-ig-content');
  ct.innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="_renderIgStoriesView()" style="margin-bottom:16px;"><i class="fas fa-arrow-left" style="margin-right:4px;"></i>Retour</button>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
      <h3 style="font-size:18px;font-weight:700;color:var(--text);margin:0;">${escHtml(seq.name)}</h3>
      <span style="font-size:11px;padding:3px 10px;border-radius:8px;background:${t.color}20;color:${t.color};font-weight:600;">${escHtml(t.label)}</span>
    </div>
    ${seq.objective ? `<div style="font-size:12px;color:var(--text3);margin-bottom:16px;"><strong>Objectif :</strong> ${escHtml(seq.objective)}</div>` : ''}
    ${seq.notes ? `<div style="font-size:12px;color:var(--text3);margin-bottom:16px;"><strong>Notes :</strong> ${escHtml(seq.notes)}</div>` : ''}

    <div style="margin-bottom:20px;">
      <div style="display:flex;gap:20px;font-size:13px;color:var(--text2);margin-bottom:16px;">
        <span><strong>${items.length}</strong> stories</span>
        <span><strong>${seq.total_impressions || 0}</strong> impressions</span>
        <span>Drop-off : <strong>${seq.overall_dropoff_rate != null ? seq.overall_dropoff_rate + '%' : '—'}</strong></span>
        <span><strong>${seq.total_replies || 0}</strong> replies</span>
      </div>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <h4 style="font-size:14px;font-weight:600;color:var(--text);margin:0;">Funnel de rétention</h4>
      <button class="btn btn-red btn-sm" onclick="_bizIgAddStoriesToSeq('${seqId}')"><i class="fas fa-plus" style="margin-right:4px;"></i>Ajouter des stories</button>
    </div>
    ${items.length
      ? `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;">${funnelBars}</div>`
      : '<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">Aucune story dans cette séquence — ajoutez-en avec le bouton ci-dessus</div>'}

    ${items.length ? `<h4 style="font-size:14px;font-weight:600;color:var(--text);margin:16px 0 12px;">Stories dans la séquence</h4>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      ${items.map((item, idx) => {
        const story = (window._bizIgStories || []).find(s => s.id === item.story_id);
        return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;width:100px;overflow:hidden;text-align:center;">
          <div style="width:100%;aspect-ratio:9/16;background:var(--bg3);display:flex;align-items:center;justify-content:center;">
            ${story?.thumbnail_url || story?.ig_media_url
              ? '<img src="' + escHtml(story.thumbnail_url || story.ig_media_url) + '" style="width:100%;height:100%;object-fit:cover;">'
              : '<i class="fas fa-image" style="color:var(--text3);"></i>'}
          </div>
          <div style="padding:4px;font-size:10px;color:var(--text3);">Story ${idx + 1}</div>
        </div>`;
      }).join('')}
    </div>` : ''}`;
}

// ── Add stories to sequence modal ──
function _bizIgAddStoriesToSeq(seqId) {
  const stories = window._bizIgStories || [];
  const existingItems = (window._bizIgSequenceItems || []).filter(i => i.sequence_id === seqId);
  const existingStoryIds = existingItems.map(i => i.story_id);

  if (!stories.length) {
    notify('Aucune story disponible. Synchronisez vos stories Instagram.', 'error');
    return;
  }

  const storyOptions = stories.map(s => {
    const checked = existingStoryIds.includes(s.id) ? 'checked' : '';
    const date = s.published_at ? new Date(s.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
    return `
      <label style="display:flex;align-items:center;gap:10px;padding:8px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--bg2);">
        <input type="checkbox" value="${s.id}" ${checked} style="accent-color:var(--primary);">
        <div style="width:36px;height:50px;border-radius:4px;overflow:hidden;background:var(--bg3);flex-shrink:0;display:flex;align-items:center;justify-content:center;">
          ${s.thumbnail_url || s.ig_media_url
            ? '<img src="' + escHtml(s.thumbnail_url || s.ig_media_url) + '" style="width:100%;height:100%;object-fit:cover;">'
            : '<i class="fas fa-image" style="font-size:10px;color:var(--text3);"></i>'}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:11px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml((s.caption || '').slice(0, 40)) || 'Story'}</div>
          <div style="font-size:10px;color:var(--text3);">${date} — ${s.impressions || 0} imp.</div>
        </div>
      </label>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.id = 'ig-seq-stories-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';
  overlay.innerHTML = `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:28px;width:460px;max-width:90vw;max-height:80vh;display:flex;flex-direction:column;">
      <h3 style="font-size:18px;font-weight:700;color:var(--text);margin:0 0 16px;">Sélectionner les stories</h3>
      <div id="ig-seq-story-list" style="display:flex;flex-direction:column;gap:6px;overflow-y:auto;flex:1;margin-bottom:16px;">
        ${storyOptions}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-outline" onclick="document.getElementById('ig-seq-stories-modal').remove()">Annuler</button>
        <button class="btn btn-red" onclick="_bizIgSaveSeqStories('${seqId}')">Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

async function _bizIgSaveSeqStories(seqId) {
  const checkboxes = document.querySelectorAll('#ig-seq-story-list input[type=checkbox]:checked');
  const selectedIds = Array.from(checkboxes).map(cb => cb.value);

  // Delete existing items
  await supabaseClient.from('story_sequence_items').delete().eq('sequence_id', seqId);

  // Insert new items
  if (selectedIds.length) {
    const inserts = selectedIds.map((storyId, idx) => ({
      sequence_id: seqId,
      story_id: storyId,
      position: idx + 1,
    }));
    const { error } = await supabaseClient.from('story_sequence_items').insert(inserts);
    if (error) { handleError(error, 'ig-seq-add-stories'); return; }
  }

  document.getElementById('ig-seq-stories-modal')?.remove();
  notify(`${selectedIds.length} stories ajoutées`, 'success');
  await bizRenderIgStories();
  _bizIgShowSequenceDetail(seqId);
}

// ── Create sequence modal ──
function _bizIgCreateSequenceModal() {
  const typeOptions = Object.entries(IG_SEQ_TYPES).map(([k, v]) =>
    `<option value="${k}">${v.label}</option>`
  ).join('');

  const overlay = document.createElement('div');
  overlay.id = 'ig-seq-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';
  overlay.innerHTML = `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:28px;width:420px;max-width:90vw;">
      <h3 style="font-size:18px;font-weight:700;color:var(--text);margin:0 0 20px;">Nouvelle Séquence</h3>
      <label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Nom</label>
      <input type="text" id="ig-seq-name" class="bt-input" placeholder="Ex: Séquence confiance semaine 3" style="margin-bottom:12px;">

      <label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Type</label>
      <select id="ig-seq-type" class="bt-input" style="margin-bottom:12px;">${typeOptions}</select>

      <label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Objectif</label>
      <input type="text" id="ig-seq-objective" class="bt-input" placeholder="Ex: Générer 10 réponses DM" style="margin-bottom:12px;">

      <label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Notes</label>
      <textarea id="ig-seq-notes" class="bt-input" rows="3" placeholder="Notes libres..." style="margin-bottom:16px;resize:vertical;"></textarea>

      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-outline" onclick="document.getElementById('ig-seq-modal').remove()">Annuler</button>
        <button class="btn btn-red" onclick="_bizIgSaveSequence()">Créer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

async function _bizIgSaveSequence() {
  const name = document.getElementById('ig-seq-name').value.trim();
  const type = document.getElementById('ig-seq-type').value;
  const objective = document.getElementById('ig-seq-objective').value.trim();
  const notes = document.getElementById('ig-seq-notes').value.trim();

  if (!name) { notify('Le nom est obligatoire', 'error'); return; }

  const { error } = await supabaseClient.from('story_sequences').insert({
    user_id: currentUser.id,
    name,
    sequence_type: type,
    objective: objective || null,
    notes: notes || null,
    status: 'draft',
  });

  if (error) { handleError(error, 'ig-create-sequence'); return; }

  document.getElementById('ig-seq-modal')?.remove();
  notify('Séquence créée', 'success');
  await bizRenderIgStories();
}

async function _bizIgDeleteSequence(seqId, seqName) {
  if (!confirm(`Supprimer la séquence "${seqName}" ? Les stories ne seront pas supprimées.`)) return;

  // Delete sequence items first (cascade should handle it but just in case)
  await supabaseClient.from('story_sequence_items').delete().eq('sequence_id', seqId);
  const { error } = await supabaseClient.from('story_sequences').delete().eq('id', seqId);

  if (error) { handleError(error, 'ig-delete-sequence'); return; }

  notify('Séquence supprimée', 'success');
  await bizRenderIgStories();
}

// ═══════════════════════════════════════
// ── REELS TAB ──
// ═══════════════════════════════════════

async function bizRenderIgReels() {
  const ct = document.getElementById('biz-ig-content');

  try {
    const [reelsRes, pillarsRes] = await Promise.all([
      supabaseClient.from('ig_reels').select('*').eq('user_id', currentUser.id).order('published_at', { ascending: false }),
      supabaseClient.from('ig_content_pillars').select('*').eq('user_id', currentUser.id).order('name'),
    ]);
    window._bizIgReels = reelsRes.data || [];
    window._bizIgPillars = pillarsRes.data || [];
  } catch (e) {
    handleError(e, 'ig-reels');
  }

  _renderIgReelsView(ct);
}

function _renderIgReelsView(ct) {
  if (!ct) ct = document.getElementById('biz-ig-content');
  const reels = window._bizIgReels || [];
  const pillars = window._bizIgPillars || [];

  if (!reels.length && !pillars.length) {
    ct.innerHTML = `
      <div style="text-align:center;padding:60px;">
        <i class="fas fa-film" style="font-size:48px;color:var(--text3);margin-bottom:16px;display:block;opacity:0.4;"></i>
        <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:8px;">Aucun reel importé</div>
        <div style="font-size:13px;color:var(--text3);">Connectez votre Instagram pour importer vos reels et analyser vos performances</div>
      </div>`;
    return;
  }

  // KPIs
  const totalViews = reels.reduce((s, r) => s + (r.views || 0), 0);
  const totalReels = reels.length;
  const avgEngagement = totalReels ? (reels.reduce((s, r) => s + (r.engagement_rate || 0), 0) / totalReels).toFixed(2) : 0;
  const avgReach = totalReels ? Math.round(reels.reduce((s, r) => s + (r.reach || 0), 0) / totalReels) : 0;

  const kpiCard = (label, value, icon) => `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;text-align:center;">
      <i class="fas ${icon}" style="font-size:18px;color:var(--primary);margin-bottom:8px;display:block;"></i>
      <div style="font-size:22px;font-weight:700;color:var(--text);">${value}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px;">${label}</div>
    </div>`;

  // Top performing reels table
  const sortedReels = [...reels].sort((a, b) => (b.views || 0) - (a.views || 0));
  const reelRows = sortedReels.map(r => {
    const caption = (r.caption || '').length > 50 ? escHtml(r.caption.slice(0, 50)) + '...' : escHtml(r.caption || '—');
    const pillar = pillars.find(p => p.id === r.pillar_id);
    const pillarTag = pillar
      ? `<span style="font-size:10px;padding:2px 8px;border-radius:8px;background:${escHtml(pillar.color || '#6b7280')}20;color:${escHtml(pillar.color || '#6b7280')};font-weight:600;">${escHtml(pillar.name)}</span>`
      : '<span style="color:var(--text3);font-size:10px;">—</span>';
    const thumb = r.thumbnail_url
      ? `<img src="${escHtml(r.thumbnail_url)}" style="width:40px;height:54px;object-fit:cover;border-radius:4px;cursor:pointer;" onclick="_bizIgPlayReel('${r.id}')">`
      : `<div style="width:40px;height:54px;background:var(--bg3);border-radius:4px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-film" style="font-size:12px;color:var(--text3);"></i></div>`;
    return `
      <tr class="nd-tr" style="cursor:pointer;" onclick="_bizIgPlayReel('${r.id}')">
        <td style="padding:6px 8px;">${thumb}</td>
        <td style="font-size:12px;color:var(--text);max-width:200px;">${caption}</td>
        <td>${pillarTag}</td>
        <td style="font-size:12px;color:var(--text2);">${(r.views || 0).toLocaleString()}</td>
        <td style="font-size:12px;color:var(--text2);">${r.saves || 0}</td>
        <td style="font-size:12px;color:var(--text2);">${r.shares || 0}</td>
        <td style="font-size:12px;color:var(--text2);">${r.comments || 0}</td>
      </tr>`;
  }).join('');

  // Content pillars section
  const pillarsList = pillars.map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:6px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${escHtml(p.color || '#6b7280')};"></div>
        <span style="font-size:13px;font-weight:600;color:var(--text);">${escHtml(p.name)}</span>
        <span style="font-size:11px;color:var(--text3);">${reels.filter(r => r.pillar_id === p.id).length} reels</span>
      </div>
      <div style="display:flex;gap:4px;">
        <button class="nd2-btn nd2-btn-sm" onclick="_bizIgEditPillar('${p.id}')" title="Modifier"><i class="fas fa-pen" style="font-size:10px;"></i></button>
        <button class="nd2-btn nd2-btn-del nd2-btn-sm" onclick="_bizIgDeletePillar('${p.id}')" title="Supprimer"><i class="fas fa-trash" style="font-size:10px;"></i></button>
      </div>
    </div>`).join('');

  ct.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
      ${kpiCard('Total Views', totalViews.toLocaleString(), 'fa-play')}
      ${kpiCard('Avg Engagement', avgEngagement + '%', 'fa-heart')}
      ${kpiCard('Total Reels', totalReels, 'fa-film')}
      ${kpiCard('Avg Reach', avgReach.toLocaleString(), 'fa-bullseye')}
    </div>

    <h3 style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:12px;">Top Performing Reels</h3>
    ${reels.length ? `
    <div class="nd-table-wrap" style="margin-bottom:28px;">
      <table class="nd-table">
        <thead><tr><th></th><th>Caption</th><th>Pillar</th><th>Views</th><th>Saves</th><th>Shares</th><th>Comments</th></tr></thead>
        <tbody>${reelRows}</tbody>
      </table>
    </div>` : ''}

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <h3 style="font-size:16px;font-weight:700;color:var(--text);margin:0;">Content Pillars</h3>
      <button class="btn btn-red btn-sm" onclick="_bizIgAddPillarModal()"><i class="fas fa-plus" style="margin-right:4px;"></i>Ajouter</button>
    </div>
    ${pillars.length ? pillarsList : '<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">Aucun pilier de contenu défini</div>'}`;
}

// ── Play reel modal ──
function _bizIgPlayReel(reelId) {
  const reel = (window._bizIgReels || []).find(r => r.id === reelId);
  if (!reel) return;

  const caption = reel.caption || '';
  const date = reel.published_at ? new Date(reel.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  const overlay = document.createElement('div');
  overlay.id = 'ig-reel-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;';
  overlay.innerHTML = `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:14px;overflow:hidden;max-width:420px;width:90vw;max-height:90vh;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);">
        <span style="font-size:13px;font-weight:600;color:var(--text);">${date}</span>
        <button onclick="document.getElementById('ig-reel-modal').remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px;"><i class="fas fa-times"></i></button>
      </div>
      ${reel.video_url
        ? `<video src="${escHtml(reel.video_url)}" controls autoplay playsinline style="width:100%;max-height:70vh;background:#000;"></video>`
        : reel.thumbnail_url
          ? `<img src="${escHtml(reel.thumbnail_url)}" style="width:100%;max-height:70vh;object-fit:contain;background:#000;">`
          : '<div style="padding:60px;text-align:center;color:var(--text3);">Vidéo non disponible</div>'}
      <div style="padding:12px 16px;overflow-y:auto;max-height:150px;">
        <div style="display:flex;gap:16px;font-size:12px;color:var(--text2);margin-bottom:8px;">
          <span><i class="fas fa-eye" style="margin-right:3px;"></i>${(reel.views || 0).toLocaleString()}</span>
          <span><i class="fas fa-heart" style="margin-right:3px;"></i>${reel.likes || 0}</span>
          <span><i class="fas fa-comment" style="margin-right:3px;"></i>${reel.comments || 0}</span>
          <span><i class="fas fa-share" style="margin-right:3px;"></i>${reel.shares || 0}</span>
          <span><i class="fas fa-bookmark" style="margin-right:3px;"></i>${reel.saves || 0}</span>
          <span><i class="fas fa-bullseye" style="margin-right:3px;"></i>${(reel.reach || 0).toLocaleString()}</span>
        </div>
        <div style="font-size:12px;color:var(--text);white-space:pre-line;">${escHtml(caption)}</div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ── Pillar CRUD ──
function _bizIgAddPillarModal() {
  const overlay = document.createElement('div');
  overlay.id = 'ig-pillar-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';
  overlay.innerHTML = `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:28px;width:360px;max-width:90vw;">
      <h3 style="font-size:18px;font-weight:700;color:var(--text);margin:0 0 20px;">Nouveau Pilier</h3>
      <label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Nom</label>
      <input type="text" id="ig-pillar-name" class="bt-input" placeholder="Ex: Éducation fitness" style="margin-bottom:12px;">
      <label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Couleur</label>
      <input type="color" id="ig-pillar-color" value="#3b82f6" style="margin-bottom:16px;width:50px;height:32px;border:none;cursor:pointer;background:transparent;">
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-outline" onclick="document.getElementById('ig-pillar-modal').remove()">Annuler</button>
        <button class="btn btn-red" onclick="_bizIgSavePillar()">Créer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

async function _bizIgSavePillar(editId) {
  const name = document.getElementById('ig-pillar-name').value.trim();
  const color = document.getElementById('ig-pillar-color').value;
  if (!name) { notify('Le nom est obligatoire', 'error'); return; }

  if (editId) {
    const { error } = await supabaseClient.from('ig_content_pillars').update({ name, color }).eq('id', editId);
    if (error) { handleError(error, 'ig-pillar-edit'); return; }
    notify('Pilier mis à jour', 'success');
  } else {
    const { error } = await supabaseClient.from('ig_content_pillars').insert({ user_id: currentUser.id, name, color });
    if (error) { handleError(error, 'ig-pillar-add'); return; }
    notify('Pilier créé', 'success');
  }

  document.getElementById('ig-pillar-modal')?.remove();
  await bizRenderIgReels();
}

function _bizIgEditPillar(id) {
  const pillar = (window._bizIgPillars || []).find(p => p.id === id);
  if (!pillar) return;

  const overlay = document.createElement('div');
  overlay.id = 'ig-pillar-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';
  overlay.innerHTML = `
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:28px;width:360px;max-width:90vw;">
      <h3 style="font-size:18px;font-weight:700;color:var(--text);margin:0 0 20px;">Modifier le Pilier</h3>
      <label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Nom</label>
      <input type="text" id="ig-pillar-name" class="bt-input" value="${escHtml(pillar.name)}" style="margin-bottom:12px;">
      <label style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Couleur</label>
      <input type="color" id="ig-pillar-color" value="${escHtml(pillar.color || '#3b82f6')}" style="margin-bottom:16px;width:50px;height:32px;border:none;cursor:pointer;background:transparent;">
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-outline" onclick="document.getElementById('ig-pillar-modal').remove()">Annuler</button>
        <button class="btn btn-red" onclick="_bizIgSavePillar('${id}')">Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

async function _bizIgDeletePillar(id) {
  if (!confirm('Supprimer ce pilier ?')) return;
  const { error } = await supabaseClient.from('ig_content_pillars').delete().eq('id', id);
  if (error) { handleError(error, 'ig-pillar-delete'); return; }
  notify('Pilier supprimé', 'success');
  await bizRenderIgReels();
}

// ═══════════════════════════════════════
// ── OVERVIEW TAB ──
// ═══════════════════════════════════════

async function bizRenderIgOverview() {
  const ct = document.getElementById('biz-ig-content');

  try {
    const { data } = await supabaseClient.from('ig_accounts').select('*').eq('user_id', currentUser.id).single();
    window._bizIgAccount = data || null;
  } catch (e) {
    window._bizIgAccount = null;
  }

  const acct = window._bizIgAccount;

  if (!acct) {
    ct.innerHTML = `
      <div style="text-align:center;padding:60px;">
        <i class="fab fa-instagram" style="font-size:48px;color:var(--text3);margin-bottom:16px;display:block;opacity:0.4;"></i>
        <div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:8px;">Aucun compte connecté</div>
        <div style="font-size:13px;color:var(--text3);margin-bottom:20px;">Connectez votre compte Instagram pour voir vos statistiques</div>
        <button class="btn btn-red" onclick="bizConnectInstagram()"><i class="fab fa-instagram" style="margin-right:6px;"></i>Connecter Instagram</button>
        <div style="font-size:11px;color:var(--text3);margin-top:12px;">Nécessite un compte Instagram Business ou Creator lié à une Page Facebook</div>
      </div>`;
    return;
  }

  // Fetch live data from Instagram API
  let profile = {};
  try {
    const resp = await fetch(`https://graph.instagram.com/v25.0/me?fields=username,name,biography,followers_count,follows_count,media_count,profile_picture_url&access_token=${acct.access_token}`);
    profile = await resp.json();
  } catch (e) { devError('[IG Profile]', e); }

  const followers = profile.followers_count || 0;
  const following = profile.follows_count || 0;
  const posts = profile.media_count || 0;

  // Calculate engagement from reels data
  const reels = window._bizIgReels || [];
  const totalReach = reels.reduce((s, r) => s + (r.reach || 0), 0);
  const avgEngagement = reels.length ? (reels.reduce((s, r) => s + (r.engagement_rate || 0), 0) / reels.length).toFixed(2) : '0.00';

  const kpiCard = (label, value, icon) => `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:20px;text-align:center;">
      <i class="fas ${icon}" style="font-size:20px;color:var(--primary);margin-bottom:10px;display:block;"></i>
      <div style="font-size:26px;font-weight:700;color:var(--text);">${value}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:4px;">${label}</div>
    </div>`;

  ct.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);display:flex;align-items:center;justify-content:center;overflow:hidden;">
        ${profile.profile_picture_url
          ? `<img src="${profile.profile_picture_url}" style="width:100%;height:100%;object-fit:cover;">`
          : '<i class="fab fa-instagram" style="color:#fff;font-size:22px;"></i>'}
      </div>
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--text);">@${escHtml(acct.ig_username || profile.username || '')}</div>
        <div style="font-size:12px;color:var(--text3);">Compte connecté</div>
      </div>
      <div style="flex:1;"></div>
      <button class="btn btn-outline btn-sm" onclick="bizSyncIgData().then(()=>bizRenderInstagram())"><i class="fas fa-sync"></i> Synchroniser</button>
      <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="bizDisconnectIg()"><i class="fas fa-unlink"></i></button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;">
      ${kpiCard('Followers', followers.toLocaleString(), 'fa-users')}
      ${kpiCard('Following', following.toLocaleString(), 'fa-user-plus')}
      ${kpiCard('Posts', posts.toLocaleString(), 'fa-images')}
      ${kpiCard('Engagement', avgEngagement + '%', 'fa-heart')}
      ${kpiCard('Total Reach', totalReach.toLocaleString(), 'fa-bullseye')}
    </div>
    ${profile.biography ? `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;margin-top:16px;"><div style="font-size:11px;color:var(--text3);margin-bottom:4px;">Bio</div><div style="font-size:13px;color:var(--text);white-space:pre-line;">${escHtml(profile.biography)}</div></div>` : ''}`;
}

async function bizDisconnectIg() {
  if (!confirm('Déconnecter votre compte Instagram ?')) return;
  await supabaseClient.from('ig_accounts').delete().eq('user_id', currentUser.id);
  window._bizIgAccount = null;
  notify('Instagram déconnecté', 'success');
  bizRenderInstagram();
}
