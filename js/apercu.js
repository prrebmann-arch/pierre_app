// ===== ATHLETE APERÇU (OVERVIEW) =====

async function loadAthleteTabApercu() {
  const el = document.getElementById('athlete-tab-content');
  el.innerHTML = '<div class="text-center" style="padding:60px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

  const athleteId = currentAthleteId;
  const userId = currentAthleteObj?.user_id;
  if (!athleteId || !currentAthleteObj) return;

  // Load all data in parallel
  const [
    { data: athlete },
    { data: reports },
    { data: phases },
    { data: programs },
    { data: nutritionPlans },
    { data: trackingRows },
  ] = await Promise.all([
    supabaseClient.from('athletes').select('*').eq('id', athleteId).single(),
    userId
      ? supabaseClient.from('daily_reports').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(60)
      : Promise.resolve({ data: [] }),
    supabaseClient.from('roadmap_phases').select('*').eq('athlete_id', athleteId).eq('status', 'en_cours').order('position').limit(1),
    supabaseClient.from('workout_programs').select('id, nom, actif, workout_sessions(id, nom, exercices)').eq('athlete_id', athleteId).eq('actif', true).limit(1),
    supabaseClient.from('nutrition_plans').select('*').eq('athlete_id', athleteId).eq('actif', true),
    supabaseClient.from('daily_tracking').select('date, water_ml, steps').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(7),
  ]);

  const allReports = reports || [];
  const today = new Date();

  // --- Last 7 days reports ---
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = toDateStr(d);
    const r = allReports.find(rep => rep.date === ds);
    last7.push({ date: ds, day: d.toLocaleDateString('fr-FR', { weekday: 'short' }).substring(0, 3), report: r });
  }

  // --- Weight card (30 days history with hover) ---
  const last30 = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = toDateStr(d);
    const r = allReports.find(rep => rep.date === ds);
    last30.push({ date: ds, label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), report: r });
  }
  const weightData = last30.map(d => ({ weight: d.report?.weight || null, label: d.label }));
  const validWeights = weightData.filter(d => d.weight != null);
  const lastWeight = validWeights.length ? validWeights[validWeights.length - 1].weight : null;
  const weightMin = validWeights.length ? Math.min(...validWeights.map(w => w.weight)) : 0;
  const weightMax = validWeights.length ? Math.max(...validWeights.map(w => w.weight)) : 0;
  const weightRange = weightMax - weightMin || 1;

  // Build weight chart data as JSON for the interactive chart
  const weightChartData = JSON.stringify(weightData);

  // SVG viewBox constants — used by chart AND crosshair
  const VB_X = -12, VB_W = 116;

  let weightSvg;
  if (validWeights.length > 1) {
    // Padding: 5% top/bottom so the line doesn't touch edges
    const pad = 0.05;
    const yScale = (w) => 100 - ((w - weightMin) / weightRange) * (100 * (1 - 2 * pad)) - 100 * pad;

    // Build polyline segments — break line at gaps (null days)
    const segments = [];
    let currentSeg = [];
    weightData.forEach((d, i) => {
      if (d.weight == null) {
        if (currentSeg.length) { segments.push(currentSeg); currentSeg = []; }
        return;
      }
      const x = (i / 29) * 100;
      const y = yScale(d.weight);
      currentSeg.push({ x, y, xf: x.toFixed(2), yf: y.toFixed(2) });
    });
    if (currentSeg.length) segments.push(currentSeg);

    // Build SVG polylines (one per segment, so gaps don't connect)
    const polylines = segments.map(seg => {
      const pts = seg.map(p => `${p.xf},${p.yf}`).join(' ');
      const fillPts = pts + ` ${seg[seg.length - 1].xf},104 ${seg[0].xf},104`;
      return `<polygon points="${fillPts}" fill="url(#wgrad)"/>
              <polyline points="${pts}" fill="none" stroke="#B30808" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
    }).join('');

    // All points for tooltip
    const allPts = segments.flat();

    // Y axis labels
    const yLabels = [];
    const step = weightRange > 2 ? Math.ceil(weightRange / 3) : 0.5;
    for (let w = Math.floor(weightMin); w <= Math.ceil(weightMax); w += step) {
      const y = yScale(w);
      yLabels.push(`<line x1="0" y1="${y}" x2="100" y2="${y}" stroke="var(--border)" stroke-width="0.5" vector-effect="non-scaling-stroke"/>`);
      yLabels.push(`<text x="-2" y="${y}" fill="var(--text3)" font-size="3.5" text-anchor="end" dominant-baseline="middle">${w}</text>`);
    }

    // Data-points JSON for interactive crosshair
    const chartPoints = [];
    weightData.forEach((d, i) => {
      if (d.weight == null) return;
      chartPoints.push({ idx: i, weight: d.weight, label: d.label });
    });
    weightSvg = `
      <div class="ap-weight-chart" id="ap-weight-chart" data-points='${JSON.stringify(chartPoints)}' data-vbx="${VB_X}" data-vbw="${VB_W}">
        <svg viewBox="${VB_X} -4 ${VB_W} 108" style="width:100%;height:140px;" preserveAspectRatio="none">
          <defs>
            <linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#B30808" stop-opacity="0.25"/>
              <stop offset="100%" stop-color="#B30808" stop-opacity="0"/>
            </linearGradient>
          </defs>
          ${yLabels.join('')}
          ${polylines}
        </svg>
        <div class="ap-weight-crosshair" id="ap-crosshair"></div>
        <div class="ap-weight-tooltip" id="ap-weight-tooltip"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text3);margin-top:2px;">
        <span>${last30[0].label}</span>
        <span>${last30[14].label}</span>
        <span>${last30[29].label}</span>
      </div>`;
  } else {
    weightSvg = '<div style="height:120px;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:12px;">Pas assez de données</div>';
  }

  const weightDiff = validWeights.length >= 2 ? (validWeights[validWeights.length-1].weight - validWeights[0].weight).toFixed(1) : null;
  const weightDiffHtml = weightDiff ? `<span style="font-size:12px;margin-left:8px;color:${parseFloat(weightDiff) > 0 ? 'var(--danger)' : parseFloat(weightDiff) < 0 ? 'var(--success)' : 'var(--text3)'};">${parseFloat(weightDiff) > 0 ? '+' : ''}${weightDiff} kg</span>` : '';

  // --- Tracking map (shared by steps + water) ---
  const trackingMap = {};
  (trackingRows || []).forEach(t => { trackingMap[t.date] = t; });

  // --- Steps card (priority: daily_tracking > daily_reports) ---
  const stepsTarget = athlete?.pas_journalier || DEFAULT_STEPS_GOAL;
  const todayReport = last7[6]?.report;
  const todayTrackedSteps = trackingMap[toDateStr(today)]?.steps;
  const todaySteps = todayTrackedSteps || todayReport?.steps || 0;
  const stepsPct = Math.min(100, Math.round((todaySteps / stepsTarget) * 100));
  const stepsValues = last7.map(d => {
    const tracked = trackingMap[d.date]?.steps;
    return tracked || d.report?.steps || 0;
  });
  const stepsMax = Math.max(...stepsValues, stepsTarget, 1);
  const stepsChartPoints = [];
  const stepsBarData = last7.map((d, i) => {
    const v = d.report?.steps || 0;
    const h = Math.max(4, (v / stepsMax) * 60);
    const color = v >= stepsTarget ? 'var(--success)' : 'var(--primary)';
    stepsChartPoints.push({ steps: v, day: d.day });
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;">
      <div style="height:60px;display:flex;align-items:flex-end;width:100%;"><div style="width:100%;height:${h}px;background:${color};border-radius:3px 3px 0 0;opacity:${v ? 1 : 0.2};"></div></div>
      <span style="font-size:9px;color:var(--text3);">${d.day}</span>
    </div>`;
  });
  const daysReached = stepsValues.filter(v => v >= stepsTarget).length;
  const avgSteps = Math.round(stepsValues.reduce((a, b) => a + b, 0) / 7);

  // --- Sleep card ---
  const sleepValues = last7.map(d => d.report?.sleep_quality).filter(v => v != null);
  const avgSleep = sleepValues.length ? (sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length).toFixed(1) : null;
  const sleepChartPoints = [];
  const sleepBarData = last7.map(d => {
    const v = d.report?.sleep_quality;
    const h = v != null ? Math.max(4, (v / 10) * 60) : 4;
    const color = v >= 7 ? 'var(--success)' : v >= 5 ? 'var(--warning)' : v != null ? 'var(--danger)' : 'var(--bg4)';
    sleepChartPoints.push({ quality: v, day: d.day });
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;">
      <div style="height:60px;display:flex;align-items:flex-end;width:100%;"><div style="width:100%;height:${h}px;background:${color};border-radius:3px 3px 0 0;opacity:${v != null ? 1 : 0.2};"></div></div>
      <span style="font-size:9px;color:var(--text3);">${d.day}</span>
    </div>`;
  });

  // --- Water card ---
  const waterGoal = athlete?.water_goal_ml || DEFAULT_WATER_GOAL;
  const todayTracking = trackingMap[toDateStr(today)];
  const todayWater = todayTracking?.water_ml || 0;
  const waterPct = Math.min(100, Math.round((todayWater / waterGoal) * 100));
  const waterBarData = last7.map(d => {
    const t = trackingMap[d.date];
    const v = t?.water_ml || 0;
    const h = Math.max(4, (v / Math.max(waterGoal, 1)) * 60);
    const color = v >= waterGoal ? 'var(--success)' : 'var(--info, #3b82f6)';
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;">
      <div style="height:60px;display:flex;align-items:flex-end;width:100%;"><div style="width:100%;height:${h}px;background:${color};border-radius:3px 3px 0 0;opacity:${v ? 1 : 0.2};"></div></div>
      <span style="font-size:9px;color:var(--text3);">${d.day}</span>
    </div>`;
  });
  const daysWaterReached = last7.filter(d => (trackingMap[d.date]?.water_ml || 0) >= waterGoal).length;

  // --- Activity feed (last 15 reports) ---
  const activityHtml = allReports.slice(0, 15).map(r => {
    const d = new Date(r.date + 'T00:00:00');
    const timeAgo = getTimeAgo(d);
    const items = [];
    if (r.weight) items.push(`<span style="color:var(--text2);"><i class="fas fa-weight" style="color:var(--primary);margin-right:3px;"></i>${r.weight} kg</span>`);
    if (r.sessions_executed) items.push(`<span style="color:var(--text2);"><i class="fas fa-dumbbell" style="color:var(--primary);margin-right:3px;"></i>${escHtml(r.sessions_executed)}</span>`);
    if (r.session_performance) {
      const pc = r.session_performance === 'Progrès' ? 'var(--success)' : r.session_performance === 'Régression' ? 'var(--danger)' : 'var(--warning)';
      items.push(`<span style="color:${pc};"><i class="fas fa-chart-line" style="margin-right:3px;"></i>${escHtml(r.session_performance)}</span>`);
    }
    if (r.steps) items.push(`<span style="color:var(--text2);"><i class="fas fa-shoe-prints" style="color:var(--text3);margin-right:3px;"></i>${Number(r.steps).toLocaleString('fr-FR')} pas</span>`);
    if (!items.length) return '';
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-subtle);">
      <div style="width:6px;height:6px;border-radius:50%;background:var(--primary);margin-top:6px;flex-shrink:0;"></div>
      <div style="flex:1;">
        <div style="display:flex;flex-wrap:wrap;gap:10px;font-size:12px;">${items.join('')}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px;">${timeAgo}</div>
      </div>
    </div>`;
  }).filter(Boolean).join('') || '<div style="color:var(--text3);font-size:12px;text-align:center;padding:20px;">Aucune activité</div>';

  // --- Roadmap phase ---
  const activePhase = phases?.[0];
  let phaseHtml = '<div style="color:var(--text3);font-size:13px;">Aucune phase en cours</div>';
  if (activePhase) {
    const pi = typeof PROG_PHASES !== 'undefined' ? PROG_PHASES[activePhase.phase] : null;
    const color = pi ? pi.color : 'var(--primary)';
    const end = activePhase.end_date ? new Date(activePhase.end_date + 'T00:00:00') : null;
    const daysLeft = end ? Math.max(0, Math.ceil((end - today) / MS_PER_DAY)) : '?';
    phaseHtml = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></div>
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--text);">${escHtml(activePhase.name)}</div>
          <div style="font-size:11px;color:var(--text3);">${pi ? pi.label : ''} · ${daysLeft}j restants</div>
        </div>
      </div>`;
  }

  // --- Active program ---
  const activeProg = programs?.[0];
  let progHtml = '<div style="color:var(--text3);font-size:13px;">Aucun programme actif</div>';
  if (activeProg) {
    const sessions = activeProg.workout_sessions || [];
    let totalEx = 0, totalSeries = 0;
    sessions.forEach(s => {
      let exs = [];
      try { exs = typeof s.exercices === 'string' ? JSON.parse(s.exercices) : (s.exercices || []); } catch (e) {}
      exs.forEach(ex => { totalEx++; totalSeries += (parseInt(ex.series) || 0); });
    });
    progHtml = `
      <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px;">${escHtml(activeProg.nom)}</div>
      <div style="font-size:11px;color:var(--text3);">${sessions.length} séances · ${totalEx} exercices · ${totalSeries} séries</div>`;
  }

  // --- Nutrition (both training + rest) ---
  const allPlans = nutritionPlans || [];
  const trainingPlan = allPlans.find(p => p.meal_type === 'training' || p.meal_type === 'entrainement') || null;
  const restPlan = allPlans.find(p => p.meal_type === 'rest' || p.meal_type === 'repos') || null;

  const renderMiniNutri = (plan, label) => {
    if (!plan) return '';
    const cal = plan.calories_objectif || 0;
    const p = plan.proteines || 0;
    const g = plan.glucides || 0;
    const l = plan.lipides || 0;
    return `<div style="margin-bottom:6px;">
      <div style="font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">${label}</div>
      <div style="font-size:18px;font-weight:700;color:var(--text);">${cal} <span style="font-size:11px;font-weight:400;color:var(--text3);">kcal</span></div>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <span style="font-size:10px;color:var(--text2);"><span style="color:var(--success);">P</span> ${p}g</span>
        <span style="font-size:10px;color:var(--text2);"><span style="color:var(--info);">G</span> ${g}g</span>
        <span style="font-size:10px;color:var(--text2);"><span style="color:var(--warning);">L</span> ${l}g</span>
      </div>
    </div>`;
  };

  let nutriHtml;
  if (trainingPlan || restPlan) {
    nutriHtml = `${renderMiniNutri(trainingPlan, 'Jour entraînement')}${renderMiniNutri(restPlan, 'Jour repos')}`;
  } else {
    nutriHtml = '<div style="color:var(--text3);font-size:13px;">Aucun plan actif</div>';
  }

  // --- Bilan status ---
  const mondayDate = new Date(today);
  const dayOff = mondayDate.getDay() === 0 ? 6 : mondayDate.getDay() - 1;
  mondayDate.setDate(mondayDate.getDate() - dayOff);
  const mondayStr = toDateStr(mondayDate);
  const thisWeekReports = allReports.filter(r => r.date >= mondayStr);
  const bilanCount = thisWeekReports.length;
  const lastBilan = allReports[0];
  const bilanHtml = bilanCount > 0
    ? `<div style="font-size:14px;font-weight:600;color:var(--text);">${bilanCount} bilan${bilanCount > 1 ? 's' : ''} cette semaine</div>
       <div style="font-size:11px;color:var(--text3);margin-top:4px;">Dernier : ${lastBilan ? new Date(lastBilan.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}</div>`
    : `<div style="color:var(--text3);font-size:13px;">Aucun bilan cette semaine</div>
       ${lastBilan ? `<div style="font-size:11px;color:var(--text3);margin-top:4px;">Dernier : ${new Date(lastBilan.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>` : ''}`;

  // ===== RENDER =====
  el.innerHTML = `
    <div class="ap-layout">
      <div class="ap-main">
        <!-- Row 1: Weight (full width) -->
        <div class="ap-card ap-card-weight">
          <div class="ap-card-header">
            <i class="fas fa-weight"></i> Poids (30 derniers jours)
          </div>
          <div class="ap-card-body">
            <div style="display:flex;align-items:baseline;">
              <span style="font-size:28px;font-weight:700;color:var(--text);">${lastWeight ? lastWeight + ' <span style="font-size:14px;font-weight:400;color:var(--text3);">kg</span>' : '<span style="color:var(--text3);font-size:16px;">—</span>'}</span>
              ${weightDiffHtml}
            </div>
            <div style="margin-top:8px;">${weightSvg}</div>
          </div>
        </div>

        <!-- Row 2: Bilan, Steps, Sleep, Water -->
        <div class="ap-row" style="grid-template-columns:repeat(4,1fr);">
          <div class="ap-card ap-card-sm" onclick="switchAthleteTab('bilans')" style="cursor:pointer;">
            <div class="ap-card-header"><i class="fas fa-clipboard-check"></i> Bilan</div>
            <div class="ap-card-body">${bilanHtml}</div>
          </div>

          <div class="ap-card ap-card-sm">
            <div class="ap-card-header"><i class="fas fa-shoe-prints"></i> Pas</div>
            <div class="ap-card-body">
              <div style="display:flex;align-items:baseline;gap:6px;">
                <span style="font-size:22px;font-weight:700;color:var(--text);">${todaySteps ? todaySteps.toLocaleString('fr-FR') : '—'}</span>
                <span style="font-size:11px;color:var(--text3);">auj.</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
                <div style="flex:1;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;"><div style="width:${stepsPct}%;height:100%;background:${stepsPct >= 100 ? 'var(--success)' : 'var(--primary)'};border-radius:2px;"></div></div>
                <span style="font-size:10px;color:var(--text3);">${stepsPct}%</span>
              </div>
              <div class="ap-steps-chart" id="ap-steps-chart" data-points='${JSON.stringify(stepsChartPoints)}'>
                <div style="display:flex;gap:2px;align-items:flex-end;">${stepsBarData.join('')}</div>
                <div class="ap-weight-crosshair" id="ap-steps-crosshair"></div>
                <div class="ap-weight-tooltip" id="ap-steps-tooltip"></div>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text3);margin-top:4px;">
                <span>${daysReached}/7 obj.</span>
                <span>Moy: ${avgSteps.toLocaleString('fr-FR')}/j</span>
              </div>
            </div>
          </div>

          <div class="ap-card ap-card-sm">
            <div class="ap-card-header"><i class="fas fa-moon"></i> Sommeil</div>
            <div class="ap-card-body">
              <div style="font-size:22px;font-weight:700;color:var(--text);">${avgSleep ? avgSleep + '<span style="font-size:12px;font-weight:400;color:var(--text3);">/10</span>' : '<span style="color:var(--text3);font-size:14px;">—</span>'}</div>
              <div class="ap-steps-chart" id="ap-sleep-chart" data-points='${JSON.stringify(sleepChartPoints)}'>
                <div style="display:flex;gap:2px;align-items:flex-end;">${sleepBarData.join('')}</div>
                <div class="ap-weight-crosshair" id="ap-sleep-crosshair"></div>
                <div class="ap-weight-tooltip" id="ap-sleep-tooltip"></div>
              </div>
            </div>
          </div>

          <div class="ap-card ap-card-sm">
            <div class="ap-card-header"><i class="fas fa-tint"></i> Eau</div>
            <div class="ap-card-body">
              <div style="display:flex;align-items:baseline;gap:6px;">
                <span style="font-size:22px;font-weight:700;color:var(--text);">${todayWater ? (todayWater / 1000).toFixed(1) : '—'}</span>
                <span style="font-size:11px;color:var(--text3);">L auj.</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
                <div style="flex:1;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;"><div style="width:${waterPct}%;height:100%;background:${waterPct >= 100 ? 'var(--success)' : 'var(--info, #3b82f6)'};border-radius:2px;"></div></div>
                <span style="font-size:10px;color:var(--text3);">${waterPct}%</span>
              </div>
              <div style="display:flex;gap:2px;align-items:flex-end;margin-top:8px;">${waterBarData.join('')}</div>
              <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text3);margin-top:4px;">
                <span>${daysWaterReached}/7 obj.</span>
                <span>Obj: ${(waterGoal / 1000).toFixed(1)}L</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Row 3: Roadmap, Program, Nutrition -->
        <div class="ap-row">
          <div class="ap-card ap-card-sm" onclick="switchAthleteTab('roadmap')" style="cursor:pointer;">
            <div class="ap-card-header"><i class="fas fa-road"></i> Roadmap</div>
            <div class="ap-card-body">${phaseHtml}</div>
          </div>

          <div class="ap-card ap-card-sm" onclick="switchAthleteTab('training')" style="cursor:pointer;">
            <div class="ap-card-header"><i class="fas fa-dumbbell"></i> Programme actif</div>
            <div class="ap-card-body">${progHtml}</div>
          </div>

          <div class="ap-card ap-card-sm" onclick="switchAthleteTab('nutrition')" style="cursor:pointer;">
            <div class="ap-card-header"><i class="fas fa-utensils"></i> Nutrition</div>
            <div class="ap-card-body">${nutriHtml}</div>
          </div>
        </div>
      </div>

      <!-- Activity (full height right column) -->
      <div class="ap-card ap-card-activity">
        <div class="ap-card-header">
          <i class="fas fa-bolt"></i> Activité récente
        </div>
        <div class="ap-card-body ap-activity-scroll">${activityHtml}</div>
      </div>
    </div>`;

  // Interactive chart tooltips
  initWeightTooltip();
  initStepsTooltip();
  initSleepTooltip();

  // Match activity height to main column
  const mainCol = el.querySelector('.ap-main');
  const activityCard = el.querySelector('.ap-card-activity');
  if (mainCol && activityCard) {
    activityCard.style.maxHeight = mainCol.offsetHeight + 'px';
  }
}

function clampTooltip(tooltip, leftPx, containerWidth) {
  tooltip.style.left = leftPx + 'px';
  tooltip.style.display = 'block';
  tooltip.style.transform = 'translateX(-50%)';
  // After render, check if tooltip overflows
  const tw = tooltip.offsetWidth;
  const half = tw / 2;
  if (leftPx - half < 0) {
    tooltip.style.transform = 'translateX(0)';
    tooltip.style.left = '0px';
  } else if (leftPx + half > containerWidth) {
    tooltip.style.transform = 'translateX(-100%)';
    tooltip.style.left = containerWidth + 'px';
  }
}

function initWeightTooltip() {
  const chart = document.getElementById('ap-weight-chart');
  const crosshair = document.getElementById('ap-crosshair');
  const tooltip = document.getElementById('ap-weight-tooltip');
  if (!chart || !crosshair || !tooltip) return;

  let points;
  try { points = JSON.parse(chart.getAttribute('data-points')); } catch (e) { return; }
  if (!points.length) return;

  // ViewBox offset: SVG data x=0..100 is mapped inside viewBox starting at VB_X with width VB_W
  const vbx = parseFloat(chart.getAttribute('data-vbx')) || -12;
  const vbw = parseFloat(chart.getAttribute('data-vbw')) || 116;

  // Convert SVG data-x (0-100) to pixel position in container
  const dataXtoPx = (dataX, width) => ((dataX - vbx) / vbw) * width;
  // Convert pixel position to SVG data-x
  const pxToDataX = (px, width) => (px / width) * vbw + vbx;

  chart.addEventListener('mousemove', (e) => {
    const rect = chart.getBoundingClientRect();
    const mouseDataX = pxToDataX(e.clientX - rect.left, rect.width);

    // Find nearest data point by SVG x position
    let nearest = points[0];
    let minDist = Infinity;
    for (const pt of points) {
      const ptX = (pt.idx / 29) * 100;
      const dist = Math.abs(ptX - mouseDataX);
      if (dist < minDist) { minDist = dist; nearest = pt; }
    }

    // Position crosshair at nearest point — properly mapped
    const snapDataX = (nearest.idx / 29) * 100;
    const leftPx = dataXtoPx(snapDataX, rect.width);
    crosshair.style.left = leftPx + 'px';
    crosshair.style.display = 'block';

    // Position tooltip (clamped to container edges)
    tooltip.textContent = `${nearest.weight} kg — ${nearest.label}`;
    clampTooltip(tooltip, leftPx, rect.width);
  });

  chart.addEventListener('mouseleave', () => {
    crosshair.style.display = 'none';
    tooltip.style.display = 'none';
  });
}

function initStepsTooltip() {
  const chart = document.getElementById('ap-steps-chart');
  const crosshair = document.getElementById('ap-steps-crosshair');
  const tooltip = document.getElementById('ap-steps-tooltip');
  if (!chart || !crosshair || !tooltip) return;

  let points;
  try { points = JSON.parse(chart.getAttribute('data-points')); } catch (e) { return; }
  if (!points.length) return;

  chart.addEventListener('mousemove', (e) => {
    const rect = chart.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;

    // 7 bars evenly spaced — find nearest
    const idx = Math.max(0, Math.min(6, Math.round(xPct * 6)));
    const pt = points[idx];

    // Crosshair at center of that bar
    const centerX = ((idx + 0.5) / 7) * rect.width;
    crosshair.style.left = centerX + 'px';
    crosshair.style.display = 'block';

    // Tooltip (clamped)
    tooltip.textContent = `${pt.steps.toLocaleString('fr-FR')} pas — ${pt.day}`;
    clampTooltip(tooltip, centerX, rect.width);
  });

  chart.addEventListener('mouseleave', () => {
    crosshair.style.display = 'none';
    tooltip.style.display = 'none';
  });
}

function initSleepTooltip() {
  const chart = document.getElementById('ap-sleep-chart');
  const crosshair = document.getElementById('ap-sleep-crosshair');
  const tooltip = document.getElementById('ap-sleep-tooltip');
  if (!chart || !crosshair || !tooltip) return;

  let points;
  try { points = JSON.parse(chart.getAttribute('data-points')); } catch (e) { return; }
  if (!points.length) return;

  chart.addEventListener('mousemove', (e) => {
    const rect = chart.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const idx = Math.max(0, Math.min(6, Math.round(xPct * 6)));
    const pt = points[idx];

    const centerX = ((idx + 0.5) / 7) * rect.width;
    crosshair.style.left = centerX + 'px';
    crosshair.style.display = 'block';

    tooltip.textContent = pt.quality != null ? `${pt.quality}/10 — ${pt.day}` : `— ${pt.day}`;
    clampTooltip(tooltip, centerX, rect.width);
  });

  chart.addEventListener('mouseleave', () => {
    crosshair.style.display = 'none';
    tooltip.style.display = 'none';
  });
}
