// ===== BILANS TAB — Weekly Accordion =====

function _bilanParseExs(data) {
  try { return (typeof data === 'string' ? JSON.parse(data) : data) || []; } catch { return []; }
}

async function loadAthleteTabBilans() {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i></div>';

  if (!currentAthleteObj) {
    el.innerHTML = '<div class="card"><div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Athlète non sélectionné</p></div></div>';
    return;
  }

  // Fetch data in parallel
  const [bilansRes, progRes, nutriRes, phasesRes, wlogsRes] = await Promise.all([
    supabaseClient.from('daily_reports').select('*').eq('user_id', currentAthleteObj.user_id).order('date', { ascending: false }),
    supabaseClient.from('programming_weeks').select('*').eq('athlete_id', currentAthleteId).order('week_date'),
    supabaseClient.from('nutrition_plans').select('*').eq('athlete_id', currentAthleteId),
    supabaseClient.from('roadmap_phases').select('*').eq('athlete_id', currentAthleteId).order('start_date'),
    supabaseClient.from('workout_logs').select('id, date, session_id, session_name, titre, type, started_at, finished_at, exercices_completes').eq('athlete_id', currentAthleteId).order('date', { ascending: false }),
  ]);

  if (bilansRes.error) { devLog('bilans fetch error:', bilansRes.error); }
  if (progRes.error) { devLog('programming_weeks fetch error:', progRes.error); }
  if (nutriRes.error) { devLog('nutrition_plans fetch error:', nutriRes.error); }
  if (phasesRes.error) { devLog('roadmap_phases fetch error:', phasesRes.error); }

  const bilans = bilansRes.data || [];
  const allWLogs = wlogsRes.data || [];
  // Index workout logs by date for fast lookup
  const wlogsByDate = {};
  allWLogs.forEach(l => { if (!wlogsByDate[l.date]) wlogsByDate[l.date] = []; wlogsByDate[l.date].push(l); });

  const roadmapPhases = (phasesRes.data || []).sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
  const progWeeks = progRes.data || [];
  const nutriPlans = nutriRes.data || [];

  // Complete bilan scheduling config
  const _cbFreq = currentAthleteObj.complete_bilan_frequency || 'weekly';
  const _cbIntv = currentAthleteObj.complete_bilan_interval || 7;
  const _cbDay = currentAthleteObj.complete_bilan_day ?? 0;
  const _cbAnchor = currentAthleteObj.complete_bilan_anchor_date;
  const _cbMonthDay = currentAthleteObj.complete_bilan_month_day || 1;

  // Build photo history — resolve paths to signed URLs
  window._photoHistory = { front: [], side: [], back: [] };
  const photoPromises = [];
  bilans.forEach(b => {
    ['front', 'side', 'back'].forEach(pos => {
      const raw = b['photo_' + pos];
      if (!raw) return;
      // If it's already a full URL (legacy), extract the path after /athlete-photos/
      let path = raw;
      const bucketMarker = '/athlete-photos/';
      const idx = raw.indexOf(bucketMarker);
      if (idx !== -1) {
        path = raw.substring(idx + bucketMarker.length).split('?')[0];
      }
      photoPromises.push(
        supabaseClient.storage
          .from('athlete-photos')
          .createSignedUrl(path, 3600)
          .then(({ data, error }) => {
            if (data?.signedUrl) {
              window._photoHistory[pos].push({ date: b.date, url: data.signedUrl });
            } else if (raw.startsWith('http')) {
              // Fallback: use raw URL directly if signing fails
              window._photoHistory[pos].push({ date: b.date, url: raw });
            }
          })
      );
    });
  });
  await Promise.all(photoPromises);
  Object.values(window._photoHistory).forEach(arr => arr.sort((a, b) => a.date.localeCompare(b.date)));

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

  // ── Inject days with workout_logs but no bilan ──
  const bilanDates = new Set(bilans.map(b => b.date));
  const wlogDates = Object.keys(wlogsByDate).filter(d => !bilanDates.has(d));
  wlogDates.forEach(d => {
    // Create a minimal pseudo-bilan so the day appears in the table
    bilans.push({ date: d, _autoOnly: true });
  });

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

  // Compute phase counters
  let _lastPh = null, _phCtr = 0;
  progWeeks.forEach(pw => {
    if (pw.phase && pw.phase === _lastPh) { _phCtr++; }
    else if (pw.phase) { _phCtr = 1; _lastPh = pw.phase; }
    else { _phCtr = 0; _lastPh = null; }
    pw._phaseNum = _phCtr;
  });

  const progLookup = {};
  progWeeks.forEach(pw => {
    if (pw.week_date) {
      // Use raw date string directly (already a Monday YYYY-MM-DD)
      const key = String(pw.week_date).substring(0, 10);
      progLookup[key] = pw;
    }
  });

  // ── Nutrition plans (sorted for per-week lookup) ──

  const nutriSorted = nutriPlans.sort((a, b) => (b.valid_from || '').localeCompare(a.valid_from || '') || (b.created_at || '').localeCompare(a.created_at || ''));

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
      const training = validAtDate.find(p => p.meal_type === 'training' || p.meal_type === 'entrainement') || null;
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
      totalSessions: bb.filter(b => (wlogsByDate[b.date] || []).length > 0).length,
      avgSteps:     bwAvg(bb, 'steps'),
      avgEnjoyment: bwAvg(bb, 'session_enjoyment'),
      totalCardio:  bb.reduce((s, b) => s + (b.cardio_minutes || 0), 0),
      anySick:      bb.some(b => b.sick_signs),
      perfSummary:  (() => {
        const perfs = [];
        bb.forEach(b => {
          (wlogsByDate[b.date] || []).forEach(log => {
            const prev = allWLogs.find(l => l.session_id && l.session_id === log.session_id && l.date < log.date);
            if (!prev) return;
            const curExs = _bilanParseExs(log.exercices_completes);
            const prevExs = _bilanParseExs(prev.exercices_completes);
            let cv = 0, pv = 0;
            curExs.forEach(e => { (e.series || []).forEach(s => { cv += (parseFloat(s.reps)||0) * (parseFloat(s.kg||s.charge||s.load)||1); }); });
            prevExs.forEach(e => { (e.series || []).forEach(s => { pv += (parseFloat(s.reps)||0) * (parseFloat(s.kg||s.charge||s.load)||1); }); });
            if (pv === 0) return;
            const ratio = cv / pv;
            if (ratio > 1.02) perfs.push('Progrès');
            else if (ratio < 0.98) perfs.push('Régression');
            else perfs.push('Maintien');
          });
        });
        if (!perfs.length) return null;
        const p = perfs.filter(x => x === 'Progrès').length;
        const r = perfs.filter(x => x === 'Régression').length;
        const s = perfs.length - p - r;
        return { p, s, r };
      })(),
      sessionNames: bb.filter(b => b.sessions_executed && b.sessions_executed !== '0' && isNaN(b.sessions_executed)).map(b => b.sessions_executed),
      // Mensurations (latest non-null of the week)
      belly:  bwLast(bb, 'belly_measurement'),
      hip:    bwLast(bb, 'hip_measurement'),
      thigh:  bwLast(bb, 'thigh_measurement'),
      // Weekly notes (all entries, sorted by date)
      positiveWeeks: bwAllTexts(bb, 'positive_week'),
      negativeWeeks: bwAllTexts(bb, 'negative_week'),
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

    const prog  = progLookup[w.key];
    let phase = prog ? PROG_PHASES[prog.phase] : null;
    let phaseCounter = prog?._phaseNum ? ` S${prog._phaseNum}` : '';

    // Fallback: use roadmap_phases if programming_weeks is empty
    if (!phase && roadmapPhases.length) {
      const mondayStr = w.key;
      const sundayStr = toDateStr(sunday);
      const rp = roadmapPhases.find(p => p.start_date && p.start_date <= sundayStr && (!p.end_date || p.end_date >= mondayStr));
      if (rp) {
        phase = PROG_PHASES[rp.phase] || { label: rp.name || rp.phase, short: rp.name || rp.phase, color: 'var(--primary)' };
        // Calculate week number within this phase
        const phaseStart = new Date(rp.start_date + 'T00:00:00');
        const weeksSinceStart = Math.floor((w.monday - phaseStart) / (7 * MS_PER_DAY)) + 1;
        phaseCounter = ` S${weeksSinceStart}`;
      }
    }

    const mondayLabel = w.monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const sundayLabel = sunday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    let statusHtml = '';
    if (isCurrent) statusHtml = '<span class="bw-status bw-status-current">EN COURS</span>';
    else if (isFuture) statusHtml = '<span class="bw-status bw-status-future">À VENIR</span>';

    const phaseBadge = phase ? `<span class="bw-phase" style="background:${phase.color};">${phase.short || phase.label}${phaseCounter}</span>` : '';

    const dotsHtml = dayLabels.map((l, di) =>
      `<span class="bw-dot${w.bilansByDayIdx[di] ? ' filled' : ''}">${l}</span>`
    ).join('');

    // ── Header stats (grid-aligned with daily table) ──
    const perfAvgHdr = (() => {
      if (!w.perfSummary) return '—';
      const { p, s, r } = w.perfSummary;
      let parts = [];
      if (p) parts.push(`<span style="color:var(--success);">${p}↑</span>`);
      if (s) parts.push(`<span style="color:var(--warning);">${s}→</span>`);
      if (r) parts.push(`<span style="color:var(--danger);">${r}↓</span>`);
      return parts.join(' ');
    })();

    const deltaHtml = w.deltaKg !== null
      ? `<span class="bw-stat-sub ${w.deltaKg < 0 ? 'bw-delta-neg' : w.deltaKg > 0 ? 'bw-delta-pos' : ''}">${w.deltaKg > 0 ? '+' : ''}${w.deltaKg}</span>`
      : '';

    const statsHtml = `
      <div class="bw-stat"></div>
      <div class="bw-stat"><span class="bw-stat-label">POIDS</span><span class="bw-stat-value">${w.avgWeight !== null ? w.avgWeight.toFixed(1) : '—'}${deltaHtml}</span></div>
      <div class="bw-stat"><span class="bw-stat-label">ADHÉR.</span><span class="bw-stat-value">${bwStatVal(w.avgAdherence)}</span></div>
      <div class="bw-stat"><span class="bw-stat-label">SÉANCES</span><span class="bw-stat-value">${w.totalSessions}</span></div>
      <div class="bw-stat"><span class="bw-stat-label">PERF.</span><span class="bw-stat-value">${perfAvgHdr}</span></div>
      <div class="bw-stat"><span class="bw-stat-label">PLAISIR</span><span class="bw-stat-value">${bwStatVal(w.avgEnjoyment)}</span></div>
      <div class="bw-stat"><span class="bw-stat-label">CARDIO</span><span class="bw-stat-value">${w.totalCardio ? w.totalCardio + '\'' : '—'}</span></div>
      <div class="bw-stat"><span class="bw-stat-label">COURB.</span><span class="bw-stat-value">${bwStatVal(w.avgSoreness, true)}</span></div>
      <div class="bw-stat"><span class="bw-stat-label">STRESS</span><span class="bw-stat-value">${bwStatVal(w.avgStress, true)}</span></div>
      <div class="bw-stat"><span class="bw-stat-label">ÉNERGIE</span><span class="bw-stat-value">${bwStatVal(w.avgEnergy)}</span></div>
      <div class="bw-stat"><span class="bw-stat-label">MALAD.</span><span class="bw-stat-value">${w.anySick ? '<i class="fas fa-triangle-exclamation" style="color:var(--danger);"></i>' : '<i class="fas fa-check" style="color:var(--success);"></i>'}</span></div>
      <div class="bw-stat"><span class="bw-stat-label">SOMMEIL</span><span class="bw-stat-value">${bwStatVal(w.avgSleep)}</span></div>
      <div class="bw-stat"><span class="bw-stat-label">PAS</span><span class="bw-stat-value">${w.avgSteps !== null ? Math.round(w.avgSteps).toLocaleString('fr-FR') : '—'}</span></div>
      <div class="bw-stat"></div>`;

    const isOpen = isCurrent || idx === 0;
    const cardCls = ['bw-card'];
    if (isCurrent) cardCls.push('bw-current');
    if (isOpen) cardCls.push('bw-open');
    const borderLeft = phase ? `border-left:3px solid ${phase.color};` : '';

    // ── Phase + Nutrition header (like RD Coaching) ──
    const phaseTitle = '';
    const nutriPeriods = getNutriPeriodsForWeek(w.monday);
    let nutriHtml = '';
    if (nutriPeriods.length || phaseTitle) {
      let nutriContent = phaseTitle;
      nutriContent += nutriPeriods.map((period, pIdx) => {
        const showDate = nutriPeriods.length > 1;
        const periodName = period.training?.nom || period.rest?.nom || '';
        const prevName = pIdx > 0 ? (nutriPeriods[pIdx-1].training?.nom || nutriPeriods[pIdx-1].rest?.nom || '') : '';
        const nameChanged = pIdx === 0 || periodName !== prevName;
        const dietLabel = nameChanged && periodName ? `<span style="font-weight:600;color:var(--text1);margin-right:6px;">${escHtml(periodName)}</span>` : '';
        const dateLabel = showDate
          ? `<div class="bw-nutri-date">${dietLabel}À partir du ${new Date(period.from + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>`
          : (dietLabel ? `<div class="bw-nutri-date">${dietLabel}</div>` : '');
        let items = '';
        if (period.training) {
          items += `<div class="bw-nutri-item"><span class="bw-nutri-label">Jour ON</span><span>${period.training.calories_objectif || 0} kcal · P:${period.training.proteines || 0}g G:${period.training.glucides || 0}g L:${period.training.lipides || 0}g</span></div>`;
        }
        if (period.rest) {
          items += `<div class="bw-nutri-item"><span class="bw-nutri-label">Jour OFF</span><span>${period.rest.calories_objectif || 0} kcal · P:${period.rest.proteines || 0}g G:${period.rest.glucides || 0}g L:${period.rest.lipides || 0}g</span></div>`;
        }
        return `<div class="bw-nutri${showDate ? ' bw-nutri-multi' : ''}">${dateLabel}<div class="bw-nutri-items">${items}</div></div>`;
      }).join('');
      nutriHtml = nutriContent;
    }

    // ── Weekly notes (all daily entries) ──
    let weekNotesHtml = '';
    const hasPos = w.positiveWeeks && w.positiveWeeks.length;
    const hasNeg = w.negativeWeeks && w.negativeWeeks.length;
    if (hasPos || hasNeg) {
      weekNotesHtml = '<div class="bw-week-notes">';
      if (hasPos) {
        weekNotesHtml += `<div class="bw-week-note"><span class="bw-week-note-icon" style="color:var(--success);"><i class="fas fa-plus-circle"></i></span><div><span class="bw-week-note-label">Points positifs</span>`;
        w.positiveWeeks.forEach(e => {
          weekNotesHtml += `<span class="bw-week-note-text"><strong style="color:var(--text2);margin-right:6px;">${e.date}</strong>${escHtml(e.text)}</span>`;
        });
        weekNotesHtml += '</div></div>';
      }
      if (hasNeg) {
        weekNotesHtml += `<div class="bw-week-note"><span class="bw-week-note-icon" style="color:var(--danger);"><i class="fas fa-minus-circle"></i></span><div><span class="bw-week-note-label">À améliorer</span>`;
        w.negativeWeeks.forEach(e => {
          weekNotesHtml += `<span class="bw-week-note-text"><strong style="color:var(--text2);margin-right:6px;">${e.date}</strong>${escHtml(e.text)}</span>`;
        });
        weekNotesHtml += '</div></div>';
      }
      weekNotesHtml += '</div>';
    }

    // ── Daily detail grid ──
    const sorted = [...w.bilans].sort((a, b) => a.date.localeCompare(b.date));

    let daysHtml = `<div class="bw-days-table">
      <div class="bw-day-hdr">
        <span class="bw-dh-date">DATE</span>
        <span class="bw-dh">POIDS</span>
        <span class="bw-dh">ADHÉR.</span>
        <span class="bw-dh">SÉANCE</span>
        <span class="bw-dh">PERF.</span>
        <span class="bw-dh">PLAISIR</span>
        <span class="bw-dh">CARDIO</span>
        <span class="bw-dh">COURB.</span>
        <span class="bw-dh">STRESS</span>
        <span class="bw-dh">ÉNERGIE</span>
        <span class="bw-dh">MALAD.</span>
        <span class="bw-dh">SOMM.</span>
        <span class="bw-dh">NUIT</span>
        <span class="bw-dh-end"></span>
      </div>`;

    sorted.forEach(b => {
      const d = new Date(b.date + 'T00:00:00');
      let di = d.getDay() - 1; if (di < 0) di = 6;
      const dayStr = dayNames[di] + ' ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      const noteId = 'bn-' + b.id;
      const isBilanDay = isBilanDate(b.date, _cbFreq, _cbIntv, _cbDay, _cbAnchor, _cbMonthDay);
      const hasPhotos = b.photo_front || b.photo_side || b.photo_back;
      const hasMens = b.belly_measurement || b.hip_measurement || b.thigh_measurement;
      const hasDetails = b.general_notes || b.steps
        || hasPhotos || hasMens;

      // Session name — computed from workout_logs
      const dayLogs = wlogsByDate[b.date] || [];
      let sessionCell = '—';
      if (dayLogs.length) {
        const names = dayLogs.map(l => l.session_name || l.titre || 'Séance').filter(Boolean);
        sessionCell = `<span style="font-size:10px;font-weight:600;color:var(--primary);">${escHtml(names.join(', '))}</span>`;
      }

      // Performance — compare with previous log of same session
      let perfCell = '—';
      if (dayLogs.length) {
        const perfs = dayLogs.map(log => {
          const prevLog = allWLogs.find(l => l.session_id && l.session_id === log.session_id && l.date < log.date);
          if (!prevLog) return null;
          const curExs = _bilanParseExs(log.exercices_completes);
          const prevExs = _bilanParseExs(prevLog.exercices_completes);
          let curVol = 0, prevVol = 0;
          curExs.forEach(e => { (e.series || []).forEach(s => { curVol += (parseFloat(s.reps) || 0) * (parseFloat(s.kg || s.charge || s.load) || 1); }); });
          prevExs.forEach(e => { (e.series || []).forEach(s => { prevVol += (parseFloat(s.reps) || 0) * (parseFloat(s.kg || s.charge || s.load) || 1); }); });
          if (prevVol === 0) return null;
          const ratio = curVol / prevVol;
          if (ratio > 1.02) return 'Progrès';
          if (ratio < 0.98) return 'Régression';
          return 'Maintien';
        }).filter(Boolean);
        if (perfs.length) {
          const best = perfs.includes('Progrès') ? 'Progrès' : perfs.includes('Régression') ? 'Régression' : 'Maintien';
          const pc = best === 'Progrès' ? 'var(--success)' : best === 'Régression' ? 'var(--danger)' : 'var(--warning)';
          perfCell = `<span style="font-size:10px;font-weight:600;color:${pc};">${best}</span>`;
        }
      }

      daysHtml += `<div class="bw-day-row${isBilanDay ? ' bw-bilan-day' : ''}">
        <span class="bw-dr-date">${dayStr}${isBilanDay ? ' <i class="fas fa-star" style="color:var(--warning);font-size:9px;"></i>' : ''}</span>
        <span class="bw-dr">${b.weight != null ? b.weight : '—'}</span>
        <span class="bw-dr">${bwTag(b.adherence)}</span>
        <span class="bw-dr">${sessionCell}</span>
        <span class="bw-dr">${perfCell}</span>
        <span class="bw-dr">${bwTag(b.session_enjoyment)}</span>
        <span class="bw-dr">${b.cardio_minutes != null ? b.cardio_minutes + '\'' : '—'}</span>
        <span class="bw-dr">${bwTag(b.soreness, true)}</span>
        <span class="bw-dr">${bwTag(b.stress, true)}</span>
        <span class="bw-dr">${bwTag(b.energy)}</span>
        <span class="bw-dr">${b.sick_signs ? '<i class="fas fa-triangle-exclamation" style="color:var(--danger);font-size:10px;"></i>' : '—'}</span>
        <span class="bw-dr">${bwTag(b.sleep_quality)}</span>
        <span class="bw-dr bw-dr-nuit">${b.bedtime && b.wakeup ? `<span style="font-size:10px;">${b.bedtime.slice(0,5)}<span style="color:var(--text3);margin:0 1px;">→</span>${b.wakeup.slice(0,5)}</span>` : '—'}</span>
        <span class="bw-dr-end" style="display:flex;align-items:center;justify-content:flex-end;gap:2px;">${hasPhotos ? `<button class="bw-note-btn" onclick="event.stopPropagation();openPhotoCompare('front','${b.date}')" title="Photos"><i class="fas fa-camera" style="color:var(--primary);font-size:11px;"></i></button>` : ''}${hasDetails ? `<button class="bw-note-btn" onclick="event.stopPropagation();document.getElementById('${noteId}').classList.toggle('open')"><i class="fas fa-chevron-down"></i></button>` : ''}<button class="bw-note-btn" onclick="event.stopPropagation();deleteBilan('${b.id}','${b.date}')" title="Supprimer ce bilan" style="margin-left:2px;"><i class="fas fa-trash" style="color:var(--danger);font-size:10px;opacity:0.5;"></i></button></span>
      </div>`;

      // Expandable detail sub-row
      if (hasDetails) {
        let details = '';

        // Photos accessible via camera icon on the row

        // Mensurations charts (inside day dropdown)
        if (hasMens) {
          details += buildMensCharts(bilans, b.date, b.id);
        }

        // Other metrics (only items not shown in main columns)
        let detailItems = '';
        if (b.steps != null) detailItems += `<div class="bw-detail-item"><span class="bw-detail-label">Pas</span><span>${Number(b.steps).toLocaleString('fr-FR')}</span></div>`;
        if (detailItems) details += `<div class="bw-detail-grid">${detailItems}</div>`;
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
              <button class="bo-action-btn" style="color:var(--success);font-size:12px;" onclick="event.stopPropagation();openBilanTraitePopup('${currentAthleteObj.user_id}','${escHtml(currentAthleteObj.prenom)}')" title="Bilan traité"><i class="fas fa-check-circle"></i></button>
              <div class="bw-dots">${dotsHtml}</div>
              <i class="fas fa-chevron-down bw-chevron"></i>
            </div>
          </div>
          <div class="bw-stats">${statsHtml}</div>
        </div>
        <div class="bw-body">
          ${nutriHtml}${weekNotesHtml}${daysHtml}
        </div>
      </div>`;
  });

  html += '</div>';
  el.innerHTML = html;
  initMensChartTooltips();
}

// ── Delete bilan ──

async function deleteBilan(bilanId, date) {
  if (!confirm(`Supprimer le bilan du ${date} ?`)) return;
  try {
    const { error, count } = await supabaseClient.from('daily_reports').delete({ count: 'exact' }).eq('id', bilanId);
    if (error) throw error;
    if (count === 0) {
      notify('Impossible de supprimer ce bilan (permission refusée). Ajoutez la policy RLS coach_delete_athlete_bilans.', 'error');
      return;
    }
    notify('Bilan supprimé', 'success');
    loadAthleteTabBilans();
  } catch (err) {
    handleError(err, 'deleteBilan');
  }
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

function bwAllTexts(bilans, field) {
  return [...bilans]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter(b => b[field] && b[field].trim())
    .map(b => {
      const d = new Date(b.date);
      const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
      const label = days[d.getUTCDay()] + ' ' + d.getUTCDate();
      return { date: label, text: b[field].trim() };
    });
}

function bwStatVal(val, inverted) {
  if (val == null) return '—';
  const v = val.toFixed(1);
  let color;
  if (!inverted) {
    color = val >= 7 ? 'var(--success)' : val >= 5 ? 'var(--warning)' : 'var(--danger)';
  } else {
    color = val <= 3 ? 'var(--success)' : val <= 5 ? 'var(--warning)' : 'var(--danger)';
  }
  return `<span style="color:${color};">${v}</span>`;
}

function bwAvgTag(val, inverted) {
  if (val == null) return '—';
  const v = val.toFixed(1);
  let cls;
  if (!inverted) {
    cls = val >= 7 ? 'bw-tag-good' : val >= 5 ? 'bw-tag-ok' : 'bw-tag-bad';
  } else {
    cls = val <= 3 ? 'bw-tag-good' : val <= 5 ? 'bw-tag-ok' : 'bw-tag-bad';
  }
  return `<span class="bw-tag ${cls}" style="font-size:10px;">${v}</span>`;
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

// ===== PHOTO COMPARE VIEWER =====

function openPhotoCompare(type, currentDate) {
  const photos = window._photoHistory[type];
  if (!photos || !photos.length) return;

  const rightIdx = photos.findIndex(p => p.date === currentDate);
  if (rightIdx < 0) return;

  let leftIdx = rightIdx - 1;
  if (leftIdx < 0) leftIdx = 0;

  window._pcState = { type, photos, rightIdx, leftIdx };

  // Create overlay if not exists
  if (!document.getElementById('photo-compare-overlay')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="photo-compare-overlay" class="pc-overlay" onclick="if(event.target===this)closePhotoCompare()">
        <div class="pc-viewer">
          <div class="pc-header">
            <div class="pc-tabs" id="pc-tabs"></div>
            <button class="pc-close" onclick="closePhotoCompare()"><i class="fas fa-times"></i></button>
          </div>
          <div class="pc-body">
            <div class="pc-side pc-left">
              <button class="pc-nav pc-nav-prev" id="pc-prev" onclick="pcNavigate(-1)"><i class="fas fa-chevron-left"></i></button>
              <div class="pc-img-wrap">
                <img id="pc-img-left" src="" alt="">
                <div class="pc-date" id="pc-date-left"></div>
              </div>
              <button class="pc-nav pc-nav-next" id="pc-next" onclick="pcNavigate(1)"><i class="fas fa-chevron-right"></i></button>
            </div>
            <div class="pc-divider"></div>
            <div class="pc-side pc-right">
              <div class="pc-img-wrap">
                <img id="pc-img-right" src="" alt="">
                <div class="pc-date" id="pc-date-right"></div>
              </div>
              <div class="pc-badge-current">ACTUEL</div>
            </div>
          </div>
        </div>
      </div>
    `);
  }

  document.getElementById('photo-compare-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderPhotoCompare();
}

function renderPhotoCompare() {
  const { type, photos, rightIdx, leftIdx } = window._pcState;
  const typeLabels = { front: 'Face', side: 'Profil', back: 'Dos' };
  const typeIcons = { front: 'fa-user', side: 'fa-user-alt', back: 'fa-user-alt-slash' };

  // Tabs
  const tabsEl = document.getElementById('pc-tabs');
  tabsEl.innerHTML = ['front', 'side', 'back'].map(t => {
    const hasPhotos = window._photoHistory[t].length > 0;
    const active = t === type ? 'active' : '';
    return hasPhotos
      ? `<button class="pc-tab ${active}" onclick="pcSwitchType('${t}')"><i class="fas ${typeIcons[t]}"></i> ${typeLabels[t]}</button>`
      : '';
  }).join('');

  // Right photo (current)
  const right = photos[rightIdx];
  document.getElementById('pc-img-right').src = right.url;
  document.getElementById('pc-date-right').textContent = formatBilanDate(right.date);

  // Left photo (comparison)
  const left = photos[leftIdx];
  const imgLeft = document.getElementById('pc-img-left');
  imgLeft.classList.add('pc-fade');
  setTimeout(() => {
    imgLeft.src = left.url;
    document.getElementById('pc-date-left').textContent = formatBilanDate(left.date);
    imgLeft.classList.remove('pc-fade');
  }, 150);

  // Navigation buttons state
  document.getElementById('pc-prev').disabled = leftIdx <= 0;
  document.getElementById('pc-next').disabled = leftIdx >= rightIdx;
}

function pcNavigate(dir) {
  const s = window._pcState;
  const newIdx = s.leftIdx + dir;
  if (newIdx < 0 || newIdx > s.rightIdx) return;
  s.leftIdx = newIdx;
  renderPhotoCompare();
}

function pcSwitchType(type) {
  const photos = window._photoHistory[type];
  if (!photos.length) return;
  const s = window._pcState;

  // Find the closest date to the current right photo in the new type
  const currentDate = s.photos[s.rightIdx].date;
  let rightIdx = photos.findIndex(p => p.date === currentDate);
  if (rightIdx < 0) rightIdx = photos.length - 1;

  let leftIdx = s.leftIdx;
  if (leftIdx >= rightIdx) leftIdx = rightIdx - 1;
  if (leftIdx < 0) leftIdx = 0;

  window._pcState = { type, photos, rightIdx, leftIdx };
  renderPhotoCompare();
}

function closePhotoCompare() {
  const overlay = document.getElementById('photo-compare-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function formatBilanDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

// ===== MENSURATION CHARTS =====

function buildMensCharts(bilans, upToDate, weekKey) {
  // Filter bilans up to this week's Sunday
  const filtered = bilans.filter(b => b.date <= upToDate);
  const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));
  const suffix = weekKey.replace(/-/g, '');
  const metrics = [
    { key: 'belly_measurement', label: 'Ventre', icon: 'fa-ruler-horizontal', color: '#E85D04' },
    { key: 'hip_measurement', label: 'Hanches', icon: 'fa-ruler-combined', color: '#7209B7' },
    { key: 'thigh_measurement', label: 'Cuisses', icon: 'fa-ruler', color: '#0096C7' },
  ];

  let chartsHtml = '';
  metrics.forEach(m => {
    const uid = m.key + '_' + suffix;
    const points = [];
    sorted.forEach(b => {
      const v = parseFloat(b[m.key]);
      if (!isNaN(v) && v > 0) {
        const d = new Date(b.date + 'T00:00:00');
        points.push({
          date: b.date,
          value: v,
          label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        });
      }
    });
    if (points.length < 2) return;

    const values = points.map(p => p.value);
    const vMin = Math.min(...values);
    const vMax = Math.max(...values);
    const range = vMax - vMin || 1;
    const pad = 0.08;
    const yScale = (v) => 100 - ((v - vMin) / range) * (100 * (1 - 2 * pad)) - 100 * pad;
    const VB_X = -12, VB_W = 116;

    const pts = points.map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = yScale(p.value);
      return { xf: x.toFixed(2), yf: y.toFixed(2) };
    });
    const lineStr = pts.map(p => `${p.xf},${p.yf}`).join(' ');
    const fillStr = lineStr + ` ${pts[pts.length-1].xf},104 ${pts[0].xf},104`;

    const yLabels = [];
    const step = range > 4 ? Math.ceil(range / 3) : range > 1 ? 1 : 0.5;
    for (let v = Math.floor(vMin); v <= Math.ceil(vMax); v += step) {
      const y = yScale(v);
      yLabels.push(`<line x1="0" y1="${y}" x2="100" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="0.5" vector-effect="non-scaling-stroke"/>`);
      yLabels.push(`<text x="-2" y="${y}" fill="var(--text3)" font-size="3.5" text-anchor="end" dominant-baseline="middle">${v}</text>`);
    }

    const chartPoints = points.map((p, i) => ({ idx: i, value: p.value, label: p.label, total: points.length }));
    const lastVal = points[points.length - 1].value;
    const firstVal = points[0].value;
    const diff = (lastVal - firstVal).toFixed(1);
    const diffHtml = `<span style="font-size:12px;margin-left:8px;color:${parseFloat(diff) < 0 ? 'var(--success)' : parseFloat(diff) > 0 ? 'var(--danger)' : 'var(--text3)'};">${parseFloat(diff) > 0 ? '+' : ''}${diff} cm</span>`;

    chartsHtml += `
      <div class="bw-mens-chart-card">
        <div style="font-size:12px;font-weight:600;color:var(--text2);padding:12px 16px 2px;display:flex;align-items:center;gap:6px;">
          <i class="fas ${m.icon}" style="color:${m.color};font-size:11px;"></i> ${m.label}
          <span style="margin-left:auto;font-size:18px;font-weight:700;color:var(--text);">${lastVal} <span style="font-size:11px;font-weight:400;color:var(--text3);">cm</span></span>
          ${diffHtml}
        </div>
        <div style="padding:2px 16px 10px;">
          <div class="bw-mens-chart-wrap" data-points='${JSON.stringify(chartPoints)}' data-color="${m.color}" data-uid="${uid}">
            <svg viewBox="${VB_X} -4 ${VB_W} 108" style="width:100%;height:90px;" preserveAspectRatio="none">
              <defs>
                <linearGradient id="mg_${uid}" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="${m.color}" stop-opacity="0.25"/>
                  <stop offset="100%" stop-color="${m.color}" stop-opacity="0"/>
                </linearGradient>
              </defs>
              ${yLabels.join('')}
              <polygon points="${fillStr}" fill="url(#mg_${uid})"/>
              <polyline points="${lineStr}" fill="none" stroke="${m.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
            </svg>
            <div class="ap-weight-crosshair bw-mens-xhair"></div>
            <div class="ap-weight-tooltip bw-mens-tip" style="background:${m.color};box-shadow:0 2px 8px ${m.color}66;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text3);margin-top:1px;">
            <span>${points[0].label}</span>
            ${points.length > 2 ? `<span>${points[Math.floor(points.length/2)].label}</span>` : ''}
            <span>${points[points.length-1].label}</span>
          </div>
        </div>
      </div>`;
  });

  if (!chartsHtml) return '';
  return `<div class="bw-mens-charts-row">${chartsHtml}</div>`;
}

function initMensChartTooltips() {
  const VB_X = -12, VB_W = 116;

  document.querySelectorAll('.bw-mens-chart-wrap').forEach(chart => {
    const crosshair = chart.querySelector('.bw-mens-xhair');
    const tooltip = chart.querySelector('.bw-mens-tip');
    if (!crosshair || !tooltip) return;

    let points;
    try { points = JSON.parse(chart.getAttribute('data-points')); } catch(e) { return; }
    if (!points.length) return;
    const total = points[0].total || points.length;

    const dataXtoPx = (dataX, width) => ((dataX - VB_X) / VB_W) * width;
    const pxToDataX = (px, width) => (px / width) * VB_W + VB_X;

    chart.addEventListener('mousemove', (e) => {
      const rect = chart.getBoundingClientRect();
      const mouseDataX = pxToDataX(e.clientX - rect.left, rect.width);
      let nearest = points[0], minDist = Infinity;
      for (const pt of points) {
        const ptX = (pt.idx / (total - 1)) * 100;
        const dist = Math.abs(ptX - mouseDataX);
        if (dist < minDist) { minDist = dist; nearest = pt; }
      }
      const snapDataX = (nearest.idx / (total - 1)) * 100;
      const leftPx = dataXtoPx(snapDataX, rect.width);
      crosshair.style.left = leftPx + 'px';
      crosshair.style.display = 'block';
      tooltip.textContent = `${nearest.value} cm — ${nearest.label}`;
      tooltip.style.display = 'block';
      tooltip.style.left = Math.min(Math.max(leftPx, 50), rect.width - 50) + 'px';
    });

    chart.addEventListener('mouseleave', () => {
      crosshair.style.display = 'none';
      tooltip.style.display = 'none';
    });
  });
}
