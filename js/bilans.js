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

  // Jour du bilan hebdo (0=lundi, ..., 6=dimanche)
  const bilanDay = currentAthleteObj.bilan_day ?? 0;

  if (!bilans.length) {
    el.innerHTML = '<div class="card"><div class="empty-state"><i class="fas fa-chart-line"></i><p>Aucun bilan enregistré</p><p style="font-size:12px;color:var(--text3);margin-top:8px;">L\'athlète doit remplir ses check-ins journaliers.</p></div></div>';
    return;
  }

  // ── Helpers ──

  function toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getMonday(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    return d;
  }

  // ── Group bilans by week ──

  const weeks = {};
  bilans.forEach(b => {
    const date = new Date(b.date + 'T00:00:00');
    const monday = getMonday(date);
    const key = toDateStr(monday);
    if (!weeks[key]) weeks[key] = { monday, bilans: [], bilansByDayIdx: {} };
    weeks[key].bilans.push(b);
    let dayIdx = date.getDay() - 1;
    if (dayIdx < 0) dayIdx = 6;
    weeks[key].bilansByDayIdx[dayIdx] = b;
  });

  const sortedKeys = Object.keys(weeks).sort().reverse();
  const todayMonday = toDateStr(getMonday(new Date()));

  // ── Programming weeks lookup ──

  const progLookup = {};
  progWeeks.forEach(pw => {
    if (pw.week_date) {
      const d = new Date(pw.week_date + 'T00:00:00');
      progLookup[`${d.getFullYear()}-${getWeekNumber(d)}`] = pw;
    }
  });

  // ── Nutrition plans (sorted for per-week lookup) ──

  const nutriSorted = nutriPlans.sort((a, b) => (b.valid_from || '').localeCompare(a.valid_from || ''));

  function getNutriPeriodsForWeek(weekMonday) {
    const mondayStr = toDateStr(weekMonday);
    const sunday = new Date(weekMonday);
    sunday.setDate(sunday.getDate() + 6);
    const sundayStr = toDateStr(sunday);

    const changeDates = [...new Set(
      nutriSorted
        .filter(p => p.valid_from && p.valid_from > mondayStr && p.valid_from <= sundayStr)
        .map(p => p.valid_from)
    )].sort();

    const timePoints = [mondayStr, ...changeDates];
    const periods = [];

    timePoints.forEach(dateStr => {
      const validAtDate = nutriSorted.filter(p => !p.valid_from || p.valid_from <= dateStr);
      const training = validAtDate.find(p => p.meal_type === 'training' || p.meal_type === 'entrainement') || validAtDate[0] || null;
      const rest = validAtDate.find(p => p.meal_type === 'rest' || p.meal_type === 'repos') || null;
      const last = periods[periods.length - 1];
      if (last && last.training?.id === training?.id && last.rest?.id === rest?.id) return;
      periods.push({ from: dateStr, training, rest });
    });
    return periods;
  }

  // ── Compute weekly data ──

  const weekData = sortedKeys.map(key => {
    const w = weeks[key];
    const bb = w.bilans;
    return {
      key, ...w,
      avgWeight:    bwAvg(bb, 'weight'),
      avgEnergy:    bwAvg(bb, 'energy'),
      avgSleep:     bwAvg(bb, 'sleep_quality'),
      avgStress:    bwAvg(bb, 'stress'),
      avgSoreness:  bwAvg(bb, 'soreness'),
      avgAdherence: bwAvg(bb, 'adherence'),
      totalSessions: bb.reduce((s, b) => s + (parseFloat(b.sessions_executed) || 0), 0),
      // Mensurations (latest non-null of the week)
      belly:  bwLast(bb, 'belly_measurement'),
      hip:    bwLast(bb, 'hip_measurement'),
      thigh:  bwLast(bb, 'thigh_measurement'),
      // Weekly notes
      positiveWeek: bwLastText(bb, 'positive_week'),
      negativeWeek: bwLastText(bb, 'negative_week'),
    };
  });

  // Weight & mensuration deltas
  weekData.forEach((w, i) => {
    const prev = weekData[i + 1];
    w.deltaKg    = (prev && w.avgWeight !== null && prev.avgWeight !== null) ? +(w.avgWeight - prev.avgWeight).toFixed(1) : null;
    w.deltaBelly = (prev && w.belly !== null && prev.belly !== null) ? +(w.belly - prev.belly).toFixed(1) : null;
    w.deltaHip   = (prev && w.hip !== null && prev.hip !== null) ? +(w.hip - prev.hip).toFixed(1) : null;
    w.deltaThigh = (prev && w.thigh !== null && prev.thigh !== null) ? +(w.thigh - prev.thigh).toFixed(1) : null;
  });

  // ── Render ──

  const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const dayNames  = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  let html = '<div class="bw-container">';

  weekData.forEach((w, idx) => {
    const isCurrent = w.key === todayMonday;
    const isFuture  = w.key > todayMonday;
    const sunday = new Date(w.monday);
    sunday.setDate(sunday.getDate() + 6);
    const weekNum = getWeekNumber(w.monday);

    const prog  = progLookup[`${w.monday.getFullYear()}-${weekNum}`];
    const phase = prog ? PROG_PHASES[prog.phase] : null;

    const mondayLabel = w.monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const sundayLabel = sunday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    let statusHtml = '';
    if (isCurrent) statusHtml = '<span class="bw-status bw-status-current">EN COURS</span>';
    else if (isFuture) statusHtml = '<span class="bw-status bw-status-future">À VENIR</span>';

    const phaseBadge = phase ? `<span class="bw-phase" style="background:${phase.color};">${phase.label}</span>` : '';

    const dotsHtml = dayLabels.map((l, di) =>
      `<span class="bw-dot${w.bilansByDayIdx[di] ? ' filled' : ''}">${l}</span>`
    ).join('');

    // ── Header stats ──
    const statsHtml = [
      { label: 'POIDS',     value: w.avgWeight !== null ? w.avgWeight.toFixed(1) + ' kg' : '—' },
      { label: 'Δ KG',      value: w.deltaKg !== null ? (w.deltaKg > 0 ? '+' : '') + w.deltaKg : '—',
        cls: w.deltaKg !== null ? (w.deltaKg < 0 ? 'bw-delta-neg' : w.deltaKg > 0 ? 'bw-delta-pos' : '') : '' },
      { label: 'SÉANCES',   value: w.totalSessions },
      { label: 'ÉNERGIE',   value: w.avgEnergy !== null ? w.avgEnergy.toFixed(1) + '/10' : '—' },
      { label: 'SOMMEIL',   value: w.avgSleep !== null ? w.avgSleep.toFixed(1) + '/10' : '—' },
      { label: 'STRESS',    value: w.avgStress !== null ? w.avgStress.toFixed(1) + '/10' : '—' },
      { label: 'COURB.',    value: w.avgSoreness !== null ? w.avgSoreness.toFixed(1) + '/10' : '—' },
    ].map(s => `
      <div class="bw-stat">
        <span class="bw-stat-label">${s.label}</span>
        <span class="bw-stat-value ${s.cls || ''}">${s.value}</span>
      </div>
    `).join('');

    const isOpen = isCurrent || idx === 0;
    const cardCls = ['bw-card'];
    if (isCurrent) cardCls.push('bw-current');
    if (isOpen) cardCls.push('bw-open');
    const borderLeft = phase ? `border-left:3px solid ${phase.color};` : '';

    // ── Nutrition periods ──
    const nutriPeriods = getNutriPeriodsForWeek(w.monday);
    let nutriHtml = '';
    if (nutriPeriods.length) {
      nutriHtml = nutriPeriods.map(period => {
        const showDate = nutriPeriods.length > 1;
        const dateLabel = showDate
          ? `<div class="bw-nutri-date">À partir du ${new Date(period.from + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>`
          : '';
        let items = '';
        if (period.training) {
          items += `<div class="bw-nutri-item"><span class="bw-nutri-label">Jour ON</span><span>${period.training.calories_objectif || 0} kcal · P:${period.training.proteines || 0}g G:${period.training.glucides || 0}g L:${period.training.lipides || 0}g</span></div>`;
        }
        if (period.rest) {
          items += `<div class="bw-nutri-item"><span class="bw-nutri-label">Jour OFF</span><span>${period.rest.calories_objectif || 0} kcal · P:${period.rest.proteines || 0}g G:${period.rest.glucides || 0}g L:${period.rest.lipides || 0}g</span></div>`;
        }
        return `<div class="bw-nutri${showDate ? ' bw-nutri-multi' : ''}">${dateLabel}<div class="bw-nutri-items">${items}</div></div>`;
      }).join('');
    }

    // ── Mensurations section ──
    let mensHtml = '';
    if (w.belly !== null || w.hip !== null || w.thigh !== null) {
      const items = [
        { label: 'Ventre', val: w.belly, delta: w.deltaBelly },
        { label: 'Hanches', val: w.hip, delta: w.deltaHip },
        { label: 'Cuisses', val: w.thigh, delta: w.deltaThigh },
      ].filter(m => m.val !== null).map(m => {
        const deltaStr = m.delta !== null ? ` <span class="${m.delta < 0 ? 'bw-delta-neg' : m.delta > 0 ? 'bw-delta-pos' : ''}">(${m.delta > 0 ? '+' : ''}${m.delta})</span>` : '';
        return `<div class="bw-mens-item"><span class="bw-mens-label">${m.label}</span><span class="bw-mens-val">${m.val} cm${deltaStr}</span></div>`;
      }).join('');
      mensHtml = `<div class="bw-mens">${items}</div>`;
    }

    // ── Weekly notes ──
    let weekNotesHtml = '';
    if (w.positiveWeek || w.negativeWeek) {
      weekNotesHtml = '<div class="bw-week-notes">';
      if (w.positiveWeek) weekNotesHtml += `<div class="bw-week-note"><span class="bw-week-note-icon" style="color:var(--success);"><i class="fas fa-plus-circle"></i></span><div><span class="bw-week-note-label">Point positif</span><span class="bw-week-note-text">${escHtml(w.positiveWeek)}</span></div></div>`;
      if (w.negativeWeek) weekNotesHtml += `<div class="bw-week-note"><span class="bw-week-note-icon" style="color:var(--danger);"><i class="fas fa-minus-circle"></i></span><div><span class="bw-week-note-label">À améliorer</span><span class="bw-week-note-text">${escHtml(w.negativeWeek)}</span></div></div>`;
      weekNotesHtml += '</div>';
    }

    // ── Daily detail grid ──
    const sorted = [...w.bilans].sort((a, b) => a.date.localeCompare(b.date));

    let daysHtml = `<div class="bw-days-table">
      <div class="bw-day-hdr">
        <span class="bw-dh-date">DATE</span>
        <span class="bw-dh">POIDS</span>
        <span class="bw-dh">ÉNERGIE</span>
        <span class="bw-dh">SOMMEIL</span>
        <span class="bw-dh">STRESS</span>
        <span class="bw-dh">COURB.</span>
        <span class="bw-dh">SÉANCES</span>
        <span class="bw-dh">ADHÉR.</span>
        <span class="bw-dh-end"></span>
      </div>`;

    sorted.forEach(b => {
      const d = new Date(b.date + 'T00:00:00');
      let di = d.getDay() - 1; if (di < 0) di = 6;
      const dayStr = dayNames[di] + ' ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      const noteId = 'bn-' + b.id;
      const isBilanDay = di === bilanDay;
      const hasPhotos = b.photo_front || b.photo_side || b.photo_back;
      const hasMens = b.belly_measurement || b.hip_measurement || b.thigh_measurement;
      const hasDetails = b.general_notes || b.cardio_minutes || b.steps || b.session_performance
        || b.session_enjoyment || b.bedtime || b.wakeup || b.sleep_efficiency || b.sick_signs
        || hasPhotos || hasMens;

      daysHtml += `<div class="bw-day-row${isBilanDay ? ' bw-bilan-day' : ''}">
        <span class="bw-dr-date">${dayStr}${isBilanDay ? ' <i class="fas fa-star" style="color:var(--warning);font-size:9px;"></i>' : ''}</span>
        <span class="bw-dr">${b.weight != null ? b.weight + ' kg' : '—'}</span>
        <span class="bw-dr">${bwTag(b.energy)}</span>
        <span class="bw-dr">${bwTag(b.sleep_quality)}</span>
        <span class="bw-dr">${bwTag(b.stress, true)}</span>
        <span class="bw-dr">${bwTag(b.soreness, true)}</span>
        <span class="bw-dr">${b.sessions_executed ?? '—'}</span>
        <span class="bw-dr">${bwTag(b.adherence)}</span>
        <span class="bw-dr-end">${hasDetails ? `<button class="bw-note-btn" onclick="event.stopPropagation();document.getElementById('${noteId}').classList.toggle('open')"><i class="fas fa-chevron-down"></i></button>` : ''}</span>
      </div>`;

      // Expandable detail sub-row
      if (hasDetails) {
        let details = '';

        // Photos (bilan day)
        if (hasPhotos) {
          details += `<div class="bw-photos">`;
          if (b.photo_front) details += `<div class="bw-photo"><div class="bw-photo-label">Face</div><img src="${b.photo_front}" alt="Face" onclick="window.open(this.src,'_blank')" onerror="this.parentElement.style.display='none'"></div>`;
          if (b.photo_side) details += `<div class="bw-photo"><div class="bw-photo-label">Profil</div><img src="${b.photo_side}" alt="Profil" onclick="window.open(this.src,'_blank')" onerror="this.parentElement.style.display='none'"></div>`;
          if (b.photo_back) details += `<div class="bw-photo"><div class="bw-photo-label">Dos</div><img src="${b.photo_back}" alt="Dos" onclick="window.open(this.src,'_blank')" onerror="this.parentElement.style.display='none'"></div>`;
          details += `</div>`;
        }

        // Mensurations (bilan day)
        if (hasMens) {
          details += '<div class="bw-detail-grid bw-detail-mens">';
          if (b.belly_measurement) details += `<div class="bw-detail-item"><span class="bw-detail-label">Ventre</span><span>${b.belly_measurement} cm</span></div>`;
          if (b.hip_measurement) details += `<div class="bw-detail-item"><span class="bw-detail-label">Hanches</span><span>${b.hip_measurement} cm</span></div>`;
          if (b.thigh_measurement) details += `<div class="bw-detail-item"><span class="bw-detail-label">Cuisses</span><span>${b.thigh_measurement} cm</span></div>`;
          details += '</div>';
        }

        // Other metrics
        details += '<div class="bw-detail-grid">';
        if (b.session_performance != null) details += `<div class="bw-detail-item"><span class="bw-detail-label">Performance</span>${bwTag(b.session_performance)}</div>`;
        if (b.session_enjoyment != null) details += `<div class="bw-detail-item"><span class="bw-detail-label">Plaisir</span>${bwTag(b.session_enjoyment)}</div>`;
        if (b.cardio_minutes != null) details += `<div class="bw-detail-item"><span class="bw-detail-label">Cardio</span><span>${b.cardio_minutes} min</span></div>`;
        if (b.steps != null) details += `<div class="bw-detail-item"><span class="bw-detail-label">Pas</span><span>${Number(b.steps).toLocaleString('fr-FR')}</span></div>`;
        if (b.bedtime) details += `<div class="bw-detail-item"><span class="bw-detail-label">Coucher</span><span>${b.bedtime.slice(0, 5)}</span></div>`;
        if (b.wakeup) details += `<div class="bw-detail-item"><span class="bw-detail-label">Réveil</span><span>${b.wakeup.slice(0, 5)}</span></div>`;
        if (b.sleep_efficiency != null) details += `<div class="bw-detail-item"><span class="bw-detail-label">Eff. sommeil</span><span>${b.sleep_efficiency}%</span></div>`;
        if (b.sick_signs) details += `<div class="bw-detail-item"><span class="bw-detail-label">Maladie</span><span style="color:var(--danger);">Oui</span></div>`;
        details += '</div>';
        if (b.general_notes) details += `<div class="bw-detail-note"><i class="fas fa-pen" style="color:var(--text3);margin-right:6px;font-size:11px;"></i>${escHtml(b.general_notes)}</div>`;

        daysHtml += `<div class="bw-note-row" id="${noteId}">${details}</div>`;
      }
    });
    daysHtml += '</div>';

    // ── Assemble card ──
    html += `
      <div class="${cardCls.join(' ')}" style="${borderLeft}">
        <div class="bw-header" onclick="toggleBilanWeek(this)">
          <div class="bw-header-top">
            <div class="bw-header-left">
              <span class="bw-week-label">S${weekNum} · ${mondayLabel} — ${sundayLabel}</span>
              ${phaseBadge}${statusHtml}
            </div>
            <div class="bw-header-right">
              <div class="bw-dots">${dotsHtml}</div>
              <i class="fas fa-chevron-down bw-chevron"></i>
            </div>
          </div>
          <div class="bw-stats">${statsHtml}</div>
        </div>
        <div class="bw-body">
          ${nutriHtml}${mensHtml}${weekNotesHtml}${daysHtml}
        </div>
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

function bwLast(bilans, field) {
  const sorted = [...bilans].sort((a, b) => b.date.localeCompare(a.date));
  const found = sorted.find(b => b[field] != null && b[field] !== '');
  return found ? parseFloat(found[field]) : null;
}

function bwLastText(bilans, field) {
  const sorted = [...bilans].sort((a, b) => b.date.localeCompare(a.date));
  const found = sorted.find(b => b[field] && b[field].trim());
  return found ? found[field].trim() : null;
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
