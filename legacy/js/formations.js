// ===== FORMATIONS (Pierre Coaching Protocol) =====

let currentFormationId = null;

// ── Load & render all formations ──
async function loadFormations() {
  const el = document.getElementById('formations-content');
  if (!el) return;

  const [fRes, mRes] = await Promise.all([
    supabaseClient.from('formations').select('*').eq('coach_id', currentUser.id).order('created_at', { ascending: false }),
    supabaseClient.from('formation_members').select('formation_id, athlete_id')
  ]);

  if (fRes.error) { devError('[formations]', fRes.error); el.innerHTML = '<div class="card" style="padding:24px;color:var(--danger);">Erreur de chargement</div>'; return; }

  const formations = fRes.data || [];
  const members = mRes.data || [];

  // Build member count map
  const memberCountMap = {};
  members.forEach(m => { memberCountMap[m.formation_id] = (memberCountMap[m.formation_id] || 0) + 1; });

  let html = `
    <div class="page-header">
      <h1 class="page-title">Formation</h1>
      <button class="btn btn-red" onclick="openCreateFormationModal()">
        <i class="fas fa-plus"></i> Nouvelle formation
      </button>
    </div>`;

  if (!formations.length) {
    html += '<div class="card"><div class="empty-state"><i class="fas fa-graduation-cap"></i><p>Aucune formation créée</p><p style="font-size:12px;color:var(--text3);margin-top:8px;">Créez votre première formation pour commencer.</p></div></div>';
  } else {
    html += '<div class="fm-grid">';
    formations.forEach(f => {
      const audienceLabel = f.visibility === 'selected'
        ? `<i class="fas fa-user-check"></i> ${memberCountMap[f.id] || 0} athlète${(memberCountMap[f.id] || 0) > 1 ? 's' : ''}`
        : '<i class="fas fa-users"></i> Tous les athlètes';
      html += `
        <div class="fm-card" onclick="viewFormation('${f.id}')">
          <div class="fm-card-icon"><i class="fas fa-play-circle"></i></div>
          <div class="fm-card-body">
            <div class="fm-card-title">${escHtml(f.title)}</div>
            ${f.description ? `<div class="fm-card-desc">${escHtml(f.description)}</div>` : ''}
            <div class="fm-card-meta" style="display:flex;gap:12px;flex-wrap:wrap;">
              <span>${f.video_count || 0} vidéo${(f.video_count || 0) > 1 ? 's' : ''}</span>
              <span>${audienceLabel}</span>
            </div>
          </div>
          <button class="fm-card-del" onclick="event.stopPropagation();deleteFormation('${f.id}','${escHtml(f.title)}')" title="Supprimer">
            <i class="fas fa-trash"></i>
          </button>
        </div>`;
    });
    html += '</div>';
  }

  el.innerHTML = html;
}

// ── Create formation modal ──
async function openCreateFormationModal() {
  // Fetch athletes for selection
  const { data: athletes } = await supabaseClient
    .from('athletes')
    .select('id, prenom, nom, email')
    .eq('coach_id', currentUser.id)
    .order('prenom');

  const aths = athletes || [];

  let html = `
    <div class="modal-overlay open" id="fm-create-modal" onclick="if(event.target===this)this.classList.remove('open')">
      <div class="modal" style="max-width:520px;">
        <div class="modal-header">
          <div class="modal-title">Nouvelle formation</div>
          <button class="modal-close" onclick="document.getElementById('fm-create-modal').classList.remove('open')"><i class="fas fa-times"></i></button>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div>
            <label class="field-label">Nom de la formation *</label>
            <input type="text" id="fm-create-title" class="field-input" placeholder="Ex: Programme débutant">
          </div>
          <div>
            <label class="field-label">Description</label>
            <textarea id="fm-create-desc" class="field-input" rows="2" placeholder="Optionnel"></textarea>
          </div>
          <div>
            <label class="field-label">Accès</label>
            <div style="display:flex;gap:8px;margin-top:4px;">
              <button class="btn btn-outline fm-visibility-btn active" data-vis="all" onclick="setFormationVisibility('all')">
                <i class="fas fa-users"></i> Tous les athlètes
              </button>
              <button class="btn btn-outline fm-visibility-btn" data-vis="selected" onclick="setFormationVisibility('selected')">
                <i class="fas fa-user-check"></i> Sélection
              </button>
            </div>
          </div>
          <div id="fm-create-athletes" style="display:none;">
            <label class="field-label">Athlètes</label>
            <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm);margin-top:4px;">
              ${aths.length ? aths.map(a => `
                <label class="fm-athlete-row" style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);">
                  <input type="checkbox" class="fm-athlete-cb" value="${a.id}">
                  <span style="font-size:14px;color:var(--text);">${escHtml(a.prenom)} ${escHtml(a.nom)}</span>
                  <span style="font-size:12px;color:var(--text3);margin-left:auto;">${escHtml(a.email)}</span>
                </label>
              `).join('') : '<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px;">Aucun athlète</div>'}
            </div>
            <button class="btn btn-outline" style="margin-top:8px;font-size:12px;" onclick="toggleAllFormationAthletes()">
              <i class="fas fa-check-double"></i> Tout sélectionner / désélectionner
            </button>
          </div>
          <button class="btn btn-red" style="margin-top:8px;" onclick="submitCreateFormation()">
            <i class="fas fa-check"></i> Créer la formation
          </button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}

function setFormationVisibility(vis) {
  document.querySelectorAll('.fm-visibility-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.vis === vis);
  });
  const athleteDiv = document.getElementById('fm-create-athletes');
  if (athleteDiv) athleteDiv.style.display = vis === 'selected' ? 'block' : 'none';
}

function toggleAllFormationAthletes() {
  const cbs = document.querySelectorAll('.fm-athlete-cb');
  const allChecked = [...cbs].every(cb => cb.checked);
  cbs.forEach(cb => cb.checked = !allChecked);
}

async function submitCreateFormation() {
  const title = document.getElementById('fm-create-title')?.value?.trim();
  if (!title) { alert('Le nom est obligatoire'); return; }
  const description = document.getElementById('fm-create-desc')?.value?.trim() || '';
  const activeBtn = document.querySelector('.fm-visibility-btn.active');
  const visibility = activeBtn?.dataset.vis || 'all';

  const selectedAthletes = visibility === 'selected'
    ? [...document.querySelectorAll('.fm-athlete-cb:checked')].map(cb => cb.value)
    : [];

  if (visibility === 'selected' && selectedAthletes.length === 0) {
    alert('Sélectionnez au moins un athlète');
    return;
  }

  const { data: formation, error } = await supabaseClient.from('formations').insert({
    coach_id: currentUser.id,
    title,
    description,
    video_count: 0,
    visibility
  }).select().single();

  if (error) { handleError(error, 'formations'); return; }

  // Insert members if selected visibility
  if (visibility === 'selected' && selectedAthletes.length > 0) {
    const rows = selectedAthletes.map(aid => ({ formation_id: formation.id, athlete_id: aid }));
    const { error: mErr } = await supabaseClient.from('formation_members').insert(rows);
    if (mErr) { devError('[formation_members]', mErr); }
  }

  // Close modal
  document.getElementById('fm-create-modal')?.remove();
  loadFormations();
}

// ── Delete a formation ──
async function deleteFormation(id, title) {
  if (!confirm(`Supprimer la formation "${title}" et toutes ses vidéos ?`)) return;

  const { data: videos } = await supabaseClient.from('formation_videos').select('id').eq('formation_id', id);
  const videoIds = (videos || []).map(v => v.id);
  if (videoIds.length) await supabaseClient.from('formation_video_progress').delete().in('video_id', videoIds);
  await supabaseClient.from('formation_videos').delete().eq('formation_id', id);
  // formation_members cascade on delete
  const { error } = await supabaseClient.from('formations').delete().eq('id', id);
  if (error) { handleError(error, 'formations'); return; }
  loadFormations();
}

// ── View formation detail ──
async function viewFormation(formationId) {
  currentFormationId = formationId;
  const el = document.getElementById('formations-content');

  const [fRes, vRes, mRes, progRes] = await Promise.all([
    supabaseClient.from('formations').select('*').eq('id', formationId).single(),
    supabaseClient.from('formation_videos').select('*').eq('formation_id', formationId).order('position'),
    supabaseClient.from('formation_members').select('athlete_id, athletes(id, prenom, nom, email)').eq('formation_id', formationId),
    supabaseClient.from('formation_video_progress').select('user_id, video_id, watched')
  ]);

  if (fRes.error) { handleError(fRes.error, 'viewFormation'); return; }
  const formation = fRes.data;
  const videos = vRes.data || [];
  const fMembers = mRes.data || [];
  const allProgress = progRes.data || [];

  // Filter progress to this formation's videos
  const videoIds = new Set(videos.map(v => v.id));
  const formationProgress = allProgress.filter(p => videoIds.has(p.video_id));

  let html = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px;">
        <button class="btn btn-outline" onclick="loadFormations()"><i class="fas fa-arrow-left"></i> Retour</button>
        <h1 class="page-title">${escHtml(formation.title)}</h1>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline" onclick="openMembersModal('${formationId}')">
          <i class="fas fa-users"></i> Membres
        </button>
        <button class="btn btn-red" onclick="addVideo('${formationId}')">
          <i class="fas fa-plus"></i> Ajouter une vidéo
        </button>
      </div>
    </div>`;

  // Info bar
  const audienceLabel = formation.visibility === 'selected'
    ? `<i class="fas fa-user-check"></i> ${fMembers.length} athlète${fMembers.length > 1 ? 's' : ''} sélectionné${fMembers.length > 1 ? 's' : ''}`
    : '<i class="fas fa-users"></i> Tous les athlètes';

  html += `<div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;flex-wrap:wrap;">`;
  if (formation.description) {
    html += `<p style="color:var(--text2);font-size:14px;margin:0;">${escHtml(formation.description)}</p>`;
  }
  html += `<span style="font-size:12px;color:var(--text3);background:var(--bg3);padding:4px 10px;border-radius:20px;">${audienceLabel}</span>`;
  html += `</div>`;

  // ── Progression section ──
  if (videos.length > 0) {
    // Get athletes who have access
    let progressAthletes = [];
    if (formation.visibility === 'selected') {
      progressAthletes = fMembers.map(m => m.athletes).filter(Boolean);
    } else {
      const { data: allAthletes } = await supabaseClient
        .from('athletes')
        .select('id, prenom, nom, email, user_id')
        .eq('coach_id', currentUser.id)
        .order('prenom');
      progressAthletes = allAthletes || [];
    }

    if (progressAthletes.length > 0) {
      html += `
        <div style="margin-bottom:24px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <h3 style="font-size:14px;font-weight:600;color:var(--text);margin:0;"><i class="fas fa-chart-bar" style="margin-right:6px;color:var(--primary);"></i> Progression des athlètes</h3>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px;">`;

      // Build progress per user
      const progressByUser = {};
      formationProgress.forEach(p => {
        if (p.watched) {
          if (!progressByUser[p.user_id]) progressByUser[p.user_id] = new Set();
          progressByUser[p.user_id].add(p.video_id);
        }
      });

      progressAthletes.forEach(a => {
        const userId = a.user_id || a.id;
        const watchedCount = progressByUser[userId]?.size || 0;
        const totalVideos = videos.length;
        const pct = Math.round((watchedCount / totalVideos) * 100);
        const barColor = pct === 100 ? 'var(--success)' : 'var(--primary)';

        html += `
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span style="font-size:13px;font-weight:600;color:var(--text);">${escHtml(a.prenom)} ${escHtml(a.nom)}</span>
              <span style="font-size:12px;color:var(--text3);">${watchedCount}/${totalVideos}</span>
            </div>
            <div style="height:6px;background:var(--bg3);border-radius:3px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:${barColor};border-radius:3px;transition:width 0.3s;"></div>
            </div>
          </div>`;
      });

      html += '</div></div>';
    }
  }

  // ── Videos section ──
  if (!videos.length) {
    html += '<div class="card"><div class="empty-state"><i class="fas fa-video"></i><p>Aucune vidéo dans cette formation</p></div></div>';
  } else {
    html += '<div class="fm-videos">';
    videos.forEach((v, i) => {
      const embedUrl = getEmbedUrl(v.video_url);
      html += `
        <div class="fm-video-card">
          <div class="fm-video-num">${i + 1}</div>
          <div class="fm-video-preview">
            ${embedUrl
              ? `<iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
              : `<a href="${escHtml(v.video_url)}" target="_blank" class="fm-video-link"><i class="fas fa-external-link-alt"></i> Ouvrir la vidéo</a>`
            }
          </div>
          <div class="fm-video-info">
            <div class="fm-video-title">${escHtml(v.title)}</div>
          </div>
          <div class="fm-video-actions">
            <button onclick="moveVideo('${v.id}','${formationId}',${v.position},'up')" title="Monter" ${i === 0 ? 'disabled' : ''}><i class="fas fa-chevron-up"></i></button>
            <button onclick="moveVideo('${v.id}','${formationId}',${v.position},'down')" title="Descendre" ${i === videos.length - 1 ? 'disabled' : ''}><i class="fas fa-chevron-down"></i></button>
            <button onclick="deleteVideo('${v.id}','${formationId}')" title="Supprimer" style="color:var(--danger);"><i class="fas fa-trash"></i></button>
          </div>
        </div>`;
    });
    html += '</div>';
  }

  el.innerHTML = html;
}

// ── Members modal (manage who has access) ──
async function openMembersModal(formationId) {
  const [fRes, aRes, mRes] = await Promise.all([
    supabaseClient.from('formations').select('id, title, visibility').eq('id', formationId).single(),
    supabaseClient.from('athletes').select('id, prenom, nom, email').eq('coach_id', currentUser.id).order('prenom'),
    supabaseClient.from('formation_members').select('athlete_id').eq('formation_id', formationId)
  ]);

  const formation = fRes.data;
  const athletes = aRes.data || [];
  const currentMembers = new Set((mRes.data || []).map(m => m.athlete_id));

  const vis = formation.visibility || 'all';

  let html = `
    <div class="modal-overlay open" id="fm-members-modal" onclick="if(event.target===this)this.classList.remove('open')">
      <div class="modal" style="max-width:520px;">
        <div class="modal-header">
          <div class="modal-title">Membres — ${escHtml(formation.title)}</div>
          <button class="modal-close" onclick="document.getElementById('fm-members-modal').remove()"><i class="fas fa-times"></i></button>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div>
            <label class="field-label">Accès</label>
            <div style="display:flex;gap:8px;margin-top:4px;">
              <button class="btn btn-outline fm-vis-edit-btn ${vis === 'all' ? 'active' : ''}" data-vis="all" onclick="setEditVisibility('all')">
                <i class="fas fa-users"></i> Tous les athlètes
              </button>
              <button class="btn btn-outline fm-vis-edit-btn ${vis === 'selected' ? 'active' : ''}" data-vis="selected" onclick="setEditVisibility('selected')">
                <i class="fas fa-user-check"></i> Sélection
              </button>
            </div>
          </div>
          <div id="fm-edit-athletes" style="display:${vis === 'selected' ? 'block' : 'none'};">
            <label class="field-label">Athlètes</label>
            <div style="max-height:280px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm);margin-top:4px;">
              ${athletes.length ? athletes.map(a => `
                <label class="fm-athlete-row" style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);">
                  <input type="checkbox" class="fm-edit-athlete-cb" value="${a.id}" ${currentMembers.has(a.id) ? 'checked' : ''}>
                  <span style="font-size:14px;color:var(--text);">${escHtml(a.prenom)} ${escHtml(a.nom)}</span>
                  <span style="font-size:12px;color:var(--text3);margin-left:auto;">${escHtml(a.email)}</span>
                </label>
              `).join('') : '<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px;">Aucun athlète</div>'}
            </div>
            <button class="btn btn-outline" style="margin-top:8px;font-size:12px;" onclick="toggleAllEditAthletes()">
              <i class="fas fa-check-double"></i> Tout sélectionner / désélectionner
            </button>
          </div>
          <button class="btn btn-red" style="margin-top:8px;" onclick="saveMembersModal('${formationId}')">
            <i class="fas fa-check"></i> Enregistrer
          </button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}

function setEditVisibility(vis) {
  document.querySelectorAll('.fm-vis-edit-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.vis === vis);
  });
  const el = document.getElementById('fm-edit-athletes');
  if (el) el.style.display = vis === 'selected' ? 'block' : 'none';
}

function toggleAllEditAthletes() {
  const cbs = document.querySelectorAll('.fm-edit-athlete-cb');
  const allChecked = [...cbs].every(cb => cb.checked);
  cbs.forEach(cb => cb.checked = !allChecked);
}

async function saveMembersModal(formationId) {
  const activeBtn = document.querySelector('.fm-vis-edit-btn.active');
  const visibility = activeBtn?.dataset.vis || 'all';

  const selectedAthletes = visibility === 'selected'
    ? [...document.querySelectorAll('.fm-edit-athlete-cb:checked')].map(cb => cb.value)
    : [];

  if (visibility === 'selected' && selectedAthletes.length === 0) {
    alert('Sélectionnez au moins un athlète');
    return;
  }

  // Update visibility
  await supabaseClient.from('formations').update({ visibility }).eq('id', formationId);

  // Replace members: delete all, then insert selected
  await supabaseClient.from('formation_members').delete().eq('formation_id', formationId);

  if (visibility === 'selected' && selectedAthletes.length > 0) {
    const rows = selectedAthletes.map(aid => ({ formation_id: formationId, athlete_id: aid }));
    await supabaseClient.from('formation_members').insert(rows);
  }

  document.getElementById('fm-members-modal')?.remove();
  viewFormation(formationId);
}

// ── Add video to formation ──
async function addVideo(formationId) {
  const title = prompt('Titre de la vidéo :');
  if (!title || !title.trim()) return;
  const url = prompt('Lien de la vidéo (YouTube, Vimeo, Loom...) :');
  if (!url || !url.trim()) return;

  const { data: existing } = await supabaseClient
    .from('formation_videos')
    .select('position')
    .eq('formation_id', formationId)
    .order('position', { ascending: false })
    .limit(1);

  const nextPos = (existing && existing.length > 0) ? existing[0].position + 1 : 0;

  const { error } = await supabaseClient.from('formation_videos').insert({
    formation_id: formationId,
    title: title.trim(),
    video_url: url.trim(),
    position: nextPos
  });

  if (error) { handleError(error, 'formations'); return; }

  await supabaseClient.from('formations').update({
    video_count: nextPos + 1
  }).eq('id', formationId);

  viewFormation(formationId);
}

// ── Delete video ──
async function deleteVideo(videoId, formationId) {
  if (!confirm('Supprimer cette vidéo ?')) return;

  await supabaseClient.from('formation_video_progress').delete().eq('video_id', videoId);
  const { error } = await supabaseClient.from('formation_videos').delete().eq('id', videoId);
  if (error) { handleError(error, 'formations'); return; }

  const { data: remaining } = await supabaseClient
    .from('formation_videos')
    .select('id')
    .eq('formation_id', formationId);

  await supabaseClient.from('formations').update({
    video_count: (remaining || []).length
  }).eq('id', formationId);

  viewFormation(formationId);
}

// ── Move video up/down ──
async function moveVideo(videoId, formationId, currentPos, direction) {
  const newPos = direction === 'up' ? currentPos - 1 : currentPos + 1;

  const { data: target } = await supabaseClient
    .from('formation_videos')
    .select('id')
    .eq('formation_id', formationId)
    .eq('position', newPos)
    .single();

  if (!target) return;

  await Promise.all([
    supabaseClient.from('formation_videos').update({ position: newPos }).eq('id', videoId),
    supabaseClient.from('formation_videos').update({ position: currentPos }).eq('id', target.id)
  ]);

  viewFormation(formationId);
}

// ── Convert video URL to embeddable URL ──
function getEmbedUrl(url) {
  if (!url) return null;
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  m = url.match(/vimeo\.com\/(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  m = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (m) return `https://www.loom.com/embed/${m[1]}`;
  return null;
}
