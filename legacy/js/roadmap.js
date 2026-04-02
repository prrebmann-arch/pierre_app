// ===== ROADMAP TAB =====

async function loadAthleteTabRoadmap() {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div class="text-center" style="padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  const [{ data: phases }, { data: programs }, { data: nutritions }, { data: reports }] = await Promise.all([
    supabaseClient.from('roadmap_phases').select('*').eq('athlete_id', currentAthleteId).order('position').order('start_date'),
    supabaseClient.from('workout_programs').select('id,nom').eq('athlete_id', currentAthleteId),
    supabaseClient.from('nutrition_plans').select('id,nom').eq('athlete_id', currentAthleteId),
    supabaseClient.from('daily_reports').select('date,weight').eq('user_id', currentAthleteObj.user_id),
  ]);

  window._rmPhases = phases || [];
  window._rmPrograms = programs || [];
  window._rmNutritions = nutritions || [];
  window._rmReports = reports || [];

  renderRoadmap();
}

function renderRoadmap() {
  const el = document.getElementById('athlete-tab-content');
  const phases = window._rmPhases || [];
  const today = toDateStr(new Date());

  let html = `
    <div class="rm-header">
      <div>
        <h2 class="rm-title">Roadmap</h2>
        <p class="rm-subtitle">Planifiez et suivez les phases de progression</p>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-red" onclick="addRoadmapPhase()"><i class="fas fa-plus"></i> Phase</button>
      </div>
    </div>`;

  // ── Timeline ──
  if (!phases.length) {
    html += `
      <div class="rm-empty">
        <i class="fas fa-road" style="font-size:32px;color:var(--text3);"></i>
        <p style="margin-top:12px;color:var(--text2);">Aucune phase planifiée</p>
        <button class="btn btn-red" onclick="addRoadmapPhase()" style="margin-top:12px;"><i class="fas fa-plus"></i> Ajouter une phase</button>
      </div>`;
  } else {
    html += '<div class="rm-timeline">';
    phases.forEach((p, i) => {
      const pi = PROG_PHASES[p.phase];
      const color = pi ? pi.color : '#555';
      const label = pi ? pi.label : p.phase || '';
      const isActive = p.start_date <= today && p.end_date >= today;
      const isPast = p.end_date < today;
      const statusLabel = p.status === 'en_cours' ? 'En cours' : p.status === 'terminee' ? 'Terminée' : 'Planifiée';
      const statusCls = p.status === 'en_cours' ? 'rm-status-active' : p.status === 'terminee' ? 'rm-status-done' : 'rm-status-planned';

      const prog = window._rmPrograms.find(pr => pr.id === p.programme_id);
      const nutri = window._rmNutritions.find(n => n.id === p.nutrition_id);

      // Week count
      const start = new Date(p.start_date + 'T00:00:00');
      const end = new Date(p.end_date + 'T00:00:00');
      const weeks = Math.max(1, Math.round((end - start) / (7 * 86400000)));

      // Weight average in this phase
      const weightVals = (window._rmReports || [])
        .filter(r => r.weight && r.date >= p.start_date && r.date <= p.end_date)
        .map(r => parseFloat(r.weight));
      const avgWeight = weightVals.length ? (weightVals.reduce((a, b) => a + b, 0) / weightVals.length).toFixed(1) : null;

      html += `
        <div class="rm-phase${isActive ? ' rm-phase-active' : ''}${isPast ? ' rm-phase-past' : ''}">
          <div class="rm-dot" style="background:${color};"></div>
          <div class="rm-line"></div>
          <div class="rm-phase-card">
            <div class="rm-phase-top">
              <div class="rm-phase-info">
                <div class="rm-phase-name-row">
                  <span class="rm-phase-badge" style="background:${color};">${escHtml(label)}</span>
                  <span class="rm-phase-name">${escHtml(p.name)}</span>
                  <span class="${statusCls}">${statusLabel}</span>
                </div>
                ${p.description ? `<div class="rm-phase-desc">${escHtml(p.description)}</div>` : ''}
                <div class="rm-phase-meta">
                  <span><i class="fas fa-calendar"></i> ${formatDateFr(p.start_date)} → ${formatDateFr(p.end_date)}</span>
                  <span><i class="fas fa-layer-group"></i> ${weeks} sem.</span>
                  ${avgWeight ? `<span><i class="fas fa-weight"></i> ${avgWeight} kg moy.</span>` : ''}
                </div>
              </div>
              <div class="rm-phase-actions">
                ${p.status === 'planifiee' ? `<button class="btn btn-outline btn-sm" onclick="startRoadmapPhase('${p.id}')" style="color:var(--success);border-color:var(--success);"><i class="fas fa-play"></i> Démarrer</button>` : ''}
                ${p.status === 'en_cours' ? `<button class="btn btn-outline btn-sm" onclick="completeRoadmapPhase('${p.id}')" style="color:var(--success);border-color:var(--success);"><i class="fas fa-check"></i> Terminer</button>` : ''}
                ${prog ? `<span class="rm-link-pill"><i class="fas fa-dumbbell"></i> ${escHtml(prog.nom)}</span>` : ''}
                ${nutri ? `<span class="rm-link-pill"><i class="fas fa-utensils"></i> ${escHtml(nutri.nom)}</span>` : ''}
                <button class="btn btn-outline btn-sm" onclick="editRoadmapPhase('${p.id}')"><i class="fas fa-pen"></i></button>
                <button class="btn btn-outline btn-sm btn-danger" onclick="deleteRoadmapPhase('${p.id}')"><i class="fas fa-trash"></i></button>
              </div>
            </div>
          </div>
        </div>`;
    });

    // Add phase button at bottom of timeline
    html += `
      <div class="rm-phase rm-add-phase" onclick="addRoadmapPhase()">
        <div class="rm-dot" style="background:var(--border);"></div>
        <div class="rm-phase-card rm-add-card">
          <i class="fas fa-plus"></i> Ajouter une phase
        </div>
      </div>`;
    html += '</div>';
  }

  // ── Calendar view ──
  html += renderRoadmapCalendar();

  // ── Week by week view ──
  html += renderRoadmapWeekTable();

  el.innerHTML = html;
}

function formatDateFr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ── Calendar ──

function renderRoadmapCalendar() {
  const phases = window._rmPhases || [];
  if (!phases.length) return '';

  // Find date range
  const allDates = phases.flatMap(p => [new Date(p.start_date + 'T00:00:00'), new Date(p.end_date + 'T00:00:00')]);
  let minDate = new Date(Math.min(...allDates));
  let maxDate = new Date(Math.max(...allDates));
  minDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);

  // Store range for navigation
  window._rmCalMin = minDate;
  window._rmCalMax = maxDate;

  // Default: start at current month (or min if current is before)
  const now = new Date();
  if (window._rmCalOffset == null) {
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    if (currentMonth >= minDate && currentMonth <= maxDate) {
      window._rmCalOffset = (currentMonth.getFullYear() - minDate.getFullYear()) * 12 + (currentMonth.getMonth() - minDate.getMonth());
    } else {
      window._rmCalOffset = 0;
    }
  }

  const totalMonths = (maxDate.getFullYear() - minDate.getFullYear()) * 12 + (maxDate.getMonth() - minDate.getMonth()) + 1;
  const visibleCount = Math.min(4, totalMonths);
  const offset = Math.max(0, Math.min(window._rmCalOffset, totalMonths - visibleCount));
  window._rmCalOffset = offset;

  const canPrev = offset > 0;
  const canNext = offset + visibleCount < totalMonths;

  let html = `
    <div class="rm-calendar-section">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 class="rm-section-title" style="margin:0;">Vue calendrier</h3>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm" onclick="rmCalNav(-1)" ${canPrev ? '' : 'disabled'} style="${canPrev ? '' : 'opacity:0.3;cursor:default;'}"><i class="fas fa-chevron-left"></i></button>
          <button class="btn btn-outline btn-sm" onclick="rmCalNav(1)" ${canNext ? '' : 'disabled'} style="${canNext ? '' : 'opacity:0.3;cursor:default;'}"><i class="fas fa-chevron-right"></i></button>
        </div>
      </div>
      <div class="rm-cal-grid" style="grid-template-columns:repeat(${visibleCount}, 1fr);">`;

  for (let m = 0; m < visibleCount; m++) {
    const monthDate = new Date(minDate.getFullYear(), minDate.getMonth() + offset + m, 1);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const monthName = monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const firstDay = new Date(year, month, 1);
    let startDay = firstDay.getDay() - 1; if (startDay < 0) startDay = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = toDateStr(new Date());

    html += `<div class="rm-cal-month">
      <div class="rm-cal-month-name">${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</div>
      <div class="rm-cal-days-hdr">
        <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
      </div>
      <div class="rm-cal-days">`;

    for (let i = 0; i < startDay; i++) html += '<span class="rm-cal-day rm-cal-empty"></span>';

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const phase = phases.find(p => p.start_date <= dateStr && p.end_date >= dateStr);
      const pi = phase ? PROG_PHASES[phase.phase] : null;
      const color = pi ? pi.color : null;
      const isToday = dateStr === todayStr;

      let style = '';
      if (isToday && color) style = `background:var(--primary);border-color:var(--primary);color:#fff;`;
      else if (isToday) style = `background:var(--primary);border-color:var(--primary);color:#fff;`;
      else if (color) style = `background:${color}22;border-color:${color};`;

      html += `<span class="rm-cal-day${isToday ? ' rm-cal-today' : ''}${phase ? ' rm-cal-in-phase' : ''}" ${style ? `style="${style}"` : ''}>${d}</span>`;
    }

    html += '</div></div>';
  }

  // Legend
  html += '</div><div class="rm-cal-legend">';
  phases.forEach(p => {
    const pi = PROG_PHASES[p.phase];
    const color = pi ? pi.color : '#555';
    html += `<span class="rm-legend-item"><span class="rm-legend-dot" style="background:${color};"></span> ${escHtml(p.name)} <span class="rm-legend-dates">${formatDateShort(p.start_date)} — ${formatDateShort(p.end_date)}</span></span>`;
  });
  html += '</div></div>';
  return html;
}

function rmCalNav(dir) {
  window._rmCalOffset = (window._rmCalOffset || 0) + dir;
  renderRoadmap();
}

// ── Week by week table ──

function renderRoadmapWeekTable() {
  const phases = window._rmPhases || [];
  if (!phases.length) return '';

  const programs = window._rmPrograms || [];
  const nutritions = window._rmNutritions || [];
  const reports = window._rmReports || [];

  // Generate all weeks from first phase start to last phase end
  const allDates = phases.flatMap(p => [new Date(p.start_date + 'T00:00:00'), new Date(p.end_date + 'T00:00:00')]);
  let minDate = new Date(Math.min(...allDates));
  let maxDate = new Date(Math.max(...allDates));
  // Align to Monday
  const dayOfWeek = minDate.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  minDate.setDate(minDate.getDate() + diff);

  // Build weight map by date
  const weightByDate = {};
  reports.forEach(r => { if (r.weight) weightByDate[r.date] = parseFloat(r.weight); });

  const weeks = [];
  let weekStart = new Date(minDate);
  let weekNum = 1;
  while (weekStart <= maxDate) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekKey = toDateStr(weekStart);
    const weekEndKey = toDateStr(weekEnd);

    // Find phase for this week
    const phase = phases.find(p => p.start_date <= weekEndKey && p.end_date >= weekKey);

    // Weight average
    const weightVals = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(weekStart); dt.setDate(dt.getDate() + d);
      const v = weightByDate[toDateStr(dt)];
      if (v) weightVals.push(v);
    }
    const avgWeight = weightVals.length ? (weightVals.reduce((a, b) => a + b, 0) / weightVals.length).toFixed(1) : null;

    weeks.push({
      num: weekNum++,
      start: weekKey,
      end: weekEndKey,
      phase,
      avgWeight,
    });

    weekStart.setDate(weekStart.getDate() + 7);
  }

  const today = toDateStr(new Date());

  let html = `
    <div class="rm-weektable-section">
      <h3 class="rm-section-title">Vue semaine par semaine</h3>
      <div class="rm-wt">
        <div class="rm-wt-hdr">
          <span class="rm-wt-h" style="text-align:left;">Semaine</span>
          <span class="rm-wt-h">Phase</span>
          <span class="rm-wt-h">Poids moyen</span>
          <span class="rm-wt-h">Programme</span>
          <span class="rm-wt-h">Nutrition</span>
        </div>`;

  weeks.forEach(w => {
    const isCurrent = w.start <= today && w.end >= today;
    const p = w.phase;
    const pi = p ? PROG_PHASES[p.phase] : null;
    const color = pi ? pi.color : null;
    const prog = p ? programs.find(pr => pr.id === p.programme_id) : null;
    const nutri = p ? nutritions.find(n => n.id === p.nutrition_id) : null;

    html += `
      <div class="rm-wt-row${isCurrent ? ' rm-wt-current' : ''}">
        <span class="rm-wt-cell rm-wt-week">
          <strong>S${w.num}</strong>
          <span class="rm-wt-dates">${formatDateShort(w.start)} — ${formatDateShort(w.end)}</span>
        </span>
        <span class="rm-wt-cell">${pi ? `<span class="rm-wt-phase" style="background:${color};">${escHtml(p.name)}</span>` : '<span style="color:var(--text3);">—</span>'}</span>
        <span class="rm-wt-cell">${w.avgWeight ? w.avgWeight + ' kg' : '—'}</span>
        <span class="rm-wt-cell">${prog ? `<span class="rm-wt-prog"><i class="fas fa-dumbbell"></i> ${escHtml(prog.nom)}</span>` : '<span style="color:var(--text3);">—</span>'}</span>
        <span class="rm-wt-cell">${nutri ? `<span class="rm-wt-nutri"><i class="fas fa-utensils"></i> ${escHtml(nutri.nom)}</span>` : '<span style="color:var(--text3);">—</span>'}</span>
      </div>`;
  });

  html += '</div></div>';
  return html;
}

// ── CRUD ──

function addRoadmapPhase() {
  const phases = window._rmPhases || [];
  const programs = window._rmPrograms || [];
  const nutritions = window._rmNutritions || [];

  // Default dates: day after last phase end, or next Monday
  let defaultStart;
  if (phases.length) {
    const last = phases[phases.length - 1];
    defaultStart = new Date(last.end_date + 'T00:00:00');
    defaultStart.setDate(defaultStart.getDate() + 1);
  } else {
    defaultStart = getNextMonday(new Date());
  }
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setDate(defaultEnd.getDate() + 8 * 7 - 1); // 8 weeks

  showRoadmapModal({
    id: null,
    name: '',
    phase: 'seche',
    description: '',
    start_date: toDateStr(defaultStart),
    end_date: toDateStr(defaultEnd),
    status: 'planifiee',
    programme_id: null,
    nutrition_id: null,
  }, programs, nutritions);
}

function editRoadmapPhase(id) {
  const phase = (window._rmPhases || []).find(p => p.id === id);
  if (!phase) return;
  showRoadmapModal(phase, window._rmPrograms || [], window._rmNutritions || []);
}

function showRoadmapModal(data, programs, nutritions) {
  const isEdit = !!data.id;
  window._rmSelectedPhase = data.phase || 'seche';
  window._rmSelectedStatus = data.status || 'planifiee';

  const phaseButtons = Object.entries(PROG_PHASES).map(([k, v]) =>
    `<button type="button" class="rm-modal-phase-btn${data.phase === k ? ' active' : ''}" data-phase="${k}" onclick="selectRmPhase(this)" style="--phase-color:${v.color};">${v.label}</button>`
  ).join('');

  const statusButtons = [
    ['planifiee', 'Planifiée', 'var(--text3)', 'var(--bg3)'],
    ['en_cours', 'En cours', 'var(--success)', 'rgba(34,197,94,0.15)'],
    ['terminee', 'Terminée', 'var(--text3)', 'var(--bg3)'],
  ].map(([k, label, color, bg]) =>
    `<button type="button" class="rm-modal-status-btn${data.status === k ? ' active' : ''}" data-status="${k}" onclick="selectRmStatus(this)" style="--st-color:${color};--st-bg:${bg};">${label}</button>`
  ).join('');

  const progOptions = `<option value="">— Aucun —</option>` +
    programs.map(p => `<option value="${p.id}" ${data.programme_id === p.id ? 'selected' : ''}>${escHtml(p.nom)}</option>`).join('');

  const nutriOptions = `<option value="">— Aucun —</option>` +
    nutritions.map(n => `<option value="${n.id}" ${data.nutrition_id === n.id ? 'selected' : ''}>${escHtml(n.nom)}</option>`).join('');

  const weeksVal = (() => { const s = new Date(data.start_date + 'T00:00:00'); const e = new Date(data.end_date + 'T00:00:00'); return Math.max(1, Math.round((e - s) / (7 * 86400000))); })();

  const modalHtml = `
    <div class="modal-overlay open" id="rm-modal" onclick="this.remove()">
      <div class="modal rm-modal-compact" onclick="event.stopPropagation()">
        <div class="rm-m-head">
          <span class="rm-m-title">${isEdit ? 'Modifier la phase' : 'Nouvelle phase'}</span>
          <button class="modal-close" onclick="document.getElementById('rm-modal').remove()">×</button>
        </div>

        <div class="rm-m-body">
          <div class="rm-modal-phases">${phaseButtons}</div>

          <input type="text" id="rm-name" value="${escHtml(data.name)}" placeholder="Titre de la phase *" class="rm-m-input rm-m-title-input">

          <textarea id="rm-desc" rows="1" placeholder="Description (optionnel)" class="rm-m-input rm-m-desc">${escHtml(data.description || '')}</textarea>

          <div class="rm-m-dates">
            <input type="date" id="rm-start" value="${data.start_date}" class="rm-m-input rm-m-date" onchange="rmCalcEndFromWeeks()">
            <div class="rm-m-weeks">
              <button type="button" onclick="rmAdjustWeeks(-1)">−</button>
              <span id="rm-weeks-display">${weeksVal}</span>
              <small>sem</small>
              <button type="button" onclick="rmAdjustWeeks(1)">+</button>
              <input type="hidden" id="rm-weeks" value="${weeksVal}">
            </div>
            <input type="date" id="rm-end" value="${data.end_date}" class="rm-m-input rm-m-date" onchange="rmCalcWeeksFromEnd()">
          </div>

          <div class="rm-m-row">
            <div class="rm-modal-statuses">${statusButtons}</div>
          </div>

          <div class="rm-m-row rm-m-selects">
            <select id="rm-prog" class="rm-m-input">${progOptions}</select>
            <select id="rm-nutri" class="rm-m-input">${nutriOptions}</select>
          </div>
        </div>

        <div class="rm-m-foot">
          <button class="btn btn-outline" onclick="document.getElementById('rm-modal').remove()">Annuler</button>
          <button class="btn btn-red" onclick="saveRoadmapPhase('${data.id || ''}')"> ${isEdit ? 'Enregistrer' : 'Créer'}</button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function selectRmPhase(btn) {
  document.querySelectorAll('.rm-modal-phase-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._rmSelectedPhase = btn.dataset.phase;
}

function selectRmStatus(btn) {
  document.querySelectorAll('.rm-modal-status-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  window._rmSelectedStatus = btn.dataset.status;
}

function rmSyncWeeksDisplay() {
  const w = document.getElementById('rm-weeks').value;
  const display = document.getElementById('rm-weeks-display');
  if (display) display.textContent = w;
}

function rmCalcEndFromWeeks() {
  const start = document.getElementById('rm-start').value;
  const weeks = parseInt(document.getElementById('rm-weeks').value);
  if (!start || !weeks || weeks < 1) return;
  const d = new Date(start + 'T00:00:00');
  d.setDate(d.getDate() + weeks * 7 - 1);
  document.getElementById('rm-end').value = toDateStr(d);
  rmSyncWeeksDisplay();
}

function rmCalcWeeksFromEnd() {
  const start = document.getElementById('rm-start').value;
  const end = document.getElementById('rm-end').value;
  if (!start || !end) return;
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const weeks = Math.max(1, Math.round((e - s + 86400000) / (7 * 86400000)));
  document.getElementById('rm-weeks').value = weeks;
  rmSyncWeeksDisplay();
}

function rmAdjustWeeks(delta) {
  const el = document.getElementById('rm-weeks');
  const cur = parseInt(el.value) || 1;
  const next = Math.max(1, cur + delta);
  el.value = next;
  rmCalcEndFromWeeks();
}

async function saveRoadmapPhase(existingId) {
  const name = document.getElementById('rm-name').value.trim();
  const phase = window._rmSelectedPhase || 'seche';
  const status = window._rmSelectedStatus || 'planifiee';
  const description = document.getElementById('rm-desc').value.trim();
  const start_date = document.getElementById('rm-start').value;
  const end_date = document.getElementById('rm-end').value;
  const programme_id = document.getElementById('rm-prog').value || null;
  const nutrition_id = document.getElementById('rm-nutri').value || null;

  if (!name) { notify('Nom requis', 'warning'); return; }
  if (!start_date || !end_date) { notify('Dates requises', 'warning'); return; }
  if (end_date < start_date) { notify('La date de fin doit être après la date de début', 'warning'); return; }

  const phases = window._rmPhases || [];
  const position = existingId
    ? (phases.find(p => p.id === existingId)?.position || 0)
    : phases.length;

  const row = {
    athlete_id: currentAthleteId,
    coach_id: currentUser.id,
    name, phase, status, description,
    start_date, end_date,
    programme_id, nutrition_id,
    position,
  };

  let error;
  if (existingId) {
    ({ error } = await supabaseClient.from('roadmap_phases').update(row).eq('id', existingId));
  } else {
    ({ error } = await supabaseClient.from('roadmap_phases').insert(row));
  }

  if (error) { handleError(error, 'roadmap'); return; }

  document.getElementById('rm-modal')?.remove();
  notify(existingId ? 'Phase mise à jour !' : 'Phase créée !', 'success');

  // Sync programming_weeks
  await syncProgrammingWeeksFromRoadmap();
  await loadAthleteTabRoadmap();
}

async function deleteRoadmapPhase(id) {
  if (!confirm('Supprimer cette phase ?')) return;
  const { error } = await supabaseClient.from('roadmap_phases').delete().eq('id', id);
  if (error) { handleError(error, 'roadmap'); return; }
  notify('Phase supprimée', 'success');
  await syncProgrammingWeeksFromRoadmap();
  await loadAthleteTabRoadmap();
}

async function startRoadmapPhase(id) {
  const today = toDateStr(new Date());
  const phases = window._rmPhases || [];
  const targetPhase = phases.find(p => p.id === id);
  if (!targetPhase) return;

  // Terminer la phase en cours s'il y en a une (date de fin = hier)
  const activePhase = phases.find(p => p.status === 'en_cours' && p.id !== id);
  if (activePhase) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const { error: endErr } = await supabaseClient.from('roadmap_phases')
      .update({ status: 'terminee', end_date: toDateStr(yesterday) })
      .eq('id', activePhase.id);
    if (endErr) { handleError(endErr, 'roadmap'); return; }
  }

  // Démarrer la nouvelle phase : ajuster start_date à aujourd'hui seulement si on est avant la date prévue
  const updates = { status: 'en_cours' };
  if (today < targetPhase.start_date || today > targetPhase.start_date) {
    updates.start_date = today;
  }

  const { error } = await supabaseClient.from('roadmap_phases')
    .update(updates).eq('id', id);
  if (error) { handleError(error, 'roadmap'); return; }
  notify('Phase démarrée !', 'success');
  await syncProgrammingWeeksFromRoadmap();
  await loadAthleteTabRoadmap();
}

async function completeRoadmapPhase(id) {
  const today = toDateStr(new Date());
  // Terminer avec date de fin = aujourd'hui
  const { error } = await supabaseClient.from('roadmap_phases')
    .update({ status: 'terminee', end_date: today }).eq('id', id);
  if (error) { handleError(error, 'roadmap'); return; }
  notify('Phase terminée !', 'success');
  await syncProgrammingWeeksFromRoadmap();
  await loadAthleteTabRoadmap();
}

// ── Sync programming_weeks from roadmap phases ──
// Keep programming_weeks in sync so bilans still work

async function syncProgrammingWeeksFromRoadmap() {
  const { data: phases } = await supabaseClient.from('roadmap_phases')
    .select('*').eq('athlete_id', currentAthleteId).order('position').order('start_date');
  if (!phases?.length) {
    // Delete all programming weeks for this athlete
    const { error: delErr } = await supabaseClient.from('programming_weeks').delete().eq('athlete_id', currentAthleteId);
    if (delErr) { handleError(delErr, 'roadmap'); }
    return;
  }

  // Generate expected weeks from phases
  const expectedWeeks = [];
  phases.forEach(p => {
    let weekStart = new Date(p.start_date + 'T00:00:00');
    // Align to Monday
    const dow = weekStart.getDay();
    const mondayDiff = dow === 0 ? -6 : 1 - dow;
    weekStart.setDate(weekStart.getDate() + mondayDiff);

    const endDate = new Date(p.end_date + 'T00:00:00');
    while (weekStart <= endDate) {
      expectedWeeks.push({
        week_date: toDateStr(weekStart),
        phase: p.phase,
      });
      weekStart.setDate(weekStart.getDate() + 7);
    }
  });

  // Deduplicate by week_date (later phase wins)
  const weekMap = {};
  expectedWeeks.forEach(w => { weekMap[w.week_date] = w.phase; });

  // Delete existing and recreate
  const { error: delErr } = await supabaseClient.from('programming_weeks').delete().eq('athlete_id', currentAthleteId);
  if (delErr) { handleError(delErr, 'roadmap'); return; }
  const rows = Object.entries(weekMap).map(([week_date, phase]) => ({
    athlete_id: currentAthleteId,
    coach_id: currentUser.id,
    week_date,
    phase,
  }));
  if (rows.length) {
    const { error: insErr } = await supabaseClient.from('programming_weeks').insert(rows);
    if (insErr) { handleError(insErr, 'roadmap'); }
  }
}
