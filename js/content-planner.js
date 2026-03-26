// ===== CONTENT PLANNER — Planificateur de contenu Instagram =====

let _cpTab = 'calendar';
let _cpDrafts = [];
let _cpHashtagGroups = [];
let _cpCaptionTemplates = [];
let _cpCalendarMonth = new Date().getMonth();
let _cpCalendarYear = new Date().getFullYear();
let _cpEditingDraft = null;

// ── Data layer ──
async function cpLoadDrafts() {
  const { data } = await supabaseClient.from('ig_drafts').select('*').eq('user_id', currentUser.id).order('scheduled_at', { ascending: true });
  return data || [];
}
async function cpLoadHashtagGroups() {
  const { data } = await supabaseClient.from('ig_hashtag_groups').select('*').eq('user_id', currentUser.id).order('name');
  return data || [];
}
async function cpLoadCaptionTemplates() {
  const { data } = await supabaseClient.from('ig_caption_templates').select('*').eq('user_id', currentUser.id).order('title');
  return data || [];
}

async function cpSaveDraft(draft) {
  const payload = { user_id: currentUser.id, ...draft };
  if (draft.id) {
    const { error } = await supabaseClient.from('ig_drafts').update(payload).eq('id', draft.id);
    if (error) { handleError(error, 'cp-save-draft'); return null; }
    return draft.id;
  } else {
    delete payload.id;
    const { data, error } = await supabaseClient.from('ig_drafts').insert(payload).select('id').single();
    if (error) { handleError(error, 'cp-save-draft'); return null; }
    return data.id;
  }
}
async function cpDeleteDraft(id) {
  const { error } = await supabaseClient.from('ig_drafts').delete().eq('id', id);
  if (error) handleError(error, 'cp-delete-draft');
}
async function cpSaveHashtagGroup(group) {
  const payload = { user_id: currentUser.id, ...group };
  if (group.id) {
    const { error } = await supabaseClient.from('ig_hashtag_groups').update(payload).eq('id', group.id);
    if (error) handleError(error, 'cp-save-hashtag');
  } else {
    delete payload.id;
    const { error } = await supabaseClient.from('ig_hashtag_groups').insert(payload);
    if (error) handleError(error, 'cp-save-hashtag');
  }
}
async function cpDeleteHashtagGroup(id) {
  const { error } = await supabaseClient.from('ig_hashtag_groups').delete().eq('id', id);
  if (error) handleError(error, 'cp-delete-hashtag');
}
async function cpSaveCaptionTemplate(tpl) {
  const payload = { user_id: currentUser.id, ...tpl };
  if (tpl.id) {
    const { error } = await supabaseClient.from('ig_caption_templates').update(payload).eq('id', tpl.id);
    if (error) handleError(error, 'cp-save-template');
  } else {
    delete payload.id;
    const { error } = await supabaseClient.from('ig_caption_templates').insert(payload);
    if (error) handleError(error, 'cp-save-template');
  }
}
async function cpDeleteCaptionTemplate(id) {
  const { error } = await supabaseClient.from('ig_caption_templates').delete().eq('id', id);
  if (error) handleError(error, 'cp-delete-template');
}

// ── Main render (called from business tab) ──
async function cpRenderPlanner() {
  const el = document.getElementById('biz-tab-content');
  el.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  [_cpDrafts, _cpHashtagGroups, _cpCaptionTemplates] = await Promise.all([
    cpLoadDrafts(), cpLoadHashtagGroups(), cpLoadCaptionTemplates()
  ]);

  // Also load published reels for calendar overlay
  if (!window._bizIgReels || window._bizIgReels.length === 0) {
    const { data } = await supabaseClient.from('ig_reels').select('*').eq('user_id', currentUser.id).order('published_at', { ascending: false });
    window._bizIgReels = data || [];
  }

  cpRender();
}

function cpRender() {
  const el = document.getElementById('biz-tab-content');

  const counts = {
    draft: _cpDrafts.filter(d => d.status === 'draft').length,
    scheduled: _cpDrafts.filter(d => d.status === 'scheduled').length,
  };

  const cpTabs = [
    ['calendar','fa-calendar-alt','Calendrier'],
    ['drafts','fa-file-alt','Brouillons',counts.draft],
    ['scheduled','fa-clock','Programmés',counts.scheduled],
    ['hashtags','fa-hashtag','Hashtags'],
    ['templates','fa-file-code','Templates'],
    ['besttime','fa-chart-bar','Best time'],
  ];

  const navHtml = cpTabs.map(([id,icon,label,count]) => {
    const badge = count ? `<span class="cp-nav-count">${count}</span>` : '';
    return `<button class="cp-nav-btn ${_cpTab===id?'active':''}" onclick="_cpTab='${id}';cpRender()"><i class="fas ${icon}"></i> ${label}${badge}</button>`;
  }).join('');

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
      <div class="cp-nav">${navHtml}</div>
      <div style="flex:1;"></div>
      <button class="btn btn-red btn-sm" onclick="cpOpenNewDraft()"><i class="fas fa-plus"></i> Nouveau post</button>
    </div>
    <div id="cp-tab-content"></div>`;

  switch (_cpTab) {
    case 'calendar': cpRenderCalendar(); break;
    case 'drafts': cpRenderDraftsList('draft'); break;
    case 'scheduled': cpRenderDraftsList('scheduled'); break;
    case 'hashtags': cpRenderHashtags(); break;
    case 'templates': cpRenderTemplates(); break;
    case 'besttime': cpRenderBestTime(); break;
  }
}

// ═══════════════════════════════════════
// ── CALENDAR VIEW ──
// ═══════════════════════════════════════

function cpRenderCalendar() {
  const ct = document.getElementById('cp-tab-content');
  const year = _cpCalendarYear;
  const month = _cpCalendarMonth;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  const events = {};
  const addEvent = (date, item) => {
    const key = date.slice(0, 10);
    if (!events[key]) events[key] = [];
    events[key].push(item);
  };

  (window._bizIgReels || []).forEach(r => {
    if (r.published_at) addEvent(r.published_at, { type: 'published', data: r });
  });
  _cpDrafts.forEach(d => {
    const date = d.scheduled_at || d.created_at;
    if (date) addEvent(date, { type: d.status, data: d });
  });

  const weekdays = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d =>
    `<div class="cp-cal-weekday">${d}</div>`
  ).join('');

  const today = new Date().toISOString().slice(0, 10);

  let emptyCells = '';
  for (let i = 0; i < startDow; i++) {
    emptyCells += `<div class="cp-cal-day cp-cal-day-empty"></div>`;
  }

  let dayCells = '';
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const dayEvents = events[dateStr] || [];

    const eventsHtml = dayEvents.slice(0, 3).map(e => {
      const cls = 'cp-cal-event cp-cal-event-' + e.type;
      const caption = e.data.caption ? escHtml(e.data.caption.slice(0, 25)) : 'Sans légende';
      return `<div class="${cls}" onclick="event.stopPropagation();cpOpenDraftDetail('${e.data.id}')" title="${escHtml(e.data.caption || '')}">${caption}</div>`;
    }).join('');
    const moreHtml = dayEvents.length > 3 ? `<div style="font-size:9px;color:var(--text3);padding:0 6px;">+${dayEvents.length - 3} autre${dayEvents.length - 3 > 1 ? 's' : ''}</div>` : '';

    dayCells += `
      <div class="cp-cal-day${isToday ? ' cp-cal-day-today' : ''}" onclick="cpOpenNewDraft('${dateStr}')">
        <div class="cp-cal-day-num">${day}</div>
        ${eventsHtml}${moreHtml}
      </div>`;
  }

  const totalCells = startDow + totalDays;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  let trailingCells = '';
  for (let i = 0; i < remaining; i++) {
    trailingCells += `<div class="cp-cal-day cp-cal-day-empty"></div>`;
  }

  ct.innerHTML = `
    <div class="cp-cal-header">
      <button class="btn btn-outline btn-sm" onclick="_cpCalendarMonth--;if(_cpCalendarMonth<0){_cpCalendarMonth=11;_cpCalendarYear--;}cpRenderCalendar()"><i class="fas fa-chevron-left"></i></button>
      <span class="cp-cal-title">${monthNames[month]} ${year}</span>
      <button class="btn btn-outline btn-sm" onclick="_cpCalendarMonth++;if(_cpCalendarMonth>11){_cpCalendarMonth=0;_cpCalendarYear++;}cpRenderCalendar()"><i class="fas fa-chevron-right"></i></button>
    </div>
    <div class="cp-cal-grid">
      ${weekdays}
      ${emptyCells}
      ${dayCells}
      ${trailingCells}
    </div>
    <div class="cp-cal-legend">
      <span><div class="cp-cal-legend-dot" style="background:var(--success);"></div> Publié</span>
      <span><div class="cp-cal-legend-dot" style="background:var(--primary);"></div> Programmé</span>
      <span><div class="cp-cal-legend-dot" style="background:var(--text3);"></div> Brouillon</span>
      <span><div class="cp-cal-legend-dot" style="background:var(--danger);"></div> Échoué</span>
    </div>`;
}

// ═══════════════════════════════════════
// ── DRAFTS & SCHEDULED LIST ──
// ═══════════════════════════════════════

function cpRenderDraftsList(statusFilter) {
  const ct = document.getElementById('cp-tab-content');
  const filtered = _cpDrafts.filter(d => d.status === statusFilter);

  if (!filtered.length) {
    ct.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text3);">
      <i class="fas ${statusFilter === 'draft' ? 'fa-file-alt' : 'fa-clock'}" style="font-size:32px;margin-bottom:12px;display:block;opacity:0.3;"></i>
      <div style="font-size:13px;">Aucun ${statusFilter === 'draft' ? 'brouillon' : 'post programmé'}</div>
      <button class="btn btn-red btn-sm" style="margin-top:14px;" onclick="cpOpenNewDraft()"><i class="fas fa-plus"></i> Créer un post</button>
    </div>`;
    return;
  }

  const cards = filtered.map(d => {
    const thumb = d.media_urls?.[0]
      ? `<div class="cp-draft-thumb"><img src="${escHtml(d.media_urls[0])}" alt=""></div>`
      : `<div class="cp-draft-thumb"><i class="fas fa-image" style="font-size:22px;color:var(--text3);"></i></div>`;

    const caption = d.caption ? escHtml(d.caption.slice(0, 120)) + (d.caption.length > 120 ? '...' : '') : '<span style="color:var(--text3);font-style:italic;">Sans légende</span>';
    const date = d.scheduled_at ? new Date(d.scheduled_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Non planifié';
    const hashtags = (d.hashtags || []).slice(0, 5).map(h => `<span style="font-size:10px;color:var(--primary);margin-right:4px;">#${escHtml(h)}</span>`).join('');

    return `
      <div class="cp-draft-card" onclick="cpOpenDraftDetail('${d.id}')">
        ${thumb}
        <div style="flex:1;min-width:0;">
          <div class="cp-draft-caption">${caption}</div>
          ${hashtags ? `<div style="margin-top:4px;">${hashtags}</div>` : ''}
          <div class="cp-draft-meta">
            <span><i class="fas fa-calendar"></i> ${date}</span>
            <span><i class="fas fa-${d.media_type === 'VIDEO' ? 'video' : 'image'}"></i> ${d.media_type || 'IMAGE'}</span>
          </div>
        </div>
        <div class="cp-draft-actions">
          <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();cpOpenNewDraft(null,'${d.id}')" title="Modifier"><i class="fas fa-pen"></i></button>
          <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();cpConfirmDelete('${d.id}')" title="Supprimer" style="color:var(--danger);"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
  }).join('');

  ct.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;">${cards}</div>`;
}

// ═══════════════════════════════════════
// ── NEW / EDIT DRAFT MODAL ──
// ═══════════════════════════════════════

function cpOpenNewDraft(dateStr, editId) {
  _cpEditingDraft = editId ? _cpDrafts.find(d => d.id === editId) : null;
  const d = _cpEditingDraft || {};

  // Init temp media from existing draft or empty
  if (!editId) {
    window._cpTempMedia = [];
  } else if (!window._cpTempMedia || !window._cpTempMedia.length) {
    window._cpTempMedia = (d.media_urls || []).map(url => ({
      url, name: url.split('/').pop(), size: null, type: url.match(/\.(mp4|mov)$/i) ? 'video' : 'image', isVideo: !!url.match(/\.(mp4|mov)$/i)
    }));
  }

  const scheduledDate = dateStr || (d.scheduled_at ? d.scheduled_at.slice(0, 10) : '');
  const scheduledTime = d.scheduled_at ? d.scheduled_at.slice(11, 16) : '09:00';

  // Hashtag groups dropdown options
  const hgOptions = _cpHashtagGroups.map(g =>
    `<option value="${g.id}">${escHtml(g.name)} (${g.hashtags?.length || 0})</option>`
  ).join('');

  // Caption templates dropdown
  const ctOptions = _cpCaptionTemplates.map(t =>
    `<option value="${t.id}">${escHtml(t.title)}</option>`
  ).join('');

  const popup = document.createElement('div');
  popup.id = 'cp-draft-modal';
  popup.className = 'bt-popup-overlay';
  popup.onclick = e => { if (e.target === popup) popup.remove(); };

  popup.innerHTML = `
    <div class="bt-popup" style="width:950px;max-height:90vh;overflow-y:auto;position:relative;">
      <div class="bt-popup-header">
        <span style="font-weight:700;">${d.id ? 'Modifier le post' : 'Nouveau post'}</span>
        <button class="bt-close" onclick="document.getElementById('cp-draft-modal')?.remove()"><i class="fas fa-times"></i></button>
      </div>
      <div class="bt-popup-body" style="display:flex;gap:20px;">

        <!-- LEFT: Preview média -->
        <div style="width:320px;flex-shrink:0;display:flex;flex-direction:column;gap:10px;">
          <div id="cp-media-preview" style="display:flex;flex-direction:column;gap:8px;"></div>
          <div id="cp-upload-progress" style="display:none;"></div>
          <input type="file" id="cp-media-file" accept="image/*,video/*" style="display:none;" onchange="cpHandleMediaUpload(this)">
          <div style="border:2px dashed var(--border);border-radius:12px;padding:24px 16px;text-align:center;cursor:pointer;transition:all .2s;" onclick="document.getElementById('cp-media-file').click()" onmouseover="this.style.borderColor='var(--primary)';this.style.background='rgba(179,8,8,0.05)'" onmouseout="this.style.borderColor='var(--border)';this.style.background='transparent'">
            <i class="fas fa-cloud-upload-alt" style="font-size:28px;color:var(--text3);margin-bottom:8px;display:block;"></i>
            <div style="font-size:12px;color:var(--text2);font-weight:500;">Clique ou glisse un fichier</div>
            <div style="font-size:10px;color:var(--text3);margin-top:4px;">Images (10 MB) · Vidéos (200 MB)</div>
          </div>
          <div style="display:flex;gap:6px;">
            <input type="text" id="cp-media-url" class="bt-input" placeholder="URL du média..." style="flex:1;font-size:11px;">
            <button class="btn btn-outline btn-sm" onclick="cpAddMediaUrl()"><i class="fas fa-link"></i></button>
          </div>
        </div>

        <!-- RIGHT: Formulaire -->
        <div style="flex:1;display:flex;flex-direction:column;gap:14px;min-width:0;">

          <!-- Caption -->
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <label style="font-size:11px;color:var(--text3);font-weight:600;">Légende</label>
              ${ctOptions ? `<select id="cp-tpl-select" class="bt-input" style="width:auto;font-size:11px;padding:4px 8px;" onchange="cpApplyTemplate(this.value)">
                <option value="">Template...</option>
                ${ctOptions}
              </select>` : ''}
            </div>
            <textarea id="cp-caption" class="bt-input" rows="6" style="margin-top:4px;resize:vertical;font-family:inherit;" placeholder="Écris ta légende ici...">${escHtml(d.caption || '')}</textarea>
            <span id="cp-char-count" style="font-size:10px;color:var(--text3);">${(d.caption || '').length} / 2200</span>
          </div>

          <!-- Hashtags -->
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <label style="font-size:11px;color:var(--text3);font-weight:600;">Hashtags</label>
              ${hgOptions ? `<select id="cp-hg-select" class="bt-input" style="width:auto;font-size:11px;padding:4px 8px;" onchange="cpApplyHashtagGroup(this.value)">
                <option value="">Groupe...</option>
                ${hgOptions}
              </select>` : ''}
            </div>
            <input type="text" id="cp-hashtags" class="bt-input" style="margin-top:4px;" placeholder="fitness, coaching, musculation" value="${escHtml((d.hashtags || []).join(', '))}">
            <span id="cp-hashtag-count" style="font-size:10px;color:var(--text3);">${(d.hashtags || []).length} / 30</span>
          </div>

          <!-- Type + Schedule row -->
          <div style="display:flex;gap:12px;">
            <div style="flex:1;">
              <label style="font-size:11px;color:var(--text3);font-weight:600;">Type</label>
              <div style="display:flex;gap:4px;margin-top:4px;">
                ${['IMAGE', 'VIDEO', 'CAROUSEL'].map(t => `
                  <button type="button" class="btn btn-sm ${(d.media_type || 'IMAGE') === t ? 'btn-red' : 'btn-outline'} cp-type-btn" onclick="document.querySelectorAll('#cp-draft-modal .cp-type-btn').forEach(b=>b.className='btn btn-sm btn-outline cp-type-btn');this.className='btn btn-sm btn-red cp-type-btn';document.getElementById('cp-media-type').value='${t}';">
                    <i class="fas fa-${t === 'IMAGE' ? 'image' : t === 'VIDEO' ? 'video' : 'images'}"></i>
                  </button>`).join('')}
                <input type="hidden" id="cp-media-type" value="${d.media_type || 'IMAGE'}">
              </div>
            </div>
            <div style="flex:1;">
              <label style="font-size:11px;color:var(--text3);font-weight:600;">Planification</label>
              <div style="display:flex;gap:4px;margin-top:4px;">
                <input type="date" id="cp-sched-date" class="bt-input" style="font-size:11px;" value="${scheduledDate}">
                <input type="time" id="cp-sched-time" class="bt-input" style="font-size:11px;" value="${scheduledTime}">
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div style="display:flex;gap:8px;margin-top:auto;padding-top:8px;">
            <button class="btn btn-outline" style="flex:1;" onclick="cpSaveDraftFromModal('draft')"><i class="fas fa-save" style="margin-right:4px;"></i>Brouillon</button>
            <button class="btn btn-red" style="flex:1;" onclick="cpSaveDraftFromModal('scheduled')"><i class="fas fa-clock" style="margin-right:4px;"></i>Programmer</button>
            <button class="btn btn-red" style="flex:1;background:var(--success);border-color:var(--success);" onclick="cpPublishNow()"><i class="fas fa-paper-plane" style="margin-right:4px;"></i>Publier</button>
          </div>
        </div>

      </div>

      <!-- Publishing overlay -->
      <div id="cp-publish-overlay" style="display:none;position:absolute;inset:0;background:rgba(10,10,11,0.92);border-radius:20px;z-index:10;flex-direction:column;align-items:center;justify-content:center;gap:16px;">
        <div style="width:60px;height:60px;border-radius:50%;background:rgba(179,8,8,0.15);display:flex;align-items:center;justify-content:center;">
          <i class="fas fa-spinner fa-spin" style="font-size:28px;color:var(--primary);"></i>
        </div>
        <div id="cp-publish-status" style="font-size:16px;font-weight:700;color:var(--text);">Publication en cours...</div>
        <div id="cp-publish-detail" style="font-size:12px;color:var(--text3);">Envoi du média à Instagram</div>
      </div>
    </div>`;

  document.body.appendChild(popup);

  // Render existing media
  cpRefreshMediaPreview();

  // Char counter
  document.getElementById('cp-caption').addEventListener('input', function () {
    document.getElementById('cp-char-count').textContent = this.value.length + ' / 2200';
  });
  document.getElementById('cp-hashtags').addEventListener('input', function () {
    const count = this.value.split(',').filter(h => h.trim()).length;
    document.getElementById('cp-hashtag-count').textContent = count + ' / 30';
  });
}

// Store temp media data for the modal (url, name, size, type, isVideo)
window._cpTempMedia = [];

function cpOpenDraftDetail(id) {
  const draft = _cpDrafts.find(d => d.id === id);
  if (!draft) {
    const reel = (window._bizIgReels || []).find(r => r.id === id);
    if (reel) { cpShowPublishedDetail(reel); return; }
    return;
  }
  window._cpTempMedia = (draft.media_urls || []).map(url => ({
    url, name: url.split('/').pop(), size: null, type: url.match(/\.(mp4|mov)$/i) ? 'video' : 'image', isVideo: !!url.match(/\.(mp4|mov)$/i)
  }));
  cpOpenNewDraft(null, id);
}

function cpShowPublishedDetail(reel) {
  const popup = document.createElement('div');
  popup.id = 'cp-reel-modal';
  popup.className = 'bt-popup-overlay';
  popup.onclick = e => { if (e.target === popup) popup.remove(); };

  popup.innerHTML = `
    <div class="bt-popup" style="width:500px;">
      <div class="bt-popup-header">
        <span style="font-weight:700;">Post publié</span>
        <button class="bt-close" onclick="document.getElementById('cp-reel-modal')?.remove()"><i class="fas fa-times"></i></button>
      </div>
      <div class="bt-popup-body">
        ${reel.thumbnail_url ? `<img src="${escHtml(reel.thumbnail_url)}" style="width:100%;border-radius:10px;margin-bottom:12px;">` : ''}
        <div style="font-size:13px;line-height:1.5;color:var(--text);white-space:pre-wrap;">${escHtml(reel.caption || 'Sans légende')}</div>
        <div style="display:flex;gap:16px;margin-top:16px;flex-wrap:wrap;">
          ${_cpStatBadge('fas fa-eye', reel.views || 0, 'Vues')}
          ${_cpStatBadge('fas fa-heart', reel.likes || 0, 'Likes')}
          ${_cpStatBadge('fas fa-comment', reel.comments || 0, 'Commentaires')}
          ${_cpStatBadge('fas fa-share', reel.shares || 0, 'Partages')}
          ${_cpStatBadge('fas fa-bookmark', reel.saves || 0, 'Saves')}
          ${_cpStatBadge('fas fa-bullseye', reel.reach || 0, 'Reach')}
          ${_cpStatBadge('fas fa-chart-line', (reel.engagement_rate || 0).toFixed(1) + '%', 'Engagement')}
        </div>
        <div style="margin-top:12px;font-size:11px;color:var(--text3);">Publié le ${reel.published_at ? new Date(reel.published_at).toLocaleString('fr-FR') : '—'}</div>
      </div>
    </div>`;
  document.body.appendChild(popup);
}

function _cpStatBadge(icon, value, label) {
  return `<div style="display:flex;flex-direction:column;align-items:center;min-width:50px;">
    <i class="${icon}" style="font-size:14px;color:var(--primary);margin-bottom:2px;"></i>
    <span style="font-size:14px;font-weight:700;">${value}</span>
    <span style="font-size:9px;color:var(--text3);">${label}</span>
  </div>`;
}

// ── Format file size ──
function _cpFormatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' Go';
}

// ── Media handling ──
async function cpHandleMediaUpload(input) {
  const file = input.files?.[0];
  if (!file) return;

  const maxSize = file.type.startsWith('video/') ? 200 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxSize) {
    notify(`Fichier trop volumineux (max ${file.type.startsWith('video/') ? '200' : '10'} MB)`, 'error');
    return;
  }

  const isVideo = file.type.startsWith('video/');

  // Show upload progress overlay
  const progressEl = document.getElementById('cp-upload-progress');
  if (progressEl) {
    progressEl.style.display = 'flex';
    progressEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:16px;background:var(--bg3);border-radius:12px;border:1px solid var(--border);width:100%;">
        <div style="width:50px;height:50px;border-radius:8px;background:var(--bg2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="fas fa-${isVideo ? 'video' : 'image'}" style="font-size:20px;color:var(--primary);"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(file.name)}</div>
          <div style="font-size:11px;color:var(--text3);">${_cpFormatSize(file.size)} — ${isVideo ? 'Vidéo' : 'Image'}</div>
          <div style="margin-top:6px;height:4px;background:var(--bg);border-radius:2px;overflow:hidden;">
            <div id="cp-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--primary),var(--success));border-radius:2px;transition:width 0.3s;"></div>
          </div>
          <div id="cp-progress-text" style="font-size:10px;color:var(--text3);margin-top:4px;">Upload en cours...</div>
        </div>
      </div>`;
  }

  // Simulate progress (Supabase SDK doesn't expose progress)
  let fakeProgress = 0;
  const progressInterval = setInterval(() => {
    fakeProgress = Math.min(fakeProgress + Math.random() * 15, 90);
    const bar = document.getElementById('cp-progress-bar');
    const text = document.getElementById('cp-progress-text');
    if (bar) bar.style.width = fakeProgress + '%';
    if (text) text.textContent = `Upload en cours... ${Math.round(fakeProgress)}%`;
  }, 300);

  try {
    const ext = file.name.split('.').pop();
    const path = `${currentUser.id}/${Date.now()}.${ext}`;
    const { error } = await supabaseClient.storage.from('content-drafts').upload(path, file, { contentType: file.type });

    clearInterval(progressInterval);

    if (error) {
      if (progressEl) progressEl.style.display = 'none';
      handleError(error, 'cp-upload');
      return;
    }

    // Complete progress
    const bar = document.getElementById('cp-progress-bar');
    const text = document.getElementById('cp-progress-text');
    if (bar) bar.style.width = '100%';
    if (text) text.textContent = 'Upload terminé !';

    const { data: urlData } = supabaseClient.storage.from('content-drafts').getPublicUrl(path);
    const url = urlData.publicUrl;

    if (!window._cpTempMedia) window._cpTempMedia = [];
    window._cpTempMedia.push({ url, name: file.name, size: file.size, type: isVideo ? 'video' : 'image', isVideo });
    cpRefreshMediaPreview();

    if (isVideo) document.getElementById('cp-media-type').value = 'VIDEO';

    setTimeout(() => { if (progressEl) progressEl.style.display = 'none'; }, 1000);
    notify('Média ajouté !', 'success');
  } catch (err) {
    clearInterval(progressInterval);
    if (progressEl) progressEl.style.display = 'none';
    notify('Erreur upload', 'error');
    devError('[CP Upload]', err);
  }

  input.value = '';
}

function cpAddMediaUrl() {
  const urlInput = document.getElementById('cp-media-url');
  const url = urlInput.value.trim();
  if (!url) return;
  if (!window._cpTempMedia) window._cpTempMedia = [];
  const isVideo = !!url.match(/\.(mp4|mov|avi|webm)(\?|$)/i);
  window._cpTempMedia.push({ url, name: url.split('/').pop().split('?')[0], size: null, type: isVideo ? 'video' : 'image', isVideo });
  cpRefreshMediaPreview();
  urlInput.value = '';
}

function cpRemoveMedia(index) {
  if (window._cpTempMedia) {
    window._cpTempMedia.splice(index, 1);
    cpRefreshMediaPreview();
  }
}

function cpRefreshMediaPreview() {
  const el = document.getElementById('cp-media-preview');
  if (!el) return;
  const media = window._cpTempMedia || [];
  if (!media.length) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = media.map((m, i) => `
    <div style="border-radius:16px;overflow:hidden;background:#000;position:relative;">
      <div style="width:100%;aspect-ratio:9/16;position:relative;">
        ${m.isVideo
          ? `<video src="${escHtml(m.url)}" style="width:100%;height:100%;object-fit:cover;" autoplay loop muted playsinline></video>`
          : `<img src="${escHtml(m.url)}" style="width:100%;height:100%;object-fit:cover;">`
        }
        <!-- Overlay infos en bas -->
        <div style="position:absolute;bottom:0;left:0;right:0;padding:12px;background:linear-gradient(transparent,rgba(0,0,0,0.8));">
          <div style="font-size:12px;font-weight:600;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(m.name)}</div>
          <div style="display:flex;gap:8px;margin-top:3px;font-size:10px;color:rgba(255,255,255,0.6);">
            <span>${m.isVideo ? 'Vidéo' : 'Image'}</span>
            ${m.size ? `<span>${_cpFormatSize(m.size)}</span>` : ''}
            <span style="color:#22c55e;"><i class="fas fa-check-circle" style="margin-right:2px;"></i>Prêt</span>
          </div>
        </div>
        <!-- Bouton supprimer -->
        <button onclick="cpRemoveMedia(${i})" style="position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:50%;background:rgba(0,0,0,0.6);color:white;border:none;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);transition:all .2s;" onmouseover="this.style.background='rgba(239,68,68,0.8)'" onmouseout="this.style.background='rgba(0,0,0,0.6)'"><i class="fas fa-trash"></i></button>
      </div>
    </div>`).join('');
}

// ── Save draft from modal ──
async function cpSaveDraftFromModal(status) {
  const caption = document.getElementById('cp-caption').value.trim();
  const hashtagsStr = document.getElementById('cp-hashtags').value;
  const hashtags = hashtagsStr.split(',').map(h => h.trim().replace(/^#/, '')).filter(Boolean);
  const mediaType = document.getElementById('cp-media-type').value;
  const schedDate = document.getElementById('cp-sched-date').value;
  const schedTime = document.getElementById('cp-sched-time').value;

  const scheduledAt = schedDate ? new Date(`${schedDate}T${schedTime || '09:00'}`).toISOString() : null;

  if (status === 'scheduled' && !scheduledAt) {
    notify('Choisis une date pour programmer le post', 'error');
    return;
  }

  const draft = {
    caption,
    hashtags,
    media_urls: (window._cpTempMedia || []).map(m => m.url),
    media_type: mediaType,
    status,
    scheduled_at: scheduledAt,
  };

  if (_cpEditingDraft?.id) draft.id = _cpEditingDraft.id;

  const id = await cpSaveDraft(draft);
  if (!id) return;

  notify(status === 'scheduled' ? 'Post programmé !' : 'Brouillon sauvegardé !', 'success');
  document.getElementById('cp-draft-modal')?.remove();

  // Refresh
  _cpDrafts = await cpLoadDrafts();
  cpRender();
}

// ── Publish overlay helpers ──
function _cpShowPublishOverlay(status, detail) {
  const overlay = document.getElementById('cp-publish-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  const s = document.getElementById('cp-publish-status');
  const d = document.getElementById('cp-publish-detail');
  if (s) s.textContent = status;
  if (d) d.textContent = detail;
}
function _cpHidePublishOverlay() {
  const overlay = document.getElementById('cp-publish-overlay');
  if (overlay) overlay.style.display = 'none';
}
function _cpPublishOverlaySuccess() {
  const overlay = document.getElementById('cp-publish-overlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div style="width:60px;height:60px;border-radius:50%;background:rgba(34,197,94,0.15);display:flex;align-items:center;justify-content:center;">
      <i class="fas fa-check" style="font-size:28px;color:var(--success);"></i>
    </div>
    <div style="font-size:16px;font-weight:700;color:var(--success);">Publié sur Instagram !</div>
    <div style="font-size:12px;color:var(--text3);">Ton post est en ligne</div>`;
}
function _cpPublishOverlayError(msg) {
  const overlay = document.getElementById('cp-publish-overlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div style="width:60px;height:60px;border-radius:50%;background:rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center;">
      <i class="fas fa-times" style="font-size:28px;color:var(--danger);"></i>
    </div>
    <div style="font-size:16px;font-weight:700;color:var(--danger);">Erreur de publication</div>
    <div style="font-size:12px;color:var(--text3);max-width:300px;text-align:center;">${escHtml(msg)}</div>
    <button class="btn btn-outline btn-sm" onclick="document.getElementById('cp-publish-overlay').style.display='none'" style="margin-top:8px;">Fermer</button>`;
}

// ── Publish now ──
async function cpPublishNow() {
  const caption = document.getElementById('cp-caption').value.trim();
  const hashtagsStr = document.getElementById('cp-hashtags').value;
  const hashtags = hashtagsStr.split(',').map(h => h.trim().replace(/^#/, '')).filter(Boolean);
  const mediaType = document.getElementById('cp-media-type').value;
  const mediaUrls = (window._cpTempMedia || []).map(m => m.url);

  if (!mediaUrls.length) {
    notify('Ajoute au moins un média pour publier', 'error');
    return;
  }

  let fullCaption = caption;
  if (hashtags.length) {
    fullCaption += '\n\n' + hashtags.map(h => '#' + h).join(' ');
  }

  // Get IG account
  _cpShowPublishOverlay('Connexion à Instagram...', 'Vérification du compte');
  const { data: acct } = await supabaseClient.from('ig_accounts').select('*').eq('user_id', currentUser.id).single();
  if (!acct?.access_token || !acct?.ig_user_id) {
    _cpHidePublishOverlay();
    notify('Connecte ton compte Instagram d\'abord', 'error');
    return;
  }

  try {
    _cpShowPublishOverlay('Envoi du média...', mediaType === 'VIDEO' ? 'Traitement de la vidéo par Instagram (peut prendre 1-2 min)' : 'Création du post');

    const resp = await fetch('/api/ig-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: acct.access_token,
        ig_user_id: acct.ig_user_id,
        image_url: mediaType !== 'VIDEO' ? mediaUrls[0] : undefined,
        video_url: mediaType === 'VIDEO' ? mediaUrls[0] : undefined,
        caption: fullCaption,
        media_type: mediaType,
      }),
    });

    const data = await resp.json();
    if (data.error) {
      _cpPublishOverlayError(data.error);
      if (_cpEditingDraft?.id) {
        await supabaseClient.from('ig_drafts').update({ status: 'failed', error_message: data.error }).eq('id', _cpEditingDraft.id);
      }
      return;
    }

    _cpPublishOverlaySuccess();

    const draftPayload = {
      caption,
      hashtags,
      media_urls: mediaUrls,
      media_type: mediaType,
      status: 'published',
      published_at: new Date().toISOString(),
      ig_media_id: data.ig_media_id,
    };
    if (_cpEditingDraft?.id) draftPayload.id = _cpEditingDraft.id;
    await cpSaveDraft(draftPayload);

    setTimeout(() => {
      document.getElementById('cp-draft-modal')?.remove();
    }, 2000);

    _cpDrafts = await cpLoadDrafts();
    // Also re-sync IG data
    if (typeof bizSyncIgData === 'function') bizSyncIgData();
    cpRender();
  } catch (err) {
    notify('Erreur de publication', 'error');
    devError('[CP Publish]', err);
  }
}

// ── Apply template / hashtag group ──
function cpApplyTemplate(id) {
  const tpl = _cpCaptionTemplates.find(t => t.id === id);
  if (!tpl) return;
  document.getElementById('cp-caption').value = tpl.body;
  document.getElementById('cp-char-count').textContent = tpl.body.length + ' / 2200';
  if (tpl.hashtags?.length) {
    const existing = document.getElementById('cp-hashtags').value;
    const merged = [...new Set([...existing.split(',').map(h => h.trim()).filter(Boolean), ...tpl.hashtags])];
    document.getElementById('cp-hashtags').value = merged.join(', ');
    document.getElementById('cp-hashtag-count').textContent = merged.length + ' / 30';
  }
}

function cpApplyHashtagGroup(id) {
  const group = _cpHashtagGroups.find(g => g.id === id);
  if (!group?.hashtags) return;
  const existing = document.getElementById('cp-hashtags').value;
  const merged = [...new Set([...existing.split(',').map(h => h.trim()).filter(Boolean), ...group.hashtags])];
  document.getElementById('cp-hashtags').value = merged.join(', ');
  document.getElementById('cp-hashtag-count').textContent = merged.length + ' / 30';
}

// ── Confirm delete ──
async function cpConfirmDelete(id) {
  if (!confirm('Supprimer ce post ?')) return;
  await cpDeleteDraft(id);
  _cpDrafts = await cpLoadDrafts();
  cpRender();
  notify('Post supprimé', 'success');
}

// ═══════════════════════════════════════
// ── HASHTAG GROUPS ──
// ═══════════════════════════════════════

function cpRenderHashtags() {
  const ct = document.getElementById('cp-tab-content');

  const cards = _cpHashtagGroups.map(g => `
    <div style="padding:14px;background:var(--bg2);border-radius:12px;border:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-weight:700;font-size:14px;">${escHtml(g.name)}</span>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm" onclick="cpEditHashtagGroup('${g.id}')"><i class="fas fa-pen"></i></button>
          <button class="btn btn-outline btn-sm" onclick="cpConfirmDeleteHashtag('${g.id}')" style="color:var(--danger);border-color:var(--danger);"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">
        ${(g.hashtags || []).map(h => `<span style="font-size:11px;color:var(--primary);background:rgba(179,8,8,0.1);padding:2px 8px;border-radius:12px;">#${escHtml(h)}</span>`).join('')}
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:6px;">${(g.hashtags || []).length} hashtags</div>
    </div>`).join('');

  ct.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <span style="font-size:14px;color:var(--text3);">${_cpHashtagGroups.length} groupe(s)</span>
      <button class="btn btn-red btn-sm" onclick="cpEditHashtagGroup()"><i class="fas fa-plus" style="margin-right:4px;"></i>Nouveau groupe</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;">${cards || '<div style="text-align:center;padding:40px;color:var(--text3);grid-column:1/-1;">Aucun groupe de hashtags</div>'}</div>`;
}

function cpEditHashtagGroup(id) {
  const group = id ? _cpHashtagGroups.find(g => g.id === id) : {};

  const popup = document.createElement('div');
  popup.id = 'cp-hg-modal';
  popup.className = 'bt-popup-overlay';
  popup.onclick = e => { if (e.target === popup) popup.remove(); };

  popup.innerHTML = `
    <div class="bt-popup" style="width:420px;">
      <div class="bt-popup-header">
        <span style="font-weight:700;">${id ? 'Modifier le groupe' : 'Nouveau groupe de hashtags'}</span>
        <button class="bt-close" onclick="document.getElementById('cp-hg-modal')?.remove()"><i class="fas fa-times"></i></button>
      </div>
      <div class="bt-popup-body" style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <label style="font-size:11px;color:var(--text3);font-weight:600;">Nom du groupe</label>
          <input type="text" id="cp-hg-name" class="bt-input" value="${escHtml(group.name || '')}" placeholder="Ex: Fitness général">
        </div>
        <div>
          <label style="font-size:11px;color:var(--text3);font-weight:600;">Hashtags (séparés par des virgules)</label>
          <textarea id="cp-hg-tags" class="bt-input" rows="4" placeholder="fitness, musculation, coaching, sport">${escHtml((group.hashtags || []).join(', '))}</textarea>
        </div>
        <button class="btn btn-red" onclick="cpSaveHashtagGroupFromModal(${id ? `'${id}'` : 'null'})"><i class="fas fa-save" style="margin-right:4px;"></i>Sauvegarder</button>
      </div>
    </div>`;
  document.body.appendChild(popup);
}

async function cpSaveHashtagGroupFromModal(id) {
  const name = document.getElementById('cp-hg-name').value.trim();
  const tags = document.getElementById('cp-hg-tags').value.split(',').map(h => h.trim().replace(/^#/, '')).filter(Boolean);

  if (!name) { notify('Nom requis', 'error'); return; }
  if (!tags.length) { notify('Ajoute au moins un hashtag', 'error'); return; }

  await cpSaveHashtagGroup({ id: id || undefined, name, hashtags: tags });
  notify('Groupe sauvegardé !', 'success');
  document.getElementById('cp-hg-modal')?.remove();
  _cpHashtagGroups = await cpLoadHashtagGroups();
  cpRender();
}

async function cpConfirmDeleteHashtag(id) {
  if (!confirm('Supprimer ce groupe ?')) return;
  await cpDeleteHashtagGroup(id);
  _cpHashtagGroups = await cpLoadHashtagGroups();
  cpRender();
  notify('Groupe supprimé', 'success');
}

// ═══════════════════════════════════════
// ── CAPTION TEMPLATES ──
// ═══════════════════════════════════════

function cpRenderTemplates() {
  const ct = document.getElementById('cp-tab-content');

  const cards = _cpCaptionTemplates.map(t => `
    <div style="padding:14px;background:var(--bg2);border-radius:12px;border:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-weight:700;font-size:14px;">${escHtml(t.title)}</span>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm" onclick="cpEditTemplate('${t.id}')"><i class="fas fa-pen"></i></button>
          <button class="btn btn-outline btn-sm" onclick="cpConfirmDeleteTemplate('${t.id}')" style="color:var(--danger);border-color:var(--danger);"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text2);line-height:1.4;white-space:pre-wrap;max-height:80px;overflow:hidden;">${escHtml(t.body.slice(0, 200))}</div>
      ${t.hashtags?.length ? `<div style="margin-top:6px;font-size:10px;color:var(--primary);">${t.hashtags.map(h => '#' + escHtml(h)).join(' ')}</div>` : ''}
      <div style="font-size:10px;color:var(--text3);margin-top:6px;">${escHtml(t.category || 'general')}</div>
    </div>`).join('');

  ct.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <span style="font-size:14px;color:var(--text3);">${_cpCaptionTemplates.length} template(s)</span>
      <button class="btn btn-red btn-sm" onclick="cpEditTemplate()"><i class="fas fa-plus" style="margin-right:4px;"></i>Nouveau template</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;">${cards || '<div style="text-align:center;padding:40px;color:var(--text3);grid-column:1/-1;">Aucun template</div>'}</div>`;
}

function cpEditTemplate(id) {
  const tpl = id ? _cpCaptionTemplates.find(t => t.id === id) : {};

  const popup = document.createElement('div');
  popup.id = 'cp-tpl-modal';
  popup.className = 'bt-popup-overlay';
  popup.onclick = e => { if (e.target === popup) popup.remove(); };

  popup.innerHTML = `
    <div class="bt-popup" style="width:500px;">
      <div class="bt-popup-header">
        <span style="font-weight:700;">${id ? 'Modifier le template' : 'Nouveau template de caption'}</span>
        <button class="bt-close" onclick="document.getElementById('cp-tpl-modal')?.remove()"><i class="fas fa-times"></i></button>
      </div>
      <div class="bt-popup-body" style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <label style="font-size:11px;color:var(--text3);font-weight:600;">Titre</label>
          <input type="text" id="cp-tpl-title" class="bt-input" value="${escHtml(tpl.title || '')}" placeholder="Ex: Post transformation">
        </div>
        <div>
          <label style="font-size:11px;color:var(--text3);font-weight:600;">Catégorie</label>
          <select id="cp-tpl-cat" class="bt-input">
            ${['general', 'education', 'storytelling', 'offre', 'preuve_sociale', 'motivation', 'behind_the_scenes'].map(c =>
              `<option value="${c}" ${(tpl.category || 'general') === c ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1).replace('_', ' ')}</option>`
            ).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:11px;color:var(--text3);font-weight:600;">Contenu</label>
          <textarea id="cp-tpl-body" class="bt-input" rows="8" style="resize:vertical;font-family:inherit;" placeholder="Écris ton template de caption ici...">${escHtml(tpl.body || '')}</textarea>
        </div>
        <div>
          <label style="font-size:11px;color:var(--text3);font-weight:600;">Hashtags inclus (optionnel)</label>
          <input type="text" id="cp-tpl-tags" class="bt-input" value="${escHtml((tpl.hashtags || []).join(', '))}" placeholder="fitness, coaching">
        </div>
        <button class="btn btn-red" onclick="cpSaveTemplateFromModal(${id ? `'${id}'` : 'null'})"><i class="fas fa-save" style="margin-right:4px;"></i>Sauvegarder</button>
      </div>
    </div>`;
  document.body.appendChild(popup);
}

async function cpSaveTemplateFromModal(id) {
  const title = document.getElementById('cp-tpl-title').value.trim();
  const body = document.getElementById('cp-tpl-body').value.trim();
  const category = document.getElementById('cp-tpl-cat').value;
  const hashtags = document.getElementById('cp-tpl-tags').value.split(',').map(h => h.trim().replace(/^#/, '')).filter(Boolean);

  if (!title || !body) { notify('Titre et contenu requis', 'error'); return; }

  await cpSaveCaptionTemplate({ id: id || undefined, title, body, category, hashtags });
  notify('Template sauvegardé !', 'success');
  document.getElementById('cp-tpl-modal')?.remove();
  _cpCaptionTemplates = await cpLoadCaptionTemplates();
  cpRender();
}

async function cpConfirmDeleteTemplate(id) {
  if (!confirm('Supprimer ce template ?')) return;
  await cpDeleteCaptionTemplate(id);
  _cpCaptionTemplates = await cpLoadCaptionTemplates();
  cpRender();
  notify('Template supprimé', 'success');
}

// ═══════════════════════════════════════
// ── BEST TIME TO POST (heatmap) ──
// ═══════════════════════════════════════

function cpRenderBestTime() {
  const ct = document.getElementById('cp-tab-content');
  const reels = window._bizIgReels || [];

  if (reels.length < 5) {
    ct.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text3);">
      <i class="fas fa-chart-bar" style="font-size:40px;margin-bottom:12px;display:block;"></i>
      <div style="font-size:14px;">Pas assez de données</div>
      <div style="font-size:12px;margin-top:4px;">Publie au moins 5 reels pour voir les meilleurs moments</div>
    </div>`;
    return;
  }

  // Build heatmap: day x hour -> avg engagement
  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const grid = {}; // "day-hour" -> { total_eng, count }

  reels.forEach(r => {
    if (!r.published_at) return;
    const d = new Date(r.published_at);
    const dayIdx = (d.getDay() + 6) % 7; // Mon=0
    const hour = d.getHours();
    const key = `${dayIdx}-${hour}`;
    if (!grid[key]) grid[key] = { total_eng: 0, count: 0 };
    grid[key].total_eng += (r.engagement_rate || 0);
    grid[key].count++;
  });

  // Find max for color scaling
  let maxAvg = 0;
  Object.values(grid).forEach(v => {
    const avg = v.total_eng / v.count;
    if (avg > maxAvg) maxAvg = avg;
  });

  // Build heatmap HTML
  let heatHtml = `
    <h3 style="font-size:16px;font-weight:700;margin-bottom:16px;">Meilleurs moments pour poster</h3>
    <div style="font-size:11px;color:var(--text3);margin-bottom:12px;">Basé sur ${reels.length} publications. Plus c'est rouge, meilleur est l'engagement.</div>
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <tr>
        <td style="padding:4px;font-weight:600;color:var(--text3);"></td>
        ${hours.filter(h => h >= 6 && h <= 23).map(h => `<td style="text-align:center;padding:4px;font-weight:600;color:var(--text3);">${String(h).padStart(2, '0')}h</td>`).join('')}
      </tr>`;

  dayNames.forEach((dayName, dayIdx) => {
    heatHtml += `<tr><td style="padding:6px 8px;font-weight:600;color:var(--text);">${dayName}</td>`;
    hours.filter(h => h >= 6 && h <= 23).forEach(hour => {
      const key = `${dayIdx}-${hour}`;
      const cell = grid[key];
      if (cell) {
        const avg = cell.total_eng / cell.count;
        const intensity = maxAvg > 0 ? avg / maxAvg : 0;
        const r = Math.round(179 * intensity);
        const g = Math.round(8 * (1 - intensity));
        const b = Math.round(8 * (1 - intensity));
        const alpha = 0.2 + intensity * 0.8;
        heatHtml += `<td style="text-align:center;padding:6px;background:rgba(${r},${g},${b},${alpha});border-radius:4px;cursor:pointer;" title="${dayName} ${hour}h — ${avg.toFixed(1)}% eng (${cell.count} posts)">${avg.toFixed(1)}</td>`;
      } else {
        heatHtml += `<td style="text-align:center;padding:6px;background:var(--bg3);border-radius:4px;color:var(--text3);">—</td>`;
      }
    });
    heatHtml += `</tr>`;
  });

  heatHtml += `</table></div>`;

  // Top 5 best slots
  const slots = Object.entries(grid).map(([key, val]) => {
    const [d, h] = key.split('-').map(Number);
    return { day: dayNames[d], hour: h, avg: val.total_eng / val.count, count: val.count };
  }).sort((a, b) => b.avg - a.avg).slice(0, 5);

  heatHtml += `
    <div style="margin-top:24px;">
      <h3 style="font-size:14px;font-weight:700;margin-bottom:10px;">Top 5 créneaux</h3>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${slots.map((s, i) => `
          <div style="padding:10px 16px;background:var(--bg2);border-radius:10px;border:1px solid ${i === 0 ? 'var(--primary)' : 'var(--border)'};text-align:center;">
            <div style="font-size:11px;color:var(--text3);">${s.day}</div>
            <div style="font-size:18px;font-weight:700;color:${i === 0 ? 'var(--primary)' : 'var(--text)'};">${String(s.hour).padStart(2, '0')}h</div>
            <div style="font-size:10px;color:var(--success);">${s.avg.toFixed(1)}% eng</div>
            <div style="font-size:9px;color:var(--text3);">${s.count} post${s.count > 1 ? 's' : ''}</div>
          </div>`).join('')}
      </div>
    </div>`;

  ct.innerHTML = heatHtml;
}
