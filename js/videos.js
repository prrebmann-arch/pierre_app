// ===== VIDÉOS D'EXÉCUTION =====

let _vidsData = [];
let _vidsFilter = 'a_traiter';
let _vidsGlobal = false;

// Auto-cleanup: delete execution videos older than 3 months
async function cleanupOldVideos() {
  if (window._videosCleanupDone) return;
  window._videosCleanupDone = true;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - VIDEO_RETENTION_MONTHS);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  try {
    // Get old videos to delete their storage files too
    const { data: oldVids } = await supabaseClient
      .from('execution_videos')
      .select('id, video_url, thumbnail_url')
      .lt('date', cutoffStr)
      .limit(100);
    if (oldVids?.length) {
      // Delete storage files
      const paths = [];
      oldVids.forEach(v => {
        if (v.video_url) {
          const marker = '/execution-videos/';
          const idx = v.video_url.indexOf(marker);
          if (idx !== -1) paths.push(v.video_url.substring(idx + marker.length).split('?')[0]);
        }
      });
      if (paths.length) {
        await supabaseClient.storage.from('execution-videos').remove(paths);
      }
      // Delete DB rows
      await supabaseClient.from('execution_videos').delete().lt('date', cutoffStr);
      devLog(`[CLEANUP] Supprimé ${oldVids.length} vidéos > 3 mois`);
    }
  } catch (e) {
    devLog('[CLEANUP] Erreur nettoyage vidéos:', e);
  }
}

// ── Global section (sidebar "Vidéos") ──
async function loadVideosSection() {
  const el = document.getElementById('videos-content');
  el.innerHTML = '<div class="text-center" style="padding:60px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

  const coachId = currentUser?.id;
  if (!coachId) return;

  // Cleanup old videos (runs once per session)
  cleanupOldVideos();

  const { data: athletes } = await supabaseClient
    .from('athletes')
    .select('id, prenom, nom, user_id')
    .eq('coach_id', coachId);

  const athleteIds = (athletes || []).map(a => a.id);
  if (!athleteIds.length) {
    el.innerHTML = `
      <div class="page-header"><h1 class="page-title">Vidéos d'exécution</h1></div>
      <div style="text-align:center;padding:60px;color:var(--text3);">
        <i class="fas fa-video" style="font-size:32px;margin-bottom:12px;opacity:0.4;display:block;"></i>
        Aucun athlète
      </div>`;
    return;
  }

  const { data: videos } = await supabaseClient
    .from('execution_videos')
    .select('*')
    .in('athlete_id', athleteIds)
    .order('created_at', { ascending: false })
    .limit(MAX_VIDEOS_LOAD);

  const athleteMap = {};
  (athletes || []).forEach(a => { athleteMap[a.id] = a; });

  _vidsData = (videos || []).map(v => ({ ...v, _athlete: athleteMap[v.athlete_id] }));
  _vidsFilter = 'a_traiter';
  _vidsGlobal = true;

  renderVideosPage(el);
}

// ── Athlete tab ──
async function loadAthleteTabVideos() {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div class="text-center" style="padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  const { data: videos } = await supabaseClient
    .from('execution_videos')
    .select('*')
    .eq('athlete_id', currentAthleteId)
    .order('created_at', { ascending: false })
    .limit(MAX_VIDEOS_LOAD);

  _vidsData = videos || [];
  _vidsFilter = 'a_traiter';
  _vidsGlobal = false;

  renderVideosPage(el);
}

// ── Page (filters + grid) ──
function renderVideosPage(container) {
  const pending = _vidsData.filter(v => v.status === 'a_traiter').length;
  const done = _vidsData.filter(v => v.status === 'traite').length;

  container.innerHTML = `
    ${_vidsGlobal ? '<div class="page-header"><h1 class="page-title">Vidéos d\'exécution</h1></div>' : '<h2 style="font-size:18px;font-weight:600;margin-bottom:16px;">Vidéos d\'exécution</h2>'}
    <div class="vid-filters">
      <button class="vid-filter-btn ${_vidsFilter === 'all' ? 'active' : ''}" onclick="setVidsFilter('all',this)">Toutes <span class="vid-filter-count">${_vidsData.length}</span></button>
      <button class="vid-filter-btn vid-filter-pending ${_vidsFilter === 'a_traiter' ? 'active' : ''}" onclick="setVidsFilter('a_traiter',this)">À traiter <span class="vid-filter-count">${pending}</span></button>
      <button class="vid-filter-btn ${_vidsFilter === 'traite' ? 'active' : ''}" onclick="setVidsFilter('traite',this)">Traités <span class="vid-filter-count">${done}</span></button>
    </div>
    <div id="vids-grid"></div>`;

  renderVideosGrid();
}

// ── Grid ──
function renderVideosGrid() {
  const container = document.getElementById('vids-grid');
  if (!container) return;

  const filtered = _vidsFilter === 'all'
    ? _vidsData
    : _vidsData.filter(v => v.status === _vidsFilter);

  if (!filtered.length) {
    container.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text3);">
      <i class="fas fa-video" style="font-size:32px;margin-bottom:12px;opacity:0.4;display:block;"></i>
      <div style="font-size:14px;">${_vidsFilter === 'a_traiter' ? 'Aucune vidéo à traiter' : _vidsFilter === 'traite' ? 'Aucune vidéo traitée' : 'Aucune vidéo'}</div>
    </div>`;
    return;
  }

  container.innerHTML = '<div class="vid-grid">' + filtered.map(v => {
    const date = new Date(v.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const athleteName = v._athlete ? `${v._athlete.prenom} ${v._athlete.nom}` : '';
    const isPending = v.status === 'a_traiter';

    let thumbContent;
    if (v.thumbnail_url) {
      thumbContent = `<img src="${escHtml(v.thumbnail_url)}" alt="" loading="lazy">`;
    } else if (v.video_url) {
      // Lazy-loaded via IntersectionObserver — data-src, no src yet
      thumbContent = `<video class="vid-lazy" data-src="${escHtml(v.video_url)}" muted playsinline preload="none" style="pointer-events:none;"></video>`;
    } else {
      thumbContent = `<div class="vid-thumb-placeholder"><i class="fas fa-play-circle vid-thumb-play"></i></div>`;
    }

    return `<div class="vid-card" onclick="viewVideoDetail('${v.id}')">
      <div class="vid-thumb">
        ${thumbContent}
        <span class="vid-badge ${isPending ? 'vid-badge-pending' : 'vid-badge-done'}">
          ${isPending ? '<i class="fas fa-circle" style="font-size:6px;margin-right:4px;"></i> À traiter' : '<i class="fas fa-check" style="font-size:9px;margin-right:4px;"></i> Traité'}
        </span>
      </div>
      <div class="vid-info">
        <div class="vid-info-name">${escHtml(v.exercise_name)}</div>
        <div class="vid-info-meta">
          <span>Série ${v.serie_number}</span>
          <span>${date}</span>
        </div>
        ${_vidsGlobal && athleteName ? `<div class="vid-info-athlete">${escHtml(athleteName)}</div>` : ''}
      </div>
    </div>`;
  }).join('') + '</div>';

  // Lazy-load: only when card scrolls into view, set preload="auto" + seek first frame
  lazyLoadThumbnails();
}

function lazyLoadThumbnails() {
  const vids = document.querySelectorAll('.vid-lazy');
  if (!vids.length) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const vid = entry.target;
      obs.unobserve(vid);

      // Create an offscreen video to extract a frame
      const tempVid = document.createElement('video');
      tempVid.crossOrigin = 'anonymous';
      tempVid.muted = true;
      tempVid.playsInline = true;
      tempVid.preload = 'auto';

      tempVid.onloadeddata = function () {
        tempVid.currentTime = 0.5;
      };

      tempVid.onseeked = function () {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = tempVid.videoWidth || 320;
          canvas.height = tempVid.videoHeight || 180;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(tempVid, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

          // Replace the video element with a static image
          const img = document.createElement('img');
          img.src = dataUrl;
          img.alt = '';
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
          vid.replaceWith(img);
        } catch (e) {
          // CORS or other error — fallback: just show the video element with src
          vid.src = vid.dataset.src;
          vid.preload = 'metadata';
        }
        // Free memory
        tempVid.src = '';
        tempVid.load();
      };

      // Fallback if seek doesn't fire (e.g. very short video)
      tempVid.onerror = function () {
        vid.src = vid.dataset.src;
        vid.preload = 'metadata';
      };

      tempVid.src = vid.dataset.src;
    });
  }, { rootMargin: '300px' });

  vids.forEach(v => obs.observe(v));
}

function setVidsFilter(filter, btn) {
  _vidsFilter = filter;
  document.querySelectorAll('.vid-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderVideosGrid();
}

// ── Video detail (native player, no Plyr) ──
async function viewVideoDetail(videoId) {
  const section = _vidsGlobal
    ? document.getElementById('videos-content')
    : document.getElementById('athlete-tab-content');
  section.innerHTML = '<div class="text-center" style="padding:60px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

  const { data: video } = await supabaseClient
    .from('execution_videos')
    .select('*')
    .eq('id', videoId)
    .single();
  if (!video) { notify('Vidéo introuvable', 'error'); return; }

  const { data: athlete } = await supabaseClient
    .from('athletes')
    .select('id, prenom, nom, user_id')
    .eq('id', video.athlete_id)
    .single();

  // All past videos of same exercise for comparative navigation
  const { data: prevVideos } = await supabaseClient
    .from('execution_videos')
    .select('id, video_url, thumbnail_url, date, serie_number')
    .eq('athlete_id', video.athlete_id)
    .eq('exercise_name', video.exercise_name)
    .neq('id', video.id)
    .order('date', { ascending: false })
    .limit(50);
  // Sort oldest → newest for navigation index
  const allPrevSorted = (prevVideos || []).sort((a, b) => a.date.localeCompare(b.date));
  window._vidCompVideos = allPrevSorted;
  // Default: prefer same serie + earlier date, then any earlier, then first available
  const defaultPrev = prevVideos?.find(v => v.serie_number === video.serie_number && v.date < video.date)
    || prevVideos?.find(v => v.date < video.date)
    || prevVideos?.[0]
    || null;
  window._vidCompIdx = defaultPrev ? allPrevSorted.findIndex(v => v.id === defaultPrev.id) : -1;
  const prevVideo = defaultPrev;

  // Navigation
  const filtered = _vidsFilter === 'all' ? _vidsData : _vidsData.filter(v => v.status === _vidsFilter);
  const currentIdx = filtered.findIndex(v => v.id === videoId);
  const prevId = currentIdx > 0 ? filtered[currentIdx - 1].id : null;
  const nextId = currentIdx < filtered.length - 1 ? filtered[currentIdx + 1].id : null;

  const date = new Date(video.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const isPending = video.status === 'a_traiter';
  const backFn = _vidsGlobal ? 'loadVideosSection()' : 'loadAthleteTabVideos()';
  const poster = video.thumbnail_url ? ` poster="${escHtml(video.thumbnail_url)}"` : '';

  section.innerHTML = `
    <div style="margin-bottom:16px;">
      <button class="btn btn-outline btn-sm" onclick="${backFn}"><i class="fas fa-arrow-left"></i> Retour aux vidéos</button>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <div>
        <h2 style="font-size:20px;font-weight:700;margin-bottom:4px;">${escHtml(video.exercise_name)}</h2>
        <div style="font-size:13px;color:var(--text3);">
          <i class="fas fa-layer-group"></i> Série ${video.serie_number}
          &nbsp;&nbsp;<i class="fas fa-calendar"></i> ${date}
          ${athlete ? `&nbsp;&nbsp;<i class="fas fa-user"></i> ${escHtml(athlete.prenom)} ${escHtml(athlete.nom)}` : ''}
          ${video.session_name ? `&nbsp;&nbsp;<i class="fas fa-dumbbell"></i> ${escHtml(video.session_name)}` : ''}
        </div>
      </div>
      <span id="vid-status-badge" class="vid-badge-lg ${isPending ? 'vid-badge-pending' : 'vid-badge-done'}">
        ${isPending ? '<i class="fas fa-circle" style="font-size:6px;margin-right:4px;"></i> À traiter' : '<i class="fas fa-check" style="margin-right:4px;"></i> Traité'}
      </span>
    </div>

    <div class="vid-detail">
      <div class="vid-player-area">
        <div id="vid-players-container" class="vid-players-single">
          ${prevVideo ? `
          <div class="vid-player-col" id="vid-comparative" style="display:none;">
            <div class="vid-player-label" id="vid-prev-label">Séance précédente — ${new Date(prevVideo.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            <div class="vid-player-wrap" style="position:relative;">
              <video id="vid-prev" class="vid-player" controls muted playsinline preload="none"
                     data-src="${escHtml(prevVideo.video_url)}"${prevVideo.thumbnail_url ? ` poster="${escHtml(prevVideo.thumbnail_url)}"` : ''}></video>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
                <button class="btn btn-outline btn-sm" id="vid-comp-prev" onclick="navigateCompVideo(-1)" title="Vidéo plus ancienne"><i class="fas fa-chevron-left"></i></button>
                <span style="font-size:11px;color:var(--text3);" id="vid-comp-counter">${window._vidCompIdx + 1} / ${allPrevSorted.length}</span>
                <button class="btn btn-outline btn-sm" id="vid-comp-next" onclick="navigateCompVideo(1)" title="Vidéo plus récente"><i class="fas fa-chevron-right"></i></button>
              </div>
            </div>
          </div>` : ''}
          <div class="vid-player-col">
            ${prevVideo ? `<div class="vid-player-label" id="vid-label-current" style="display:none;">Séance courante</div>` : ''}
            <div class="vid-player-wrap">
              <video id="vid-main" class="vid-player" controls muted playsinline preload="auto"${poster}
                     src="${escHtml(video.video_url)}"></video>
            </div>
          </div>
        </div>
      </div>

      <div class="vid-feedback-panel">
        ${prevVideo ? `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border-subtle);">
            <span style="font-size:13px;font-weight:600;">Vue comparative</span>
            <label class="toggle-switch" style="margin:0;">
              <input type="checkbox" onchange="toggleComparative(this.checked)">
              <span class="switch"></span>
            </label>
          </div>` : ''}

        <h3 style="font-size:16px;font-weight:600;margin-bottom:6px;">Votre correction</h3>
        <p style="font-size:12px;color:var(--text3);margin-bottom:16px;">Ajoutez un lien vers une vidéo de feedback et/ou des notes.</p>

        <div class="form-group">
          <label><i class="fas fa-link" style="margin-right:6px;"></i>Lien vidéo (Loom, YouTube, etc.)</label>
          <input type="url" id="vid-feedback-url" placeholder="https://www.loom.com/share/..." value="${escHtml(video.coach_feedback_url || '')}">
        </div>

        <div class="form-group">
          <label style="display:flex;align-items:center;justify-content:space-between;">
            Notes de correction
            <button type="button" class="btn btn-outline btn-sm" id="vid-mic-btn" onclick="toggleVoiceRecording('${video.id}')" style="padding:4px 10px;font-size:12px;">
              <i class="fas fa-microphone" id="vid-mic-icon"></i> <span id="vid-mic-label">Vocal</span>
            </button>
          </label>
          <textarea id="vid-feedback-notes" rows="4" placeholder="Points à améliorer, conseils techniques...">${escHtml(video.coach_notes || '')}</textarea>
          <div id="vid-audio-player" style="${video.coach_audio_url ? '' : 'display:none;'}margin-top:8px;">${video.coach_audio_url ? `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg3);border-radius:8px;">
              <audio controls src="${escHtml(video.coach_audio_url)}" style="flex:1;height:32px;"></audio>
              <button type="button" class="btn btn-outline btn-sm" onclick="removeVoiceRecording()" style="padding:4px 8px;color:var(--danger);" title="Supprimer">
                <i class="fas fa-trash"></i>
              </button>
            </div>` : ''}</div>
        </div>

        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;margin-bottom:16px;">
          <input type="checkbox" id="vid-mark-treated" ${!isPending ? 'checked' : ''}>
          Marquer comme traité
        </label>

        <button class="btn btn-red" style="width:100%;" onclick="saveVideoFeedback('${video.id}')">
          <i class="fas fa-save"></i> Enregistrer
        </button>

        <div style="display:flex;justify-content:space-between;margin-top:20px;padding-top:16px;border-top:1px solid var(--border-subtle);">
          <button class="btn btn-outline btn-sm" ${!prevId ? 'disabled' : ''} onclick="${prevId ? `viewVideoDetail('${prevId}')` : ''}">
            <i class="fas fa-chevron-left"></i> Précédent
          </button>
          <button class="btn btn-outline btn-sm" ${!nextId ? 'disabled' : ''} onclick="${nextId ? `viewVideoDetail('${nextId}')` : ''}">
            Suivant <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>

    <div id="vid-training-section"></div>`;

  // Debug + force first frame
  const mainVid = document.getElementById('vid-main');
  if (mainVid) {
    devLog('[VIDEO] URL:', video.video_url);
    devLog('[VIDEO] Element:', mainVid);

    mainVid.onloadedmetadata = function () {
      devLog('[VIDEO] Metadata loaded, duration:', mainVid.duration);
      // Detect portrait video and adapt layout
      if (mainVid.videoWidth && mainVid.videoHeight && mainVid.videoHeight > mainVid.videoWidth) {
        mainVid.closest('.vid-player-wrap')?.classList.add('vid-portrait');
        mainVid.closest('.vid-player-area')?.classList.add('vid-area-portrait');
      }
    };
    mainVid.onloadeddata = function () {
      devLog('[VIDEO] Data loaded, readyState:', mainVid.readyState);
      if (mainVid.currentTime === 0) mainVid.currentTime = 0.001;
    };
    mainVid.oncanplay = function () {
      devLog('[VIDEO] Can play');
    };
    mainVid.onerror = function () {
      const err = mainVid.error;
      devError('[VIDEO] Error:', err?.code, err?.message);
      // Show error to user
      mainVid.parentElement.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--text3);">
          <i class="fas fa-exclamation-triangle" style="font-size:24px;color:var(--primary);margin-bottom:12px;display:block;"></i>
          <div style="font-size:14px;margin-bottom:8px;">Impossible de lire cette vidéo</div>
          <div style="font-size:11px;word-break:break-all;opacity:0.6;">${escHtml(video.video_url || 'URL manquante')}</div>
        </div>`;
    };
    mainVid.onstalled = function () {
      devLog('[VIDEO] Stalled');
    };

    // Force load
    mainVid.load();
  }

  window._vidCurrentAthlete = athlete;
  window._vidCurrentVideo = video;

  // Load training comparison below
  loadVideoTraining(video);
}

// ── Voice recording ──
let _voiceRecorder = null;
let _voiceChunks = [];
let _voiceTimer = null;
let _voiceSeconds = 0;
let _voiceAudioUrl = null; // staged URL (uploaded to storage)
let _voiceVideoId = null;

async function toggleVoiceRecording(videoId) {
  if (_voiceRecorder && _voiceRecorder.state === 'recording') {
    _voiceRecorder.stop();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    _voiceChunks = [];
    _voiceSeconds = 0;
    _voiceVideoId = videoId;
    // Use mp4/aac for iOS compatibility, fallback to webm
    const mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
    const ext = mimeType === 'audio/mp4' ? 'mp4' : 'webm';
    _voiceRecorder = new MediaRecorder(stream, { mimeType });

    _voiceRecorder.ondataavailable = e => { if (e.data.size > 0) _voiceChunks.push(e.data); };
    _voiceRecorder.onstop = async () => {
      clearInterval(_voiceTimer);
      stream.getTracks().forEach(t => t.stop());
      _updateMicUI(false);

      const blob = new Blob(_voiceChunks, { type: mimeType });
      if (blob.size < 500) return; // too short, ignore

      // Upload to Supabase Storage
      const path = `${currentUser.id}/${videoId}_${Date.now()}.${ext}`;
      const micBtn = document.getElementById('vid-mic-btn');
      if (micBtn) { micBtn.disabled = true; micBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi...'; }

      const { error } = await supabaseClient.storage.from('coach-audio').upload(path, blob, { contentType: mimeType, upsert: true });
      if (error) { handleError(error, 'voiceUpload'); if (micBtn) { micBtn.disabled = false; micBtn.innerHTML = '<i class="fas fa-microphone"></i> Vocal'; } return; }

      const { data: signedData } = await supabaseClient.storage.from('coach-audio').createSignedUrl(path, 31536000);
      _voiceAudioUrl = signedData?.signedUrl || null;

      if (micBtn) { micBtn.disabled = false; micBtn.innerHTML = '<i class="fas fa-microphone"></i> Vocal'; }

      // Show mini player
      const playerEl = document.getElementById('vid-audio-player');
      if (playerEl && _voiceAudioUrl) {
        playerEl.style.display = 'block';
        playerEl.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg3);border-radius:8px;">
            <audio controls src="${escHtml(_voiceAudioUrl)}" style="flex:1;height:32px;"></audio>
            <button type="button" class="btn btn-outline btn-sm" onclick="removeVoiceRecording()" style="padding:4px 8px;color:var(--danger);" title="Supprimer">
              <i class="fas fa-trash"></i>
            </button>
          </div>`;
      }
    };

    _voiceRecorder.start();
    _updateMicUI(true);
    _voiceTimer = setInterval(() => {
      _voiceSeconds++;
      const lbl = document.getElementById('vid-mic-label');
      if (lbl) lbl.textContent = `${Math.floor(_voiceSeconds / 60)}:${String(_voiceSeconds % 60).padStart(2, '0')}`;
    }, 1000);
  } catch (err) {
    notify('Impossible d\'accéder au micro', 'error');
    devError('[Voice]', err);
  }
}

function _updateMicUI(recording) {
  const icon = document.getElementById('vid-mic-icon');
  const lbl = document.getElementById('vid-mic-label');
  const btn = document.getElementById('vid-mic-btn');
  if (recording) {
    if (icon) { icon.className = 'fas fa-stop'; icon.style.color = 'var(--danger)'; }
    if (lbl) lbl.textContent = '0:00';
    if (btn) btn.style.borderColor = 'var(--danger)';
  } else {
    if (icon) { icon.className = 'fas fa-microphone'; icon.style.color = ''; }
    if (lbl) lbl.textContent = 'Vocal';
    if (btn) btn.style.borderColor = '';
  }
}

function removeVoiceRecording() {
  _voiceAudioUrl = null;
  const playerEl = document.getElementById('vid-audio-player');
  if (playerEl) { playerEl.style.display = 'none'; playerEl.innerHTML = ''; }
}

// ── Save feedback ──
async function saveVideoFeedback(videoId) {
  const feedbackUrl = document.getElementById('vid-feedback-url')?.value?.trim() || null;
  const notes = document.getElementById('vid-feedback-notes')?.value?.trim() || null;
  const markTreated = document.getElementById('vid-mark-treated')?.checked;
  const audioUrl = _voiceAudioUrl || window._vidCurrentVideo?.coach_audio_url || null;

  const updateData = {
    coach_feedback_url: feedbackUrl,
    coach_notes: notes,
    coach_audio_url: audioUrl,
    status: markTreated ? 'traite' : 'a_traiter'
  };
  if (feedbackUrl || notes || audioUrl) updateData.feedback_at = new Date().toISOString();

  const { error } = await supabaseClient
    .from('execution_videos')
    .update(updateData)
    .eq('id', videoId);
  if (error) { handleError(error, 'videos'); return; }

  const idx = _vidsData.findIndex(v => v.id === videoId);
  if (idx >= 0) Object.assign(_vidsData[idx], updateData);

  const athlete = window._vidCurrentAthlete;
  const video = window._vidCurrentVideo;
  if (athlete?.user_id && (feedbackUrl || notes || audioUrl)) {
    const meta = { video_id: videoId };
    if (feedbackUrl) meta.feedback_url = feedbackUrl;
    if (notes) meta.coach_notes = notes;
    if (audioUrl) meta.audio_url = audioUrl;
    const _t = 'Retour sur votre vidéo';
    const _b = notes || `Votre coach a fait un retour sur ${video?.exercise_name || 'votre exercice'}`;
    await supabaseClient.from('notifications').insert({
      user_id: athlete.user_id, type: 'retour', title: _t, body: _b, metadata: meta
    });
    await sendExpoPush([athlete.user_id], _t, _b, { type: 'retour', ...meta });
  }

  _voiceAudioUrl = null;

  const badge = document.getElementById('vid-status-badge');
  if (badge) {
    if (markTreated) {
      badge.className = 'vid-badge-lg vid-badge-done';
      badge.innerHTML = '<i class="fas fa-check" style="margin-right:4px;"></i> Traité';
    } else {
      badge.className = 'vid-badge-lg vid-badge-pending';
      badge.innerHTML = '<i class="fas fa-circle" style="font-size:6px;margin-right:4px;"></i> À traiter';
    }
  }

  notify('Correction enregistrée !', 'success');
}

// ── Navigate through past comparative videos ──
function navigateCompVideo(dir) {
  const videos = window._vidCompVideos || [];
  if (!videos.length) return;
  let idx = (window._vidCompIdx ?? 0) + dir;
  if (idx < 0) idx = 0;
  if (idx >= videos.length) idx = videos.length - 1;
  window._vidCompIdx = idx;
  const v = videos[idx];
  const vid = document.getElementById('vid-prev');
  const label = document.getElementById('vid-prev-label');
  const counter = document.getElementById('vid-comp-counter');
  if (vid) {
    vid.src = v.video_url;
    vid.poster = v.thumbnail_url || '';
    vid.load();
  }
  if (label) label.textContent = `Séance précédente — ${new Date(v.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  if (counter) counter.textContent = `${idx + 1} / ${videos.length}`;
  document.getElementById('vid-comp-prev')?.toggleAttribute('disabled', idx <= 0);
  document.getElementById('vid-comp-next')?.toggleAttribute('disabled', idx >= videos.length - 1);

  // Sync training comparison below: find log matching this video's date
  const logs = window._vtAllLogs || [];
  if (logs.length) {
    const matchIdx = logs.findIndex(l => l.date === v.date);
    if (matchIdx >= 0) {
      window._vtPrevLogIdx = matchIdx;
      renderVideoTraining(logs[matchIdx], window._vtCurrentLog, window._vtSession, window._vtSessionExs);
    }
  }
}

// ── Comparative toggle ──
function toggleComparative(on) {
  const wrap = document.getElementById('vid-comparative');
  const container = document.getElementById('vid-players-container');
  const labelCurrent = document.getElementById('vid-label-current');
  if (!wrap || !container) return;

  if (on) {
    wrap.style.display = 'block';
    container.classList.remove('vid-players-single');
    container.classList.add('vid-players-side');
    if (labelCurrent) labelCurrent.style.display = 'block';
    const vid = document.getElementById('vid-prev');
    if (vid && vid.dataset.src && !vid.getAttribute('src')) {
      vid.src = vid.dataset.src;
      vid.preload = 'auto';
      vid.load();
    }
  } else {
    wrap.style.display = 'none';
    container.classList.remove('vid-players-side');
    container.classList.add('vid-players-single');
    if (labelCurrent) labelCurrent.style.display = 'none';
  }
}

// ═══════════════════════════════════════════════════
// ── Training comparison below video detail ──
// ═══════════════════════════════════════════════════

async function loadVideoTraining(video) {
  const container = document.getElementById('vid-training-section');
  if (!container) return;

  container.innerHTML = '<div class="text-center" style="padding:30px;"><i class="fas fa-spinner fa-spin"></i></div>';

  // Load exercices DB for autocomplete (if not already loaded)
  if (!window.exercicesDB?.length && typeof loadExercices === 'function') {
    try { await loadExercices(); } catch(e) {}
  }

  // 1. Find the right program + session
  let matchSession = null;
  let program = null;

  // Load all programs + sessions for this athlete
  const { data: allProgs } = await supabaseClient
    .from('workout_programs')
    .select('id, nom, actif, workout_sessions(*)')
    .eq('athlete_id', video.athlete_id)
    .order('actif', { ascending: false });

  const allSessions = [];
  (allProgs || []).forEach(p => {
    (p.workout_sessions || []).forEach(s => {
      allSessions.push({ ...s, _prog: { id: p.id, nom: p.nom, actif: p.actif } });
    });
  });

  // Try 1: exact session_id match
  if (video.session_id) {
    matchSession = allSessions.find(s => s.id === video.session_id);
  }

  // Try 2: session_name match in active program first, then any
  if (!matchSession && video.session_name) {
    matchSession = allSessions.find(s => s.nom === video.session_name && s._prog.actif);
    if (!matchSession) matchSession = allSessions.find(s => s.nom === video.session_name);
  }

  // Try 3: find session containing the exercise (when session_name and session_id are null)
  if (!matchSession && video.exercise_name) {
    const exNameLower = video.exercise_name.toLowerCase();
    // Prefer active program sessions
    for (const s of allSessions) {
      let exs = [];
      try { exs = typeof s.exercices === 'string' ? JSON.parse(s.exercices) : (s.exercices || []); } catch(e) {}
      if (exs.some(e => (e.nom || '').toLowerCase() === exNameLower)) {
        if (!matchSession || (s._prog.actif && !matchSession._prog.actif)) {
          matchSession = s;
        }
      }
    }
  }

  // Try 4: first session of active program (fallback)
  if (!matchSession) {
    matchSession = allSessions.find(s => s._prog.actif);
  }

  if (matchSession) program = matchSession._prog;
  if (!matchSession || !program) { container.innerHTML = ''; return; }

  // Parse session exercises and ensure numeric types
  let sessionExs = [];
  try { sessionExs = typeof matchSession.exercices === 'string' ? JSON.parse(matchSession.exercices) : (matchSession.exercices || []); } catch(e) {}
  // Normalize to new sets format
  sessionExs = sessionExs.map(e => {
    const ex = { ...e };
    if (!ex.sets) ex.sets = _vtNormalizeExSets(ex);
    return ex;
  });

  // 3. Workout logs for this session
  // Try by session_id first (current program)
  let { data: logs } = await supabaseClient
    .from('workout_logs')
    .select('*')
    .eq('session_id', matchSession.id)
    .order('date', { ascending: false })
    .limit(30);

  // Fallback: session_id changes when coach re-saves program → search by athlete + session name
  if (!logs?.length && (video.session_name || matchSession.nom)) {
    ({ data: logs } = await supabaseClient
      .from('workout_logs')
      .select('*')
      .eq('athlete_id', video.athlete_id)
      .eq('session_name', video.session_name || matchSession.nom)
      .order('date', { ascending: false })
      .limit(30));
  }

  // Find current (matching video date) and previous (different date)
  const allLogs = logs || [];
  const currentLog = allLogs.find(l => l.date === video.date);
  const currentIdx = currentLog ? allLogs.indexOf(currentLog) : -1;
  // Find first log with a DIFFERENT date for comparison (skip same date entirely)
  let defaultPrevIdx = -1;
  for (let i = 0; i < allLogs.length; i++) {
    if (allLogs[i].date !== video.date) {
      defaultPrevIdx = i;
      break;
    }
  }

  // Find active program session for the EDITOR (always show current program, not old one)
  const activeProg = (allProgs || []).find(p => p.actif);
  let editSession = matchSession;
  let editProgram = program;
  let editSessionExs = [...sessionExs];
  if (activeProg && activeProg.id !== program.id) {
    // The video is from an old program — use first session of active program for editor
    const activeSessions = (activeProg.workout_sessions || []).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    if (activeSessions.length) {
      editSession = activeSessions[0];
      editProgram = { id: activeProg.id, nom: activeProg.nom, actif: true };
      try { editSessionExs = typeof editSession.exercices === 'string' ? JSON.parse(editSession.exercices) : (editSession.exercices || []); } catch { editSessionExs = []; }
      editSessionExs = editSessionExs.map(e => { const ex = { ...e }; if (!ex.sets) ex.sets = _vtNormalizeExSets(ex); return ex; });
    }
  }

  // Store for editing + navigation
  window._vtSession = matchSession;
  window._vtEditSession = editSession;
  window._vtEditSessionExs = editSessionExs;
  window._vtEditProgramId = editProgram.id;
  window._vtSessionExs = [...sessionExs];
  window._vtProgramId = program.id;
  window._vtAllLogs = allLogs;
  window._vtCurrentLog = currentLog;
  window._vtPrevLogIdx = defaultPrevIdx;

  const prevLog = defaultPrevIdx >= 0 ? allLogs[defaultPrevIdx] : null;
  // Safety: if prevLog has the same date as the video, discard it (no real comparison)
  const safePrevLog = (prevLog && prevLog.date === video.date) ? null : prevLog;
  renderVideoTraining(safePrevLog, currentLog, matchSession, sessionExs);
}

// Navigate through previous logs
function navigateVtPrevLog(dir) {
  const logs = window._vtAllLogs || [];
  const video = window._vidCurrentVideo;
  const videoDate = video?.date;
  let idx = (window._vtPrevLogIdx ?? 0) + dir;
  // Skip logs from the same date as the video
  while (idx >= 0 && idx < logs.length && logs[idx].date === videoDate) idx += dir;
  if (idx < 0 || idx >= logs.length) return;
  window._vtPrevLogIdx = idx;
  const session = window._vtSession;
  const sessionExs = window._vtSessionExs;
  // Re-render with new prev log, keep highlight for current video's exercise
  renderVideoTraining(logs[idx], window._vtCurrentLog, session, sessionExs);
}

function _parseLogExs(log) {
  if (!log) return [];
  try {
    return (typeof log.exercices_completes === 'string' ? JSON.parse(log.exercices_completes) : log.exercices_completes) || [];
  } catch(e) { return []; }
}

function _fmtDateShort(d) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

function renderVideoTraining(prevLog, currentLog, session, sessionExs) {
  const container = document.getElementById('vid-training-section');
  if (!container) return;

  const video = window._vidCurrentVideo;
  const videoExName = (video?.exercise_name || '').toLowerCase();
  const videoSerie = video?.serie_number;

  // Check if prev log has a matching comparative video for highlight
  const compVideos = window._vidCompVideos || [];
  const compVideo = prevLog ? compVideos.find(v => v.date === prevLog.date) : null;
  const prevHighlightExName = compVideo ? (video?.exercise_name || '').toLowerCase() : '';
  const prevHighlightSerie = compVideo ? compVideo.serie_number : null;

  const prevExs = _parseLogExs(prevLog);
  const currentExs = _parseLogExs(currentLog);

  // Build master exercise list preserving duplicates (by index)
  // Use programmed exercises as base, then add extras from logs
  const masterExs = sessionExs.map((e, i) => ({ nom: e.nom || '', idx: i }));
  const usedPrevForMaster = new Set();
  const usedCurForMaster = new Set();
  // Check for log exercises not in program
  const addExtras = (list, usedSet) => {
    list.forEach((e, i) => {
      const name = (e.nom || '').toLowerCase();
      const alreadyInMaster = masterExs.some((m, mi) => {
        if (m.nom.toLowerCase() === name && !usedSet.has(mi)) { usedSet.add(mi); return true; }
        return false;
      });
      if (!alreadyInMaster) masterExs.push({ nom: e.nom, idx: masterExs.length });
    });
  };
  addExtras(prevExs, usedPrevForMaster);
  addExtras(currentExs, usedCurForMaster);

  // Position-aware matching: track used indices to handle duplicates
  const matchByPos = (name, list, usedSet) => {
    for (let i = 0; i < list.length; i++) {
      if (usedSet.has(i)) continue;
      if ((list[i].nom || '').toLowerCase() === name.toLowerCase()) {
        usedSet.add(i);
        return list[i];
      }
    }
    return null;
  };

  const usedPrev = new Set();
  const usedCur = new Set();
  let videoHighlightDone = false;
  let prevHighlightDone = false;

  // Render sets for one exercise cell
  const renderSets = (ex, cmpEx, isCurrentCol, highlightThisEx, highlightSerieNum) => {
    if (!ex) return '<div style="padding:12px 0;color:var(--text3);font-size:12px;text-align:center;">—</div>';
    const series = ex.series || [];
    const hlSerie = highlightSerieNum ?? videoSerie;
    return `
      <div class="vt-sets">
        <div class="vt-set-head"><span>SÉRIE</span><span>KG</span><span>REPS</span></div>
        ${series.map((s, si) => {
          const kg = s.kg ?? s.load ?? '-';
          const reps = s.reps ?? '-';
          const cmpSeries = cmpEx?.series || [];
          const cs = cmpSeries[si];
          let icon = '';
          if (cs && isCurrentCol) {
            const curVol = (parseFloat(reps)||0) * (parseFloat(kg)||1);
            const prevVol = (parseFloat(cs.reps)||0) * (parseFloat(cs.kg ?? cs.load)||1);
            if (curVol > prevVol) icon = '<i class="fas fa-arrow-up vt-up"></i>';
            else if (curVol < prevVol) icon = '<i class="fas fa-arrow-down vt-down"></i>';
            else icon = '<i class="fas fa-equals vt-eq"></i>';
          }
          const isHighlight = highlightThisEx && (si + 1) === hlSerie;
          return `<div class="vt-set-row${isHighlight ? ' vt-set-active' : ''}"><span><i class="fas fa-layer-group" style="font-size:9px;opacity:0.4;margin-right:4px;"></i>${si+1}</span><span>${kg}</span><span>${reps} ${icon}</span></div>`;
        }).join('')}
      </div>`;
  };

  // Rows — each exercise aligned across columns, duplicates handled by position
  const rowsHtml = masterExs.map(m => {
    const name = m.nom;
    const prevEx = matchByPos(name, prevExs, usedPrev);
    const curEx = matchByPos(name, currentExs, usedCur);
    const prevSets = prevEx?.series?.length || 0;
    const curSets = curEx?.series?.length || 0;
    const missed = !curEx;

    // Highlight in CURRENT column (right): the exercise+serie from the video
    let highlightCurEx = false;
    if (!videoHighlightDone && name.toLowerCase() === videoExName) {
      highlightCurEx = true;
      videoHighlightDone = true;
    }
    // Highlight in PREV column (left): only if comparative video exists for that prev date
    let highlightPrevEx = false;
    if (!prevHighlightDone && prevEx && prevHighlightExName && name.toLowerCase() === prevHighlightExName) {
      highlightPrevEx = true;
      prevHighlightDone = true;
    }

    const rowHighlight = highlightCurEx || highlightPrevEx;
    return `<div class="vt-comp-row${rowHighlight ? ' vt-comp-row-active' : ''}">
      <div class="vt-comp-cell">
        <div class="vt-ex-header">
          <span class="vt-ex-name">${escHtml(name)}</span>
          <span class="vt-ex-count">${prevSets} série${prevSets > 1 ? 's' : ''}</span>
        </div>
        ${renderSets(prevEx, null, false, highlightPrevEx, prevHighlightSerie)}
      </div>
      <div class="vt-comp-cell">
        <div class="vt-ex-header">
          <span class="vt-ex-name${missed ? ' vt-ex-missed' : ''}">${escHtml(name)}</span>
          <span class="vt-ex-count">${curSets} série${curSets > 1 ? 's' : ''}</span>
          ${highlightCurEx ? `<span style="font-size:10px;color:var(--primary);font-weight:700;"><i class="fas fa-video" style="margin-right:3px;"></i>Série ${videoSerie}</span>` : ''}
        </div>
        ${renderSets(curEx, prevEx, true, highlightCurEx)}
      </div>
    </div>`;
  }).join('');

  // Headers
  const allLogs = window._vtAllLogs || [];
  const prevIdx = window._vtPrevLogIdx ?? -1;
  const totalLogs = allLogs.length;
  // Current log index in the full list (for display: exclude it from nav count)
  const currentLogIdx = currentLog ? allLogs.indexOf(currentLog) : -1;

  const _vtDuration = (lg) => {
    if (!lg?.started_at || !lg?.finished_at) return null;
    return Math.round((new Date(lg.finished_at) - new Date(lg.started_at)) / 60000);
  };
  const _vtDurFmt = (d) => d >= 60 ? Math.floor(d/60) + 'h' + String(d%60).padStart(2,'0') : d + ' min';

  const prevDur = _vtDuration(prevLog);
  const curDur = _vtDuration(currentLog);

  const prevHeader = prevLog
    ? `<div class="vt-col-session">${escHtml(session.nom || '')}</div><div class="vt-col-meta"><i class="fas fa-calendar"></i> ${_fmtDateShort(prevLog.date)}${prevDur ? '&nbsp;&nbsp;<i class="fas fa-clock"></i> ' + _vtDurFmt(prevDur) : ''}</div>`
    : '<div style="color:var(--text3);font-size:13px;">Aucune donnée</div>';
  const curHeader = currentLog
    ? `<div class="vt-col-session">${escHtml(session.nom || '')}</div><div class="vt-col-meta"><i class="fas fa-calendar"></i> ${_fmtDateShort(currentLog.date)}${curDur ? '&nbsp;&nbsp;<i class="fas fa-clock"></i> ' + _vtDurFmt(curDur) : ''}</div>`
    : '<div style="color:var(--text3);font-size:13px;">Aucune donnée</div>';

  // Navigation arrows for prev log (skip currentLogIdx)
  const canPrevOlder = prevIdx < totalLogs - 1;
  const canPrevNewer = prevIdx > 0 && prevIdx !== currentLogIdx;

  const editColHtml = renderVtEditCol(window._vtEditSession || session, window._vtEditSessionExs || sessionExs);

  container.innerHTML = `
    <div class="vt-section">
      <div class="vt-grid">
        <div class="vt-comparison" id="vt-comparison-area">
          <div class="vt-comp-headers">
            <div class="vt-comp-header-cell">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <div class="vt-col-title">Séance précédente</div>
                <div style="display:flex;gap:4px;">
                  <button class="btn btn-outline btn-sm" onclick="navigateVtPrevLog(-1)" ${!canPrevNewer ? 'disabled' : ''} title="Plus récent"><i class="fas fa-chevron-left"></i></button>
                  <button class="btn btn-outline btn-sm" onclick="navigateVtPrevLog(1)" ${!canPrevOlder ? 'disabled' : ''} title="Plus ancien"><i class="fas fa-chevron-right"></i></button>
                </div>
              </div>
              ${prevHeader}
            </div>
            <div class="vt-comp-header-cell">
              <div class="vt-col-title">Séance courante</div>
              ${curHeader}
            </div>
          </div>
          ${rowsHtml}
        </div>
        ${editColHtml}
      </div>
    </div>`;
}

function _vtNormalizeExSets(ex) {
  if (ex.sets && Array.isArray(ex.sets)) return ex.sets;
  const count = parseInt(ex.series) || 3;
  const reps = ex.reps || '10';
  const tempo = ex.tempo || '30X1';
  const sets = [];
  for (let i = 0; i < count; i++) sets.push({ reps, tempo, repos: '1m30', type: 'normal' });
  return sets;
}

function _vtBuildSetRow(exIdx, setIdx, set) {
  if (set.type === 'dropset') {
    const isMax = set.reps === 'MAX';
    return `<tr class="tp-set-row tp-set-drop" data-type="dropset">
      <td class="tp-set-num"><span class="tp-set-type-tag tp-tag-drop">DROP</span></td>
      <td>${isMax ? `<span class="tp-maxrep-tag">MAX REP</span><input type="hidden" class="tp-set-reps" value="MAX">` : `<input type="text" class="tp-set-reps" value="${escHtml(set.reps||'10')}" placeholder="10">`} <label class="tp-maxrep-toggle"><input type="checkbox" ${isMax ? 'checked' : ''} onchange="vtToggleDropMaxRep(${exIdx},${setIdx},this.checked)"><span>Max</span></label></td>
      <td><input type="text" class="tp-set-tempo" value="${escHtml(set.tempo||'30X1')}" placeholder="30X1"></td>
      <td><span style="color:var(--text3);font-size:11px;">—</span></td>
      <td><button class="tp-set-del" onclick="vtRemoveSet(${exIdx},${setIdx})"><i class="fas fa-times"></i></button></td>
    </tr>`;
  }
  if (set.type === 'rest_pause') {
    return `<tr class="tp-set-row tp-set-rp" data-type="rest_pause">
      <td class="tp-set-num"><span class="tp-set-type-tag tp-tag-rp">RP</span></td>
      <td class="tp-rp-params"><input type="text" class="tp-set-reps" value="${escHtml(set.reps||'12')}" placeholder="12" style="width:30px;"><span class="tp-rp-lbl">reps</span> <input type="text" class="tp-set-reps-rp" value="${escHtml(set.reps_rp||'20')}" placeholder="20" style="width:30px;"><span class="tp-rp-lbl">total</span> <span class="tp-rp-lbl">RP</span> <input type="text" class="tp-set-rp-time" value="${escHtml(set.rest_pause_time||'15')}" placeholder="15" style="width:28px;"><span class="tp-rp-lbl">s</span></td>
      <td><span style="color:var(--text3);font-size:11px;">—</span></td>
      <td><span style="color:var(--text3);font-size:11px;">—</span></td>
      <td><button class="tp-set-del" onclick="vtRemoveSet(${exIdx},${setIdx})"><i class="fas fa-times"></i></button></td>
    </tr>`;
  }
  return `<tr class="tp-set-row" data-type="normal">
    <td class="tp-set-num">${setIdx+1}</td>
    <td><input type="text" class="tp-set-reps" value="${escHtml(set.reps||'10')}" placeholder="8-12"></td>
    <td><input type="text" class="tp-set-tempo" value="${escHtml(set.tempo||'30X1')}" placeholder="30X1"></td>
    <td><input type="text" class="tp-set-repos" value="${escHtml(set.repos||'1m30')}" placeholder="1m30"></td>
    <td><button class="tp-set-del" onclick="vtRemoveSet(${exIdx},${setIdx})"><i class="fas fa-times"></i></button></td>
  </tr>`;
}

function renderVtEditCol(session, exs) {
  // Normalize all exercises to new sets format
  exs.forEach(ex => { if (!ex.sets) ex.sets = _vtNormalizeExSets(ex); });
  const totalSeries = exs.reduce((a, e) => a + (e.sets?.length || 0), 0);

  const videoExName = (window._vidCurrentVideo?.exercise_name || '').toLowerCase();

  const exsHtml = exs.map((ex, idx) => {
    const sets = ex.sets || [];
    const setsHtml = sets.map((set, si) => _vtBuildSetRow(idx, si, set)).join('');
    const superBadge = ex.superset_id ? `<span class="tp-superset-badge">SS ${escHtml(ex.superset_id)}</span>` : '';
    const muscle = ex.muscle_principal || '';
    const isVideoEx = (ex.nom || '').toLowerCase() === videoExName;

    return `
    <div class="tr-exercise-card${isVideoEx ? ' vt-edit-highlight' : ''}" data-superset="${escHtml(ex.superset_id||'')}">
      <div class="tr-exercise-header">
        <span class="tr-exercise-num">${idx+1}.</span>
        <input type="text" class="tp-ed-name vt-input-name" id="vt-nom-${idx}" value="${escHtml(ex.nom||'')}" placeholder="Nom" list="vt-datalist" style="flex:1;background:transparent;border:none;color:var(--text);font-size:13px;font-weight:600;font-family:inherit;outline:none;">
        ${superBadge}
        ${muscle ? `<span class="tr-exercise-muscle-chip">${escHtml(muscle)}</span>` : ''}
        <div class="tr-exercise-actions">
          <div class="tp-ex-menu-wrap">
            <button class="tp-ex-menu-btn" onclick="toggleVtExMenu(this)" title="Options"><i class="fas fa-ellipsis-v"></i></button>
            <div class="tp-ex-menu">
              <button onclick="vtToggleSuperset(${idx})"><i class="fas fa-link"></i> Super set</button>
              <button onclick="vtAddDropSet(${idx})"><i class="fas fa-angle-double-down"></i> Drop set</button>
              <button onclick="vtAddRestPause(${idx})"><i class="fas fa-pause"></i> Rest-pause</button>
              <hr>
              <button onclick="removeVtExercise(${idx})" style="color:var(--danger);"><i class="fas fa-trash"></i> Supprimer</button>
            </div>
          </div>
        </div>
      </div>
      <table class="tp-sets-table">
        <thead><tr><th>#</th><th>Reps</th><th>Tempo</th><th>Repos</th><th></th></tr></thead>
        <tbody>${setsHtml}</tbody>
      </table>
      <button class="tp-add-set-btn" onclick="vtAddSet(${idx})"><i class="fas fa-plus"></i> Série</button>
    </div>`;
  }).join('');

  const dbOptions = (window.exercicesDB || []).map(e => `<option value="${escHtml(e.nom)}">`).join('');

  return `<div class="vt-col vt-col-edit" id="vt-edit-col">
    <div class="vt-col-header">
      <div class="vt-col-title">Modifier la séance</div>
    </div>
    <datalist id="vt-datalist">${dbOptions}</datalist>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <input type="text" class="inline-input" id="vt-session-nom" value="${escHtml(session.nom || '')}" placeholder="Nom de la séance">
    </div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px;"><i class="fas fa-dumbbell" style="margin-right:4px;"></i> ${exs.length} exercice${exs.length > 1 ? 's' : ''} — ${totalSeries} séries</div>
    ${exsHtml}
    <button class="btn btn-outline btn-sm" onclick="addVtExercise()" style="margin-top:10px;width:100%;"><i class="fas fa-plus"></i> Exercice</button>
    <button class="btn btn-red" onclick="saveVtSession()" style="width:100%;margin-top:12px;"><i class="fas fa-save"></i> Enregistrer les modifications</button>
  </div>`;
}

// ── Edit helpers ──

function toggleVtExMenu(btn) {
  const menu = btn.nextElementSibling;
  const isOpen = menu.classList.contains('open');
  document.querySelectorAll('.tp-ex-menu.open').forEach(m => m.classList.remove('open'));
  if (!isOpen) menu.classList.add('open');
}

function _syncVtInputs() {
  window._vtSessionExs.forEach((ex, i) => {
    const nomInput = document.getElementById(`vt-nom-${i}`);
    if (nomInput) ex.nom = nomInput.value.trim();
    // Sync sets from DOM
    const card = document.querySelectorAll('#vt-edit-col .tr-exercise-card')[i];
    if (!card) return;
    const rows = card.querySelectorAll('.tp-set-row');
    if (!rows.length) return;
    ex.sets = [];
    rows.forEach(row => {
      const type = row.dataset.type || 'normal';
      const set = { type };
      set.reps = row.querySelector('.tp-set-reps')?.value || '10';
      if (type === 'normal') {
        set.tempo = row.querySelector('.tp-set-tempo')?.value || '30X1';
        set.repos = row.querySelector('.tp-set-repos')?.value || '1m30';
      } else if (type === 'dropset') {
        set.tempo = row.querySelector('.tp-set-tempo')?.value || '30X1';
        set.repos = '';
      } else if (type === 'rest_pause') {
        set.reps_rp = row.querySelector('.tp-set-reps-rp')?.value || '20';
        set.rest_pause_time = row.querySelector('.tp-set-rp-time')?.value || '15';
      }
      ex.sets.push(set);
    });
  });
}

function addVtExercise() {
  _syncVtInputs();
  window._vtSessionExs.push({ nom: '', sets: [{ reps: '10', tempo: '30X1', repos: '1m30', type: 'normal' }] });
  _rerenderVtEdit();
}

function removeVtExercise(idx) {
  _syncVtInputs();
  window._vtSessionExs.splice(idx, 1);
  _rerenderVtEdit();
}

function vtAddSet(idx) {
  _syncVtInputs();
  const ex = window._vtSessionExs[idx];
  if (!ex) return;
  if (!ex.sets) ex.sets = _vtNormalizeExSets(ex);
  ex.sets.push({ reps: '10', tempo: '30X1', repos: '1m30', type: 'normal' });
  _rerenderVtEdit();
}

function vtRemoveSet(exIdx, setIdx) {
  _syncVtInputs();
  const ex = window._vtSessionExs[exIdx];
  if (!ex?.sets) return;
  if (ex.sets.length <= 1) { notify('Il faut au moins une série', 'warning'); return; }
  ex.sets.splice(setIdx, 1);
  _rerenderVtEdit();
}

function vtAddDropSet(idx) {
  _syncVtInputs();
  const ex = window._vtSessionExs[idx];
  if (!ex) return;
  if (!ex.sets) ex.sets = _vtNormalizeExSets(ex);
  document.querySelectorAll('.tp-ex-menu.open').forEach(m => m.classList.remove('open'));
  ex.sets.push({ reps: '10', tempo: '30X1', repos: '', type: 'dropset' });
  _rerenderVtEdit();
}

function vtAddRestPause(idx) {
  _syncVtInputs();
  const ex = window._vtSessionExs[idx];
  if (!ex) return;
  if (!ex.sets) ex.sets = _vtNormalizeExSets(ex);
  document.querySelectorAll('.tp-ex-menu.open').forEach(m => m.classList.remove('open'));
  ex.sets.push({ reps: '12', reps_rp: '20', rest_pause_time: '15', type: 'rest_pause' });
  _rerenderVtEdit();
}

function vtToggleDropMaxRep(exIdx, setIdx, isMax) {
  _syncVtInputs();
  const ex = window._vtSessionExs[exIdx];
  if (!ex?.sets?.[setIdx]) return;
  ex.sets[setIdx].reps = isMax ? 'MAX' : '10';
  _rerenderVtEdit();
}

function vtToggleSuperset(exIdx) {
  _syncVtInputs();
  const exercises = window._vtSessionExs;
  const ex = exercises[exIdx];
  document.querySelectorAll('.tp-ex-menu.open').forEach(m => m.classList.remove('open'));
  if (ex.superset_id) {
    const groupLetter = ex.superset_id.charAt(0);
    exercises.forEach(e => { if (e.superset_id && e.superset_id.charAt(0) === groupLetter) delete e.superset_id; });
  } else {
    const nextEx = exercises[exIdx + 1];
    if (!nextEx) { notify('Ajoutez un exercice après celui-ci pour créer un super set', 'warning'); return; }
    const usedLetters = new Set(exercises.map(e => e.superset_id ? e.superset_id.charAt(0) : null).filter(Boolean));
    let letter = 'A';
    while (usedLetters.has(letter)) letter = String.fromCharCode(letter.charCodeAt(0) + 1);
    ex.superset_id = letter + '1';
    nextEx.superset_id = letter + '2';
  }
  _rerenderVtEdit();
}

function _rerenderVtEdit() {
  const el = document.getElementById('vt-edit-col');
  if (el) {
    el.outerHTML = renderVtEditCol(window._vtEditSession || window._vtSession, window._vtEditSessionExs || window._vtSessionExs);
  }
}

async function saveVtSession() {
  _syncVtInputs();
  const nom = document.getElementById('vt-session-nom')?.value?.trim();
  if (!nom) { notify('Nom de séance requis', 'warning'); return; }

  const exercises = window._vtSessionExs.filter(e => e.nom);
  if (!exercises.length) { notify('Ajoutez au moins un exercice', 'warning'); return; }

  const { error } = await supabaseClient
    .from('workout_sessions')
    .update({ nom, exercices: JSON.stringify(exercises) })
    .eq('id', (window._vtEditSession || window._vtSession).id);
  if (error) { handleError(error, 'training'); return; }

  window._vtSession.nom = nom;
  window._vtSession.exercices = exercises;
  window._vtSessionExs = [...exercises];
  notify('Séance modifiée !', 'success');
}
