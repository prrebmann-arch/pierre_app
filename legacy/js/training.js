// ===== CARDIO SECTION =====

function renderCardioSection(cardio, pas) {
  if (!cardio && !pas) {
    return `
      <div class="card mb-20">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-heartbeat"></i> Cardio & Activité</div>
          <button class="btn btn-outline btn-sm" onclick="editCardio()"><i class="fas fa-plus"></i> Ajouter</button>
        </div>
        <div class="empty-state" style="padding:20px;">
          <i class="fas fa-heart-pulse" style="font-size:24px;color:var(--text3);"></i>
          <p class="text-small text-muted" style="margin-top:8px;">Aucun cardio configuré</p>
        </div>
      </div>`;
  }

  const freqLabels = { post_training: 'Post training', repos: 'Jours de repos', '7j7': '7j/7' };

  return `
    <div class="cd-card mb-20">
      <div class="cd-header">
        <div class="cd-title"><i class="fas fa-heartbeat"></i> Cardio & Activité</div>
        <div class="flex gap-6">
          <button class="cd-btn" onclick="editCardio()"><i class="fas fa-pen"></i></button>
          <button class="cd-btn cd-btn-del" onclick="deleteCardio()"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div class="cd-body">
        <div class="cd-row">
          ${cardio ? `
          <div class="cd-stat">
            <span class="cd-stat-val">${cardio.minutes || '-'}<small>min</small></span>
            <span class="cd-stat-lbl">${escHtml(cardio.titre || 'Cardio')}</span>
          </div>
          <div class="cd-sep"></div>
          <div class="cd-stat">
            <span class="cd-stat-val">${cardio.bpm_min || '?'}–${cardio.bpm_max || '?'}</span>
            <span class="cd-stat-lbl">BPM cible</span>
          </div>
          <div class="cd-sep"></div>
          <div class="cd-stat">
            <span class="cd-stat-val cd-stat-freq">${freqLabels[cardio.frequence] || cardio.frequence || '-'}</span>
            <span class="cd-stat-lbl">Fréquence</span>
          </div>
          <div class="cd-sep"></div>` : ''}
          <div class="cd-stat">
            <span class="cd-stat-val"><i class="fas fa-shoe-prints" style="font-size:12px;color:var(--primary);margin-right:4px;"></i>${pas ? Number(pas).toLocaleString('fr-FR') : '—'}</span>
            <span class="cd-stat-lbl">Pas/jour</span>
          </div>
        </div>
      </div>
    </div>`;
}

function editCardio() {
  const el = document.getElementById('cardio-section');
  if (!el) return;

  const cardio = window._cardioConfig || {};
  window._cardioFreqSelected = cardio.frequence || null;
  const isPost = cardio.frequence === 'post_training';
  const isRepos = cardio.frequence === 'repos';
  const is7j7 = cardio.frequence === '7j7';

  el.innerHTML = `
    <div class="cd-card mb-20">
      <div class="cd-header">
        <div class="cd-title"><i class="fas fa-heartbeat"></i> Cardio</div>
        <button class="cd-btn" onclick="cancelCardioEdit()"><i class="fas fa-times"></i></button>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <input type="text" id="cardio-titre" value="${escHtml(cardio.titre || '')}" placeholder="Titre (ex: LISS Cardio)" class="rm-m-input" style="font-size:13px;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;">
          <div>
            <label class="label-sm">Durée (min)</label>
            <input type="number" id="cardio-minutes" value="${cardio.minutes || ''}" min="1" max="120" placeholder="30" class="rm-m-input" style="text-align:center;">
          </div>
          <div style="grid-column:span 2;">
            <label class="label-sm">BPM cible</label>
            <div style="display:flex;gap:6px;align-items:center;">
              <input type="number" id="cardio-bpm-min" value="${cardio.bpm_min || ''}" min="60" max="200" placeholder="120" class="rm-m-input" style="text-align:center;">
              <span style="color:var(--text3);font-size:12px;">–</span>
              <input type="number" id="cardio-bpm-max" value="${cardio.bpm_max || ''}" min="60" max="220" placeholder="140" class="rm-m-input" style="text-align:center;">
            </div>
          </div>
          <div>
            <label class="label-sm"><i class="fas fa-shoe-prints" style="margin-right:3px;"></i> Pas/jour</label>
            <input type="number" id="cardio-pas" value="${window._pasJournalier || ''}" min="0" max="100000" placeholder="10000" class="rm-m-input" style="text-align:center;">
          </div>
        </div>
        <div>
          <label class="label-sm">Fréquence</label>
          <div style="display:flex;gap:6px;margin-top:4px;">
            <button type="button" class="cd-freq-btn ${isPost ? 'active' : ''}" data-val="post_training" onclick="selectCardioFreq(this)">Post training</button>
            <button type="button" class="cd-freq-btn ${isRepos ? 'active' : ''}" data-val="repos" onclick="selectCardioFreq(this)">Jours de repos</button>
            <button type="button" class="cd-freq-btn ${is7j7 ? 'active' : ''}" data-val="7j7" onclick="selectCardioFreq(this)">7j/7</button>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;">
          <button class="btn btn-red btn-sm" onclick="saveCardio()"><i class="fas fa-save"></i> Enregistrer</button>
        </div>
      </div>
    </div>`;
}

function selectCardioFreq(btn) {
  document.querySelectorAll('.cd-freq-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._cardioFreqSelected = btn.dataset.val;
}

function cancelCardioEdit() {
  loadAthleteTabTraining();
}

async function saveCardio() {
  const titre = document.getElementById('cardio-titre')?.value.trim();
  const minutes = parseInt(document.getElementById('cardio-minutes')?.value) || null;
  const bpm_min = parseInt(document.getElementById('cardio-bpm-min')?.value) || null;
  const bpm_max = parseInt(document.getElementById('cardio-bpm-max')?.value) || null;
  const frequence = window._cardioFreqSelected || null;

  if (!titre) { notify('Veuillez entrer un titre', 'warning'); return; }

  const pas_journalier = parseInt(document.getElementById('cardio-pas')?.value) || null;
  const cardio = { titre, minutes, bpm_min, bpm_max, frequence };
  const { error } = await supabaseClient.from('athletes').update({ cardio_config: cardio, pas_journalier }).eq('id', currentAthleteId);
  if (error) { handleError(error, 'training'); return; }

  window._cardioConfig = cardio;
  window._pasJournalier = pas_journalier;
  notify('Cardio sauvegardé !', 'success');
  loadAthleteTabTraining();
}

async function deleteCardio() {
  if (!confirm('Supprimer la configuration cardio ?')) return;
  const { error } = await supabaseClient.from('athletes').update({ cardio_config: null }).eq('id', currentAthleteId);
  if (error) { handleError(error, 'training'); return; }

  window._cardioConfig = null;
  notify('Cardio supprimé', 'success');
  loadAthleteTabTraining();
}

// ===== PAS JOURNALIER =====

async function saveSteps(val) {
  const pas = parseInt(val) || null;
  const { error } = await supabaseClient.from('athletes').update({ pas_journalier: pas }).eq('id', currentAthleteId);
  if (error) { handleError(error, 'training'); return; }
  notify('Pas journalier sauvegardé !', 'success');
  loadAthleteTabTraining();
}

// ===== EXERCISE HELPERS =====

/** Normalize old { series, reps } format to new { sets: [...] } format */
function normalizeExSets(ex) {
  if (ex.sets && Array.isArray(ex.sets)) return ex.sets;
  const count = parseInt(ex.series) || 3;
  const reps = ex.reps || '10';
  const tempo = ex.tempo || '30X1';
  const sets = [];
  for (let i = 0; i < count; i++) sets.push({ reps, tempo, repos: '1m30', type: 'normal' });
  return sets;
}

/** Get total series count from exercise (works with both old/new format) */
function getExSeriesCount(ex) {
  if (ex.sets && Array.isArray(ex.sets)) return ex.sets.length;
  return parseInt(ex.series) || 0;
}

// ===== TRAINING PROGRAMS =====

async function loadExercices() {
  if (window.exercicesDB) return window.exercicesDB;
  const { data } = await supabaseClient.from('exercices').select('id, nom, muscle_principal, categorie').order('nom');
  window.exercicesDB = data || [];
  return window.exercicesDB;
}

// ===== TRAINING PROGRAM EDITOR =====

function buildTpExerciseHtml(exData) {
  const exName = exData?.nom || '';
  const exId = exData?.exercice_id || '';
  const exMuscle = exData?.muscle_principal || '';
  // If we have an ID but no muscle, look it up
  let muscle = exMuscle;
  if (!muscle && exId) {
    const found = (window.exercicesDB || []).find(e => String(e.id) === String(exId));
    if (found) muscle = found.muscle_principal || '';
  }
  if (!muscle && exName) {
    const found = (window.exercicesDB || []).find(e => e.nom === exName);
    if (found) muscle = found.muscle_principal || '';
  }

  return `
    <div class="exercise-item tp-ex-row" style="margin-bottom:8px;">
      <div style="display:flex;gap:6px;align-items:center;">
        <div style="flex:2;min-width:160px;position:relative;">
          <input type="text" class="tp-ex-search inline-input-sm" value="${escHtml(exName)}" placeholder="Rechercher un exercice..." oninput="searchTpExercise(this)" onfocus="searchTpExercise(this)" autocomplete="off" style="width:100%;">
          <input type="hidden" class="tp-ex-id" value="${escHtml(String(exId))}">
          <input type="hidden" class="tp-ex-muscle" value="${escHtml(muscle)}">
          <div class="tp-ex-results" style="display:none;"></div>
          ${muscle ? `<div class="tp-ex-muscle-tag" style="font-size:10px;color:var(--text3);margin-top:2px;"><i class="fas fa-circle" style="font-size:6px;color:var(--primary);margin-right:4px;"></i>${escHtml(muscle)}</div>` : ''}
        </div>
        <input type="number" class="tp-ex-series inline-input-sm" value="${escHtml(exData?.series||'')}" placeholder="Séries" style="width:60px;" min="1" oninput="updateTpMuscleSummary()">
        <input type="text" class="tp-ex-reps inline-input-sm" value="${escHtml(exData?.reps||'')}" placeholder="Reps" style="width:70px;">
        <button type="button" class="btn btn-outline btn-sm btn-danger" onclick="this.closest('.tp-ex-row').remove();updateTpMuscleSummary()">×</button>
      </div>
    </div>`;
}

function searchTpExercise(input) {
  const query = input.value.trim().toLowerCase();
  const resultsDiv = input.parentElement.querySelector('.tp-ex-results');
  if (!resultsDiv) return;

  if (query.length < 1) {
    resultsDiv.style.display = 'none';
    return;
  }

  const exDB = window.exercicesDB || [];
  const matches = exDB.filter(ex =>
    ex.nom.toLowerCase().includes(query) ||
    (ex.muscle_principal && ex.muscle_principal.toLowerCase().includes(query)) ||
    (ex.categorie && ex.categorie.toLowerCase().includes(query))
  ).slice(0, 8);

  if (!matches.length) {
    resultsDiv.innerHTML = '<div class="tp-ex-result-empty">Aucun exercice trouvé</div>';
    resultsDiv.style.display = 'block';
    return;
  }

  resultsDiv.innerHTML = matches.map(ex =>
    `<div class="tp-ex-result-item" onmousedown="selectTpExercise(this, '${ex.id}', '${escHtml(ex.nom).replace(/'/g, "\\'")}', '${escHtml(ex.muscle_principal||'').replace(/'/g, "\\'")}')">
      <span class="tp-ex-result-name">${escHtml(ex.nom)}</span>
      ${ex.muscle_principal ? `<span class="tp-ex-result-muscle">${escHtml(ex.muscle_principal)}</span>` : ''}
    </div>`
  ).join('');
  resultsDiv.style.display = 'block';
}

function selectTpExercise(resultEl, id, nom, muscle) {
  const exRow = resultEl.closest('.tp-ex-row');
  if (!exRow) return;
  const searchInput = exRow.querySelector('.tp-ex-search');
  const idInput = exRow.querySelector('.tp-ex-id');
  const muscleInput = exRow.querySelector('.tp-ex-muscle');
  const resultsDiv = exRow.querySelector('.tp-ex-results');
  const muscleTag = exRow.querySelector('.tp-ex-muscle-tag');

  searchInput.value = nom;
  idInput.value = id;
  muscleInput.value = muscle;
  resultsDiv.style.display = 'none';

  // Update or create muscle tag
  if (muscleTag) {
    muscleTag.innerHTML = muscle ? `<i class="fas fa-circle" style="font-size:6px;color:var(--primary);margin-right:4px;"></i>${escHtml(muscle)}` : '';
  } else if (muscle) {
    searchInput.parentElement.insertAdjacentHTML('beforeend',
      `<div class="tp-ex-muscle-tag" style="font-size:10px;color:var(--text3);margin-top:2px;"><i class="fas fa-circle" style="font-size:6px;color:var(--primary);margin-right:4px;"></i>${escHtml(muscle)}</div>`
    );
  }

  updateTpMuscleSummary();
}

// Close search results when clicking elsewhere
document.addEventListener('click', (e) => {
  if (!e.target.closest('.tp-ex-row')) {
    document.querySelectorAll('.tp-ex-results').forEach(d => d.style.display = 'none');
  }
});

function buildTpSessionHtml(sessionData) {
  const exHtml = (sessionData?.exercises?.length ? sessionData.exercises : [null]).map(ex => buildTpExerciseHtml(ex)).join('');
  return `
    <div class="training-day tp-session-row mb-12" draggable="true" ondragstart="tpDragStart(event)" ondragover="tpDragOver(event)" ondrop="tpDrop(event)" ondragend="tpDragEnd(event)">
      <div class="training-day-header">
        <div style="display:flex;gap:8px;flex:1;align-items:center;">
          <span class="tp-drag-handle" title="Glisser pour réorganiser"><i class="fas fa-grip-vertical"></i></span>
          <input type="text" class="tp-session-nom inline-input" placeholder="Nom séance (ex: Haut du corps)" value="${escHtml(sessionData?.nom||'')}" style="flex:1;">
          <input type="text" class="tp-session-jour inline-input" placeholder="Jour (optionnel)" value="${escHtml(sessionData?.jour||'')}" style="width:130px;">
        </div>
        <button type="button" class="btn btn-outline btn-sm btn-danger" style="margin-left:8px;" onclick="this.closest('.tp-session-row').remove();updateTpMuscleSummary()">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      <div class="tp-exercises-list" style="margin-top:10px;">${exHtml}</div>
      <button type="button" class="btn btn-outline btn-sm" style="margin-top:8px;" onclick="this.previousElementSibling.insertAdjacentHTML('beforeend', buildTpExerciseHtml(null));updateTpMuscleSummary()">
        <i class="fas fa-plus"></i> Exercice
      </button>
      <div class="tp-session-muscles" style="margin-top:8px;"></div>
    </div>`;
}

function addTpSession() {
  const c = document.getElementById('tp-sessions');
  if (c) c.insertAdjacentHTML('beforeend', buildTpSessionHtml(null));
  updateTpMuscleSummary();
}

// ── Session drag & drop ──
let _tpDragEl = null;

function tpDragStart(e) {
  _tpDragEl = e.target.closest('.tp-session-row');
  if (!_tpDragEl) return;
  _tpDragEl.classList.add('tp-dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function tpDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const target = e.target.closest('.tp-session-row');
  if (!target || target === _tpDragEl) return;
  const container = document.getElementById('tp-sessions');
  if (!container) return;
  const rows = [...container.querySelectorAll('.tp-session-row')];
  const dragIdx = rows.indexOf(_tpDragEl);
  const targetIdx = rows.indexOf(target);
  if (dragIdx < targetIdx) {
    target.after(_tpDragEl);
  } else {
    target.before(_tpDragEl);
  }
}

function tpDrop(e) {
  e.preventDefault();
}

function tpDragEnd(e) {
  if (_tpDragEl) _tpDragEl.classList.remove('tp-dragging');
  _tpDragEl = null;
}

function getMuscleCountFromExercises(exercises) {
  const muscles = {};
  const exDB = window.exercicesDB || [];
  (exercises || []).forEach(ex => {
    let muscle = null;
    if (ex.muscle_principal) { muscle = ex.muscle_principal; }
    else {
      const found = exDB.find(e => e.nom === ex.nom || String(e.id) === String(ex.exercice_id));
      if (found) muscle = found.muscle_principal;
    }
    if (!muscle) return;
    const s = getExSeriesCount(ex);
    if (s > 0) muscles[muscle] = (muscles[muscle] || 0) + s;
  });
  return muscles;
}

function renderMusclePills(muscles, size) {
  const entries = Object.entries(muscles).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '';
  const big = size === 'lg';
  return entries.map(([m, s]) =>
    `<span style="display:inline-flex;align-items:center;gap:4px;padding:${big ? '6px 10px' : '2px 8px'};border-radius:20px;font-size:${big ? '12px' : '11px'};font-weight:600;background:rgba(179,8,8,0.15);color:var(--primary);border:1px solid rgba(179,8,8,0.3);">${escHtml(m)} <span style="font-weight:800;">${s}</span></span>`
  ).join(' ');
}

function updateTpMuscleSummary() {
  const totalMuscles = {};

  document.querySelectorAll('#tp-sessions .tp-session-row').forEach(row => {
    const sessionMuscles = {};
    row.querySelectorAll('.tp-ex-row').forEach(exRow => {
      const muscle = exRow.querySelector('.tp-ex-muscle')?.value;
      if (!muscle) return;
      const series = parseInt(exRow.querySelector('.tp-ex-series')?.value) || 0;
      if (series > 0) {
        sessionMuscles[muscle] = (sessionMuscles[muscle] || 0) + series;
        totalMuscles[muscle] = (totalMuscles[muscle] || 0) + series;
      }
    });

    const summaryEl = row.querySelector('.tp-session-muscles');
    if (summaryEl) {
      const pills = renderMusclePills(sessionMuscles, 'sm');
      summaryEl.innerHTML = pills ? `<div style="display:flex;flex-wrap:wrap;gap:4px;padding-top:6px;border-top:1px solid var(--border);">${pills}</div>` : '';
    }
  });

  const totalEl = document.getElementById('tp-total-muscles');
  if (totalEl) {
    const pills = renderMusclePills(totalMuscles, 'lg');
    totalEl.innerHTML = pills
      ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">${pills}</div>`
      : '<span style="font-size:12px;color:var(--text3);">Ajoutez des exercices pour voir le volume</span>';
  }
}

function getTpSessionsData() {
  const sessions = [];
  document.querySelectorAll('#tp-sessions .tp-session-row').forEach(row => {
    const nom = row.querySelector('.tp-session-nom')?.value?.trim() || '';
    const jour = row.querySelector('.tp-session-jour')?.value?.trim() || '';
    const exercises = [];
    row.querySelectorAll('.tp-ex-row').forEach(exRow => {
      const nomEx = exRow.querySelector('.tp-ex-search')?.value?.trim() || '';
      const exId = exRow.querySelector('.tp-ex-id')?.value || null;
      if (nomEx) {
        exercises.push({
          nom: nomEx,
          exercice_id: exId,
          series: exRow.querySelector('.tp-ex-series')?.value || '-',
          reps: exRow.querySelector('.tp-ex-reps')?.value || '-',
          charge: exRow.querySelector('.tp-ex-charge')?.value || null
        });
      }
    });
    sessions.push({ nom, jour, exercises });
  });
  return sessions;
}

function updateTpPatternInputs() {
  const type = document.getElementById('tp-type')?.value;
  const pg = document.getElementById('tp-pattern-group');
  const fg = document.getElementById('tp-fixed-group');
  if (pg) pg.style.display = type === 'pattern' ? 'block' : 'none';
  if (fg) fg.style.display = type === 'fixed' ? 'block' : 'none';
}

async function saveTrainingProgramInline() {
  const nom = document.getElementById('tp-nom')?.value?.trim();
  if (!nom) { notify('Le nom est obligatoire', 'error'); return; }

  const patternType = document.getElementById('tp-type')?.value || 'pattern';
  const patternData = patternType === 'pattern'
    ? { pattern: document.getElementById('tp-pattern')?.value || '' }
    : { days: (document.getElementById('tp-fixed')?.value || '').split(',').map(d => d.trim()).filter(Boolean) };
  const sessions = getTpSessionsData();

  let programId = window._tpEditId;
  if (programId) {
    const { error } = await supabaseClient.from('workout_programs').update({ nom, pattern_type: patternType, pattern_data: patternData }).eq('id', programId);
    if (error) { handleError(error, 'training'); return; }
    const { error: delError } = await supabaseClient.from('workout_sessions').delete().eq('program_id', programId);
    if (delError) { handleError(delError, 'training'); return; }
  } else {
    // Désactiver les programmes existants avant d'en créer un nouveau
    const { error: deactivateError } = await supabaseClient.from('workout_programs').update({ actif: false }).eq('athlete_id', currentAthleteId);
    if (deactivateError) { handleError(deactivateError, 'training'); return; }
    const { data, error } = await supabaseClient.from('workout_programs').insert({ nom, athlete_id: currentAthleteId, coach_id: currentUser.id, pattern_type: patternType, pattern_data: patternData, actif: true }).select();
    if (error) { handleError(error, 'training'); return; }
    programId = data[0].id;
  }

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const { error } = await supabaseClient.from('workout_sessions').insert({ nom: s.nom, jour: s.jour || null, program_id: programId, exercices: JSON.stringify(s.exercises), ordre: i });
    if (error) { handleError(error, 'training'); return; }
  }

  notify('Programme sauvegardé !', 'success');
  if (!window._tpEditId && currentAthleteObj?.user_id) {
    const _title = 'Nouveau programme activé';
    const _body = `Votre coach a activé le programme "${nom}"`;
    const { error: notifError } = await supabaseClient.from('notifications').insert({
      user_id: currentAthleteObj.user_id, type: 'training', title: _title, body: _body
    });
    if (notifError) { devLog('Notification insert failed:', notifError); }
    await sendExpoPush([currentAthleteObj.user_id], _title, _body);
  }
  window._tpEditId = null;
  loadAthleteTabTraining();
}

async function createTrainingProgram() {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div class="text-center" style="padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';
  await loadExercices();
  window._tpEditId = null;
  window._tpSessions = [{ nom: '', jour: '', exercises: [] }];
  window._tpActiveSession = 0;
  renderTpEditor(el, '', 'pattern', {}, false);
}

async function editTrainingProgram(id) {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div class="text-center" style="padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';
  await loadExercices();
  const { data: prog } = await supabaseClient.from('workout_programs').select('*, workout_sessions(*)').eq('id', id).single();
  if (!prog) { notify('Programme introuvable', 'error'); loadAthleteTabTraining(); return; }

  window._tpEditId = id;
  let pd = {};
  try { pd = typeof prog.pattern_data === 'string' ? JSON.parse(prog.pattern_data) : (prog.pattern_data || {}); } catch (e) {}
  const patternType = prog.pattern_type || 'pattern';
  window._tpSessions = (prog.workout_sessions || []).sort((a, b) => (a.ordre || 0) - (b.ordre || 0)).map(s => {
    let exercises = [];
    try { exercises = typeof s.exercices === 'string' ? JSON.parse(s.exercices) : (s.exercices || []); } catch (e) {}
    return { nom: s.nom || '', jour: s.jour || '', exercises };
  });
  if (!window._tpSessions.length) window._tpSessions = [{ nom: '', jour: '', exercises: [] }];
  window._tpActiveSession = 0;
  renderTpEditor(el, prog.nom || '', patternType, pd, true);
}

function renderTpEditor(el, progName, patternType, pd, isEdit) {
  const sessions = window._tpSessions;
  const activeIdx = window._tpActiveSession || 0;

  // Session tabs — show session name or "Séance N"
  const tabsHtml = sessions.map((s, i) => {
    const label = s.nom || ('Séance ' + (i + 1));
    return `<button class="tr-session-tab ${i===activeIdx?'active':''}" onclick="switchTpSession(${i})">${escHtml(label)}</button>`;
  }).join('') + `<button class="tr-session-tab-add" onclick="addTpSessionNew()" title="Ajouter une séance"><i class="fas fa-plus"></i></button>`;

  // Muscle groups for filter
  const muscleGroups = [...new Set((window.exercicesDB || []).map(e => e.muscle_principal).filter(Boolean))].sort();

  el.innerHTML = `
    <div class="tr-header">
      <div style="display:flex;align-items:center;gap:12px;flex:1;">
        <button class="btn btn-outline btn-sm" onclick="loadAthleteTabTraining()"><i class="fas fa-arrow-left"></i></button>
        <input type="text" id="tp-nom" value="${escHtml(progName)}" placeholder="Nom du programme" class="tr-session-name-input" style="max-width:350px;">
      </div>
      <button class="btn btn-red" onclick="saveTrainingProgramFromEditor()"><i class="fas fa-save"></i> ${isEdit ? 'Enregistrer' : 'Créer'}</button>
    </div>
    <div class="tr-config-row">
      <select id="tp-type" onchange="updateTpPatternInputs()" class="inline-input" style="width:auto;padding:6px 10px;font-size:12px;">
        <option value="pattern"${patternType==='pattern'?' selected':''}>Pattern</option>
        <option value="fixed"${patternType==='fixed'?' selected':''}>Jours fixes</option>
      </select>
      <div id="tp-pattern-group" style="${patternType!=='pattern'?'display:none;':''}flex:1;">
        <input type="text" id="tp-pattern" value="${escHtml(pd.pattern||'')}" placeholder="ex: Haut / Bas / Repos" class="inline-input" style="font-size:12px;padding:6px 10px;">
      </div>
      <div id="tp-fixed-group" style="${patternType!=='fixed'?'display:none;':''}flex:1;">
        <input type="text" id="tp-fixed" value="${escHtml((pd.days||[]).join(', '))}" placeholder="ex: Lundi, Mercredi, Vendredi" class="inline-input" style="font-size:12px;padding:6px 10px;">
      </div>
    </div>
    <div class="tr-session-tabs" id="tp-session-tabs">${tabsHtml}</div>
    <div id="tp-program-total" style="padding:12px 20px;background:var(--bg2);border-left:1px solid var(--border);border-right:1px solid var(--border);"></div>
    <div class="tr-body">
      <div class="tr-library">
        <div class="tr-library-header">
          <i class="fas fa-book-open" style="color:var(--text3);"></i>
          <span class="tr-library-title">Bibliothèque d'exercices</span>
        </div>
        <div class="tr-library-search">
          <i class="fas fa-search"></i>
          <input type="text" id="tp-lib-search" placeholder="Rechercher un exercice..." oninput="filterTpLibrary()">
        </div>
        <div class="tr-library-filters" id="tp-lib-filters">
          <button class="tr-library-filter active" onclick="setTpLibFilter(this, '')">Tous</button>
          ${muscleGroups.map(m => `<button class="tr-library-filter" onclick="setTpLibFilter(this, '${escHtml(m)}')">${escHtml(m)}</button>`).join('')}
        </div>
        <div class="tr-library-results" id="tp-lib-results"></div>
      </div>
      <div class="tr-session-content" id="tp-session-editor"></div>
    </div>`;

  window._tpLibFilter = '';
  filterTpLibrary();
  renderTpSessionEditor();
}

function filterTpLibrary() {
  const query = (document.getElementById('tp-lib-search')?.value || '').trim().toLowerCase();
  const muscle = window._tpLibFilter || '';
  const exDB = window.exercicesDB || [];
  const results = exDB.filter(ex => {
    if (muscle && ex.muscle_principal !== muscle) return false;
    if (query && !ex.nom.toLowerCase().includes(query) && !(ex.muscle_principal||'').toLowerCase().includes(query)) return false;
    return true;
  }).slice(0, 30);

  const container = document.getElementById('tp-lib-results');
  if (!container) return;
  container.innerHTML = `<div class="tr-library-results-title">Résultats (${results.length})</div>` +
    (results.length ? results.map(ex => `
      <div class="tr-lib-item" onclick="addExFromLibrary('${ex.id}', '${escHtml(ex.nom).replace(/'/g, "\\'")}', '${escHtml(ex.muscle_principal||'').replace(/'/g, "\\'")}')">
        <div class="tr-lib-icon"><i class="fas fa-dumbbell"></i></div>
        <div>
          <div class="tr-lib-name">${escHtml(ex.nom)}</div>
          ${ex.muscle_principal ? `<div class="tr-lib-muscle">${escHtml(ex.muscle_principal)}</div>` : ''}
        </div>
      </div>
    `).join('') : '<div style="padding:30px 20px;text-align:center;color:var(--text3);font-size:13px;"><i class="fas fa-search" style="display:block;font-size:20px;margin-bottom:8px;opacity:0.3;"></i>Aucun résultat</div>');
}

function setTpLibFilter(btn, muscle) {
  document.querySelectorAll('#tp-lib-filters .tr-library-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._tpLibFilter = muscle;
  filterTpLibrary();
}

function addExFromLibrary(id, nom, muscle) {
  const sessions = window._tpSessions;
  const idx = window._tpActiveSession || 0;
  if (!sessions[idx]) return;
  sessions[idx].exercises.push({
    nom, exercice_id: id, muscle_principal: muscle,
    sets: [
      { reps: '10', tempo: '30X1', repos: '1m30', type: 'normal' },
      { reps: '10', tempo: '30X1', repos: '1m30', type: 'normal' },
      { reps: '10', tempo: '30X1', repos: '1m30', type: 'normal' },
    ]
  });
  renderTpSessionEditor();
}

function switchTpSession(idx) {
  // Save current session inputs first
  saveTpSessionInputs();
  window._tpActiveSession = idx;
  document.querySelectorAll('#tp-session-tabs .tr-session-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
  renderTpSessionEditor();
}

function addTpSessionNew() {
  saveTpSessionInputs();
  window._tpSessions.push({ nom: '', jour: '', exercises: [] });
  window._tpActiveSession = window._tpSessions.length - 1;
  const progName = document.getElementById('tp-nom')?.value || '';
  const patternType = document.getElementById('tp-type')?.value || 'pattern';
  const pd = patternType === 'pattern'
    ? { pattern: document.getElementById('tp-pattern')?.value || '' }
    : { days: (document.getElementById('tp-fixed')?.value || '').split(',').map(d => d.trim()).filter(Boolean) };
  if (window._tplMode) {
    renderTplEditor(document.getElementById('templates-content'), progName, patternType, pd, !!window._tplEditId);
  } else {
    renderTpEditor(document.getElementById('athlete-tab-content'), progName, patternType, pd, !!window._tpEditId);
  }
}

function removeTpSession() {
  const sessions = window._tpSessions;
  if (sessions.length <= 1) { notify('Il faut au moins une séance', 'warning'); return; }
  if (!confirm('Supprimer cette séance ?')) return;
  sessions.splice(window._tpActiveSession, 1);
  window._tpActiveSession = Math.min(window._tpActiveSession, sessions.length - 1);
  const progName = document.getElementById('tp-nom')?.value || '';
  const patternType = document.getElementById('tp-type')?.value || 'pattern';
  const pd = patternType === 'pattern'
    ? { pattern: document.getElementById('tp-pattern')?.value || '' }
    : { days: (document.getElementById('tp-fixed')?.value || '').split(',').map(d => d.trim()).filter(Boolean) };
  if (window._tplMode) {
    renderTplEditor(document.getElementById('templates-content'), progName, patternType, pd, !!window._tplEditId);
  } else {
    renderTpEditor(document.getElementById('athlete-tab-content'), progName, patternType, pd, !!window._tpEditId);
  }
}

function saveTpSessionInputs() {
  const sessions = window._tpSessions;
  const idx = window._tpActiveSession;
  if (!sessions[idx]) return;
  const nom = document.getElementById('tp-s-nom')?.value?.trim() || '';
  const jour = document.getElementById('tp-s-jour')?.value?.trim() || '';
  sessions[idx].nom = nom;
  sessions[idx].jour = jour;

  // Read exercises from editor (new sets-based structure)
  const exCards = document.querySelectorAll('#tp-session-exercises .tr-exercise-card');
  const exercises = [];
  exCards.forEach(card => {
    const name = card.querySelector('.tp-ed-name')?.value?.trim() || '';
    const exId = card.dataset.exId || null;
    const muscle = card.dataset.muscle || '';
    const supersetId = card.dataset.superset || null;
    if (!name) return;

    const sets = [];
    card.querySelectorAll('.tp-set-row').forEach(row => {
      const type = row.dataset.type || 'normal';
      if (type === 'rest_pause') {
        sets.push({
          type: 'rest_pause',
          reps: row.querySelector('.tp-set-reps')?.value || '8',
          reps_rp: row.querySelector('.tp-set-reps-rp')?.value || '4',
          rest_pause_time: row.querySelector('.tp-set-rp-time')?.value || '15',
        });
      } else {
        sets.push({
          type,
          reps: row.querySelector('.tp-set-reps')?.value || '10',
          tempo: row.querySelector('.tp-set-tempo')?.value || '30X1',
          repos: row.querySelector('.tp-set-repos')?.value || '1m30',
        });
      }
    });

    const ex = { nom: name, exercice_id: exId, muscle_principal: muscle, sets };
    if (supersetId) ex.superset_id = supersetId;
    exercises.push(ex);
  });
  sessions[idx].exercises = exercises;
}

function buildTpSetRow(exIdx, setIdx, set) {
  if (set.type === 'dropset') {
    const isMax = set.reps === 'MAX';
    return `<tr class="tp-set-row tp-set-drop" data-type="dropset">
      <td class="tp-set-num"><span class="tp-set-type-tag tp-tag-drop">DROP</span></td>
      <td>${isMax ? `<span class="tp-maxrep-tag">MAX REP</span><input type="hidden" class="tp-set-reps" value="MAX">` : `<input type="text" class="tp-set-reps" value="${escHtml(set.reps||'10')}" placeholder="10">`} <label class="tp-maxrep-toggle"><input type="checkbox" ${isMax ? 'checked' : ''} onchange="toggleDropMaxRep(${exIdx},${setIdx},this.checked)"><span>Max</span></label></td>
      <td><input type="text" class="tp-set-tempo" value="${escHtml(set.tempo||'30X1')}" placeholder="30X1"></td>
      <td><span style="color:var(--text3);font-size:11px;">—</span></td>
      <td><button class="tp-set-del" onclick="removeTpSet(${exIdx},${setIdx})"><i class="fas fa-times"></i></button></td>
    </tr>`;
  }
  if (set.type === 'rest_pause') {
    return `<tr class="tp-set-row tp-set-rp" data-type="rest_pause">
      <td class="tp-set-num"><span class="tp-set-type-tag tp-tag-rp">RP</span></td>
      <td class="tp-rp-params"><input type="text" class="tp-set-reps" value="${escHtml(set.reps||'12')}" placeholder="12" style="width:30px;"><span class="tp-rp-lbl">reps</span> <input type="text" class="tp-set-reps-rp" value="${escHtml(set.reps_rp||'20')}" placeholder="20" style="width:30px;"><span class="tp-rp-lbl">total</span> <span class="tp-rp-lbl">RP</span> <input type="text" class="tp-set-rp-time" value="${escHtml(set.rest_pause_time||'15')}" placeholder="15" style="width:28px;"><span class="tp-rp-lbl">s</span></td>
      <td><span style="color:var(--text3);font-size:11px;">—</span></td>
      <td><span style="color:var(--text3);font-size:11px;">—</span></td>
      <td><button class="tp-set-del" onclick="removeTpSet(${exIdx},${setIdx})"><i class="fas fa-times"></i></button></td>
    </tr>`;
  }
  return `<tr class="tp-set-row" data-type="normal">
    <td class="tp-set-num">${setIdx+1}</td>
    <td><input type="text" class="tp-set-reps" value="${escHtml(set.reps||'10')}" placeholder="8-12"></td>
    <td><input type="text" class="tp-set-tempo" value="${escHtml(set.tempo||'30X1')}" placeholder="30X1"></td>
    <td><input type="text" class="tp-set-repos" value="${escHtml(set.repos||'1m30')}" placeholder="1m30"></td>
    <td><button class="tp-set-del" onclick="removeTpSet(${exIdx},${setIdx})"><i class="fas fa-times"></i></button></td>
  </tr>`;
}

function renderTpSessionEditor() {
  const sessions = window._tpSessions;
  const idx = window._tpActiveSession || 0;
  const s = sessions[idx];
  if (!s) return;

  const editor = document.getElementById('tp-session-editor');
  if (!editor) return;

  s.exercises.forEach(ex => { if (!ex.sets) ex.sets = normalizeExSets(ex); });

  const muscles = getMuscleCountFromExercises(s.exercises);
  const volumeHtml = renderVolumeBar(muscles);

  const exHtml = s.exercises.length ? s.exercises.map((ex, i) => {
    const muscle = ex.muscle_principal || ((window.exercicesDB || []).find(e => e.nom === ex.nom || String(e.id) === String(ex.exercice_id)))?.muscle_principal || '';
    const sets = ex.sets || [];
    const superBadge = ex.superset_id ? `<span class="tp-superset-badge">SS ${escHtml(ex.superset_id)}</span>` : '';

    const setsHtml = sets.map((set, si) => buildTpSetRow(i, si, set)).join('');

    return `
      <div class="tr-exercise-card" data-ex-id="${escHtml(String(ex.exercice_id||''))}" data-muscle="${escHtml(muscle)}" data-superset="${escHtml(ex.superset_id||'')}">
        <div class="tr-exercise-header">
          <span class="tr-exercise-num">${i+1}.</span>
          <input type="text" class="tp-ed-name" value="${escHtml(ex.nom)}" readonly style="flex:1;background:transparent;border:none;color:var(--text);font-size:13px;font-weight:600;font-family:inherit;outline:none;cursor:default;">
          ${superBadge}
          ${muscle ? `<span class="tr-exercise-muscle-chip">${escHtml(muscle)}</span>` : ''}
          <div class="tr-exercise-actions">
            <button onclick="moveTpExercise(${i},-1)" title="Monter"><i class="fas fa-arrow-up"></i></button>
            <button onclick="moveTpExercise(${i},1)" title="Descendre"><i class="fas fa-arrow-down"></i></button>
            <div class="tp-ex-menu-wrap">
              <button class="tp-ex-menu-btn" onclick="toggleTpExMenu(this)" title="Options"><i class="fas fa-ellipsis-v"></i></button>
              <div class="tp-ex-menu">
                <button onclick="toggleSuperset(${i})"><i class="fas fa-link"></i> Super set</button>
                <button onclick="addDropSet(${i})"><i class="fas fa-angle-double-down"></i> Drop set</button>
                <button onclick="addRestPause(${i})"><i class="fas fa-pause"></i> Rest-pause</button>
                <hr>
                <button onclick="removeTpExercise(${i})" style="color:var(--danger);"><i class="fas fa-trash"></i> Supprimer</button>
              </div>
            </div>
          </div>
        </div>
        <table class="tp-sets-table">
          <thead><tr><th>#</th><th>Reps</th><th>Tempo</th><th>Repos</th><th></th></tr></thead>
          <tbody>${setsHtml}</tbody>
        </table>
        <button class="tp-add-set-btn" onclick="addTpSet(${i})"><i class="fas fa-plus"></i> Série</button>
      </div>`;
  }).join('') : '<div class="tr-empty-zone"><i class="fas fa-dumbbell"></i>Cliquez sur un exercice de la bibliothèque pour l\'ajouter</div>';

  editor.innerHTML = `
    <div class="tr-session-name-row">
      <div style="display:flex;align-items:center;gap:2px;font-size:12px;color:var(--text3);">Nom de la séance</div>
    </div>
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:20px;">
      <input type="text" id="tp-s-nom" value="${escHtml(s.nom)}" placeholder="ex: Push, Haut du corps..." class="tr-session-name-input" style="flex:1;">
      <input type="text" id="tp-s-jour" value="${escHtml(s.jour)}" placeholder="Jour" class="tr-session-name-input" style="width:120px;font-size:13px;font-weight:400;">
      <button class="btn btn-outline btn-sm btn-danger" onclick="removeTpSession()" title="Supprimer cette séance"><i class="fas fa-trash"></i> Supprimer</button>
    </div>
    <div id="tp-volume-zone">${volumeHtml}</div>
    <div id="tp-session-exercises">${exHtml}</div>`;

  setTimeout(() => updateTpProgramTotal(), 10);
}

function addTpSet(exIdx) {
  saveTpSessionInputs();
  const ex = window._tpSessions[window._tpActiveSession]?.exercises[exIdx];
  if (!ex) return;
  if (!ex.sets) ex.sets = normalizeExSets(ex);
  ex.sets.push({ reps: '10', tempo: '30X1', repos: '1m30', type: 'normal' });
  renderTpSessionEditor();
}

function removeTpSet(exIdx, setIdx) {
  saveTpSessionInputs();
  const ex = window._tpSessions[window._tpActiveSession]?.exercises[exIdx];
  if (!ex || !ex.sets) return;
  if (ex.sets.length <= 1) { notify('Il faut au moins une série', 'warning'); return; }
  ex.sets.splice(setIdx, 1);
  renderTpSessionEditor();
}

function toggleTpExMenu(btn) {
  const menu = btn.nextElementSibling;
  const isOpen = menu.classList.contains('open');
  document.querySelectorAll('.tp-ex-menu.open').forEach(m => m.classList.remove('open'));
  if (!isOpen) menu.classList.add('open');
}

function toggleSuperset(exIdx) {
  saveTpSessionInputs();
  const exercises = window._tpSessions[window._tpActiveSession]?.exercises;
  if (!exercises) return;
  const ex = exercises[exIdx];
  document.querySelectorAll('.tp-ex-menu.open').forEach(m => m.classList.remove('open'));

  if (ex.superset_id) {
    // Remove superset — strip letter from "A1"/"A2" to get group letter
    const groupLetter = ex.superset_id.charAt(0);
    exercises.forEach(e => { if (e.superset_id && e.superset_id.charAt(0) === groupLetter) delete e.superset_id; });
  } else {
    const nextEx = exercises[exIdx + 1];
    if (!nextEx) { notify('Ajoutez un exercice après celui-ci pour créer un super set', 'warning'); return; }
    // Generate group letter (A, B, C...)
    const usedLetters = new Set(exercises.map(e => e.superset_id ? e.superset_id.charAt(0) : null).filter(Boolean));
    let letter = 'A';
    while (usedLetters.has(letter)) letter = String.fromCharCode(letter.charCodeAt(0) + 1);
    ex.superset_id = letter + '1';
    nextEx.superset_id = letter + '2';
  }
  renderTpSessionEditor();
}

function addDropSet(exIdx) {
  saveTpSessionInputs();
  const ex = window._tpSessions[window._tpActiveSession]?.exercises[exIdx];
  if (!ex) return;
  if (!ex.sets) ex.sets = normalizeExSets(ex);
  document.querySelectorAll('.tp-ex-menu.open').forEach(m => m.classList.remove('open'));
  ex.sets.push({ reps: '10', tempo: '30X1', repos: '', type: 'dropset' });
  renderTpSessionEditor();
}

function addRestPause(exIdx) {
  saveTpSessionInputs();
  const ex = window._tpSessions[window._tpActiveSession]?.exercises[exIdx];
  if (!ex) return;
  if (!ex.sets) ex.sets = normalizeExSets(ex);
  document.querySelectorAll('.tp-ex-menu.open').forEach(m => m.classList.remove('open'));
  ex.sets.push({ reps: '12', reps_rp: '20', rest_pause_time: '15', type: 'rest_pause' });
  renderTpSessionEditor();
}

function toggleDropMaxRep(exIdx, setIdx, isMax) {
  saveTpSessionInputs();
  const ex = window._tpSessions[window._tpActiveSession]?.exercises[exIdx];
  if (!ex || !ex.sets || !ex.sets[setIdx]) return;
  ex.sets[setIdx].reps = isMax ? 'MAX' : '10';
  renderTpSessionEditor();
}

function updateTpProgramTotal() {
  const el = document.getElementById('tp-program-total');
  if (!el) return;
  const sessions = window._tpSessions || [];
  let totalEx = 0, totalSeries = 0;
  const totalMuscles = {};
  sessions.forEach(s => {
    (s.exercises || []).forEach(ex => {
      totalEx++;
      const ser = getExSeriesCount(ex);
      totalSeries += ser;
      const m = ex.muscle_principal || ((window.exercicesDB || []).find(e => e.nom === ex.nom || String(e.id) === String(ex.exercice_id)))?.muscle_principal || '';
      if (m && ser > 0) totalMuscles[m] = (totalMuscles[m] || 0) + ser;
    });
  });
  const volumeHtml = renderVolumeBar(totalMuscles);
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:10px;">
      <span style="font-size:13px;font-weight:700;color:var(--text);"><i class="fas fa-chart-bar" style="color:var(--primary);margin-right:6px;"></i>Volume total</span>
      <span style="font-size:12px;color:var(--text3);">${totalEx} exercice${totalEx > 1 ? 's' : ''} · ${totalSeries} séries</span>
    </div>
    ${volumeHtml || '<span style="font-size:12px;color:var(--text3);">Ajoutez des exercices pour voir le volume</span>'}`;
}

function moveTpExercise(idx, dir) {
  saveTpSessionInputs();
  const exs = window._tpSessions[window._tpActiveSession].exercises;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= exs.length) return;
  [exs[idx], exs[newIdx]] = [exs[newIdx], exs[idx]];
  renderTpSessionEditor();
}

function removeTpExercise(idx) {
  saveTpSessionInputs();
  window._tpSessions[window._tpActiveSession].exercises.splice(idx, 1);
  renderTpSessionEditor();
}

async function saveTrainingProgramFromEditor() {
  saveTpSessionInputs();
  const nom = document.getElementById('tp-nom')?.value?.trim();
  if (!nom) { notify('Le nom est obligatoire', 'error'); return; }

  const patternType = document.getElementById('tp-type')?.value || 'pattern';
  const patternData = patternType === 'pattern'
    ? { pattern: document.getElementById('tp-pattern')?.value || '' }
    : { days: (document.getElementById('tp-fixed')?.value || '').split(',').map(d => d.trim()).filter(Boolean) };
  const sessions = window._tpSessions;

  let programId = window._tpEditId;
  if (programId) {
    const { error } = await supabaseClient.from('workout_programs').update({ nom, pattern_type: patternType, pattern_data: patternData }).eq('id', programId);
    if (error) { handleError(error, 'training'); return; }
    const { error: delError } = await supabaseClient.from('workout_sessions').delete().eq('program_id', programId);
    if (delError) { handleError(delError, 'training'); return; }
  } else {
    const { error: deactivateError } = await supabaseClient.from('workout_programs').update({ actif: false }).eq('athlete_id', currentAthleteId);
    if (deactivateError) { handleError(deactivateError, 'training'); return; }
    const { data, error } = await supabaseClient.from('workout_programs').insert({ nom, athlete_id: currentAthleteId, coach_id: currentUser.id, pattern_type: patternType, pattern_data: patternData, actif: true }).select();
    if (error) { handleError(error, 'training'); return; }
    programId = data[0].id;
  }

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const exs = s.exercises.map(e => {
      const base = { nom: e.nom, exercice_id: e.exercice_id || null, muscle_principal: e.muscle_principal || '' };
      if (e.sets && Array.isArray(e.sets)) { base.sets = e.sets; }
      else { base.series = e.series || '-'; base.reps = e.reps || '-'; }
      if (e.superset_id) base.superset_id = e.superset_id;
      return base;
    });
    const { error } = await supabaseClient.from('workout_sessions').insert({ nom: s.nom, jour: s.jour || null, program_id: programId, exercices: JSON.stringify(exs), ordre: i });
    if (error) { handleError(error, 'training'); return; }
  }

  notify('Programme sauvegardé !', 'success');
  // Notify athlete when new program created (actif=true)
  if (!window._tpEditId && currentAthleteObj?.user_id) {
    const _title = 'Nouveau programme activé';
    const _body = `Votre coach a activé le programme "${nom}"`;
    const { error: notifError } = await supabaseClient.from('notifications').insert({
      user_id: currentAthleteObj.user_id, type: 'training', title: _title, body: _body
    });
    if (notifError) { devLog('Notification insert failed:', notifError); }
    await sendExpoPush([currentAthleteObj.user_id], _title, _body);
  }
  window._tpEditId = null;
  loadAthleteTabTraining();
}

// ===== TRAINING TAB =====

async function toggleTrainingProgram(id, isActive) {
  try {
    if (isActive) {
      const { error: deactivateError } = await supabaseClient.from('workout_programs').update({ actif: false }).eq('athlete_id', currentAthleteId);
      if (deactivateError) throw deactivateError;
      const { data: prog, error } = await supabaseClient.from('workout_programs').update({ actif: true }).eq('id', id).select('nom').single();
      if (error) throw error;
      notify('Programme activé !', 'success');
      // Notify athlete
      if (currentAthleteObj?.user_id) {
        const _title = 'Nouveau programme activé';
        const _body = `Votre coach a activé le programme "${prog?.nom || 'Entraînement'}"`;
        const { error: notifError } = await supabaseClient.from('notifications').insert({
          user_id: currentAthleteObj.user_id, type: 'training', title: _title, body: _body
        });
        if (notifError) { devLog('Notification insert failed:', notifError); }
        await sendExpoPush([currentAthleteObj.user_id], _title, _body);
      }
    } else {
      const { error } = await supabaseClient.from('workout_programs').update({ actif: false }).eq('id', id);
      if (error) throw error;
      notify('Programme désactivé', 'success');
    }
    loadAthleteTabTraining();
  } catch (error) {
    handleError(error, 'training');
    loadAthleteTabTraining();
  }
}

async function deleteTrainingProgram(id) {
  if (!confirm('Supprimer ce programme et toutes ses séances ?')) return;
  const { error: sessError } = await supabaseClient.from('workout_sessions').delete().eq('program_id', id);
  if (sessError) { handleError(sessError, 'training'); return; }
  const { error } = await supabaseClient.from('workout_programs').delete().eq('id', id);
  if (error) { handleError(error, 'training'); return; }
  notify('Programme supprimé !', 'success');
  loadAthleteTabTraining();
}

async function loadAthleteTabTraining() {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div class="text-center" style="padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  const [athleteRes, programsRes] = await Promise.all([
    supabaseClient.from('athletes').select('cardio_config, pas_journalier').eq('id', currentAthleteId).single(),
    supabaseClient.from('workout_programs').select('*, workout_sessions(*)').eq('athlete_id', currentAthleteId).order('created_at', { ascending: false }),
    loadExercices(),
  ]);

  if (athleteRes.error) { devLog('athlete fetch error:', athleteRes.error); }
  if (programsRes.error) { devLog('workout_programs fetch error:', programsRes.error); }

  const athlete = athleteRes.data;
  const programs = programsRes.data;

  const cardio = athlete?.cardio_config || null;
  const pas = athlete?.pas_journalier || null;
  window._cardioConfig = cardio;
  window._pasJournalier = pas;

  if (!programs?.length) {
    el.innerHTML = `
      <div id="cardio-section">${renderCardioSection(cardio, pas)}</div>
      <div class="card">
        <div class="empty-state">
          <i class="fas fa-dumbbell"></i>
          <p>Aucun programme d'entraînement</p>
          <div class="flex gap-8" style="justify-content:center;margin-top:12px;">
            <button class="btn btn-outline" onclick="copyTrainingFromTemplate()"><i class="fas fa-copy"></i> Copier un template</button>
            <button class="btn btn-red" onclick="createTrainingProgram()"><i class="fas fa-plus"></i> Créer un programme</button>
          </div>
        </div>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div id="cardio-section">${renderCardioSection(cardio, pas)}</div>
    <div class="flex justify-end gap-8 mb-16">
      <button class="btn btn-outline" onclick="openTrainingHistory()"><i class="fas fa-history"></i> Historique</button>
      <button class="btn btn-outline" onclick="copyTrainingFromTemplate()"><i class="fas fa-copy"></i> Copier template</button>
      <button class="btn btn-red" onclick="createTrainingProgram()"><i class="fas fa-plus"></i> Nouveau programme</button>
    </div>
    ${programs.map(p => renderTrainingProgram(p)).join('')}
  `;
}

// ===== FREE (LIBRE) SESSIONS =====

function renderFreeLogsSection(logs) {
  if (!logs || !logs.length) return '';

  const rowsHtml = logs.map(log => {
    const title = escHtml(log.titre || 'Séance libre');
    const date = formatLogDate(log.date);
    const exs = parseLogExercises(log);
    const exCount = exs.length;
    const totalSets = exs.reduce((s, e) => s + (e.series?.length || 0), 0);

    return `
      <div class="card mb-8" style="border:1px solid var(--border);cursor:pointer;" onclick="toggleFreeLogDetail('${log.id}')">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="color:var(--text3);font-size:12px;font-weight:500;">Libre</span>
            <span style="font-weight:600;color:var(--text);">${title}</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:12px;color:var(--text3);">${exCount} exo${exCount > 1 ? 's' : ''} · ${totalSets} série${totalSets > 1 ? 's' : ''}</span>
            <span style="font-size:12px;color:var(--text3);">${date}</span>
            <i class="fas fa-chevron-down" id="fl-chevron-${log.id}" style="color:var(--text3);font-size:11px;transition:transform 0.2s;"></i>
          </div>
        </div>
        <div id="fl-detail-${log.id}" style="display:none;padding:0 16px 12px;border-top:1px solid var(--border-subtle);">
          ${renderFreeLogExercises(exs)}
        </div>
      </div>`;
  }).join('');

  return `
    <div style="margin-top:24px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <i class="fas fa-running" style="color:var(--text3);"></i>
        <span style="font-size:16px;font-weight:700;color:var(--text);">Séances libres</span>
        <span style="font-size:12px;color:var(--text3);font-weight:500;">(${logs.length})</span>
      </div>
      ${rowsHtml}
    </div>`;
}

function renderFreeLogExercises(exs) {
  if (!exs.length) return '<div style="padding:8px 0;color:var(--text3);font-size:13px;">Aucun exercice</div>';

  return exs.map((ex, i) => {
    const name = escHtml(ex.nom || 'Exercice');
    const muscle = ex.muscle_principal ? `<span style="color:var(--text3);font-size:11px;margin-left:6px;">${escHtml(ex.muscle_principal)}</span>` : '';
    const series = (ex.series || []).map(set => {
      if (set.duree) return `<span class="hist-set">${escHtml(String(set.duree))}</span>`;
      const reps = set.reps ?? '-';
      const kg = set.charge ?? set.kg ?? set.load ?? null;
      return `<span class="hist-set">${reps} reps${kg != null ? ' · ' + kg + ' kg' : ''}</span>`;
    }).join('');

    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;${i > 0 ? 'border-top:1px solid var(--border-subtle);' : ''}">
      <span class="ht-num">${i + 1}</span>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:13px;color:var(--text);">${name}${muscle}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">${series || '<span style="color:var(--text3);font-size:12px;">—</span>'}</div>
      </div>
    </div>`;
  }).join('');
}

function toggleFreeLogDetail(logId) {
  const detail = document.getElementById('fl-detail-' + logId);
  const chevron = document.getElementById('fl-chevron-' + logId);
  if (!detail) return;
  const open = detail.style.display !== 'none';
  detail.style.display = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? '' : 'rotate(180deg)';
}

function renderTrainingProgram(p) {
  let patternDisplay = '';
  if (p.pattern_data) {
    try {
      const pd = typeof p.pattern_data === 'string' ? JSON.parse(p.pattern_data) : p.pattern_data;
      patternDisplay = p.pattern_type === 'pattern' ? (pd.pattern || '') : (pd.days || []).join(' · ');
    } catch (e) {}
  }
  const sessions = (p.workout_sessions || []).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  const isActive = p.actif;

  // Compute total muscles for preview
  const totalMuscles = {};
  sessions.forEach(s => {
    let exs = [];
    try { exs = typeof s.exercices === 'string' ? JSON.parse(s.exercices) : (s.exercices || []); } catch(e) {}
    const m = getMuscleCountFromExercises(exs);
    Object.entries(m).forEach(([k, v]) => { totalMuscles[k] = (totalMuscles[k] || 0) + v; });
  });

  // Mini session tags
  const sessionTags = sessions.map(s =>
    `<span style="display:inline-block;padding:3px 10px;background:var(--bg3);border-radius:6px;font-size:11px;color:var(--text2);font-weight:500;">${escHtml(s.nom || 'Séance')}</span>`
  ).join(' ');

  return `
    <div class="card mb-16" style="border:2px solid ${isActive ? 'var(--primary)' : 'var(--border)'}; cursor:pointer; transition:border-color 0.2s;" onclick="viewAllSessions('${p.id}')">
      <div class="card-header">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="card-title">${escHtml(p.nom)}</div>
            ${isActive ? '<span style="background:var(--success);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;">ACTIF</span>' : ''}
          </div>
          ${patternDisplay ? `<div class="text-small" style="color:var(--text3);margin-top:4px;"><i class="fas fa-repeat"></i> ${escHtml(patternDisplay)}</div>` : ''}
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;">${sessionTags}</div>
          ${Object.keys(totalMuscles).length ? `<div style="margin-top:10px;">${renderVolumeBar(totalMuscles)}</div>` : ''}
        </div>
        <div class="flex gap-8 items-center" onclick="event.stopPropagation()">
          <label class="toggle-switch">
            <input type="checkbox" ${isActive ? 'checked' : ''} onchange="toggleTrainingProgram('${p.id}', this.checked)">
            <span class="switch"></span>
          </label>
          <button class="btn btn-outline btn-sm" onclick="editTrainingProgram('${p.id}')"><i class="fas fa-pen"></i></button>
        </div>
      </div>
    </div>
  `;
}

// ===== MUSCLE COLORS =====
const MUSCLE_COLOR_PALETTE = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
  '#6366f1', '#78716c', '#e11d48', '#0ea5e9', '#d946ef'
];
const _muscleColorCache = {};
function getMuscleColor(m) {
  if (!m) return '#888';
  const key = m.toLowerCase();
  if (_muscleColorCache[key]) return _muscleColorCache[key];
  const idx = Object.keys(_muscleColorCache).length % MUSCLE_COLOR_PALETTE.length;
  _muscleColorCache[key] = MUSCLE_COLOR_PALETTE[idx];
  return _muscleColorCache[key];
}

function renderVolumeBar(muscles) {
  const entries = Object.entries(muscles).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '';
  return `<div class="tr-volume-pills">${entries.map(([m, c]) =>
    `<span class="tr-volume-pill" style="border-color:${getMuscleColor(m)};"><strong style="color:${getMuscleColor(m)};">${c}</strong> ${escHtml(m.toLowerCase())}</span>`
  ).join('')}</div>`;
}

// ===== VIEW SESSIONS =====

async function viewAllSessions(programId) {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div class="text-center" style="padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  const { data: prog } = await supabaseClient.from('workout_programs').select('*, workout_sessions(*)').eq('id', programId).single();
  if (!prog) { notify('Programme introuvable', 'error'); loadAthleteTabTraining(); return; }

  await loadExercices();
  const sessions = (prog.workout_sessions || []).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  window._viewSessions = sessions;
  window._viewProgId = programId;

  // Parse exercises for all sessions
  sessions.forEach(s => {
    try { s._exs = typeof s.exercices === 'string' ? JSON.parse(s.exercices) : (s.exercices || []); } catch (e) { s._exs = []; }
  });

  // Session tabs — show session name or fallback
  const tabsHtml = sessions.map((s, i) => {
    const label = s.nom || ('Séance ' + (i + 1));
    const sub = s.jour ? ` · ${s.jour}` : '';
    return `<button class="tr-session-tab ${i===0?'active':''}" onclick="switchViewSession(${i})">${escHtml(label)}${sub ? `<span style="font-weight:400;color:var(--text3);font-size:11px;">${escHtml(sub)}</span>` : ''}</button>`;
  }).join('');

  el.innerHTML = `
    <div class="tr-header">
      <div>
        <div class="tr-header-title">${escHtml(prog.nom)}</div>
        <div class="tr-header-sub">${sessions.length} séance(s) ${prog.actif ? '· <span style="color:var(--success);font-weight:600;">Actif</span>' : ''}</div>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-outline btn-sm" onclick="viewTrainingHistory('${prog.id}')"><i class="fas fa-history"></i> Historique</button>
        <button class="btn btn-outline btn-sm" onclick="editTrainingProgram('${prog.id}')"><i class="fas fa-pen"></i> Modifier</button>
        <button class="btn btn-outline btn-sm btn-danger" onclick="deleteTrainingProgram('${prog.id}')"><i class="fas fa-trash"></i></button>
        <button class="btn btn-outline btn-sm" onclick="loadAthleteTabTraining()"><i class="fas fa-arrow-left"></i></button>
      </div>
    </div>
    <div class="tr-session-tabs" id="tr-view-tabs">${tabsHtml}</div>
    <div class="tr-body-view">
      <div class="tr-session-content" id="tr-view-content"></div>
    </div>`;

  if (sessions.length) switchViewSession(0);
}

function renderExViewCard(ex, i) {
  const muscle = ex.muscle_principal || ((window.exercicesDB || []).find(e => e.nom === ex.nom || String(e.id) === String(ex.exercice_id)))?.muscle_principal || '';
  const sets = ex.sets ? ex.sets : normalizeExSets(ex);
  const superBadge = ex.superset_id ? `<span class="tp-superset-badge">SS ${escHtml(ex.superset_id)}</span>` : '';

  const setsHtml = sets.map((set, si) => {
    if (set.type === 'dropset') {
      const repsDisplay = set.reps === 'MAX' ? '<span class="tp-maxrep-tag">MAX REP</span>' : escHtml(set.reps||'-');
      return `<tr class="tv-set-row tv-set-drop"><td><span class="tp-set-type-tag tp-tag-drop">DROP</span></td><td>${repsDisplay}</td><td>${escHtml(set.tempo||'-')}</td><td>—</td></tr>`;
    }
    if (set.type === 'rest_pause') {
      return `<tr class="tv-set-row tv-set-rp"><td><span class="tp-set-type-tag tp-tag-rp">RP</span></td><td>${escHtml(set.reps||'-')}</td><td>${escHtml(set.reps_rp||'-')} tot</td><td>${escHtml(set.rest_pause_time||'15')}s</td></tr>`;
    }
    return `<tr class="tv-set-row"><td>${si+1}</td><td>${escHtml(set.reps||'-')}</td><td>${escHtml(set.tempo||'-')}</td><td>${escHtml(set.repos||'-')}</td></tr>`;
  }).join('');

  return `
    <div class="tv-ex-card">
      <div class="tv-ex-header">
        <span class="tv-ex-num">${i+1}</span>
        <span class="tv-ex-name">${escHtml(ex.nom)}</span>
        ${superBadge}
        ${muscle ? `<span class="tr-exercise-muscle-chip">${escHtml(muscle)}</span>` : ''}
      </div>
      <table class="tv-sets-table">
        <thead><tr><th>#</th><th>Reps</th><th>Tempo</th><th>Repos</th></tr></thead>
        <tbody>${setsHtml}</tbody>
      </table>
    </div>`;
}

function switchViewSession(idx) {
  const sessions = window._viewSessions || [];
  const s = sessions[idx];
  if (!s) return;

  document.querySelectorAll('#tr-view-tabs .tr-session-tab').forEach((t, i) => t.classList.toggle('active', i === idx));

  const exercises = s._exs || [];
  exercises.forEach(ex => { if (!ex.sets) ex.sets = normalizeExSets(ex); });
  const muscles = getMuscleCountFromExercises(exercises);
  let totalSeries = 0;
  exercises.forEach(ex => { totalSeries += getExSeriesCount(ex); });

  const volumeHtml = renderVolumeBar(muscles);
  const exercisesHtml = exercises.length ? exercises.map((ex, i) => renderExViewCard(ex, i)).join('') : '<div class="tr-empty-zone"><i class="fas fa-dumbbell"></i>Aucun exercice dans cette séance</div>';

  document.getElementById('tr-view-content').innerHTML = `
    <div class="tv-session-header">
      <div>
        <div class="tv-session-title">${escHtml(s.nom || 'Séance')}</div>
        ${s.jour ? `<div class="tv-session-day"><i class="fas fa-calendar"></i> ${escHtml(s.jour)}</div>` : ''}
      </div>
      <div class="tv-session-stats">
        <span><strong>${exercises.length}</strong> exo</span>
        <span><strong>${totalSeries}</strong> séries</span>
      </div>
    </div>
    ${volumeHtml}
    ${exercisesHtml}`;
}

// ===== SESSION DETAIL =====

async function deleteSession(sessionId) {
  if (!confirm('Supprimer cette séance ?')) return;
  const { error } = await supabaseClient.from('workout_sessions').delete().eq('id', sessionId);
  if (error) { handleError(error, 'training'); return; }
  loadAthleteTabTraining();
}

async function viewSessionDetail(sessionId, programId) {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div class="text-center" style="padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  const { data: session } = await supabaseClient.from('workout_sessions').select('*').eq('id', sessionId).single();
  if (!session) { notify('Séance introuvable', 'error'); loadAthleteTabTraining(); return; }

  let exercises = [];
  try { if (session.exercices) exercises = typeof session.exercices === 'string' ? JSON.parse(session.exercices) : (session.exercices || []); } catch (e) {}
  exercises.forEach(ex => { if (!ex.sets) ex.sets = normalizeExSets(ex); });

  let totalSeries = 0;
  exercises.forEach(ex => { totalSeries += getExSeriesCount(ex); });
  const muscles = getMuscleCountFromExercises(exercises);
  const volumeHtml = renderVolumeBar(muscles);

  el.innerHTML = `
    <div class="tv-detail-page">
      <div class="tv-detail-header">
        <div>
          <div class="tv-detail-title">${escHtml(session.nom)}</div>
          ${session.jour ? `<div class="tv-session-day"><i class="fas fa-calendar"></i> ${escHtml(session.jour)}</div>` : ''}
        </div>
        <div class="flex gap-8">
          <button class="btn btn-red btn-sm" onclick="editSessionDetail('${session.id}', '${programId}')"><i class="fas fa-pen"></i> Modifier</button>
          <button class="btn btn-outline btn-sm" onclick="loadAthleteTabTraining()"><i class="fas fa-arrow-left"></i></button>
        </div>
      </div>
      <div class="tv-detail-stats">
        <div class="tv-detail-stat"><span class="tv-detail-stat-val">${exercises.length}</span><span class="tv-detail-stat-lbl">exercices</span></div>
        <div class="tv-detail-sep"></div>
        <div class="tv-detail-stat"><span class="tv-detail-stat-val">${totalSeries}</span><span class="tv-detail-stat-lbl">séries</span></div>
      </div>
      ${volumeHtml}
      <div class="tv-exercises-list">
        ${exercises.length ? exercises.map((ex, i) => renderExViewCard(ex, i)).join('') : '<div class="tr-empty-zone"><i class="fas fa-dumbbell"></i>Aucun exercice</div>'}
      </div>
    </div>`;
}

async function editSessionDetail(sessionId, programId) {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div class="text-center" style="padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';
  await loadExercices();

  const { data: session } = await supabaseClient.from('workout_sessions').select('*').eq('id', sessionId).single();
  if (!session) { notify('Séance introuvable', 'error'); loadAthleteTabTraining(); return; }

  let exercises = [];
  try { if (session.exercices) exercises = typeof session.exercices === 'string' ? JSON.parse(session.exercices) : (session.exercices || []); } catch (e) {}

  window._esEditId = sessionId;
  window._esProgramId = programId;
  window._esExercises = exercises;

  const exercisesOptions = (window.exercicesDB || []).map(ex => `<option value="${escHtml(ex.nom)}">`).join('');

  el.innerHTML = `
    <div class="card">
      <datalist id="exercices-list">${exercisesOptions}</datalist>
      <div class="card-header">
        <div class="card-title">Modifier — ${escHtml(session.nom)}</div>
        <button class="btn btn-outline" onclick="viewSessionDetail('${sessionId}', '${programId}')"><i class="fas fa-arrow-left"></i> Annuler</button>
      </div>
      <div class="grid-2 mb-16">
        <div class="form-group"><label class="label-sm">Nom de la séance</label><input type="text" id="es-nom" value="${escHtml(session.nom||'')}" class="inline-input"></div>
        <div class="form-group"><label class="label-sm">Jour</label><input type="text" id="es-jour" value="${escHtml(session.jour||'')}" placeholder="ex: Lundi" class="inline-input"></div>
      </div>
      <div class="flex justify-between items-center" style="margin:16px 0 8px;">
        <h4 class="text-primary">Exercices (${exercises.length})</h4>
        <button type="button" class="btn btn-outline btn-sm" onclick="addEsExercise()"><i class="fas fa-plus"></i> Exercice</button>
      </div>
      <div id="es-exercises">${exercises.length ? exercises.map((ex, idx) => buildEsExerciseHtml(idx, ex)).join('') : '<div class="text-small text-muted text-center" style="padding:16px;">Aucun exercice</div>'}</div>
      <div class="flex justify-end border-top mt-16">
        <button class="btn btn-red" onclick="saveSessionDetailInline()"><i class="fas fa-save"></i> Enregistrer</button>
      </div>
    </div>`;
}

function buildEsExerciseHtml(idx, ex) {
  return `
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px;">
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 80px;gap:8px;align-items:flex-end;">
        <div><label class="label-sm">Exercice</label><input type="text" id="es-ex-nom-${idx}" value="${escHtml(ex.nom||'')}" placeholder="Nom" list="exercices-list" class="inline-input"></div>
        <div><label class="label-sm">Séries</label><input type="number" id="es-ex-series-${idx}" value="${ex.series||3}" min="1" class="inline-input" style="text-align:center;"></div>
        <div><label class="label-sm">Reps</label><input type="number" id="es-ex-reps-${idx}" value="${ex.reps||8}" min="1" class="inline-input" style="text-align:center;"></div>
        <div><label class="label-sm">Tempo</label><input type="text" id="es-ex-tempo-${idx}" value="${escHtml(ex.tempo||'')}" placeholder="3010" class="inline-input" style="text-align:center;"></div>
        <button type="button" class="btn btn-outline btn-sm btn-danger" onclick="removeEsExercise(${idx})"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
}

function addEsExercise() {
  const container = document.getElementById('es-exercises');
  const idx = window._esExercises.length;
  const newEx = { nom: '', series: 3, reps: 8, tempo: '' };
  window._esExercises.push(newEx);
  if (container.textContent.includes('Aucun exercice')) container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', buildEsExerciseHtml(idx, newEx));
}

function removeEsExercise(idx) {
  window._esExercises.splice(idx, 1);
  const container = document.getElementById('es-exercises');
  container.innerHTML = window._esExercises.length
    ? window._esExercises.map((ex, i) => buildEsExerciseHtml(i, ex)).join('')
    : '<div class="text-small text-muted text-center" style="padding:16px;">Aucun exercice</div>';
}

async function saveSessionDetailInline() {
  const nom = document.getElementById('es-nom').value.trim();
  const jour = document.getElementById('es-jour').value.trim();
  if (!nom) { notify('Veuillez entrer un nom de séance', 'warning'); return; }

  const exercises = [];
  for (let i = 0; i < window._esExercises.length; i++) {
    const nomInput = document.getElementById(`es-ex-nom-${i}`);
    if (!nomInput) break;
    exercises.push({
      nom: nomInput.value.trim(),
      series: parseInt(document.getElementById(`es-ex-series-${i}`).value) || 0,
      reps: parseInt(document.getElementById(`es-ex-reps-${i}`).value) || 0,
      tempo: document.getElementById(`es-ex-tempo-${i}`)?.value.trim() || null
    });
  }

  const { error } = await supabaseClient.from('workout_sessions').update({ nom, jour, exercices: JSON.stringify(exercises) }).eq('id', window._esEditId);
  if (error) { handleError(error, 'training'); return; }
  notify('Séance enregistrée !', 'success');
  viewSessionDetail(window._esEditId, window._esProgramId);
}

async function removeExercise(sessionId, exerciseIdx) {
  const { data: session } = await supabaseClient.from('workout_sessions').select('exercices').eq('id', sessionId).single();
  let exs = [];
  try { exs = typeof session?.exercices === 'string' ? JSON.parse(session.exercices) : (session?.exercices || []); } catch (e) {}
  exs.splice(exerciseIdx, 1);
  const { error } = await supabaseClient.from('workout_sessions').update({ exercices: JSON.stringify(exs) }).eq('id', sessionId);
  if (error) { handleError(error, 'training'); return; }
  loadAthleteTabTraining();
}

// ===== TRAINING HISTORY =====

async function openTrainingHistory() {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div class="text-center" style="padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  // Load ALL logs for this athlete (programme + libre)
  const [{ data: allLogs }, { data: programs }] = await Promise.all([
    supabaseClient.from('workout_logs').select('*').eq('athlete_id', currentAthleteId).order('date', { ascending: false }).limit(500),
    supabaseClient.from('workout_programs').select('*, workout_sessions(*)').eq('athlete_id', currentAthleteId).order('created_at', { ascending: false }),
  ]);

  // Build session lookup (id → session with parsed exercises)
  const sessionMap = {};
  (programs || []).forEach(p => {
    (p.workout_sessions || []).forEach(s => {
      try { s._exs = typeof s.exercices === 'string' ? JSON.parse(s.exercices) : (s.exercices || []); } catch { s._exs = []; }
      s._progName = p.nom;
      sessionMap[s.id] = s;
    });
  });

  window._thAllLogs = allLogs || [];
  window._thSessionMap = sessionMap;
  window._thWeekOffset = 0;
  window._thSelectedDate = null;
  window._thPrevLogIdx = 0;

  renderTrainingHistory(el);
}

function renderTrainingHistory(el) {
  if (!el) el = document.getElementById('athlete-tab-content');
  const allLogs = window._thAllLogs || [];
  const offset = window._thWeekOffset || 0;

  // Compute week
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7) - (offset * 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekStartStr = toDateStr(weekStart);
  const weekEndStr = toDateStr(weekEnd);
  const today = toDateStr(now);

  // Days of the week
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push({ date: toDateStr(d), dayLabel: d.toLocaleDateString('fr-FR', { weekday: 'short' }), dayNum: d.getDate() });
  }

  const weekLabel = weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' — ' + weekEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  // Selected date
  if (!window._thSelectedDate || window._thSelectedDate < weekStartStr || window._thSelectedDate > weekEndStr) {
    // Find most recent day with a log in this week, or today
    const dayWithLog = days.slice().reverse().find(d => allLogs.some(l => l.date === d.date));
    window._thSelectedDate = dayWithLog?.date || (days.find(d => d.date === today)?.date || days[0].date);
  }
  const selectedDate = window._thSelectedDate;

  // Day buttons
  const daysHtml = days.map(d => {
    const hasLog = allLogs.some(l => l.date === d.date);
    const isSelected = d.date === selectedDate;
    const isToday = d.date === today;
    return `<button class="nh-day ${isSelected ? 'active' : ''} ${isToday ? 'nh-today' : ''}" onclick="selectHistDay('${d.date}')">
      <span class="nh-day-label">${d.dayLabel}</span>
      <span class="nh-day-num">${d.dayNum}</span>
      ${hasLog ? '<span class="nh-day-dot"></span>' : ''}
    </button>`;
  }).join('');

  // Logs for selected date
  const dayLogs = allLogs.filter(l => l.date === selectedDate);

  // Build day content
  let dayContentHtml = '';
  if (!dayLogs.length) {
    dayContentHtml = `<div style="text-align:center;padding:40px;color:var(--text3);">
      <i class="fas fa-dumbbell" style="font-size:28px;margin-bottom:12px;"></i>
      <div style="font-size:14px;">Aucune séance ce jour</div>
    </div>`;
  } else {
    dayContentHtml = dayLogs.map((log, logIdx) => {
      const session = log.session_id ? window._thSessionMap[log.session_id] : null;
      const sessionName = session?.nom || log.session_name || log.titre || 'Séance libre';
      const isLibre = !log.session_id;
      const libreTag = isLibre ? '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:var(--bg4);color:var(--text3);margin-left:6px;">Libre</span>' : '';
      const duration = (log.started_at && log.finished_at)
        ? Math.round((new Date(log.finished_at) - new Date(log.started_at)) / 60000)
        : null;
      const durationHtml = duration
        ? `<span style="font-size:12px;color:var(--text3);margin-left:8px;"><i class="fas fa-clock" style="margin-right:3px;"></i>${duration >= 60 ? Math.floor(duration/60) + 'h' + String(duration%60).padStart(2,'0') : duration + ' min'}</span>`
        : '';
      const programmedExs = session?._exs || [];
      const logExs = parseLogExercises(log);

      // Find previous logs of same session type for comparison
      const prevLogIdx = window._thPrevLogIdx || 0;
      let sameLogs;
      if (log.session_id) {
        sameLogs = allLogs.filter(l => l.session_id === log.session_id && l.date < log.date);
      } else {
        sameLogs = allLogs.filter(l => !l.session_id && l.date < log.date && (l.titre || l.session_name) === (log.titre || log.session_name));
      }
      const hasPrev = sameLogs.length > 0;
      const safeIdx = Math.min(prevLogIdx, sameLogs.length - 1);
      const prevLog = hasPrev ? sameLogs[safeIdx] : null;
      const prevExs = prevLog ? parseLogExercises(prevLog) : [];
      const prevDate = prevLog ? formatLogDate(prevLog.date) : '';

      // Set tags with comparison
      const setTags = (series, cmpSeries) => (series || []).map((set, si) => {
        const reps = set.reps ?? '-';
        const kg = set.kg ?? set.load ?? set.charge ?? null;
        let cmpIcon = '';
        if (cmpSeries) {
          const cs = cmpSeries[si];
          if (cs) {
            const curVol = (parseFloat(kg) || 0) > 0 ? (parseFloat(set.reps) || 0) * (parseFloat(kg) || 0) : (parseFloat(set.reps) || 0);
            const prevVol = (parseFloat(cs.kg ?? cs.load ?? cs.charge) || 0) > 0 ? (parseFloat(cs.reps) || 0) * (parseFloat(cs.kg ?? cs.load ?? cs.charge) || 0) : (parseFloat(cs.reps) || 0);
            if (curVol > prevVol) cmpIcon = ' <i class="fas fa-arrow-up ht-cmp-up"></i>';
            else if (curVol < prevVol) cmpIcon = ' <i class="fas fa-arrow-down ht-cmp-down"></i>';
            else cmpIcon = ' <i class="fas fa-equals ht-cmp-eq"></i>';
          }
        }
        if (set.duree) return `<span class="hist-set">${escHtml(String(set.duree))}</span>`;
        return `<span class="hist-set">${reps} reps${kg != null && kg !== '-' ? ' · ' + kg + ' kg' : ''}${cmpIcon}</span>`;
      }).join('');

      const match = (name, exs) => exs.find(le => le.nom && le.nom.toLowerCase() === name.toLowerCase()) || null;

      // Build rows from programmed exercises + extras
      const baseExs = programmedExs.length ? programmedExs : logExs;
      const rows = baseExs.map((pEx, i) => {
        const name = pEx.nom || '';
        const le = match(name, logExs);
        const pe = match(name, prevExs);
        const missed = !le;
        const plannedCount = pEx ? (parseInt(pEx.series) || pEx.sets?.length || 0) : 0;
        const doneCount = le?.series?.length || 0;
        const seriesMismatch = plannedCount > 0 && doneCount > 0 && doneCount < plannedCount;
        return `<div class="ht-row${!le && !pe ? ' ht-row-dim' : ''}">
          <div class="ht-cell-name${missed ? ' ht-name-missed' : ''}">
            <span class="ht-num">${i + 1}</span>${escHtml(name)}
            ${missed ? '<span style="font-size:9px;padding:1px 6px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--danger);margin-left:6px;">Non fait</span>' : ''}
            ${seriesMismatch ? `<span style="font-size:9px;color:#f59e0b;margin-left:6px;">${doneCount}/${plannedCount} séries</span>` : ''}
          </div>
          <div class="ht-cell-data">${pe ? setTags(pe.series) : '<span class="ht-nil">—</span>'}</div>
          <div class="ht-cell-data">${le ? setTags(le.series, pe?.series) : '<span class="ht-nil">—</span>'}</div>
        </div>`;
      }).join('');

      // Extras (done but not programmed)
      const extraExs = programmedExs.length ? logExs.filter(le => !programmedExs.some(pe => pe.nom?.toLowerCase() === le.nom?.toLowerCase())) : [];
      const extraRows = extraExs.map(ex => {
        const pe = match(ex.nom, prevExs);
        return `<div class="ht-row ht-row-extra">
          <div class="ht-cell-name"><span class="ht-extra-badge">+</span>${escHtml(ex.nom || '?')}<span style="font-size:9px;padding:1px 6px;border-radius:8px;background:rgba(245,158,11,0.15);color:#f59e0b;margin-left:4px;">Ajouté</span></div>
          <div class="ht-cell-data">${pe ? setTags(pe.series) : '<span class="ht-nil">—</span>'}</div>
          <div class="ht-cell-data">${setTags(ex.series, pe?.series)}</div>
        </div>`;
      }).join('');

      // Previous header
      let prevHdr;
      if (hasPrev) {
        prevHdr = `
          <div class="ht-col-nav">
            <button class="ht-nav-btn" ${safeIdx >= sameLogs.length - 1 ? 'disabled' : ''} onclick="navHistPrev(${safeIdx + 1})"><i class="fas fa-chevron-left"></i></button>
            <span class="ht-col-label">${prevDate}</span>
            <button class="ht-nav-btn" ${safeIdx <= 0 ? 'disabled' : ''} onclick="navHistPrev(${safeIdx - 1})"><i class="fas fa-chevron-right"></i></button>
            <span class="ht-col-count">${safeIdx + 1}/${sameLogs.length}</span>
          </div>`;
      } else {
        prevHdr = '<span class="ht-col-label" style="color:var(--text3);">Pas de précédent</span>';
      }

      const rightDate = formatLogDate(log.date);

      return `
        <div style="margin-bottom:16px;">
          <div style="font-size:15px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;">
            <i class="fas fa-dumbbell" style="color:var(--primary);margin-right:8px;"></i>${escHtml(sessionName)}${libreTag}${durationHtml}
          </div>
          <div class="ht-wrap">
            <div class="ht-hdr">
              <div class="ht-cell-name ht-hdr-title">Exercice</div>
              <div class="ht-cell-data ht-hdr-col">${prevHdr}</div>
              <div class="ht-cell-data ht-hdr-col"><span class="ht-col-label">${rightDate}</span></div>
            </div>
            ${rows}${extraRows}
          </div>
        </div>`;
    }).join('');
  }

  const dateLong = new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  el.innerHTML = `
    <div class="tr-header">
      <div>
        <div class="tr-header-title"><i class="fas fa-history" style="color:var(--primary);margin-right:8px;"></i>Historique Training</div>
        <div class="tr-header-sub">Séances réalisées par l'athlète</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="loadAthleteTabTraining()"><i class="fas fa-arrow-left"></i> Programmes</button>
    </div>

    <div class="nh-week-nav">
      <button class="nh-week-btn" onclick="navHistWeek(1)"><i class="fas fa-chevron-left"></i></button>
      <span class="nh-week-label">${weekLabel}</span>
      <button class="nh-week-btn" ${offset <= 0 ? 'disabled' : ''} onclick="navHistWeek(-1)"><i class="fas fa-chevron-right"></i></button>
    </div>

    <div class="nh-days-row">${daysHtml}</div>

    <div class="nh-content">
      <div class="nh-date-label">${dateLong}</div>
      ${dayContentHtml}
    </div>`;
}

function selectHistDay(dateStr) {
  window._thSelectedDate = dateStr;
  window._thPrevLogIdx = 0;
  renderTrainingHistory();
}

function navHistWeek(dir) {
  window._thWeekOffset = (window._thWeekOffset || 0) + dir;
  window._thSelectedDate = null;
  window._thPrevLogIdx = 0;
  renderTrainingHistory();
}

function navHistPrev(idx) {
  window._thPrevLogIdx = idx;
  renderTrainingHistory();
}

// Keep for backward compat (videos.js references it)
async function viewTrainingHistory(programId) { openTrainingHistory(); }
function switchHistSession() {}
function switchHistLog() {}

function parseLogExercises(log) {
  try {
    return (typeof log.exercices_completes === 'string' ? JSON.parse(log.exercices_completes) : log.exercices_completes) || [];
  } catch (e) { return []; }
}

function formatLogDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function buildExCell(pEx, logExs, idx) {
  const pName = pEx.nom || '';
  const lEx = logExs.find(le => le.nom && le.nom.toLowerCase() === pName.toLowerCase()) || null;
  const done = !!lEx;

  const logSeries = lEx?.series || [];
  let setsHtml;
  if (logSeries.length) {
    setsHtml = '<div class="hist-ex-sets">' + logSeries.map(set => {
      const reps = set.reps ?? '-';
      const kg = set.kg ?? set.load ?? null;
      return `<span class="hist-set">${reps} reps${kg != null && kg !== '-' ? ' · ' + kg + ' kg' : ''}</span>`;
    }).join('') + '</div>';
  } else {
    setsHtml = '<div class="hist-ex-nd">Non réalisé</div>';
  }

  return `
    <div class="hist-ex-block ${done ? '' : 'hist-ex-missed-block'}">
      <div class="hist-ex-header">
        <span class="hist-ex-num">${idx+1}.</span>
        <span class="hist-ex-name">${escHtml(pName)}</span>
        ${done ? '<span class="hist-ex-done"><i class="fas fa-check"></i></span>' : '<span class="hist-ex-missed"><i class="fas fa-minus"></i></span>'}
      </div>
      ${setsHtml}
    </div>`;
}

function buildExtraCell(ex) {
  const logSeries = ex.series || [];
  const setsHtml = logSeries.length ? '<div class="hist-ex-sets">' + logSeries.map(set => {
    const reps = set.reps ?? '-';
    const kg = set.kg ?? set.load ?? null;
    return `<span class="hist-set">${reps} reps${kg != null && kg !== '-' ? ' · ' + kg + ' kg' : ''}</span>`;
  }).join('') + '</div>' : '';
  return `
    <div class="hist-ex-block hist-ex-extra">
      <div class="hist-ex-header">
        <span class="hist-ex-name">${escHtml(ex.nom || '?')}</span>
        <span style="font-size:10px;color:var(--text3);font-style:italic;">ajouté</span>
      </div>
      ${setsHtml}
    </div>`;
}

function buildExtraCell(ex) {
  const logSeries = ex.series || [];
  const setsHtml = logSeries.length ? '<div class="hist-ex-sets">' + logSeries.map(set => {
    const reps = set.reps ?? '-';
    const kg = set.kg ?? set.load ?? null;
    return `<span class="hist-set">${reps} reps${kg != null && kg !== '-' ? ' · ' + kg + ' kg' : ''}</span>`;
  }).join('') + '</div>' : '';
  return `
    <div class="hist-ex-block hist-ex-extra">
      <div class="hist-ex-header">
        <span class="hist-ex-name">${escHtml(ex.nom || '?')}</span>
        <span style="font-size:10px;color:var(--text3);font-style:italic;">ajouté</span>
      </div>
      ${setsHtml}
    </div>`;
}

function buildExtraCell(ex) {
  const logSeries = ex.series || [];
  const setsHtml = logSeries.length ? '<div class="hist-ex-sets">' + logSeries.map(set => {
    const reps = set.reps ?? '-';
    const kg = set.kg ?? set.load ?? null;
    return `<span class="hist-set">${reps} reps${kg != null && kg !== '-' ? ' · ' + kg + ' kg' : ''}</span>`;
  }).join('') + '</div>' : '';
  return `
    <div class="hist-ex-block hist-ex-extra">
      <div class="hist-ex-header">
        <span class="hist-ex-name">${escHtml(ex.nom || '?')}</span>
        <span style="font-size:10px;color:var(--text3);font-style:italic;">ajouté</span>
      </div>
      ${setsHtml}
    </div>`;
}


// Close exercise menus on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.tp-ex-menu-wrap')) {
    document.querySelectorAll('.tp-ex-menu.open').forEach(m => m.classList.remove('open'));
  }
});
