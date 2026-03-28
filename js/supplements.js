// ===== SUPPLEMENTS TAB =====

let _suppTab = 'complement';

async function loadAthleteTabSupplements() {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div class="text-center" style="padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  // Load last 7 days of logs
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const startDate = sevenDaysAgo.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: supplements }, { data: assignments }, { data: athlete }, { data: logs }] = await Promise.all([
    supabaseClient.from('supplements').select('*').eq('coach_id', currentUser.id).eq('is_template', false),
    supabaseClient.from('athlete_supplements').select('*, supplements(*)').eq('athlete_id', currentAthleteId),
    supabaseClient.from('athletes').select('supplementation_unlocked').eq('id', currentAthleteId).single(),
    supabaseClient.from('supplement_logs').select('*').eq('athlete_id', currentAthleteId).gte('taken_date', startDate).lte('taken_date', today).order('taken_date', { ascending: false }),
  ]);

  window._suppAll = supplements || [];
  window._suppAssignments = (assignments || []).filter(a => a.actif !== false);
  window._suppUnlocked = athlete?.supplementation_unlocked || false;
  window._suppLogs = logs || [];

  renderSupplementsTab(el);
}

function switchSuppTab(tab) {
  _suppTab = tab;
  renderSupplementsTab();
}

function renderSupplementsTab(el) {
  if (!el) el = document.getElementById('athlete-tab-content');
  const type = _suppTab;
  const assigned = (window._suppAssignments || []).filter(a => a.supplements?.type === type);

  const tabBtns = `
    <div class="bo-filters" style="margin-bottom:16px;">
      <button class="bo-filter ${type === 'complement' ? 'active' : ''}" onclick="switchSuppTab('complement')"><i class="fas fa-capsules"></i> Compléments</button>
      <button class="bo-filter ${type === 'supplementation' ? 'active' : ''}" onclick="switchSuppTab('supplementation')"><i class="fas fa-pills"></i> Supplémentation</button>
    </div>`;

  // Supplementation unlock toggle
  let unlockHtml = '';
  if (type === 'supplementation') {
    const unlocked = window._suppUnlocked;
    unlockHtml = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:${unlocked ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)'};border-radius:8px;margin-bottom:16px;border:1px solid ${unlocked ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'};">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text);">${unlocked ? '<i class="fas fa-unlock" style="color:var(--success);margin-right:6px;"></i>Visible par l\'athlète' : '<i class="fas fa-lock" style="color:var(--danger);margin-right:6px;"></i>Masqué pour l\'athlète'}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">La supplémentation ${unlocked ? 'est accessible' : 'n\'est pas accessible'} dans l'app mobile</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" ${unlocked ? 'checked' : ''} onchange="toggleSuppUnlock(this.checked)">
          <span class="switch"></span>
        </label>
      </div>`;
  }

  // Actions bar
  const actionsHtml = `
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px;">
      <button class="btn btn-outline btn-sm" onclick="applySuppTemplate('${type}')"><i class="fas fa-copy"></i> Appliquer template</button>
      <button class="btn btn-outline btn-sm" onclick="saveSuppAsTemplate('${type}')"><i class="fas fa-save"></i> Sauvegarder template</button>
      <button class="btn btn-red btn-sm" onclick="openAddSuppModal('${type}')"><i class="fas fa-plus"></i> Ajouter</button>
    </div>`;

  // Compliance summary (supplementation only)
  let complianceHtml = '';
  if (type === 'supplementation' && assigned.length) {
    const logs = window._suppLogs || [];
    const today = new Date().toISOString().slice(0, 10);
    const todayLogs = logs.filter(l => l.taken_date === today);
    const takenToday = todayLogs.filter(l => l.taken);
    const suppIds = assigned.map(a => a.id);
    const takenTodayCount = takenToday.filter(l => suppIds.includes(l.athlete_supplement_id)).length;

    // Last 7 days grid
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const dayLogs = logs.filter(l => l.taken_date === ds && suppIds.includes(l.athlete_supplement_id));
      const taken = dayLogs.filter(l => l.taken).length;
      const total = assigned.length;
      const pct = total > 0 ? taken / total : 0;
      const color = pct === 0 ? 'var(--bg4)' : pct >= 1 ? 'var(--success)' : 'var(--warning)';
      const label = d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3);
      days.push(`<div style="text-align:center;flex:1;">
        <div style="font-size:9px;color:var(--text3);margin-bottom:4px;">${label}</div>
        <div style="height:24px;border-radius:4px;background:${color};display:flex;align-items:center;justify-content:center;">
          ${taken > 0 ? `<span style="font-size:9px;color:#fff;font-weight:700;">${taken}/${total}</span>` : ''}
        </div>
      </div>`);
    }

    complianceHtml = `
      <div style="background:var(--bg2);border:1px solid var(--border-subtle);border-radius:10px;padding:14px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-size:13px;font-weight:600;color:var(--text);"><i class="fas fa-chart-bar" style="margin-right:6px;color:var(--text3);"></i>Suivi des prises</div>
          <div style="font-size:12px;font-weight:600;color:${takenTodayCount === assigned.length ? 'var(--success)' : 'var(--warning)'};">
            Aujourd'hui : ${takenTodayCount}/${assigned.length} ${takenTodayCount === assigned.length ? '✓' : ''}
          </div>
        </div>
        <div style="display:flex;gap:4px;">${days.join('')}</div>
      </div>`;
  }

  // Cards
  let cardsHtml = '';
  if (assigned.length) {
    cardsHtml = assigned.map(a => {
      const s = a.supplements || {};
      const linkBtn = s.lien_achat ? `<a href="${escHtml(s.lien_achat)}" target="_blank" class="btn btn-outline btn-sm" onclick="event.stopPropagation()" style="font-size:10px;"><i class="fas fa-shopping-cart"></i> Acheter</a>` : '';

      // Weekly dose calculation
      let weeklyHtml = '';
      const interval = getIntervalDays(a.frequence, a.intervalle_jours);
      if (interval > 0 && a.frequence !== 'au besoin') {
        const injPerWeek = 7 / interval;
        const dose = parseFloat((a.dosage || '').replace(',', '.')) || 0;
        if (a.concentration_mg_ml && a.unite === 'ml') {
          const mgWeek = dose * a.concentration_mg_ml * injPerWeek;
          weeklyHtml = `<div style="font-size:11px;color:var(--primary);font-weight:600;margin-top:6px;"><i class="fas fa-calculator" style="margin-right:4px;"></i>${mgWeek.toFixed(0)} mg/semaine (${a.concentration_mg_ml} mg/ml)</div>`;
        } else if (dose) {
          const perWeek = dose * injPerWeek;
          weeklyHtml = `<div style="font-size:11px;color:var(--primary);font-weight:600;margin-top:6px;"><i class="fas fa-calculator" style="margin-right:4px;"></i>${perWeek.toFixed(0)} ${escHtml(a.unite)}/semaine</div>`;
        }
      }

      // Today's taken status
      let takenBadge = '';
      if (type === 'supplementation') {
        const today = new Date().toISOString().slice(0, 10);
        const todayLog = (window._suppLogs || []).find(l => l.athlete_supplement_id === a.id && l.taken_date === today);
        if (todayLog?.taken) {
          takenBadge = `<div style="font-size:10px;color:var(--success);font-weight:600;display:flex;align-items:center;gap:4px;"><i class="fas fa-check-circle"></i> Pris aujourd'hui</div>`;
        } else {
          takenBadge = `<div style="font-size:10px;color:var(--text3);font-weight:500;display:flex;align-items:center;gap:4px;"><i class="far fa-circle"></i> Pas encore pris</div>`;
        }
      }

      return `
        <div class="supp-card">
          <div class="supp-card-header">
            <div>
              <div class="supp-card-name">${escHtml(s.nom)}</div>
              ${s.marque ? `<div class="supp-card-brand">${escHtml(s.marque)}</div>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
              ${linkBtn}
              ${takenBadge}
            </div>
          </div>
          <div class="supp-card-body">
            <div class="supp-card-dosage">
              <span class="supp-dosage-val">${escHtml(a.dosage)}</span>
              <span class="supp-dosage-unit">${escHtml(a.unite)}</span>
            </div>
            <div class="supp-card-meta">
              <span><i class="fas fa-redo"></i> ${escHtml(a.frequence)}</span>
              ${a.moment_prise ? `<span><i class="fas fa-clock"></i> ${escHtml(a.moment_prise)}</span>` : ''}
            </div>
            ${weeklyHtml}
            ${a.notes ? `<div style="font-size:11px;color:var(--text3);margin-top:6px;">${escHtml(a.notes)}</div>` : ''}
          </div>
          <div class="supp-card-footer">
            <button class="btn btn-outline btn-sm" onclick="openEditDosageModal('${a.id}','${escHtml(a.dosage)}','${escHtml(a.unite)}','${escHtml(a.frequence)}')"><i class="fas fa-pen"></i> Dosage</button>
            <button class="btn btn-outline btn-sm" onclick="viewDosageHistory('${a.id}')"><i class="fas fa-history"></i></button>
            <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="removeSuppAssignment('${a.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>`;
    }).join('');
  } else {
    cardsHtml = `<div style="text-align:center;padding:40px;color:var(--text3);"><i class="fas fa-pills" style="font-size:28px;margin-bottom:8px;display:block;"></i>Aucun ${type === 'complement' ? 'complément' : 'supplément'} assigné</div>`;
  }

  el.innerHTML = `${tabBtns}${unlockHtml}${complianceHtml}${actionsHtml}<div class="supp-grid">${cardsHtml}</div>`;
}

// ── Toggle supplementation visibility ──
async function toggleSuppUnlock(on) {
  const { error } = await supabaseClient.from('athletes').update({ supplementation_unlocked: on }).eq('id', currentAthleteId);
  if (error) { handleError(error, 'supplements'); return; }
  window._suppUnlocked = on;
  notify(on ? 'Supplémentation visible par l\'athlète' : 'Supplémentation masquée', 'success');
  renderSupplementsTab();
}

// ── Add supplement modal ──
function openAddSuppModal(type) {
  closeSuppModal();
  const modal = document.createElement('div');
  modal.id = 'supp-modal';
  modal.className = 'bt-popup-overlay';
  modal.onclick = e => { if (e.target === modal) closeSuppModal(); };
  modal.innerHTML = `
    <div class="bt-popup" style="width:480px;">
      <div class="bt-popup-header">
        <span style="font-weight:700;">Ajouter un ${type === 'complement' ? 'complément' : 'supplément'}</span>
        <button class="bt-close" onclick="closeSuppModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="bt-popup-body" style="display:flex;flex-direction:column;gap:10px;">
        <input type="text" id="supp-nom" placeholder="Nom du produit *" class="bt-input">
        <input type="text" id="supp-marque" placeholder="Marque" class="bt-input">
        <div style="display:flex;gap:8px;">
          <input type="text" id="supp-dosage" placeholder="Dosage *" class="bt-input" style="flex:1;" oninput="calcWeeklyDose()">
          <select id="supp-unite" class="bt-input" style="width:100px;" onchange="calcWeeklyDose()">
            <option value="mg">mg</option>
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="caps">caps</option>
            <option value="gélules">gélules</option>
            <option value="cuillère">cuillère</option>
            <option value="UI">UI</option>
          </select>
        </div>
        <select id="supp-frequence" class="bt-input" onchange="onSuppFreqChange()">
          <option value="1x/jour">1x/jour</option>
          <option value="2x/jour">2x/jour</option>
          <option value="3x/jour">3x/jour</option>
          <option value="tous les 2 jours">Tous les 2 jours (EOD)</option>
          <option value="tous les 3 jours">Tous les 3 jours</option>
          <option value="2x/semaine">2x/semaine</option>
          <option value="3x/semaine">3x/semaine</option>
          <option value="1x/semaine">1x/semaine</option>
          <option value="custom">Intervalle personnalisé...</option>
          <option value="au besoin">Au besoin</option>
        </select>
        <div id="supp-custom-interval" style="display:none;">
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="font-size:12px;color:var(--text3);">Tous les</span>
            <input type="number" id="supp-intervalle" placeholder="X" class="bt-input" style="width:70px;" min="1" oninput="calcWeeklyDose()">
            <span style="font-size:12px;color:var(--text3);">jours</span>
          </div>
        </div>
        ${type === 'supplementation' ? `
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="number" id="supp-concentration" placeholder="Concentration (mg/ml)" class="bt-input" style="flex:1;" step="any" oninput="calcWeeklyDose()">
          <span style="font-size:11px;color:var(--text3);white-space:nowrap;">mg/ml</span>
        </div>
        <div id="supp-weekly-calc" style="display:none;padding:10px 14px;background:rgba(179,8,8,0.08);border-radius:8px;border:1px solid rgba(179,8,8,0.15);">
          <div style="font-size:11px;color:var(--text3);">Calcul automatique</div>
          <div id="supp-weekly-result" style="font-size:14px;font-weight:700;color:var(--primary);margin-top:2px;"></div>
        </div>
        ` : ''}
        <input type="text" id="supp-moment" placeholder="Moment de prise (ex: matin, avant entraînement)" class="bt-input">
        <input type="url" id="supp-lien" placeholder="Lien d'achat (optionnel)" class="bt-input">
        <textarea id="supp-notes" placeholder="Notes" class="bt-input" rows="2"></textarea>
      </div>
      <div class="bt-popup-footer">
        <button class="btn btn-outline btn-sm" onclick="closeSuppModal()">Annuler</button>
        <button class="btn btn-red" onclick="saveNewSupplement('${type}')"><i class="fas fa-plus" style="margin-right:4px;"></i>Ajouter</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function closeSuppModal() {
  document.getElementById('supp-modal')?.remove();
}

// ── Frequency helpers ──
function onSuppFreqChange() {
  const freq = document.getElementById('supp-frequence')?.value;
  const customDiv = document.getElementById('supp-custom-interval');
  if (customDiv) customDiv.style.display = freq === 'custom' ? 'block' : 'none';
  calcWeeklyDose();
}

function onEditFreqChange() {
  const freq = document.getElementById('supp-new-freq')?.value;
  const customDiv = document.getElementById('supp-edit-custom-interval');
  if (customDiv) customDiv.style.display = freq === 'custom' ? 'block' : 'none';
  calcEditWeeklyDose();
}

function getIntervalDays(freq, customInput) {
  const map = {
    '1x/jour': 1, '2x/jour': 0.5, '3x/jour': 0.333,
    'tous les 2 jours': 2, 'tous les 3 jours': 3,
    '2x/semaine': 3.5, '3x/semaine': 2.333, '1x/semaine': 7,
  };
  if (freq === 'custom') return parseFloat(customInput) || 0;
  return map[freq] || 0;
}

function calcWeeklyDose() {
  const calcDiv = document.getElementById('supp-weekly-calc');
  const resultDiv = document.getElementById('supp-weekly-result');
  if (!calcDiv || !resultDiv) return;

  const dosage = parseFloat((document.getElementById('supp-dosage')?.value || '').replace(',', '.')) || 0;
  const unite = document.getElementById('supp-unite')?.value || '';
  const freq = document.getElementById('supp-frequence')?.value || '';
  const concentration = parseFloat((document.getElementById('supp-concentration')?.value || '').replace(',', '.')) || 0;
  const customInterval = document.getElementById('supp-intervalle')?.value || '';
  const interval = getIntervalDays(freq, customInterval);

  if (!dosage || !interval || freq === 'au besoin') { calcDiv.style.display = 'none'; return; }

  const injectionsPerWeek = 7 / interval;
  let lines = [];

  if (concentration > 0 && (unite === 'ml')) {
    const mgPerInjection = dosage * concentration;
    const mgPerWeek = mgPerInjection * injectionsPerWeek;
    lines.push(`${mgPerInjection.toFixed(0)} mg/injection × ${injectionsPerWeek.toFixed(1)}/sem = <strong>${mgPerWeek.toFixed(0)} mg/semaine</strong>`);
  } else {
    const perWeek = dosage * injectionsPerWeek;
    lines.push(`${dosage} ${unite} × ${injectionsPerWeek.toFixed(1)}/sem = <strong>${perWeek.toFixed(0)} ${unite}/semaine</strong>`);
  }

  calcDiv.style.display = 'block';
  resultDiv.innerHTML = lines.join('<br>');
}

async function saveNewSupplement(type) {
  const nom = document.getElementById('supp-nom')?.value?.trim();
  if (!nom) { notify('Nom obligatoire', 'error'); return; }
  const dosage = document.getElementById('supp-dosage')?.value?.trim();
  if (!dosage) { notify('Dosage obligatoire', 'error'); return; }

  // Create supplement
  const { data: supp, error: e1 } = await supabaseClient.from('supplements').insert({
    coach_id: currentUser.id,
    type,
    nom,
    marque: document.getElementById('supp-marque')?.value?.trim() || null,
    lien_achat: document.getElementById('supp-lien')?.value?.trim() || null,
  }).select().single();
  if (e1) { handleError(e1, 'supplements'); return; }

  // Build frequency / interval
  let frequence = document.getElementById('supp-frequence')?.value || '1x/jour';
  let intervalle_jours = 1;
  if (frequence === 'custom') {
    intervalle_jours = parseInt(document.getElementById('supp-intervalle')?.value) || 1;
    frequence = `tous les ${intervalle_jours} jours`;
  } else {
    const intervalMap = { '1x/jour': 1, '2x/jour': 1, '3x/jour': 1, 'tous les 2 jours': 2, 'tous les 3 jours': 3, '2x/semaine': 3.5, '3x/semaine': 2.333, '1x/semaine': 7, 'au besoin': 0 };
    intervalle_jours = intervalMap[frequence] || 1;
  }
  const concentration = parseFloat(document.getElementById('supp-concentration')?.value) || null;

  // Assign to athlete
  const { error: e2 } = await supabaseClient.from('athlete_supplements').insert({
    athlete_id: currentAthleteId,
    supplement_id: supp.id,
    dosage,
    unite: document.getElementById('supp-unite')?.value || 'mg',
    frequence,
    intervalle_jours: Math.round(intervalle_jours),
    concentration_mg_ml: concentration,
    moment_prise: document.getElementById('supp-moment')?.value?.trim() || null,
    notes: document.getElementById('supp-notes')?.value?.trim() || null,
  });
  if (e2) { handleError(e2, 'supplements'); return; }

  closeSuppModal();
  notify('Produit ajouté !', 'success');
  loadAthleteTabSupplements();
}

// ── Edit dosage ──
function openEditDosageModal(assignId, currentDosage, currentUnite, currentFreq) {
  closeSuppModal();
  const modal = document.createElement('div');
  modal.id = 'supp-modal';
  modal.className = 'bt-popup-overlay';
  modal.onclick = e => { if (e.target === modal) closeSuppModal(); };
  modal.innerHTML = `
    <div class="bt-popup" style="width:400px;">
      <div class="bt-popup-header">
        <span style="font-weight:700;">Modifier le dosage</span>
        <button class="bt-close" onclick="closeSuppModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="bt-popup-body" style="display:flex;flex-direction:column;gap:10px;">
        <div style="font-size:12px;color:var(--text3);">Actuel : ${escHtml(currentDosage)} ${escHtml(currentUnite)} · ${escHtml(currentFreq)}</div>
        <div style="display:flex;gap:8px;">
          <input type="text" id="supp-new-dosage" placeholder="Nouveau dosage" class="bt-input" style="flex:1;">
          <select id="supp-new-unite" class="bt-input" style="width:100px;">
            <option value="mg" ${currentUnite==='mg'?'selected':''}>mg</option>
            <option value="g" ${currentUnite==='g'?'selected':''}>g</option>
            <option value="ml" ${currentUnite==='ml'?'selected':''}>ml</option>
            <option value="caps" ${currentUnite==='caps'?'selected':''}>caps</option>
            <option value="gélules" ${currentUnite==='gélules'?'selected':''}>gélules</option>
            <option value="cuillère" ${currentUnite==='cuillère'?'selected':''}>cuillère</option>
            <option value="UI" ${currentUnite==='UI'?'selected':''}>UI</option>
          </select>
        </div>
        <select id="supp-new-freq" class="bt-input" onchange="onEditFreqChange()">
          <option value="1x/jour" ${currentFreq==='1x/jour'?'selected':''}>1x/jour</option>
          <option value="2x/jour" ${currentFreq==='2x/jour'?'selected':''}>2x/jour</option>
          <option value="3x/jour" ${currentFreq==='3x/jour'?'selected':''}>3x/jour</option>
          <option value="tous les 2 jours" ${currentFreq==='tous les 2 jours'?'selected':''}>Tous les 2 jours (EOD)</option>
          <option value="tous les 3 jours" ${currentFreq==='tous les 3 jours'?'selected':''}>Tous les 3 jours</option>
          <option value="2x/semaine" ${currentFreq==='2x/semaine'?'selected':''}>2x/semaine</option>
          <option value="3x/semaine" ${currentFreq==='3x/semaine'?'selected':''}>3x/semaine</option>
          <option value="1x/semaine" ${currentFreq==='1x/semaine'?'selected':''}>1x/semaine</option>
          <option value="custom" ${currentFreq.startsWith('tous les ')&&!['tous les 2 jours','tous les 3 jours'].includes(currentFreq)?'selected':''}>Intervalle personnalisé...</option>
          <option value="au besoin" ${currentFreq==='au besoin'?'selected':''}>Au besoin</option>
        </select>
        <div id="supp-edit-custom-interval" style="display:${currentFreq.startsWith('tous les ')&&!['tous les 2 jours','tous les 3 jours'].includes(currentFreq)?'block':'none'};">
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="font-size:12px;color:var(--text3);">Tous les</span>
            <input type="number" id="supp-edit-intervalle" placeholder="X" class="bt-input" style="width:70px;" min="1">
            <span style="font-size:12px;color:var(--text3);">jours</span>
          </div>
        </div>
        <input type="text" id="supp-raison" placeholder="Raison du changement" class="bt-input">
      </div>
      <div class="bt-popup-footer">
        <button class="btn btn-outline btn-sm" onclick="closeSuppModal()">Annuler</button>
        <button class="btn btn-red" onclick="saveDosageChange('${assignId}','${escHtml(currentDosage)}','${escHtml(currentUnite)}','${escHtml(currentFreq)}')"><i class="fas fa-check" style="margin-right:4px;"></i>Modifier</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function saveDosageChange(assignId, oldDosage, oldUnite, oldFreq) {
  const newDosage = document.getElementById('supp-new-dosage')?.value?.trim();
  if (!newDosage) { notify('Dosage obligatoire', 'error'); return; }
  const newUnite = document.getElementById('supp-new-unite')?.value;
  const newFreq = document.getElementById('supp-new-freq')?.value;
  const raison = document.getElementById('supp-raison')?.value?.trim() || null;

  // History
  await supabaseClient.from('supplement_dosage_history').insert({
    athlete_supplement_id: assignId,
    ancien_dosage: oldDosage,
    nouveau_dosage: newDosage,
    ancienne_unite: oldUnite,
    nouvelle_unite: newUnite,
    ancienne_frequence: oldFreq,
    nouvelle_frequence: newFreq,
    raison,
  });

  // Build final frequency
  let finalFreq = newFreq;
  if (newFreq === 'custom') {
    const customDays = parseInt(document.getElementById('supp-edit-intervalle')?.value) || 1;
    finalFreq = `tous les ${customDays} jours`;
  }

  // Update
  const { error } = await supabaseClient.from('athlete_supplements').update({
    dosage: newDosage, unite: newUnite, frequence: finalFreq,
  }).eq('id', assignId);
  if (error) { handleError(error, 'supplements'); return; }

  closeSuppModal();
  notify('Dosage modifié !', 'success');
  loadAthleteTabSupplements();
}

// ── Dosage history ──
async function viewDosageHistory(assignId) {
  const { data: history } = await supabaseClient.from('supplement_dosage_history')
    .select('*').eq('athlete_supplement_id', assignId).order('changed_at', { ascending: false });

  closeSuppModal();
  const modal = document.createElement('div');
  modal.id = 'supp-modal';
  modal.className = 'bt-popup-overlay';
  modal.onclick = e => { if (e.target === modal) closeSuppModal(); };

  const rows = (history || []).map(h => {
    const date = new Date(h.changed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    return `
      <div style="padding:10px 0;border-bottom:1px solid var(--border-subtle);font-size:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:var(--text3);">${date}</span>
          <span>
            <span style="color:var(--danger);text-decoration:line-through;">${escHtml(h.ancien_dosage||'')} ${escHtml(h.ancienne_unite||'')}</span>
            <i class="fas fa-arrow-right" style="margin:0 6px;font-size:9px;color:var(--text3);"></i>
            <span style="color:var(--success);font-weight:600;">${escHtml(h.nouveau_dosage)} ${escHtml(h.nouvelle_unite)}</span>
          </span>
        </div>
        ${h.raison ? `<div style="color:var(--text3);margin-top:4px;font-style:italic;">"${escHtml(h.raison)}"</div>` : ''}
      </div>`;
  }).join('') || '<div style="padding:20px;text-align:center;color:var(--text3);">Aucun changement de dosage</div>';

  modal.innerHTML = `
    <div class="bt-popup" style="width:420px;">
      <div class="bt-popup-header">
        <span style="font-weight:700;">Historique des dosages</span>
        <button class="bt-close" onclick="closeSuppModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="bt-popup-body" style="max-height:400px;overflow-y:auto;">${rows}</div>
      <div class="bt-popup-footer">
        <button class="btn btn-outline btn-sm" onclick="closeSuppModal()">Fermer</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

// ── Remove assignment ──
async function removeSuppAssignment(assignId) {
  if (!confirm('Retirer ce produit ?')) return;
  const { error } = await supabaseClient.from('athlete_supplements').update({ actif: false }).eq('id', assignId);
  if (error) { handleError(error, 'supplements'); return; }
  notify('Produit retiré', 'success');
  loadAthleteTabSupplements();
}

// ── Templates ──
async function saveSuppAsTemplate(type) {
  const assigned = (window._suppAssignments || []).filter(a => a.supplements?.type === type);
  if (!assigned.length) { notify('Aucun produit à sauvegarder', 'error'); return; }

  const name = prompt('Nom du template :');
  if (!name) return;

  for (const a of assigned) {
    const s = a.supplements;
    await supabaseClient.from('supplements').insert({
      coach_id: currentUser.id,
      type,
      nom: s.nom,
      marque: s.marque,
      lien_achat: s.lien_achat,
      description: `${a.dosage} ${a.unite} · ${a.frequence}${a.moment_prise ? ' · ' + a.moment_prise : ''}`,
      is_template: true,
      template_name: name,
    });
  }
  notify(`Template "${name}" sauvegardé !`, 'success');
}

async function applySuppTemplate(type) {
  const { data: templates } = await supabaseClient.from('supplements')
    .select('*').eq('coach_id', currentUser.id).eq('is_template', true).eq('type', type);

  const templateNames = [...new Set((templates || []).map(t => t.template_name).filter(Boolean))];
  if (!templateNames.length) { notify('Aucun template disponible', 'error'); return; }

  closeSuppModal();
  const modal = document.createElement('div');
  modal.id = 'supp-modal';
  modal.className = 'bt-popup-overlay';
  modal.onclick = e => { if (e.target === modal) closeSuppModal(); };

  const btns = templateNames.map(n =>
    `<button class="bt-chip" onclick="applyTemplate('${type}','${escHtml(n).replace(/'/g, "\\'")}')" style="width:100%;text-align:left;">${escHtml(n)}</button>`
  ).join('');

  modal.innerHTML = `
    <div class="bt-popup" style="width:380px;">
      <div class="bt-popup-header">
        <span style="font-weight:700;">Appliquer un template</span>
        <button class="bt-close" onclick="closeSuppModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="bt-popup-body"><div class="bt-chips">${btns}</div></div>
    </div>`;
  document.body.appendChild(modal);
}

async function applyTemplate(type, templateName) {
  const { data: tplItems } = await supabaseClient.from('supplements')
    .select('*').eq('coach_id', currentUser.id).eq('is_template', true)
    .eq('template_name', templateName).eq('type', type);

  if (!tplItems?.length) { notify('Template vide', 'error'); return; }

  for (const t of tplItems) {
    // Create non-template supplement
    const { data: supp } = await supabaseClient.from('supplements').insert({
      coach_id: currentUser.id, type, nom: t.nom, marque: t.marque, lien_achat: t.lien_achat,
    }).select().single();
    if (!supp) continue;

    // Parse description for dosage info
    const parts = (t.description || '').split(' · ');
    const dosageParts = (parts[0] || '').split(' ');
    const dosage = dosageParts[0] || '1';
    const unite = dosageParts[1] || 'g';
    const frequence = parts[1] || '1x/jour';
    const moment = parts[2] || null;

    await supabaseClient.from('athlete_supplements').insert({
      athlete_id: currentAthleteId, supplement_id: supp.id,
      dosage, unite, frequence, moment_prise: moment,
    });
  }

  closeSuppModal();
  notify(`Template "${templateName}" appliqué !`, 'success');
  loadAthleteTabSupplements();
}
