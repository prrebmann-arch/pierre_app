// ===== POSING TAB =====

let _posingFilter = 'a_traiter';

async function loadAthleteTabPosing() {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div class="text-center" style="padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  const athleteId = currentAthleteId;
  const a = currentAthleteObj;
  if (!a) return;

  // Fetch posing_enabled
  const { data: athlete } = await supabaseClient.from('athletes').select('posing_enabled').eq('id', athleteId).single();
  const enabled = athlete?.posing_enabled || false;

  if (!enabled) {
    el.innerHTML = `
      <div class="card" style="text-align:center;padding:40px;">
        <i class="fas fa-person" style="font-size:36px;color:var(--text3);margin-bottom:16px;"></i>
        <p style="color:var(--text3);margin-bottom:16px;">Posing désactivé pour cet athlète</p>
        <label class="toggle-switch">
          <input type="checkbox" onchange="togglePosingEnabled(this.checked)">
          <span class="switch"></span>
        </label>
      </div>`;
    return;
  }

  // Fetch videos + retours in parallel
  const [{ data: videos }, { data: retours }] = await Promise.all([
    supabaseClient.from('posing_videos').select('*').eq('athlete_id', athleteId).order('created_at', { ascending: false }),
    supabaseClient.from('posing_retours').select('*').eq('athlete_id', athleteId).order('created_at', { ascending: false }),
  ]);

  const allVideos = videos || [];
  const allRetours = retours || [];

  renderPosingTab(el, enabled, allVideos, allRetours);
}

function renderPosingTab(el, enabled, allVideos, allRetours) {
  // Filter videos
  const filtered = allVideos.filter(v => _posingFilter === 'all' ? true : v.status === _posingFilter);
  const countPending = allVideos.filter(v => v.status === 'a_traiter').length;
  const countDone = allVideos.filter(v => v.status === 'traite').length;

  // Toggle
  const toggleHtml = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:13px;color:var(--text2);">Posing activé</span>
        <label class="toggle-switch">
          <input type="checkbox" checked onchange="togglePosingEnabled(this.checked)">
          <span class="switch"></span>
        </label>
      </div>
      <button class="btn btn-red btn-sm" onclick="openPosingRetourModal()">
        <i class="fas fa-video" style="margin-right:4px;"></i> Envoyer une correction
      </button>
    </div>`;

  // Filter buttons
  const filterBtns = [
    { key: 'a_traiter', label: 'À traiter', count: countPending },
    { key: 'traite', label: 'Traité', count: countDone },
    { key: 'all', label: 'Tout', count: allVideos.length },
  ].map(f => `<button class="bo-filter ${_posingFilter === f.key ? 'active' : ''}" onclick="_posingFilter='${f.key}';renderPosingTab(document.getElementById('athlete-tab-content'),true,window._posingVideos,window._posingRetours)">${f.label} <span class="bo-count">${f.count}</span></button>`).join('');

  // Video grid
  let videosHtml = '';
  if (filtered.length) {
    videosHtml = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">` +
      filtered.map(v => {
        const date = new Date(v.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
        const thumb = v.thumbnail_url
          ? `<img src="${escHtml(v.thumbnail_url)}" style="width:100%;height:140px;object-fit:cover;border-radius:8px 8px 0 0;">`
          : `<div style="width:100%;height:140px;background:var(--bg3);border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center;"><i class="fas fa-play-circle" style="font-size:32px;color:var(--text3);"></i></div>`;
        const statusBadge = v.status === 'traite'
          ? '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:var(--success);color:#fff;">Traité</span>'
          : '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:var(--warning);color:#000;">À traiter</span>';
        return `
          <div style="background:var(--bg2);border:var(--card-border);border-radius:8px;cursor:pointer;overflow:hidden;" onclick="viewPosingVideo('${v.id}')">
            ${thumb}
            <div style="padding:10px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                <span style="font-weight:600;font-size:13px;color:var(--text);">${escHtml(v.titre || 'Posing')}</span>
                ${statusBadge}
              </div>
              ${v.commentaire ? `<div style="font-size:11px;color:var(--text3);margin-bottom:4px;">${escHtml(v.commentaire).substring(0, 60)}</div>` : ''}
              <div style="font-size:10px;color:var(--text3);">${date}</div>
            </div>
          </div>`;
      }).join('') + '</div>';
  } else {
    videosHtml = `<div style="text-align:center;padding:30px;color:var(--text3);font-size:13px;">
      <i class="fas fa-inbox" style="font-size:24px;margin-bottom:8px;display:block;"></i>
      Aucune vidéo posing ${_posingFilter === 'a_traiter' ? 'à traiter' : _posingFilter === 'traite' ? 'traitée' : ''}
    </div>`;
  }

  // Retours list
  let retoursHtml = '';
  if (allRetours.length) {
    retoursHtml = allRetours.map(r => {
      const date = new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
      return `
        <div style="background:var(--bg2);border:var(--card-border);border-radius:var(--radius);padding:14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:36px;height:36px;border-radius:8px;background:rgba(179,8,8,0.15);display:flex;align-items:center;justify-content:center;">
              <i class="fas fa-video" style="color:var(--primary);font-size:13px;"></i>
            </div>
            <div>
              <div style="font-weight:600;font-size:13px;">${escHtml(r.titre || 'Correction posing')}</div>
              ${r.commentaire ? `<div style="font-size:11px;color:var(--text2);margin-top:2px;">${escHtml(r.commentaire)}</div>` : ''}
              <div style="font-size:10px;color:var(--text3);margin-top:3px;">${date}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <a href="${escHtml(r.loom_url)}" target="_blank" class="btn btn-outline btn-sm"><i class="fas fa-external-link-alt"></i></a>
            <button class="btn btn-outline btn-sm" onclick="deletePosingRetour('${r.id}')" style="color:var(--danger);"><i class="fas fa-trash"></i></button>
          </div>
        </div>`;
    }).join('');
  } else {
    retoursHtml = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">Aucune correction envoyée</div>';
  }

  // Store for re-render
  window._posingVideos = allVideos;
  window._posingRetours = allRetours;

  el.innerHTML = `
    ${toggleHtml}
    <h3 style="font-size:16px;font-weight:700;margin-bottom:10px;"><i class="fas fa-film" style="color:var(--primary);margin-right:6px;"></i>Vidéos reçues</h3>
    <div class="bo-filters" style="margin-bottom:12px;">${filterBtns}</div>
    ${videosHtml}

    <h3 style="font-size:16px;font-weight:700;margin:24px 0 10px;"><i class="fas fa-comment-dots" style="color:var(--primary);margin-right:6px;"></i>Corrections envoyées</h3>
    ${retoursHtml}`;
}

// ── Toggle posing ──
async function togglePosingEnabled(enabled) {
  const { error } = await supabaseClient.from('athletes').update({ posing_enabled: enabled }).eq('id', currentAthleteId);
  if (error) { handleError(error, 'posing'); return; }
  currentAthleteObj.posing_enabled = enabled;
  notify(enabled ? 'Posing activé' : 'Posing désactivé', 'success');
  loadAthleteTabPosing();
}

// ── View posing video ──
function viewPosingVideo(videoId) {
  const videos = window._posingVideos || [];
  const v = videos.find(x => x.id === videoId);
  if (!v) return;

  const el = document.getElementById('athlete-tab-content');
  const date = new Date(v.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const isPending = v.status === 'a_traiter';

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
      <button class="btn btn-outline btn-sm" onclick="loadAthleteTabPosing()"><i class="fas fa-arrow-left"></i> Retour</button>
      <span style="font-size:15px;font-weight:600;">${escHtml(v.titre || 'Posing')}</span>
      ${isPending
        ? '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:var(--warning);color:#000;">À traiter</span>'
        : '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:var(--success);color:#fff;">Traité</span>'}
    </div>

    <video controls muted playsinline src="${escHtml(v.video_url)}" style="width:100%;max-height:500px;border-radius:10px;background:#000;"></video>

    ${v.commentaire ? `<div style="margin-top:12px;padding:12px;background:var(--bg2);border-radius:8px;font-size:13px;color:var(--text2);"><i class="fas fa-quote-left" style="color:var(--text3);margin-right:6px;"></i>${escHtml(v.commentaire)}</div>` : ''}
    <div style="font-size:11px;color:var(--text3);margin-top:6px;">${date}</div>

    <div style="display:flex;gap:8px;margin-top:16px;">
      ${isPending ? `<button class="btn btn-outline btn-sm" style="color:var(--success);" onclick="markPosingTraite('${v.id}')"><i class="fas fa-check"></i> Marquer traité</button>` : ''}
      <button class="btn btn-red btn-sm" onclick="openPosingRetourModal('${v.id}')"><i class="fas fa-video"></i> Envoyer une correction</button>
    </div>`;
}

// ── Mark as treated ──
async function markPosingTraite(videoId) {
  const { error } = await supabaseClient.from('posing_videos').update({ status: 'traite' }).eq('id', videoId);
  if (error) { handleError(error, 'posing'); return; }
  notify('Vidéo marquée comme traitée', 'success');
  loadAthleteTabPosing();
}

// ── Open correction modal ──
function openPosingRetourModal(videoId) {
  document.getElementById('posing-retour-video-id').value = videoId || '';
  document.getElementById('posing-retour-form').reset();
  if (videoId) document.getElementById('posing-retour-video-id').value = videoId;
  openModal('modal-posing-retour');
}

// ── Submit correction ──
async function submitPosingRetour() {
  const loomUrl = document.getElementById('posing-retour-loom-url').value.trim();
  if (!loomUrl) { notify('L\'URL Loom est obligatoire', 'error'); return; }

  const titre = document.getElementById('posing-retour-titre').value.trim() || 'Correction posing';
  const commentaire = document.getElementById('posing-retour-commentaire').value.trim() || null;
  const videoId = document.getElementById('posing-retour-video-id').value || null;

  const { error } = await supabaseClient.from('posing_retours').insert({
    athlete_id: currentAthleteId,
    coach_id: currentUser.id,
    posing_video_id: videoId,
    loom_url: loomUrl,
    titre,
    commentaire
  });
  if (error) { handleError(error, 'posing'); return; }

  // Notify athlete
  if (currentAthleteObj?.user_id) {
    await notifyAthlete(
      currentAthleteObj.user_id,
      'posing_retour',
      'Correction posing',
      `Votre coach vous a envoyé une correction posing : ${titre}`,
      { loom_url: loomUrl, titre }
    );
  }

  closeModal('modal-posing-retour');
  document.getElementById('posing-retour-form').reset();
  notify('Correction posing envoyée !', 'success');
  loadAthleteTabPosing();
}

// ── Delete retour ──
async function deletePosingRetour(retourId) {
  if (!confirm('Supprimer cette correction ?')) return;
  const { error } = await supabaseClient.from('posing_retours').delete().eq('id', retourId);
  if (error) { handleError(error, 'posing'); return; }
  notify('Correction supprimée', 'success');
  loadAthleteTabPosing();
}
