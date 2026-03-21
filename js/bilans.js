// ===== BILANS TAB — Weekly Accordion =====

async function loadAthleteTabBilans() {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  if (!currentAthleteObj) {
    el.innerHTML = '<div class="card"><div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Athlète non sélectionné</p></div></div>';
    return;
  }

  // Fetch data in parallel
  const [bilansRes, progRes, nutriRes] = await Promise.all([
    supabaseClient.from('daily_reports').select('*').eq('user_id', currentAthleteObj.user_id).order('date', { ascending: false }),
    supabaseClient.from('programming_weeks').select('*').eq('athlete_id', currentAthleteId).order('week_date'),
    supabaseClient.from('nutrition_plans').select('*').eq('athlete_id', currentAthleteId).eq('coach_id', currentUser.id)
  ]);

  const bilans = bilansRes.data || [];
  const progWeeks = progRes.data || [];
  const nutriPlans = nutriRes.data || [];

  if (!bilans.length) {
    el.innerHTML = '<div class="card"><div class="empty-state"><i class="fas fa-chart-line"></i><p>Aucun bilan enregistré</p><p style="font-size:12px;color:var(--text3);margin-top:8px;">L\'athlète doit remplir ses check-ins journaliers.</p></div></div>';
    return;
  }

  // Helper: get Monday of a given date's week
  function getMonday(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d;
  }

  // Group bilans by week (Monday-based)
  const weeks = {};
  bilans.forEach(b => {
    const date = new Date(b.date + 'T00:00:00');
    const monday = getMonday(date);
    const key = monday.toISOString().slice(0, 10);
    if (!weeks[key]) weeks[key] = { monday, bilans: [], bilansByDayIdx: {} };
    weeks[key].bilans.push(b);
    // dayIdx: 0=Mon, 1=Tue, ..., 6=Sun
    let dayIdx = date.getDay() - 1;
    if (dayIdx < 0) dayIdx = 6;
    weeks[key].bilansByDayIdx[dayIdx] = b;
  });

  // Sort week keys descending (most recent first)
  const sortedKeys = Object.keys(weeks).sort().reverse();

  // Current week Monday
  const todayMonday = getMonday(new Date()).toISOString().slice(0, 10);

  // Build programming_weeks lookup by ISO year-weekNumber
  const progLookup = {};
  progWeeks.forEach(pw => {
    if (pw.week_date) {
      const d = new Date(pw.week_date + 'T00:00:00');
      const wn = getWeekNumber(d);
      progLookup[`${d.getFullYear()}-${wn}`] = pw;
    }
  });

  // Nutrition plans — sorted by valid_from for per-week lookup
  const nutriSorted = nutriPlans.sort((a, b) => (b.valid_from || '').localeCompare(a.valid_from || ''));

  // Compute weekly averages
  const weekData = sortedKeys.map(key => {
    const w = weeks[key];
    return {
      key,
      ...w,
      avgWeight:    bwAvg(w.bilans, 'weight'),
      avgEnergy:    bwAvg(w.bilans, 'energy'),
      avgSleep:     bwAvg(w.bilans, 'sleep_quality'),
      avgAdherence: bwAvg(w.bilans, 'adherence'),
      avgStress:    bwAvg(w.bilans, 'stress'),
      totalSessions: w.bilans.reduce((s, b) => s + (parseFloat(b.sessions_executed) || 0), 0),
    };
  });

  // Compute weight delta between consecutive weeks
  weekData.forEach((w, i) => {
    const prev = weekData[i + 1];
    w.deltaKg = (prev && w.avgWeight !== null && prev.avgWeight !== null)
      ? +(w.avgWeight - prev.avgWeight).toFixed(1)
      : null;
  });

  // Find all nutrition periods for a given week (handles mid-week changes)
  function getNutriPeriodsForWeek(weekMonday) {
    const mondayStr = weekMonday.toISOString().slice(0, 10);
    const sunday = new Date(weekMonday);
    sunday.setDate(sunday.getDate() + 6);
    const sundayStr = sunday.toISOString().slice(0, 10);

    // Dates where diet changed during this week
    const changeDates = [...new Set(
      nutriSorted
        .filter(p => p.valid_from && p.valid_from > mondayStr && p.valid_from <= sundayStr)
        .map(p => p.valid_from)
    )].sort();

    const timePoints = [mondayStr, ...changeDates];
    const periods = [];

    timePoints.forEach((dateStr) => {
      const validAtDate = nutriSorted.filter(p => !p.valid_from || p.valid_from <= dateStr);
      const training = validAtDate.find(p => p.meal_type === 'training' || p.meal_type === 'entrainement') || validAtDate[0] || null;
      const rest = validAtDate.find(p => p.meal_type === 'rest' || p.meal_type === 'repos') || null;

      // Skip if same plans as previous period
      const last = periods[periods.length - 1];
      if (last && last.training?.id === training?.id && last.rest?.id === rest?.id) return;

      periods.push({ from: dateStr, training, rest });
    });

    return periods;
  }

  const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const dayNames  = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // ── Render ──
  let html = '<div class="bw-container">';

  weekData.forEach((w, idx) => {
    const isCurrent = w.key === todayMonday;
    const isFuture  = w.key > todayMonday;
    const sunday = new Date(w.monday);
    sunday.setDate(sunday.getDate() + 6);
    const weekNum = getWeekNumber(w.monday);

    // Programming phase
    const prog  = progLookup[`${w.monday.getFullYear()}-${weekNum}`];
    const phase = prog ? PROG_PHASES[prog.phase] : null;

    // Date range label
    const mondayStr = w.monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const sundayStr = sunday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    // Status badge
    let statusHtml = '';
    if (isCurrent) statusHtml = '<span class="bw-status bw-status-current">EN COURS</span>';
    else if (isFuture) statusHtml = '<span class="bw-status bw-status-future">À VENIR</span>';

    // Phase badge
    const phaseBadge = phase
      ? `<span class="bw-phase" style="background:${phase.color};">${phase.label}</span>`
      : '';

    // Day dots
    const dotsHtml = dayLabels.map((l, di) =>
      `<span class="bw-dot${w.bilansByDayIdx[di] ? ' filled' : ''}">${l}</span>`
    ).join('');

    // Summary stats
    const statsHtml = [
      { label: 'POIDS',     value: w.avgWeight !== null ? w.avgWeight.toFixed(1) + ' kg' : '—' },
      { label: 'Δ KG',      value: w.deltaKg !== null ? (w.deltaKg > 0 ? '+' : '') + w.deltaKg : '—',
        cls: w.deltaKg !== null ? (w.deltaKg < 0 ? 'bw-delta-neg' : w.deltaKg > 0 ? 'bw-delta-pos' : '') : '' },
      { label: 'SÉANCES',   value: w.totalSessions },
      { label: 'ÉNERGIE',   value: w.avgEnergy !== null ? w.avgEnergy.toFixed(1) + '/10' : '—' },
      { label: 'SOMMEIL',   value: w.avgSleep !== null ? w.avgSleep.toFixed(1) + '/10' : '—' },
      { label: 'STRESS',    value: w.avgStress !== null ? w.avgStress.toFixed(1) + '/10' : '—' },
    ].map(s => `
      <div class="bw-stat">
        <span class="bw-stat-label">${s.label}</span>
        <span class="bw-stat-value ${s.cls || ''}">${s.value}</span>
      </div>
    `).join('');

    // Card state
    const isOpen = isCurrent || idx === 0;
    const cardCls = ['bw-card'];
    if (isCurrent) cardCls.push('bw-current');
    if (isOpen) cardCls.push('bw-open');
    const borderLeft = phase ? `border-left:3px solid ${phase.color};` : '';

    // ── Expanded body ──
    // Nutrition objectives (per week — handles mid-week diet changes)
    const nutriPeriods = getNutriPeriodsForWeek(w.monday);
    let nutriHtml = '';
    if (nutriPeriods.length) {
      nutriHtml = nutriPeriods.map((period, pi) => {
        const showDate = nutriPeriods.length > 1;
        const dateLabel = showDate
          ? `<div class="bw-nutri-date">À partir du ${new Date(period.from + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>`
          : '';
        let items = '';
        if (period.training) {
          items += `<div class="bw-nutri-item">
            <span class="bw-nutri-label">Jour ON</span>
            <span>${period.training.calories_objectif || 0} kcal · P:${period.training.proteines || 0}g G:${period.training.glucides || 0}g L:${period.training.lipides || 0}g</span>
          </div>`;
        }
        if (period.rest) {
          items += `<div class="bw-nutri-item">
            <span class="bw-nutri-label">Jour OFF</span>
            <span>${period.rest.calories_objectif || 0} kcal · P:${period.rest.proteines || 0}g G:${period.rest.glucides || 0}g L:${period.rest.lipides || 0}g</span>
          </div>`;
        }
        return `<div class="bw-nutri${showDate ? ' bw-nutri-multi' : ''}">${dateLabel}<div class="bw-nutri-items">${items}</div></div>`;
      }).join('');
    }

    // Daily detail rows
    const sorted = [...w.bilans].sort((a, b) => a.date.localeCompare(b.date));

    let daysHtml = `<div class="bw-days-table">
      <div class="bw-day-hdr">
        <span class="bw-dh-date">DATE</span>
        <span class="bw-dh">POIDS</span>
        <span class="bw-dh">ÉNERGIE</span>
        <span class="bw-dh">SOMMEIL</span>
        <span class="bw-dh">STRESS</span>
        <span class="bw-dh">SÉANCES</span>
        <span class="bw-dh">ADHÉRENCE</span>
        <span class="bw-dh">PAS</span>
        <span class="bw-dh-end">NOTES</span>
      </div>`;

    sorted.forEach(b => {
      const d = new Date(b.date + 'T00:00:00');
      let di = d.getDay() - 1; if (di < 0) di = 6;
      const dayStr = dayNames[di] + ' ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

      const hasNotes = b.positives || b.negatives || b.general_notes;
      const noteId = 'bn-' + b.id;

      daysHtml += `<div class="bw-day-row">
        <span class="bw-dr-date">${dayStr}</span>
        <span class="bw-dr">${b.weight != null ? b.weight + ' kg' : '—'}</span>
        <span class="bw-dr">${bwTag(b.energy)}</span>
        <span class="bw-dr">${bwTag(b.sleep_quality)}</span>
        <span class="bw-dr">${bwTag(b.stress, true)}</span>
        <span class="bw-dr">${b.sessions_executed ?? '—'}</span>
        <span class="bw-dr">${b.adherence != null ? b.adherence + '%' : '—'}</span>
        <span class="bw-dr">${b.steps ? Number(b.steps).toLocaleString('fr-FR') : '—'}</span>
        <span class="bw-dr-end">${hasNotes ? `<button class="bw-note-btn" onclick="event.stopPropagation();document.getElementById('${noteId}').classList.toggle('open')"><i class="fas fa-comment-dots"></i></button>` : '—'}</span>
      </div>`;

      // Expandable notes sub-row
      if (hasNotes) {
        daysHtml += `<div class="bw-note-row" id="${noteId}">`;
        if (b.positives) daysHtml += `<div class="bw-note"><span class="bw-note-icon" style="color:var(--success);"><i class="fas fa-plus-circle"></i></span> ${escHtml(b.positives)}</div>`;
        if (b.negatives) daysHtml += `<div class="bw-note"><span class="bw-note-icon" style="color:var(--danger);"><i class="fas fa-minus-circle"></i></span> ${escHtml(b.negatives)}</div>`;
        if (b.general_notes) daysHtml += `<div class="bw-note"><span class="bw-note-icon" style="color:var(--text3);"><i class="fas fa-pen"></i></span> ${escHtml(b.general_notes)}</div>`;
        daysHtml += '</div>';
      }
    });
    daysHtml += '</div>';

    // ── Assemble card ──
    html += `
      <div class="${cardCls.join(' ')}" style="${borderLeft}">
        <div class="bw-header" onclick="toggleBilanWeek(this)">
          <div class="bw-header-top">
            <div class="bw-header-left">
              <span class="bw-week-label">S${weekNum} · ${mondayStr} — ${sundayStr}</span>
              ${phaseBadge}${statusHtml}
            </div>
            <div class="bw-header-right">
              <div class="bw-dots">${dotsHtml}</div>
              <i class="fas fa-chevron-down bw-chevron"></i>
            </div>
          </div>
          <div class="bw-stats">${statsHtml}</div>
        </div>
        <div class="bw-body">${nutriHtml}${daysHtml}</div>
      </div>`;
  });

  html += '</div>';
  el.innerHTML = html;
}

// ── Helpers ──

function bwAvg(bilans, field) {
  const vals = bilans.map(b => parseFloat(b[field])).filter(v => !isNaN(v) && v > 0);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function bwTag(value, inverted) {
  if (value == null || value === '') return '—';
  const v = parseFloat(value);
  if (isNaN(v)) return '—';
  let cls;
  if (!inverted) {
    cls = v >= 7 ? 'bw-tag-good' : v >= 5 ? 'bw-tag-ok' : 'bw-tag-bad';
  } else {
    cls = v <= 3 ? 'bw-tag-good' : v <= 5 ? 'bw-tag-ok' : 'bw-tag-bad';
  }
  return `<span class="bw-tag ${cls}">${v}/10</span>`;
}

function toggleBilanWeek(headerEl) {
  headerEl.closest('.bw-card').classList.toggle('bw-open');
}
