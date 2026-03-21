// ===== ATHLETES MANAGEMENT =====

async function loadAthletes() {
  const { data, error } = await supabaseClient
    .from('athletes')
    .select('*')
    .eq('coach_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    notify('Erreur chargement athlètes: ' + error.message, 'error');
    return;
  }

  athletesList = data || [];
  renderAthletes();
  updateAthleteSelects();
}

function renderAthletes() {
  const container = document.getElementById('athletes-list');

  if (!athletesList.length) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Aucun athlète</p></div>';
    return;
  }

  container.innerHTML = athletesList.map(athlete => `
    <div class="card athlete-card" onclick="openAthleteDetail('${athlete.id}')">
      <div class="card-header">
        <div>
          <div class="card-title">${athlete.prenom} ${athlete.nom}</div>
          <div style="color:var(--text2);font-size:14px;">${athlete.email}</div>
        </div>
        <div><span class="badge">${athlete.objectif}</span></div>
      </div>
      <div style="display:flex;gap:16px;font-size:14px;">
        <span>Poids: ${athlete.poids_actuel || '-'}kg</span>
        <span>Objectif: ${athlete.poids_objectif || '-'}kg</span>
      </div>
    </div>
  `).join('');
}

function openAthleteDetail(athleteId) {
  currentAthleteId = athleteId;
  currentAthleteObj = athletesList.find(a => a.id === athleteId);
  if (!currentAthleteObj) return;

  document.getElementById('athlete-detail-name').textContent = `${currentAthleteObj.prenom} ${currentAthleteObj.nom}`;
  showSection('athlete-detail');
  switchAthleteTab('infos');
}

function updateAthleteSelects() {
  ['programme-athlete', 'nutrition-athlete'].forEach(selectId => {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">Sélectionner un athlète</option>' +
      athletesList.map(a => `<option value="${a.id}">${a.prenom} ${a.nom}</option>`).join('');
  });
}

// ===== ATHLETE INFO TAB =====

async function loadAthleteTabInfos() {
  const el = document.getElementById('athlete-tab-content');
  const a = currentAthleteObj;
  el.innerHTML = `
    <div class="card mb-16">
      <div class="card-header">
        <div class="card-title">Informations personnelles</div>
        <button class="btn btn-outline btn-sm" onclick="editAthleteInfos()"><i class="fas fa-pen"></i> Modifier</button>
      </div>
      <div class="grid-2">
        <div><div class="label-sm" style="margin-bottom:4px;">Prénom</div><div style="font-weight:600;">${a.prenom}</div></div>
        <div><div class="label-sm" style="margin-bottom:4px;">Nom</div><div style="font-weight:600;">${a.nom}</div></div>
        <div><div class="label-sm" style="margin-bottom:4px;">Email</div><div style="font-weight:600;">${a.email}</div></div>
        <div><div class="label-sm" style="margin-bottom:4px;">Objectif</div><div style="font-weight:600;">${a.objectif}</div></div>
        <div><div class="label-sm" style="margin-bottom:4px;">Poids actuel</div><div style="font-weight:600;">${a.poids_actuel || '-'} kg</div></div>
        <div><div class="label-sm" style="margin-bottom:4px;">Poids objectif</div><div style="font-weight:600;">${a.poids_objectif || '-'} kg</div></div>
      </div>
      <div class="border-top" style="display:flex;gap:8px;margin-top:16px;">
        <button class="btn btn-outline" onclick="deleteAthlete('${a.id}', '${a.prenom} ${a.nom}')" style="color:var(--danger);margin-left:auto;">
          <i class="fas fa-trash"></i> Supprimer l'athlète
        </button>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title"><i class="fas fa-calendar-alt"></i> Programmation</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <span style="font-size:11px;color:var(--text3);">+</span>
          <input type="number" id="prog-add-count" value="12" min="1" max="52" style="width:48px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:4px 6px;color:var(--text);font-size:12px;text-align:center;">
          <button class="btn btn-outline btn-sm" onclick="addProgWeeks()">sem.</button>
          <button class="btn btn-outline btn-sm" onclick="addProgWeek()" title="Ajouter 1 semaine"><i class="fas fa-plus"></i></button>
        </div>
      </div>
      <div id="prog-table-container"><div class="text-center text-muted" style="padding:20px;"><i class="fas fa-spinner fa-spin"></i></div></div>
    </div>
  `;
  await loadProgrammingWeeks();
}

function editAthleteInfos() {
  fillEditAthleteForm();
  openModal('modal-edit-athlete');
}

function fillEditAthleteForm() {
  if (!currentAthleteObj) return;
  document.getElementById('edit-athlete-prenom').value = currentAthleteObj.prenom || '';
  document.getElementById('edit-athlete-nom').value = currentAthleteObj.nom || '';
  document.getElementById('edit-athlete-email').value = currentAthleteObj.email || '';
  document.getElementById('edit-athlete-poids').value = currentAthleteObj.poids_actuel || '';
  document.getElementById('edit-athlete-poids-obj').value = currentAthleteObj.poids_objectif || '';
  document.getElementById('edit-athlete-objectif').value = currentAthleteObj.objectif || 'maintenance';
  document.getElementById('edit-athlete-bilan-day').value = currentAthleteObj.bilan_day ?? 0;
}

document.getElementById('edit-athlete-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const updateData = {
    prenom: document.getElementById('edit-athlete-prenom').value,
    nom: document.getElementById('edit-athlete-nom').value,
    email: document.getElementById('edit-athlete-email').value,
    poids_actuel: parseFloat(document.getElementById('edit-athlete-poids').value) || null,
    poids_objectif: parseFloat(document.getElementById('edit-athlete-poids-obj').value) || null,
    objectif: document.getElementById('edit-athlete-objectif').value,
    bilan_day: parseInt(document.getElementById('edit-athlete-bilan-day').value)
  };

  const { error } = await supabaseClient.from('athletes').update(updateData).eq('id', currentAthleteId).select();
  if (error) { notify('Erreur: ' + error.message, 'error'); return; }

  Object.assign(currentAthleteObj, updateData);
  notify('Informations mises à jour !', 'success');
  closeModal('modal-edit-athlete');
  loadAthleteTabInfos();
  loadAthletes();
});

// ===== ADD ATHLETE =====

document.getElementById('athlete-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const prenom = document.getElementById('athlete-prenom').value;
  const nom = document.getElementById('athlete-nom').value;
  const email = document.getElementById('athlete-email').value;
  const tempPassword = Math.random().toString(36).slice(-12);

  const { data: authData, error: authError } = await supabaseClient.auth.signUp({
    email,
    password: tempPassword,
    options: { data: { prenom, nom } }
  });

  if (authError && authError.message.includes('already registered')) {
    notify('Cet email est déjà utilisé !', 'error');
    return;
  }
  if (authError) { notify('Erreur: ' + authError.message, 'error'); return; }

  const session = (await supabaseClient.auth.getSession()).data?.session;
  const coachId = session?.user?.id;
  if (!coachId) { notify('Erreur: pas de session authentifiée', 'error'); return; }

  const { data, error } = await supabaseClient
    .from('athletes')
    .insert({
      prenom, nom, email,
      poids_actuel: parseFloat(document.getElementById('athlete-poids').value) || null,
      poids_objectif: parseFloat(document.getElementById('athlete-poids-obj').value) || null,
      objectif: document.getElementById('athlete-objectif').value,
      coach_id: coachId
    })
    .select();

  if (error) { notify('Erreur création athlète: ' + error.message, 'error'); return; }

  // Show WhatsApp message modal
  const whatsappMessage = `Bienvenue dans l'app de coaching Pierre! 🏋️\n\nVoici vos identifiants:\n\nEmail: ${email}\nMot de passe: ${tempPassword}\n\nConnectez-vous pour voir vos séances!`;
  const container = document.createElement('div');
  container.id = 'whatsapp-modal-temp';
  container.className = 'modal-overlay open';
  container.innerHTML = `
    <div class="modal" onclick="event.stopPropagation();">
      <div class="modal-header">
        <h2 class="modal-title">Message WhatsApp</h2>
        <button class="modal-close" onclick="document.getElementById('whatsapp-modal-temp').remove()">×</button>
      </div>
      <div style="padding:20px;background:var(--bg2);border-radius:10px;margin:16px;font-family:monospace;font-size:13px;color:var(--text2);line-height:1.6;white-space:pre-wrap;word-break:break-word;border:1px solid var(--border);">${whatsappMessage}</div>
      <div style="padding:16px;display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-red" onclick="navigator.clipboard.writeText(\`${whatsappMessage.replaceAll('`', '\\`')}\`);alert('Message copié! 📋');document.getElementById('whatsapp-modal-temp').remove();">Copier le message</button>
        <button class="btn btn-outline" onclick="document.getElementById('whatsapp-modal-temp').remove();">Fermer</button>
      </div>
    </div>
  `;
  container.onclick = () => container.remove();
  document.body.appendChild(container);

  notify('Athlète ajouté avec succès !', 'success');
  closeModal('modal-athlete');
  document.getElementById('athlete-form').reset();
  setTimeout(() => loadAthletes(), 500);
});

// ===== PROGRAMMING WEEKS =====

async function loadProgrammingWeeks() {
  const [{ data: weeks }, { data: programs }, { data: reports }] = await Promise.all([
    supabaseClient.from('programming_weeks').select('*').eq('athlete_id', currentAthleteId).order('week_date'),
    supabaseClient.from('workout_programs').select('id,nom').eq('athlete_id', currentAthleteId).order('created_at'),
    supabaseClient.from('daily_reports').select('date,weight').eq('user_id', currentAthleteObj.user_id),
  ]);
  window._progWeeksCache = weeks || [];
  window._progPrograms = programs || [];

  // Build weight averages per programming week
  const weightByDate = {};
  (reports || []).forEach(r => { if (r.weight) weightByDate[r.date] = parseFloat(r.weight); });
  const weightMap = {};
  (weeks || []).forEach(w => {
    const start = new Date(w.week_date + 'T00:00:00');
    const vals = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start); dt.setDate(dt.getDate() + d);
      const v = weightByDate[toDateStr(dt)];
      if (v) vals.push(v);
    }
    if (vals.length) weightMap[w.id] = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  });
  window._progWeightMap = weightMap;
  renderProgrammingTable(window._progWeeksCache);
}

function renderProgrammingTable(weeks) {
  const c = document.getElementById('prog-table-container');
  if (!c) return;

  if (!weeks.length) {
    c.innerHTML = `<div class="pg-empty">
      <i class="fas fa-calendar-alt"></i>
      <p>Aucune semaine planifiée</p>
      <p style="font-size:13px;margin-top:8px;">Clique <strong>+ sem.</strong> pour démarrer.</p>
    </div>`;
    return;
  }

  const todayStr = toDateStr(new Date());
  const weightMap = window._progWeightMap || {};

  // Mark current week + compute phase counters
  let lastPhase = null, phaseCounter = 0;
  weeks.forEach((w, i) => {
    const nextDate = weeks[i + 1]?.week_date;
    w._isCurrent = w.week_date <= todayStr && (!nextDate || nextDate > todayStr);
    if (w.phase && w.phase === lastPhase) { phaseCounter++; }
    else if (w.phase) { phaseCounter = 1; lastPhase = w.phase; }
    else { phaseCounter = 0; lastPhase = null; }
    w._phaseNum = phaseCounter;
  });

  // ── Toolbar (bulk phase) ──
  let html = '<div class="pg-container">';
  html += '<div class="pg-toolbar">';
  html += '<div class="pg-toolbar-phases">';
  Object.entries(PROG_PHASES).forEach(([k, v]) => {
    html += `<button class="pg-phase-btn${window._selectedProgPhase === k ? ' active' : ''}" id="pg-pbtn-${k}" style="background:${v.color};" onclick="selectProgPhase('${k}')">${v.label}</button>`;
  });
  html += `<button class="pg-phase-btn${window._selectedProgPhase === '' ? ' active' : ''}" id="pg-pbtn-" style="background:#555;" onclick="selectProgPhase('')">AUCUNE</button>`;
  html += '</div>';
  const weekOpts = weeks.map((w, i) => `<option value="${i}">S${i + 1} — ${formatDate(w.week_date)}</option>`).join('');
  html += '<div class="pg-toolbar-range">';
  html += `<label>De</label><select id="pg-range-from">${weekOpts}</select>`;
  html += `<label>à</label><select id="pg-range-to">${weekOpts}</select>`;
  html += `<button class="btn btn-red btn-sm" onclick="bulkAssignPhase()"><i class="fas fa-check"></i> Appliquer</button>`;
  html += '</div></div>';

  // ── List ──
  html += '<div class="pg-list-hdr"><span>#</span><span>DATE</span><span>PHASE</span><span>DÉTAILS</span><span>PDC</span><span></span></div>';

  let prevPhase = weeks[0]?.phase;
  weeks.forEach((w, i) => {
    if (i > 0 && w.phase !== prevPhase) html += '<div class="pg-separator"></div>';
    prevPhase = w.phase;

    const pi = PROG_PHASES[w.phase];
    const phaseBadge = pi
      ? `<span class="pg-phase pg-phase-click" style="background:${pi.color};cursor:pointer;" onclick="event.stopPropagation();editProgPhaseInline('${w.id}',this)">${pi.short} · S${w._phaseNum}</span>`
      : `<span class="pg-phase pg-phase-click" style="background:#444;cursor:pointer;" onclick="event.stopPropagation();editProgPhaseInline('${w.id}',this)">—</span>`;

    const weight = weightMap[w.id];
    const weightTxt = weight ? `${weight} kg` : '<span style="color:var(--text3);">—</span>';

    const detailsVal = w.details ? escHtml(w.details) : '';
    const detailsHtml = detailsVal
      ? `<span class="pg-cell-details pg-click" onclick="editProgDetailInline('${w.id}',this)">${detailsVal}</span>`
      : `<span class="pg-cell-details pg-click pg-placeholder" onclick="editProgDetailInline('${w.id}',this)">—</span>`;

    html += `<div class="pg-row${w._isCurrent ? ' pg-row-current' : ''}" data-pw-id="${w.id}">`;
    html += `<span class="pg-cell-num">S${i + 1}</span>`;
    html += `<span class="pg-cell-date">${formatDate(w.week_date)}</span>`;
    html += phaseBadge;
    html += detailsHtml;
    html += `<span class="pg-cell-weight">${weightTxt}</span>`;
    html += `<button class="pg-cell-edit" onclick="deleteProgWeek('${w.id}')" title="Supprimer" style="color:var(--text3);"><i class="fas fa-trash-alt" style="font-size:11px;"></i></button>`;
    html += '</div>';
    if (w.notes_bloc) {
      html += `<div class="pg-row-notes"><i class="fas fa-sticky-note" style="margin-right:4px;"></i>${escHtml(w.notes_bloc)}</div>`;
    }
  });

  html += '</div>';
  c.innerHTML = html;

  // Default "to" to last week
  const toSel = document.getElementById('pg-range-to');
  if (toSel && weeks.length) toSel.value = weeks.length - 1;
}

// ── Inline editing: click details → input, click phase → select ──

function editProgDetailInline(id, el) {
  const w = (window._progWeeksCache || []).find(x => x.id === id);
  const val = w?.details || '';
  el.outerHTML = `<input class="pg-inline-inp" value="${escHtml(val)}" placeholder="Détails..."
    onblur="saveProgField('${id}','details',this.value)"
    onkeydown="if(event.key==='Enter'){this.blur();}if(event.key==='Escape'){renderProgrammingTable(window._progWeeksCache);}" autofocus>`;
  const inp = document.querySelector(`[data-pw-id="${id}"] .pg-inline-inp`);
  if (inp) inp.focus();
}

function editProgPhaseInline(id, el) {
  const w = (window._progWeeksCache || []).find(x => x.id === id);
  const opts = '<option value="">—</option>' + Object.entries(PROG_PHASES).map(([k, v]) =>
    `<option value="${k}"${w?.phase === k ? ' selected' : ''}>${v.short}</option>`
  ).join('');
  el.outerHTML = `<select class="pg-inline-sel"
    onchange="saveProgField('${id}','phase',this.value||null)"
    onblur="renderProgrammingTable(window._progWeeksCache)">${opts}</select>`;
  const sel = document.querySelector(`[data-pw-id="${id}"] .pg-inline-sel`);
  if (sel) sel.focus();
}

async function saveProgField(id, field, value) {
  const data = {};
  data[field] = value || null;
  await supabaseClient.from('programming_weeks').update(data).eq('id', id);
  const w = (window._progWeeksCache || []).find(x => x.id === id);
  if (w) w[field] = value || null;
  renderProgrammingTable(window._progWeeksCache);
}

// ── Bulk phase assignment ──

window._selectedProgPhase = null;

function selectProgPhase(phase) {
  window._selectedProgPhase = phase;
  document.querySelectorAll('.pg-phase-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('pg-pbtn-' + phase);
  if (btn) btn.classList.add('active');
}

async function bulkAssignPhase() {
  const phase = window._selectedProgPhase;
  if (phase === null || phase === undefined) { notify('Sélectionne une phase d\'abord', 'warning'); return; }
  const from = parseInt(document.getElementById('pg-range-from')?.value);
  const to = parseInt(document.getElementById('pg-range-to')?.value);
  if (isNaN(from) || isNaN(to) || from > to) { notify('Plage invalide', 'warning'); return; }
  const weeks = window._progWeeksCache || [];
  const ids = weeks.slice(from, to + 1).map(w => w.id);
  const { error } = await supabaseClient.from('programming_weeks')
    .update({ phase: phase || null }).in('id', ids);
  if (error) { notify('Erreur: ' + error.message, 'error'); return; }
  await loadProgrammingWeeks();
  notify(`Phase appliquée à ${ids.length} semaines`, 'success');
}

// ── Add weeks ──

function getNextMonday(fromDate) {
  const d = new Date(fromDate);
  const add = (8 - d.getDay()) % 7;
  if (add > 0) d.setDate(d.getDate() + add);
  return d;
}

async function addProgWeek() {
  const weeks = window._progWeeksCache || [];
  let nextDate;
  if (weeks.length) {
    nextDate = new Date(weeks[weeks.length - 1].week_date + 'T00:00:00');
    nextDate.setDate(nextDate.getDate() + 7);
  } else {
    nextDate = getNextMonday(new Date());
  }
  const { error } = await supabaseClient.from('programming_weeks').insert({
    athlete_id: currentAthleteId, coach_id: currentUser.id, week_date: toDateStr(nextDate),
  });
  if (error) { notify('Erreur: ' + error.message, 'error'); return; }
  await loadProgrammingWeeks();
}

async function addProgWeeks() {
  const count = parseInt(document.getElementById('prog-add-count')?.value) || 12;
  if (count < 1) return;
  const weeks = window._progWeeksCache || [];
  let start;
  if (weeks.length) {
    start = new Date(weeks[weeks.length - 1].week_date + 'T00:00:00');
    start.setDate(start.getDate() + 7);
  } else {
    start = getNextMonday(new Date());
  }
  const rows = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i * 7);
    rows.push({ athlete_id: currentAthleteId, coach_id: currentUser.id, week_date: toDateStr(d) });
  }
  const { error } = await supabaseClient.from('programming_weeks').insert(rows);
  if (error) { notify('Erreur: ' + error.message, 'error'); return; }
  await loadProgrammingWeeks();
  notify(`${count} semaines ajoutées`, 'success');
}

async function deleteProgWeek(id) {
  if (!confirm('Supprimer cette semaine ?')) return;
  const { error } = await supabaseClient.from('programming_weeks').delete().eq('id', id);
  if (error) { notify('Erreur: ' + error.message, 'error'); return; }
  await loadProgrammingWeeks();
}

// ===== DELETE ATHLETE =====

async function deleteAthlete(athleteId, athleteName) {
  if (!confirm(`Êtes-vous sûr de vouloir supprimer ${athleteName} et TOUTES ses données ?`)) return;

  try {
    const { data: programs } = await supabaseClient.from('workout_programs').select('id').eq('athlete_id', athleteId);
    const programIds = programs?.map(p => p.id) || [];

    if (programIds.length) {
      await supabaseClient.from('workout_sessions').delete().in('program_id', programIds);
    }
    await supabaseClient.from('workout_programs').delete().eq('athlete_id', athleteId);
    await supabaseClient.from('nutrition_plans').delete().eq('athlete_id', athleteId);
    const { error } = await supabaseClient.from('athletes').delete().eq('id', athleteId);
    if (error) throw error;

    notify(`${athleteName} a été supprimé !`, 'success');
    showSection('athletes');
    loadAthletes();
  } catch (error) {
    notify('Erreur: ' + error.message, 'error');
  }
}
