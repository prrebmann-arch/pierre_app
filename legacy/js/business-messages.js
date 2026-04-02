// ===== BUSINESS — MESSAGES INBOX (Live Instagram DMs) =====

window._bizConversations = [];
window._bizMessages = [];
window._bizSelectedConvo = null;
window._bizIgAccount = null;

let _msgSearch = '';

// Facebook App ID (main app ID, NOT Instagram App ID)
const FB_APP_ID = '1305972064754138';

// ── Get Instagram account info ──
async function _bizGetIgAccount() {
  if (window._bizIgAccount) return window._bizIgAccount;
  const { data } = await supabaseClient
    .from('ig_accounts')
    .select('*')
    .eq('user_id', currentUser.id)
    .single();
  window._bizIgAccount = data;
  return data;
}

// ── Facebook Login for Page Access Token (needed for DMs) ──
function bizConnectFacebookPage() {
  const redirectUri = encodeURIComponent('https://pierreapp.vercel.app/');
  const configId = '1379162567352838';
  const authUrl = `https://www.facebook.com/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${redirectUri}&response_type=code&config_id=${configId}&state=fb_page_auth`;

  console.log('[Messages] Redirecting to Facebook Login:', authUrl);
  window.location.href = authUrl;
}

// Handle Facebook OAuth callback
async function _bizCheckFbCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code || state !== 'fb_page_auth') return;

  // Clean URL
  window.history.replaceState({}, '', window.location.pathname + window.location.hash);

  // Wait for user auth
  const user = await _bizWaitForUser(15000);
  if (!user) {
    notify('Session expirée. Reconnectez-vous.', 'error');
    return;
  }

  notify('Connexion Facebook en cours...', 'success');

  try {
    const resp = await authFetch('/api/fb-page-auth', {
      method: 'POST',
      body: JSON.stringify({ code, redirect_uri: 'https://pierreapp.vercel.app/', ig_user_id: (await _bizGetIgAccount())?.ig_user_id }),
    });
    const data = await resp.json();

    if (!resp.ok || data.error) {
      notify('Erreur Facebook: ' + (data.error || `HTTP ${resp.status}`), 'error');
      console.error('[FB Auth] Error:', data);
      return;
    }

    // Save page_id and page_access_token to ig_accounts
    const { error } = await supabaseClient.from('ig_accounts').update({
      page_id: data.page_id,
      page_access_token: data.page_access_token,
    }).eq('user_id', user.id);

    if (error) {
      handleError(error, 'fb-page-auth');
      return;
    }

    window._bizIgAccount = null; // Force refresh
    notify(`Page Facebook "${data.page_name}" connectée !`, 'success');

    // Redirect to Business Messages tab
    window.location.hash = '#business';
    window.location.reload();
  } catch (err) {
    notify('Erreur connexion Facebook', 'error');
    console.error('[FB Auth]', err);
  }
}

// Check for FB callback on page load
if (new URLSearchParams(window.location.search).get('state') === 'fb_page_auth') {
  if (typeof currentUser !== 'undefined' && currentUser) {
    _bizCheckFbCallback();
  } else {
    window.addEventListener('load', () => setTimeout(_bizCheckFbCallback, 2000));
  }
}

// ── Data layer — read from Supabase (instant), sync from Instagram in background ──
async function _bizLoadConversations() {
  const acct = await _bizGetIgAccount();
  if (!acct?.page_access_token || !acct?.ig_user_id) {
    window._bizConversations = [];
    return [];
  }

  try {
    // Read from Supabase (instant)
    console.log('[Messages] Loading conversations from Supabase');
    const resp = await authFetch('/api/ig-messages', {
      method: 'POST',
      body: JSON.stringify({
        action: 'conversations',
        user_id: currentUser.id,
      }),
    });
    const data = await resp.json();

    if (data.error) {
      console.error('[Messages] API error:', data.error);
      notify('Erreur messages: ' + data.error, 'error');
      window._bizConversations = [];
      return [];
    }

    const convos = (data.data || []).map(c => ({
      id: c.id,
      participant_id: c.participant_ig_id || '',
      participant_name: c.participant_name || 'Inconnu',
      last_message: c.last_message_text || '',
      last_message_at: c.last_message_at || null,
    }));

    window._bizConversations = convos;
    return convos;
  } catch (err) {
    console.error('[Messages] Fetch error:', err);
    window._bizConversations = [];
    return [];
  }
}

async function _bizLoadMessages(threadId) {
  const acct = await _bizGetIgAccount();
  if (!acct?.ig_user_id) {
    window._bizMessages = [];
    return [];
  }

  try {
    const resp = await authFetch('/api/ig-messages', {
      method: 'POST',
      body: JSON.stringify({
        action: 'thread',
        thread_id: threadId,
        user_id: currentUser.id,
      }),
    });
    const data = await resp.json();

    if (data.error) {
      console.error('[Messages] Thread error:', data.error);
      window._bizMessages = [];
      return [];
    }

    const messages = (data.messages || []).map(m => ({
      id: m.id,
      sender: m.sender || 'participant',
      sender_name: '',
      text: m.message_text || '',
      created_at: m.sent_at || null,
    }));

    window._bizMessages = messages;
    return messages;
  } catch (err) {
    console.error('[Messages] Thread fetch error:', err);
    window._bizMessages = [];
    return [];
  }
}

// ── Background sync — pull from Instagram API and store in Supabase ──
async function _bizSyncMessages() {
  const acct = await _bizGetIgAccount();
  if (!acct?.page_access_token || !acct?.ig_user_id) return;

  try {
    console.log('[Messages] Starting background sync...');
    const resp = await authFetch('/api/ig-messages', {
      method: 'POST',
      body: JSON.stringify({
        action: 'sync',
        user_id: currentUser.id,
        ig_user_id: acct.ig_user_id,
        page_id: acct.page_id,
        page_access_token: acct.page_access_token,
      }),
    });
    const data = await resp.json();
    if (data.success) {
      console.log(`[Messages] Sync done: ${data.conversations} convos, ${data.messages} msgs`);
      // Reload UI with fresh data
      await _bizLoadConversations();
      _bizRenderConvoList();
    } else {
      console.error('[Messages] Sync error:', data.error);
    }
  } catch (err) {
    console.error('[Messages] Sync error:', err);
  }
}

// ── Helpers ──
function _bizTimeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const d = new Date(date);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return Math.floor(diff / 60) + ' min';
  if (diff < 86400) return Math.floor(diff / 3600) + ' h';
  if (diff < 604800) return Math.floor(diff / 86400) + ' j';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function _bizFormatMsgTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ── Main render ──
async function bizRenderMessages() {
  const el = document.getElementById('biz-tab-content');
  el.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';

  const acct = await _bizGetIgAccount();

  // Not connected to Instagram at all
  if (!acct?.access_token) {
    el.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text3);"><i class="fab fa-instagram" style="font-size:32px;margin-bottom:12px;display:block;opacity:0.3;"></i>Connectez votre Instagram pour accéder aux messages.</div>';
    return;
  }

  // Instagram connected but no Page token → need Facebook Login
  if (!acct.page_access_token) {
    el.innerHTML = `
      <div style="text-align:center;padding:60px;">
        <i class="fab fa-facebook" style="font-size:40px;color:#1877F2;margin-bottom:16px;display:block;"></i>
        <h3 style="margin:0 0 8px;color:var(--text);">Connecter Facebook pour les messages</h3>
        <p style="color:var(--text3);font-size:13px;margin-bottom:20px;max-width:400px;margin-left:auto;margin-right:auto;">
          Pour lire et répondre à tes DMs Instagram depuis l'app, tu dois connecter ta Page Facebook liée à ton compte Instagram.
        </p>
        <button onclick="bizConnectFacebookPage()" class="btn btn-red" style="padding:10px 24px;font-size:14px;">
          <i class="fab fa-facebook" style="margin-right:8px;"></i> Connecter ma Page Facebook
        </button>
      </div>`;
    return;
  }

  // Full access — load conversations from Supabase (instant) + sync in background
  await _bizLoadConversations();

  // If no local data, show setup message
  if (window._bizConversations.length === 0) {
    // Try sync anyway (will refresh existing convos if any)
    await _bizSyncMessages();
    await _bizLoadConversations();
  } else {
    // Sync in background (non-blocking)
    _bizSyncMessages();
  }

  // Still empty after sync = webhook needs to capture first messages
  if (window._bizConversations.length === 0) {
    el.innerHTML = `
      <div style="text-align:center;padding:60px;color:var(--text3);">
        <i class="fab fa-instagram" style="font-size:40px;margin-bottom:16px;display:block;opacity:0.3;"></i>
        <h3 style="color:var(--text);margin:0 0 8px;">En attente de messages</h3>
        <p style="font-size:13px;max-width:400px;margin:0 auto;">
          Les nouveaux messages Instagram arriveront ici automatiquement.<br>
          Envoie ou reçois un message sur Instagram pour commencer.
        </p>
        <button onclick="_bizRefreshMessages()" class="btn btn-sm" style="margin-top:16px;padding:8px 16px;">
          <i class="fas fa-sync-alt"></i> Rafraîchir
        </button>
        <br>
        <button onclick="bizDisconnectMessages()" class="btn btn-sm" style="margin-top:12px;padding:6px 14px;opacity:0.5;">
          <i class="fas fa-sign-out-alt"></i> Déconnecter Facebook
        </button>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="msg-container">
      <div class="msg-sidebar">
        <div class="msg-sidebar-header">
          <input type="text" id="msg-search" class="msg-search" placeholder="Rechercher..." value="${escHtml(_msgSearch)}" oninput="_msgSearch=this.value;_bizRenderConvoList()">
          <div class="msg-sidebar-actions">
            <button class="msg-sidebar-btn" onclick="_bizRefreshMessages()" title="Rafraîchir"><i class="fas fa-sync-alt"></i></button>
            <button class="msg-sidebar-btn" onclick="bizDisconnectMessages()" title="Déconnecter" style="opacity:0.5;"><i class="fas fa-sign-out-alt"></i></button>
          </div>
        </div>
        <div id="msg-convo-items" class="msg-convo-list"></div>
      </div>
      <div id="msg-thread" class="msg-thread">
        <div class="msg-empty">
          <div><i class="fas fa-comments" style="font-size:28px;margin-bottom:10px;display:block;opacity:0.25;"></i>Sélectionne une conversation</div>
        </div>
      </div>
    </div>`;

  _bizRenderConvoList();

  if (window._bizConversations.length > 0 && !window._bizSelectedConvo) {
    bizSelectConversation(window._bizConversations[0].id);
  } else if (window._bizSelectedConvo) {
    bizSelectConversation(window._bizSelectedConvo);
  }
}

async function _bizRefreshMessages() {
  window._bizIgAccount = null;
  notify('Synchronisation Instagram en cours...', 'success');
  await _bizSyncMessages();
  if (window._bizSelectedConvo) {
    await bizSelectConversation(window._bizSelectedConvo);
  }
}

function _bizRenderConvoList() {
  const container = document.getElementById('msg-convo-items');
  if (!container) return;

  let convos = window._bizConversations || [];

  if (_msgSearch) {
    const s = _msgSearch.toLowerCase();
    convos = convos.filter(c =>
      (c.participant_name || '').toLowerCase().includes(s) ||
      (c.last_message || '').toLowerCase().includes(s)
    );
  }

  if (convos.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3);font-size:12px;">Aucune conversation</div>`;
    return;
  }

  container.innerHTML = convos.map(c => {
    const isActive = window._bizSelectedConvo === c.id;
    const lastMsg = (c.last_message || '').length > 40 ? c.last_message.substring(0, 40) + '...' : (c.last_message || '');
    const initial = (c.participant_name || '?')[0].toUpperCase();

    return `
      <div class="msg-convo-item${isActive ? ' active' : ''}" onclick="bizSelectConversation('${c.id}')">
        <div class="msg-convo-avatar">${escHtml(initial)}</div>
        <div class="msg-convo-info">
          <div class="msg-convo-top">
            <span class="msg-convo-name">${escHtml(c.participant_name || 'Inconnu')}</span>
            <span class="msg-convo-time">${_bizTimeAgo(c.last_message_at)}</span>
          </div>
          <div class="msg-convo-preview">${escHtml(lastMsg)}</div>
        </div>
      </div>`;
  }).join('');
}

// ── Select conversation ──
async function bizSelectConversation(id) {
  window._bizSelectedConvo = id;
  _bizRenderConvoList();

  const thread = document.getElementById('msg-thread');
  if (!thread) return;

  thread.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;"><i class="fas fa-spinner fa-spin" style="color:var(--text3);"></i></div>';

  const convo = (window._bizConversations || []).find(c => c.id === id);
  await _bizLoadMessages(id);

  const participantName = convo ? (convo.participant_name || 'Inconnu') : 'Inconnu';
  const participantId = convo ? (convo.participant_id || '') : '';

  const messagesHtml = (window._bizMessages || []).map(m => {
    const isCoach = m.sender === 'coach';
    return `
      <div class="msg-bubble-row ${isCoach ? 'msg-bubble-row-coach' : 'msg-bubble-row-them'}">
        <div class="msg-bubble ${isCoach ? 'msg-bubble-coach' : 'msg-bubble-them'}">
          <div>${escHtml(m.text || '')}</div>
          <div class="msg-bubble-time" style="text-align:${isCoach ? 'right' : 'left'};">${_bizFormatMsgTime(m.created_at)}</div>
        </div>
      </div>`;
  }).join('');

  thread.innerHTML = `
    <div class="msg-thread-header">
      <div class="msg-convo-avatar">${escHtml(participantName[0].toUpperCase())}</div>
      <div class="msg-thread-name">${escHtml(participantName)}</div>
    </div>
    <div id="msg-messages-list" class="msg-messages">
      ${messagesHtml || '<div class="msg-empty"><div>Aucun message</div></div>'}
    </div>
    <div class="msg-compose">
      <textarea id="msg-input" class="msg-input" placeholder="Écrire un message..." rows="1"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();bizSendMessage('${id}','${participantId}')}"
        oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px'"></textarea>
      <button class="msg-send-btn" onclick="bizSendMessage('${id}','${participantId}')"><i class="fas fa-paper-plane"></i></button>
    </div>`;

  setTimeout(() => {
    const list = document.getElementById('msg-messages-list');
    if (list) list.scrollTop = list.scrollHeight;
  }, 50);
}

// ── Send message via Instagram API ──
async function bizSendMessage(conversationId, recipientId) {
  const input = document.getElementById('msg-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const acct = await _bizGetIgAccount();
  if (!acct?.page_access_token || !acct?.ig_user_id) {
    notify('Page Facebook non connectée', 'error');
    return;
  }

  input.value = '';
  input.style.height = 'auto';

  try {
    const resp = await authFetch('/api/ig-messages', {
      method: 'POST',
      body: JSON.stringify({
        action: 'send',
        user_id: currentUser.id,
        ig_user_id: acct.ig_user_id,
        recipient_id: recipientId,
        message_text: text,
        access_token: acct.page_access_token,
        conversation_id: conversationId,
      }),
    });
    const data = await resp.json();

    if (data.error) {
      notify('Erreur envoi: ' + data.error, 'error');
      return;
    }

    await bizSelectConversation(conversationId);
  } catch (err) {
    notify('Erreur envoi du message', 'error');
    console.error('[Messages] Send error:', err);
  }
}

// ── Disconnect Facebook Messages ──
async function bizDisconnectMessages() {
  if (!confirm('Déconnecter Facebook Messages ?')) return;
  const { error } = await supabaseClient.from('ig_accounts').update({
    page_id: null,
    page_access_token: null,
  }).eq('user_id', currentUser.id);

  if (error) {
    notify('Erreur déconnexion', 'error');
    return;
  }
  window._bizIgAccount = null;
  window._bizConversations = [];
  window._bizMessages = [];
  window._bizSelectedConvo = null;
  notify('Facebook Messages déconnecté', 'success');
  bizRenderMessages();
}
