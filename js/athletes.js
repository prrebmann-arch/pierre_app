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
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="toggleProgGenForm()"><i class="fas fa-magic"></i> Générer</button>
          <button class="btn btn-outline btn-sm" onclick="addProgWeek()"><i class="fas fa-plus"></i> Semaine</button>
        </div>
      </div>
      <div class="pg-gen-form" id="prog-generate-form">
        <div class="pg-gen-field">
          <label>Date de départ</label>
          <input type="date" id="prog-gen-date">
        </div>
        <div class="pg-gen-field">
          <label>Nb semaines</label>
          <input type="number" id="prog-gen-count" value="12" min="1" max="52" style="width:70px;">
        </div>
        <div class="pg-gen-field">
          <label>Phase</label>
          <select id="prog-gen-phase">
            <option value="">— aucune —</option>
            ${Object.entries(PROG_PHASES).map(([k,v]) => '<option value="'+k+'">'+v.label+'</option>').join('')}
          </select>
        </div>
        <button class="btn btn-red btn-sm" onclick="generateProgWeeks()"><i class="fas fa-magic"></i> Générer</button>
        <button class="btn btn-outline btn-sm" onclick="toggleProgGenForm()">Annuler</button>
        <div class="pg-gen-info"><i class="fas fa-info-circle"></i> Semaines alignées sur le ${['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'][a.bilan_day ?? 0]} (jour de bilan)</div>
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
  const [{ data: weeks }, { data: programs }] = await Promise.all([
    supabaseClient.from('programming_weeks').select('*').eq('athlete_id', currentAthleteId).order('week_date'),
    supabaseClient.from('workout_programs').select('id,nom').eq('athlete_id', currentAthleteId).order('created_at'),
  ]);
  window._progWeeksCache = weeks || [];
  window._progPrograms = programs || [];
  renderProgrammingTable(window._progWeeksCache);
}

function renderProgrammingTable(weeks) {
  const c = document.getElementById('prog-table-container');
  if (!c) return;

  if (!weeks.length) {
    c.innerHTML = `<div class="pg-empty">
      <i class="fas fa-calendar-alt"></i>
      <p>Aucune semaine planifiée</p>
      <p style="font-size:13px;margin-top:8px;">Utilise <strong>Générer</strong> pour démarrer la programmation.</p>
    </div>`;
    return;
  }

  const todayStr = toDateStr(new Date());
  const programs = window._progPrograms || [];

  // Mark current week
  weeks.forEach((w, i) => {
    const nextDate = weeks[i + 1]?.week_date;
    w._isCurrent = w.week_date <= todayStr && (!nextDate || nextDate > todayStr);
  });

  // Group consecutive weeks by phase
  const blocks = [];
  let curBlock = null;
  weeks.forEach((w, i) => {
    const ph = w.phase || '_none';
    if (!curBlock || curBlock.phase !== ph) {
      curBlock = { phase: ph, weeks: [] };
      blocks.push(curBlock);
    }
    curBlock.weeks.push({ ...w, _gi: i });
  });
  window._progBlocks = blocks;

  const totalWeeks = weeks.length;
  const currentIdx = weeks.findIndex(w => w._isCurrent);

  // ── Timeline bar ──
  let html = '<div class="pg-container">';
  html += '<div class="pg-timeline">';
  blocks.forEach(block => {
    const pct = (block.weeks.length / totalWeeks * 100).toFixed(1);
    const pi = PROG_PHASES[block.phase] || { label: '—', color: '#444' };
    const label = block.weeks.length >= 3 ? pi.label : (block.weeks.length >= 2 ? pi.label.charAt(0) : '');
    html += `<div class="pg-timeline-seg" style="width:${pct}%;background:${pi.color};" title="${pi.label} — ${block.weeks.length} sem.">${label}</div>`;
  });
  if (currentIdx >= 0) {
    const pct = ((currentIdx + 0.5) / totalWeeks * 100).toFixed(1);
    html += `<div class="pg-timeline-marker" style="left:${pct}%;"></div>`;
  }
  html += '</div>';

  // ── Phase blocks ──
  blocks.forEach((block, bi) => {
    const pi = PROG_PHASES[block.phase] || { label: 'NON PLANIFIÉ', color: '#444' };
    const hasCurrent = block.weeks.some(w => w._isCurrent);
    const isOpen = hasCurrent;

    const startDate = block.weeks[0].week_date;
    const endD = new Date(block.weeks[block.weeks.length - 1].week_date + 'T00:00:00');
    endD.setDate(endD.getDate() + 6);

    const startLabel = formatDate(startDate);
    const endLabel = endD.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    // Weight stats
    const pdcVals = block.weeks.filter(w => w.pdc_moyenne).map(w => parseFloat(w.pdc_moyenne));
    const pdcFirst = pdcVals[0] || null;
    const pdcLast = pdcVals.length > 1 ? pdcVals[pdcVals.length - 1] : null;
    const pdcDelta = (pdcFirst && pdcLast) ? (pdcLast - pdcFirst).toFixed(1) : null;

    html += `<div class="pg-block${isOpen ? ' pg-open' : ''}" style="border-left:3px solid ${pi.color};">`;

    // Header
    html += `<div class="pg-block-header" onclick="this.parentElement.classList.toggle('pg-open')">`;
    html += `<div class="pg-block-left">`;
    html += `<span class="pg-phase" style="background:${pi.color};">${pi.label}</span>`;
    html += `<div class="pg-block-info">`;
    html += `<span class="pg-block-dates">${startLabel} → ${endLabel}</span>`;
    html += `<span class="pg-block-count">${block.weeks.length} semaine${block.weeks.length > 1 ? 's' : ''}</span>`;
    html += `</div>`;
    if (hasCurrent) html += `<span class="pg-current-badge">EN COURS</span>`;
    html += `</div>`;

    html += `<div class="pg-block-right">`;
    if (pdcDelta !== null) {
      const dn = parseFloat(pdcDelta);
      const dc = dn < 0 ? 'var(--success)' : dn > 0 ? 'var(--warning)' : 'var(--text)';
      html += `<div class="pg-block-stat">`;
      html += `<span class="pg-block-stat-label">Δ POIDS</span>`;
      html += `<span class="pg-block-stat-value" style="color:${dc};">${dn > 0 ? '+' : ''}${pdcDelta} kg</span>`;
      html += `</div>`;
    }
    html += `<i class="fas fa-chevron-down pg-chevron"></i>`;
    html += `</div></div>`;

    // Body
    html += `<div class="pg-block-body"><div class="pg-weeks">`;
    html += `<div class="pg-week-hdr"><span>#</span><span>DATE</span><span>DÉTAILS</span><span>PROGRAMME</span><span>PDC</span><span></span></div>`;

    block.weeks.forEach(w => {
      const pn = programs.find(p => p.id === w.training_program_id)?.nom || '';
      html += `<div class="pg-week-row${w._isCurrent ? ' pg-week-current' : ''}">`;
      html += `<span class="pg-week-num">S${w._gi + 1}</span>`;
      html += `<span class="pg-week-date">${formatDate(w.week_date)}</span>`;
      html += `<span class="pg-week-details">${w.details ? escHtml(w.details) : '<span style="color:var(--text3);">—</span>'}</span>`;
      html += pn ? `<span class="pg-week-program">${escHtml(pn)}</span>` : '<span></span>';
      html += `<span class="pg-week-pdc">${w.pdc_moyenne ? w.pdc_moyenne + ' kg' : '<span style="color:var(--text3);">—</span>'}</span>`;
      html += `<button class="pg-week-edit" onclick="event.stopPropagation();editProgWeek('${w.id}')" title="Modifier"><i class="fas fa-pen"></i></button>`;
      html += `</div>`;
      if (w.notes_bloc) {
        html += `<div class="pg-week-notes"><i class="fas fa-sticky-note" style="margin-right:4px;"></i>${escHtml(w.notes_bloc)}</div>`;
      }
    });

    html += `</div></div></div>`;
  });

  html += '</div>';
  c.innerHTML = html;
}

function toggleProgGenForm() {
  document.getElementById('prog-generate-form')?.classList.toggle('open');
}

async function generateProgWeeks() {
  const dateVal = document.getElementById('prog-gen-date')?.value;
  const count = parseInt(document.getElementById('prog-gen-count')?.value) || 0;
  const phase = document.getElementById('prog-gen-phase')?.value || null;
  if (!dateVal || count < 1) { notify('Date et nombre de semaines requis', 'warning'); return; }

  // Snap start date to the bilan day
  const bilanDay = currentAthleteObj?.bilan_day ?? 0; // 0=Mon .. 6=Sun
  const jsTarget = (bilanDay + 1) % 7; // JS: 0=Sun, 1=Mon, ..., 6=Sat
  const start = new Date(dateVal + 'T00:00:00');
  let diff = jsTarget - start.getDay();
  if (diff < 0) diff += 7;
  if (diff > 0) start.setDate(start.getDate() + diff);

  const rows = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    rows.push({
      athlete_id: currentAthleteId,
      coach_id: currentUser.id,
      week_date: toDateStr(d),
      phase: phase,
    });
  }
  const { error } = await supabaseClient.from('programming_weeks').insert(rows);
  if (error) { notify('Erreur: ' + error.message, 'error'); return; }
  document.getElementById('prog-generate-form')?.classList.remove('open');
  await loadProgrammingWeeks();
  notify(`${count} semaines générées`, 'success');
}

async function addProgWeek() {
  const weeks = window._progWeeksCache || [];
  const bilanDay = currentAthleteObj?.bilan_day ?? 0;
  let nextDate;

  if (weeks.length) {
    const last = new Date(weeks[weeks.length - 1].week_date + 'T00:00:00');
    last.setDate(last.getDate() + 7);
    nextDate = last;
  } else {
    nextDate = new Date();
    const jsTarget = (bilanDay + 1) % 7;
    let diff = jsTarget - nextDate.getDay();
    if (diff < 0) diff += 7;
    nextDate.setDate(nextDate.getDate() + diff);
  }

  const { error } = await supabaseClient.from('programming_weeks').insert({
    athlete_id: currentAthleteId,
    coach_id: currentUser.id,
    week_date: toDateStr(nextDate),
  });
  if (error) { notify('Erreur: ' + error.message, 'error'); return; }
  await loadProgrammingWeeks();
}

// ── Modal-based edit ──

function editProgWeek(id) {
  const w = (window._progWeeksCache || []).find(x => x.id === id);
  if (!w) return;

  const programs = window._progPrograms || [];
  const progSelect = document.getElementById('pgm-prog');
  progSelect.innerHTML = '<option value="">— aucun —</option>' +
    programs.map(p => `<option value="${p.id}"${w.training_program_id === p.id ? ' selected' : ''}>${escHtml(p.nom)}</option>`).join('');

  document.getElementById('pgm-id').value = w.id;
  document.getElementById('pgm-date').value = w.week_date || '';
  document.getElementById('pgm-phase').value = w.phase || '';
  document.getElementById('pgm-details').value = w.details || '';
  document.getElementById('pgm-pdc').value = w.pdc_moyenne || '';
  document.getElementById('pgm-notes').value = w.notes_bloc || '';
  openModal('modal-prog-week');
}

async function saveProgWeek() {
  const id = document.getElementById('pgm-id').value;
  const data = {
    week_date:           document.getElementById('pgm-date').value,
    phase:               document.getElementById('pgm-phase').value || null,
    training_program_id: document.getElementById('pgm-prog').value || null,
    details:             document.getElementById('pgm-details').value || null,
    pdc_moyenne:         parseFloat(document.getElementById('pgm-pdc').value) || null,
    notes_bloc:          document.getElementById('pgm-notes').value || null,
  };
  const { error } = await supabaseClient.from('programming_weeks').update(data).eq('id', id);
  if (error) { notify('Erreur: ' + error.message, 'error'); return; }
  closeModal('modal-prog-week');
  await loadProgrammingWeeks();
  notify('Sauvegardé', 'success');
}

async function deleteProgWeek() {
  const id = document.getElementById('pgm-id').value;
  if (!confirm('Supprimer cette semaine ?')) return;
  const { error } = await supabaseClient.from('programming_weeks').delete().eq('id', id);
  if (error) { notify('Erreur: ' + error.message, 'error'); return; }
  closeModal('modal-prog-week');
  await loadProgrammingWeeks();
  notify('Semaine supprimée', 'success');
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
