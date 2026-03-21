// ===== TRAINING PROGRAMS =====

async function loadExercices() {
  if (window.exercicesDB) return window.exercicesDB;
  const { data } = await supabaseClient.from('exercices').select('id, nom, muscle_principal, categorie').order('nom');
  window.exercicesDB = data || [];
  return window.exercicesDB;
}

// ===== TRAINING PROGRAM EDITOR =====

function buildTpExerciseHtml(exData) {
  const opts = '<option value="">— exercice —</option>' + (window.exercicesDB || []).map(ex => {
    const sel = (exData && (String(exData.exercice_id) === String(ex.id) || exData.nom === ex.nom)) ? ' selected' : '';
    return `<option value="${ex.id}" data-nom="${escHtml(ex.nom)}"${sel}>${escHtml(ex.nom)}${ex.muscle_principal ? ' — ' + escHtml(ex.muscle_principal) : ''}</option>`;
  }).join('');
  return `
    <div class="exercise-item tp-ex-row" style="flex-wrap:wrap;gap:6px;margin-bottom:6px;">
      <select class="inline-input-sm" style="flex:2;min-width:160px;text-align:left;">${opts}</select>
      <input type="number" class="tp-ex-series inline-input-sm" value="${escHtml(exData?.series||'')}" placeholder="Séries" style="width:60px;" min="1">
      <input type="text" class="tp-ex-reps inline-input-sm" value="${escHtml(exData?.reps||'')}" placeholder="Reps" style="width:70px;">
      <input type="number" class="tp-ex-charge inline-input-sm" value="${escHtml(exData?.charge||'')}" placeholder="Charge kg" style="width:80px;" step="0.5">
      <button type="button" class="btn btn-outline btn-sm btn-danger" onclick="this.closest('.tp-ex-row').remove()">×</button>
    </div>`;
}

function buildTpSessionHtml(sessionData) {
  const exHtml = (sessionData?.exercises?.length ? sessionData.exercises : [null]).map(ex => buildTpExerciseHtml(ex)).join('');
  return `
    <div class="training-day tp-session-row mb-12">
      <div class="training-day-header">
        <div style="display:flex;gap:8px;flex:1;">
          <input type="text" class="tp-session-nom inline-input" placeholder="Nom séance (ex: Haut du corps)" value="${escHtml(sessionData?.nom||'')}" style="flex:1;">
          <input type="text" class="tp-session-jour inline-input" placeholder="Jour (optionnel)" value="${escHtml(sessionData?.jour||'')}" style="width:130px;">
        </div>
        <button type="button" class="btn btn-outline btn-sm btn-danger" style="margin-left:8px;" onclick="this.closest('.tp-session-row').remove()">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      <div class="tp-exercises-list" style="margin-top:10px;">${exHtml}</div>
      <button type="button" class="btn btn-outline btn-sm" style="margin-top:8px;" onclick="this.previousElementSibling.insertAdjacentHTML('beforeend', buildTpExerciseHtml(null))">
        <i class="fas fa-plus"></i> Exercice
      </button>
    </div>`;
}

function addTpSession() {
  const c = document.getElementById('tp-sessions');
  if (c) c.insertAdjacentHTML('beforeend', buildTpSessionHtml(null));
}

function getTpSessionsData() {
  const sessions = [];
  document.querySelectorAll('#tp-sessions .tp-session-row').forEach(row => {
    const nom = row.querySelector('.tp-session-nom')?.value?.trim() || '';
    const jour = row.querySelector('.tp-session-jour')?.value?.trim() || '';
    const exercises = [];
    row.querySelectorAll('.tp-ex-row').forEach(exRow => {
      const sel = exRow.querySelector('select');
      const selectedOpt = sel?.options[sel?.selectedIndex];
      const nomEx = selectedOpt?.dataset.nom || '';
      if (nomEx) {
        exercises.push({
          nom: nomEx,
          exercice_id: sel?.value || null,
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
    if (error) { notify('Erreur: ' + error.message, 'error'); return; }
    await supabaseClient.from('workout_sessions').delete().eq('program_id', programId);
  } else {
    const { data, error } = await supabaseClient.from('workout_programs').insert({ nom, athlete_id: currentAthleteId, coach_id: currentUser.id, pattern_type: patternType, pattern_data: patternData }).select();
    if (error) { notify('Erreur: ' + error.message, 'error'); return; }
    programId = data[0].id;
  }

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const { error } = await supabaseClient.from('workout_sessions').insert({ nom: s.nom, jour: s.jour || null, program_id: programId, exercices: JSON.stringify(s.exercises), ordre: i });
    if (error) { notify('Erreur: ' + error.message, 'error'); return; }
  }

  notify('Programme sauvegardé !', 'success');
  window._tpEditId = null;
  loadAthleteTabTraining();
}

async function createTrainingProgram() {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div class="text-center" style="padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';
  await loadExercices();
  window._tpEditId = null;
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Nouveau programme</div>
        <button class="btn btn-outline" onclick="loadAthleteTabTraining()"><i class="fas fa-arrow-left"></i> Annuler</button>
      </div>
      <div class="grid-2 mb-16">
        <div class="form-group"><label class="label-sm">Nom du programme</label><input type="text" id="tp-nom" class="inline-input"></div>
        <div class="form-group"><label class="label-sm">Type</label>
          <select id="tp-type" onchange="updateTpPatternInputs()" class="inline-input">
            <option value="pattern">Pattern (ex: Haut/Bas/Repos)</option>
            <option value="fixed">Jours fixes</option>
          </select>
        </div>
      </div>
      <div class="form-group" id="tp-pattern-group">
        <label class="label-sm">Pattern (séparé par /)</label>
        <input type="text" id="tp-pattern" placeholder="ex: Haut du corps / Bas du corps / Repos" class="inline-input">
      </div>
      <div class="form-group" id="tp-fixed-group" style="display:none;">
        <label class="label-sm">Jours (séparés par des virgules)</label>
        <input type="text" id="tp-fixed" placeholder="ex: Lundi, Mercredi, Vendredi" class="inline-input">
      </div>
      <div class="flex justify-between items-center" style="margin:16px 0 8px;">
        <h4 class="text-primary">Séances</h4>
        <button type="button" class="btn btn-outline btn-sm" onclick="addTpSession()"><i class="fas fa-plus"></i> Séance</button>
      </div>
      <div id="tp-sessions">${buildTpSessionHtml(null)}</div>
      <div class="flex justify-end border-top mt-16">
        <button class="btn btn-red" onclick="saveTrainingProgramInline()"><i class="fas fa-save"></i> Créer le programme</button>
      </div>
    </div>`;
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
  const sessions = (prog.workout_sessions || []).sort((a, b) => (a.ordre || 0) - (b.ordre || 0)).map(s => {
    let exercises = [];
    try { exercises = typeof s.exercices === 'string' ? JSON.parse(s.exercices) : (s.exercices || []); } catch (e) {}
    return { nom: s.nom || '', jour: s.jour || '', exercises };
  });

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Modifier — ${escHtml(prog.nom)}</div>
        <button class="btn btn-outline" onclick="loadAthleteTabTraining()"><i class="fas fa-arrow-left"></i> Annuler</button>
      </div>
      <div class="grid-2 mb-16">
        <div class="form-group"><label class="label-sm">Nom du programme</label><input type="text" id="tp-nom" value="${escHtml(prog.nom||'')}" class="inline-input"></div>
        <div class="form-group"><label class="label-sm">Type</label>
          <select id="tp-type" onchange="updateTpPatternInputs()" class="inline-input">
            <option value="pattern"${patternType==='pattern'?' selected':''}>Pattern (ex: Haut/Bas/Repos)</option>
            <option value="fixed"${patternType==='fixed'?' selected':''}>Jours fixes</option>
          </select>
        </div>
      </div>
      <div class="form-group" id="tp-pattern-group"${patternType!=='pattern'?' style="display:none;"':''}>
        <label class="label-sm">Pattern (séparé par /)</label>
        <input type="text" id="tp-pattern" value="${escHtml(pd.pattern||'')}" placeholder="ex: Haut / Bas / Repos" class="inline-input">
      </div>
      <div class="form-group" id="tp-fixed-group"${patternType!=='fixed'?' style="display:none;"':''}>
        <label class="label-sm">Jours (séparés par des virgules)</label>
        <input type="text" id="tp-fixed" value="${escHtml((pd.days||[]).join(', '))}" class="inline-input">
      </div>
      <div class="flex justify-between items-center" style="margin:16px 0 8px;">
        <h4 class="text-primary">Séances</h4>
        <button type="button" class="btn btn-outline btn-sm" onclick="addTpSession()"><i class="fas fa-plus"></i> Séance</button>
      </div>
      <div id="tp-sessions">${sessions.length ? sessions.map(s => buildTpSessionHtml(s)).join('') : buildTpSessionHtml(null)}</div>
      <div class="flex justify-end border-top mt-16">
        <button class="btn btn-red" onclick="saveTrainingProgramInline()"><i class="fas fa-save"></i> Enregistrer</button>
      </div>
    </div>`;
}

// ===== TRAINING TAB =====

async function toggleTrainingProgram(id, isActive) {
  try {
    if (isActive) {
      await supabaseClient.from('workout_programs').update({ actif: false }).eq('athlete_id', currentAthleteId);
      const { error } = await supabaseClient.from('workout_programs').update({ actif: true }).eq('id', id);
      if (error) throw error;
      notify('Programme activé !', 'success');
    } else {
      const { error } = await supabaseClient.from('workout_programs').update({ actif: false }).eq('id', id);
      if (error) throw error;
      notify('Programme désactivé', 'success');
    }
    loadAthleteTabTraining();
  } catch (error) {
    notify('Erreur: ' + error.message, 'error');
    loadAthleteTabTraining();
  }
}

async function deleteTrainingProgram(id) {
  if (!confirm('Supprimer ce programme et toutes ses séances ?')) return;
  await supabaseClient.from('workout_sessions').delete().eq('program_id', id);
  const { error } = await supabaseClient.from('workout_programs').delete().eq('id', id);
  if (error) { notify('Erreur: ' + error.message, 'error'); return; }
  notify('Programme supprimé !', 'success');
  loadAthleteTabTraining();
}

async function loadAthleteTabTraining() {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div class="text-center" style="padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  const { data: programs } = await supabaseClient
    .from('workout_programs')
    .select('*, workout_sessions(*)')
    .eq('athlete_id', currentAthleteId)
    .order('created_at', { ascending: false });

  if (!programs?.length) {
    el.innerHTML = `
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
    <div class="flex justify-end gap-8 mb-16">
      <button class="btn btn-outline" onclick="copyTrainingFromTemplate()"><i class="fas fa-copy"></i> Copier template</button>
      <button class="btn btn-red" onclick="createTrainingProgram()"><i class="fas fa-plus"></i> Nouveau programme</button>
    </div>
    ${programs.map(p => renderTrainingProgram(p)).join('')}
  `;
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

  return `
    <div class="card mb-20" style="border:2px solid ${isActive ? 'var(--primary)' : 'var(--border)'};position:relative;">
      ${isActive ? '<div class="active-badge">✓ ACTIF</div>' : ''}
      <div class="card-header">
        <div>
          <div class="card-title">${p.nom}</div>
          ${patternDisplay ? `<div class="text-small text-primary" style="margin-top:4px;"><i class="fas fa-repeat"></i> ${patternDisplay}</div>` : ''}
          <div class="text-small text-muted" style="margin-top:6px;">${sessions.length} séance(s)</div>
        </div>
        <div class="flex gap-12 items-center">
          <label class="toggle-switch">
            <input type="checkbox" ${isActive ? 'checked' : ''} onchange="toggleTrainingProgram('${p.id}', this.checked)">
            <span class="switch"></span>
            <span class="text-small" style="color:var(--text2);font-weight:500;">Actif</span>
          </label>
          <button class="btn btn-red btn-sm" onclick="viewAllSessions('${p.id}')"><i class="fas fa-eye"></i></button>
        </div>
      </div>
    </div>
  `;
}

// ===== VIEW SESSIONS =====

async function viewAllSessions(programId) {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div class="text-center" style="padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  const { data: prog } = await supabaseClient.from('workout_programs').select('*, workout_sessions(*)').eq('id', programId).single();
  if (!prog) { notify('Programme introuvable', 'error'); loadAthleteTabTraining(); return; }

  const sessions = (prog.workout_sessions || []).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

  const sessionsHtml = sessions.length ? sessions.map(s => {
    let exercises = [];
    try { if (s.exercices) exercises = typeof s.exercices === 'string' ? JSON.parse(s.exercices) : (s.exercices || []); } catch (e) {}

    return `
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:12px;">
        <div style="font-weight:600;color:var(--text);margin-bottom:8px;">${s.nom || 'Séance'}</div>
        ${s.jour ? `<div class="text-small text-muted mb-8">📅 ${s.jour}</div>` : ''}
        ${exercises.map(ex => `
          <div class="text-small" style="color:var(--text2);padding:6px 0;">
            • ${ex.nom} — ${ex.series || '-'} × ${ex.reps || '-'}${ex.charge ? ` @ ${ex.charge}kg` : ''}
          </div>`).join('') || '<div class="text-small text-muted">Aucun exercice</div>'}
      </div>`;
  }).join('') : '<div class="text-small text-muted text-center" style="padding:16px;">Aucune séance</div>';

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${prog.nom}</div>
          <div class="text-small text-muted" style="margin-top:6px;">${sessions.length} séance(s)</div>
        </div>
        <div class="flex gap-8 items-center">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" ${prog.actif ? 'checked' : ''} onchange="toggleTrainingProgram('${prog.id}', this.checked)" style="cursor:pointer;">
            <span class="text-small" style="color:var(--text2);">Actif pour l'athlète</span>
          </label>
        </div>
      </div>
      <div style="margin-top:16px;">${sessionsHtml}</div>
      <div class="flex gap-8 border-top mt-16">
        <button class="btn btn-outline" onclick="editTrainingProgram('${prog.id}')"><i class="fas fa-pen"></i> Modifier</button>
        <button class="btn btn-outline btn-danger" onclick="deleteTrainingProgram('${prog.id}')"><i class="fas fa-trash"></i> Supprimer</button>
        <button class="btn btn-outline" style="margin-left:auto;" onclick="loadAthleteTabTraining()"><i class="fas fa-arrow-left"></i> Retour</button>
      </div>
    </div>`;
}

// ===== SESSION DETAIL =====

async function deleteSession(sessionId) {
  if (!confirm('Supprimer cette séance ?')) return;
  await supabaseClient.from('workout_sessions').delete().eq('id', sessionId);
  loadAthleteTabTraining();
}

async function viewSessionDetail(sessionId, programId) {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div class="text-center" style="padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  const { data: session } = await supabaseClient.from('workout_sessions').select('*').eq('id', sessionId).single();
  if (!session) { notify('Séance introuvable', 'error'); loadAthleteTabTraining(); return; }

  let exercises = [];
  try { if (session.exercices) exercises = typeof session.exercices === 'string' ? JSON.parse(session.exercices) : (session.exercices || []); } catch (e) {}

  let totalSeries = 0;
  exercises.forEach(ex => { totalSeries += (parseInt(ex.series) || 0); });

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${escHtml(session.nom)}</div>
          ${session.jour ? `<div class="text-small text-primary" style="margin-top:4px;"><i class="fas fa-calendar"></i> ${escHtml(session.jour)}</div>` : ''}
        </div>
        <button class="btn btn-red btn-sm" onclick="editSessionDetail('${session.id}', '${programId}')"><i class="fas fa-pen"></i> Modifier</button>
      </div>
      <div class="grid-2 mb-20" style="padding:16px;background:var(--bg3);border-radius:10px;">
        <div class="text-center"><div style="font-size:24px;font-weight:700;color:var(--primary);">${exercises.length}</div><div class="text-small text-muted">Exercices</div></div>
        <div class="text-center"><div style="font-size:24px;font-weight:700;color:var(--primary);">${totalSeries}</div><div class="text-small text-muted">Séries total</div></div>
      </div>
      <div class="mb-16">
        <div class="text-small font-bold text-primary mb-12"><i class="fas fa-dumbbell"></i> Exercices</div>
        ${exercises.map(ex => `
          <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px;">
            <div style="display:grid;grid-template-columns:1fr 80px 80px 100px;gap:12px;align-items:center;">
              <div style="font-weight:600;">${escHtml(ex.nom)}</div>
              <div class="text-center"><div class="text-small text-muted">Séries</div><div style="font-size:18px;font-weight:700;color:var(--primary);">${ex.series||'-'}</div></div>
              <div class="text-center"><div class="text-small text-muted">Reps</div><div style="font-size:18px;font-weight:700;color:var(--primary);">${ex.reps||'-'}</div></div>
              <div class="text-center"><div class="text-small text-muted">Charge</div><div style="font-size:18px;font-weight:700;color:var(--primary);">${ex.charge ? ex.charge+'kg' : '-'}</div></div>
            </div>
          </div>`).join('') || '<div class="text-small text-muted text-center" style="padding:16px;">Aucun exercice</div>'}
      </div>
      <div class="flex gap-8 border-top">
        <button class="btn btn-outline" onclick="loadAthleteTabTraining()"><i class="fas fa-arrow-left"></i> Retour</button>
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
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 80px;gap:8px;align-items:flex-end;">
        <div><label class="label-sm">Exercice</label><input type="text" id="es-ex-nom-${idx}" value="${escHtml(ex.nom||'')}" placeholder="Nom" list="exercices-list" class="inline-input"></div>
        <div><label class="label-sm">Séries</label><input type="number" id="es-ex-series-${idx}" value="${ex.series||3}" min="1" class="inline-input" style="text-align:center;"></div>
        <div><label class="label-sm">Reps</label><input type="number" id="es-ex-reps-${idx}" value="${ex.reps||8}" min="1" class="inline-input" style="text-align:center;"></div>
        <div><label class="label-sm">Charge (kg)</label><input type="number" id="es-ex-charge-${idx}" value="${ex.charge||''}" step="0.5" class="inline-input" style="text-align:center;"></div>
        <div><label class="label-sm">Tempo</label><input type="text" id="es-ex-tempo-${idx}" value="${escHtml(ex.tempo||'')}" placeholder="3010" class="inline-input" style="text-align:center;"></div>
        <button type="button" class="btn btn-outline btn-sm btn-danger" onclick="removeEsExercise(${idx})"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
}

function addEsExercise() {
  const container = document.getElementById('es-exercises');
  const idx = window._esExercises.length;
  const newEx = { nom: '', series: 3, reps: 8, charge: null, tempo: '' };
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
      charge: parseFloat(document.getElementById(`es-ex-charge-${i}`).value) || null,
      tempo: document.getElementById(`es-ex-tempo-${i}`)?.value.trim() || null
    });
  }

  const { error } = await supabaseClient.from('workout_sessions').update({ nom, jour, exercices: JSON.stringify(exercises) }).eq('id', window._esEditId);
  if (error) { notify('Erreur: ' + error.message, 'error'); return; }
  notify('Séance enregistrée !', 'success');
  viewSessionDetail(window._esEditId, window._esProgramId);
}

async function removeExercise(sessionId, exerciseIdx) {
  const { data: session } = await supabaseClient.from('workout_sessions').select('exercices').eq('id', sessionId).single();
  let exs = [];
  try { exs = typeof session?.exercices === 'string' ? JSON.parse(session.exercices) : (session?.exercices || []); } catch (e) {}
  exs.splice(exerciseIdx, 1);
  await supabaseClient.from('workout_sessions').update({ exercices: JSON.stringify(exs) }).eq('id', sessionId);
  loadAthleteTabTraining();
}
