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
        <div class="card-title"><i class="fas fa-calendar-alt"></i> Objectifs &amp; Programmation</div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="showProgGenerateForm()"><i class="fas fa-magic"></i> Générer semaines</button>
          <button class="btn btn-outline btn-sm" onclick="addProgWeek()"><i class="fas fa-plus"></i> Semaine</button>
        </div>
      </div>
      <div id="prog-generate-form" style="display:none;margin-bottom:16px;padding:12px;background:var(--bg3);border-radius:8px;">
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
          <div><label class="label-sm">Date de départ</label><br>
            <input type="date" id="prog-gen-date" class="inline-input" style="margin-top:4px;">
          </div>
          <div><label class="label-sm">Nombre de semaines</label><br>
            <input type="number" id="prog-gen-count" value="12" min="1" max="52" class="inline-input" style="width:80px;margin-top:4px;">
          </div>
          <button class="btn btn-red btn-sm" onclick="generateProgWeeks()"><i class="fas fa-magic"></i> Générer</button>
          <button class="btn btn-outline btn-sm" onclick="document.getElementById('prog-generate-form').style.display='none'">Annuler</button>
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
}

document.getElementById('edit-athlete-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const updateData = {
    prenom: document.getElementById('edit-athlete-prenom').value,
    nom: document.getElementById('edit-athlete-nom').value,
    email: document.getElementById('edit-athlete-email').value,
    poids_actuel: parseFloat(document.getElementById('edit-athlete-poids').value) || null,
    poids_objectif: parseFloat(document.getElementById('edit-athlete-poids-obj').value) || null,
    objectif: document.getElementById('edit-athlete-objectif').value
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
    c.innerHTML = '<div style="text-align:center;color:var(--text3);padding:30px;">Aucune semaine planifiée — utilise <strong>Générer semaines</strong> pour démarrer.</div>';
    return;
  }
  const today = new Date().toISOString().split('T')[0];
  const programs = window._progPrograms || [];
  const rows = weeks.map((w, i) => {
    const nextDate = weeks[i + 1]?.week_date;
    const isCurrent = w.week_date <= today && (!nextDate || nextDate > today);
    const phase = PROG_PHASES[w.phase];
    const phaseBadge = phase
      ? `<span style="background:${phase.color};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap;">${phase.label}</span>`
      : '<span style="color:var(--text3);">—</span>';
    const progName = programs.find(p => p.id === w.training_program_id)?.nom || '—';
    const rowStyle = isCurrent
      ? 'background:rgba(99,102,241,0.08);border-left:3px solid var(--primary);'
      : 'border-left:3px solid transparent;';
    return `<tr id="prog-row-${w.id}" style="${rowStyle}">
      <td style="padding:7px 8px;font-size:12px;color:var(--text3);">${i + 1}</td>
      <td style="padding:7px 8px;font-size:12px;white-space:nowrap;font-weight:${isCurrent?'700':'400'};">${formatDate(w.week_date)}</td>
      <td style="padding:7px 8px;font-size:12px;max-width:160px;">${w.details ? escHtml(w.details) : '<span style="color:var(--text3);">—</span>'}</td>
      <td style="padding:7px 8px;">${phaseBadge}</td>
      <td style="padding:7px 8px;font-size:12px;">${progName !== '—' ? `<span style="font-size:11px;">${escHtml(progName)}</span>` : '<span style="color:var(--text3);">—</span>'}</td>
      <td style="padding:7px 8px;font-size:12px;text-align:center;">${w.pdc_moyenne ? `<strong>${w.pdc_moyenne}</strong>` : '<span style="color:var(--text3);">—</span>'}</td>
      <td style="padding:7px 8px;font-size:12px;max-width:200px;color:var(--text3);">${w.notes_bloc ? escHtml(w.notes_bloc) : ''}</td>
      <td style="padding:7px 8px;">
        <button class="btn btn-outline btn-sm" onclick="editProgRow('${w.id}')" title="Modifier"><i class="fas fa-pen"></i></button>
      </td>
    </tr>`;
  }).join('');
  c.innerHTML = `<div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="border-bottom:1px solid var(--border);">
        <th style="padding:8px;text-align:left;font-size:11px;color:var(--text3);">SEM</th>
        <th style="padding:8px;text-align:left;font-size:11px;color:var(--text3);">DATE</th>
        <th style="padding:8px;text-align:left;font-size:11px;color:var(--text3);">DÉTAILS</th>
        <th style="padding:8px;text-align:left;font-size:11px;color:var(--text3);">PHASE</th>
        <th style="padding:8px;text-align:left;font-size:11px;color:var(--text3);">TRAINING</th>
        <th style="padding:8px;text-align:center;font-size:11px;color:var(--text3);">PDC MOY.</th>
        <th style="padding:8px;text-align:left;font-size:11px;color:var(--text3);">NOTES BLOC</th>
        <th style="padding:8px;"></th>
      </tr></thead>
      <tbody id="prog-tbody">${rows}</tbody>
    </table>
  </div>`;
}

function showProgGenerateForm() {
  const f = document.getElementById('prog-generate-form');
  if (f) { f.style.display = f.style.display === 'none' ? 'block' : 'none'; }
}

async function generateProgWeeks() {
  const dateVal = document.getElementById('prog-gen-date')?.value;
  const count = parseInt(document.getElementById('prog-gen-count')?.value) || 0;
  if (!dateVal || count < 1) { notify('Date et nombre de semaines requis', 'warning'); return; }
  const rows = [];
  const start = new Date(dateVal + 'T00:00:00');
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    rows.push({ athlete_id: currentAthleteId, coach_id: currentUser.id, week_date: d.toISOString().split('T')[0] });
  }
  const { error } = await supabaseClient.from('programming_weeks').insert(rows);
  if (error) { notify('Erreur: ' + error.message, 'error'); return; }
  document.getElementById('prog-generate-form').style.display = 'none';
  await loadProgrammingWeeks();
  notify(`${count} semaines générées`, 'success');
}

async function addProgWeek() {
  const weeks = window._progWeeksCache || [];
  let nextDate = new Date();
  if (weeks.length) {
    const last = new Date(weeks[weeks.length - 1].week_date + 'T00:00:00');
    last.setDate(last.getDate() + 7);
    nextDate = last;
  }
  const { error } = await supabaseClient.from('programming_weeks').insert({
    athlete_id: currentAthleteId, coach_id: currentUser.id,
    week_date: nextDate.toISOString().split('T')[0]
  });
  if (error) { notify('Erreur: ' + error.message, 'error'); return; }
  await loadProgrammingWeeks();
}

function editProgRow(id) {
  const w = (window._progWeeksCache || []).find(x => x.id === id);
  if (!w) return;
  const row = document.getElementById('prog-row-' + id);
  if (!row) return;
  const idx = (window._progWeeksCache || []).findIndex(x => x.id === id);
  const programs = window._progPrograms || [];
  const inp = 'background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text);font-size:12px;';
  const progOpts = '<option value="">— programme —</option>' + programs.map(p =>
    `<option value="${p.id}"${w.training_program_id === p.id ? ' selected' : ''}>${escHtml(p.nom)}</option>`).join('');
  const phaseOpts = '<option value="">— phase —</option>' + Object.entries(PROG_PHASES).map(([k, v]) =>
    `<option value="${k}"${w.phase === k ? ' selected' : ''}>${v.label}</option>`).join('');
  row.innerHTML = `
    <td style="padding:6px;font-size:12px;color:var(--text3);">${idx + 1}</td>
    <td style="padding:6px;"><input type="date" id="pew-${id}-date" value="${w.week_date}" style="${inp}width:130px;"></td>
    <td style="padding:6px;"><input type="text" id="pew-${id}-details" value="${escHtml(w.details||'')}" placeholder="Détails" style="${inp}width:100%;"></td>
    <td style="padding:6px;"><select id="pew-${id}-phase" style="${inp}">${phaseOpts}</select></td>
    <td style="padding:6px;"><select id="pew-${id}-prog" style="${inp}">${progOpts}</select></td>
    <td style="padding:6px;"><input type="number" id="pew-${id}-pdc" value="${w.pdc_moyenne||''}" step="0.1" placeholder="kg" style="${inp}width:65px;"></td>
    <td style="padding:6px;"><input type="text" id="pew-${id}-notes" value="${escHtml(w.notes_bloc||'')}" placeholder="Notes..." style="${inp}width:100%;"></td>
    <td style="padding:6px;white-space:nowrap;display:flex;gap:4px;">
      <button class="btn btn-red btn-sm" onclick="saveProgRow('${id}')"><i class="fas fa-check"></i></button>
      <button class="btn btn-outline btn-sm" onclick="renderProgrammingTable(window._progWeeksCache||[])"><i class="fas fa-times"></i></button>
      <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="deleteProgRow('${id}')"><i class="fas fa-trash"></i></button>
    </td>`;
}

async function saveProgRow(id) {
  const g = (sfx) => document.getElementById(`pew-${id}-${sfx}`);
  const data = {
    week_date:           g('date')?.value,
    details:             g('details')?.value || null,
    phase:               g('phase')?.value || null,
    training_program_id: g('prog')?.value || null,
    pdc_moyenne:         parseFloat(g('pdc')?.value) || null,
    notes_bloc:          g('notes')?.value || null,
  };
  const { error } = await supabaseClient.from('programming_weeks').update(data).eq('id', id);
  if (error) { notify('Erreur: ' + error.message, 'error'); return; }
  await loadProgrammingWeeks();
  notify('Sauvegardé', 'success');
}

async function deleteProgRow(id) {
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
